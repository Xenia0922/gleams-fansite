/**
 * GET  /api/events          — 公开：全部日程（按日期降序）
 * GET  /api/events?id=xxx   — 公开：单条日程（含 body 日程详情）
 * GET  /api/events?all=1    — 管理：同公开（保留接口一致），需 ADMIN_CODE
 * POST /api/events          — 新建，需 ADMIN_CODE（id 必填）
 * PUT  /api/events          — 修改，需 ADMIN_CODE
 * DELETE /api/events        — 删除，需 ADMIN_CODE
 *
 * 表 events 由 ensureEvents 首次请求时自动创建并播种（无需手动 migration）。
 * ensureEvents 定义在 ../_seed.js，与 _middleware.js 共用同一份真实种子数据，
 * 杜绝曾经 schedule.js 写入虚构标题的问题。
 * body 字段存「日程详情」Markdown 正文。
 */

import { adminOk, adminGuard, json, withTable, handlePreFlight, effectiveStatus } from '../_shared.js';
import { ensureEvents } from '../_seed.js';

function parseEvent(row) {
  if (!row) return row;
  try {
    row.performers = JSON.parse(row.performers || '[]');
  } catch {
    row.performers = [];
  }
  // 有效状态：若设置了 end_time 且已过期，自动判为 'past'（像广告到期自动结束）
  row.status = effectiveStatus(row);
  return row;
}

/**
 * 后台改 events 后触发 Cloudflare Pages 重新构建，让静态构建种子
 * （日程详情页 / 首屏）从 D1 拉取最新数据、常新。
 * 纯 fire-and-forget：未配置 BUILD_HOOK_URL、或 fetch 失败都不影响本次写操作响应，
 * 绝不抛到边缘（避免 1101/500）。BUILD_HOOK_URL 在 CF Pages 后台「部署钩子」生成并配置。
 */
function triggerDeploy(env) {
  const hook = env && env.BUILD_HOOK_URL;
  if (!hook) return;
  try {
    const p = fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'admin-events-mutation' }),
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {
    /* 吞掉，不阻塞响应 */
  }
}

export async function onRequest(context) {
  const pre = handlePreFlight(context);
  if (pre) return pre;
  const { request, env } = context;
  try {
    await ensureEvents(env);
  } catch (e) {
    console.error('[events] ensureEvents error:', e.message);
  }

  if (request.method === 'GET') return withTable(env, ensureEvents, () => listEvents(request, env));
  if (request.method === 'POST') return withTable(env, ensureEvents, () => createEvent(request, env));
  if (request.method === 'PUT') return withTable(env, ensureEvents, () => putEvent(request, env));
  if (request.method === 'DELETE') return withTable(env, ensureEvents, () => deleteEvent(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function listEvents(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';

  // 单条查询（含 body 日程详情）
  const id = url.searchParams.get('id');
  if (id) {
    const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).all();
    if (!results.length) return json({ error: '未找到该日程' }, 404, { request, env });
    return json(parseEvent(results[0]), 200, { request, env });
  }

  if (all && !adminOk(request, env)) return json({ error: '无权限' }, 403, { request, env });
  // 列表接口不查 body（最长 20000 字），节省带宽；单条查询（带 id）才返回 body
  const { results } = await env.DB.prepare(
    'SELECT id,date,time,title,venue,city,performers,status,image,end_time FROM events ORDER BY date DESC, id DESC'
  ).all();
  results.forEach(parseEvent);
  return json(results, 200, { request, env });
}

async function createEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    const title = String(b.title || '').trim().slice(0, 80);
    if (!id || !title) return json({ error: 'id 与标题必填' }, 400, { request, env });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) return json({ error: '日期格式应为 YYYY-MM-DD' }, 400, { request, env });
    const performers = Array.isArray(b.performers) ? b.performers : [];
    await env.DB
      .prepare(
        `INSERT INTO events (id,date,time,title,venue,city,performers,status,image,body,end_time,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        id,
        String(b.date),
        String(b.time || '').slice(0, 10),
        title,
        String(b.venue || '').slice(0, 80),
        String(b.city || '').slice(0, 40),
        JSON.stringify(performers),
        b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming',
        String(b.image || '').slice(0, 255),
        String(b.body || '').slice(0, 20000),
        String(b.end_time || '').slice(0, 16),
        new Date().toISOString()
      )
      .run();
    triggerDeploy(env);
    return json({ ok: true, id }, 200, { request, env });
  } catch (e) {
    if (/UNIQUE|primary key/i.test(e.message || '')) return json({ error: '该 id 已存在' }, 409, { request, env });
    return json({ error: e.message }, 500, { request, env });
  }
}

async function putEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    if (!id) return json({ error: '缺少 id' }, 400, { request, env });
    const sets = [];
    const binds = [];
    if (b.title !== undefined) {
      sets.push('title = ?');
      binds.push(String(b.title).trim().slice(0, 80));
    }
    if (b.date !== undefined) {
      sets.push('date = ?');
      binds.push(String(b.date).slice(0, 10));
    }
    if (b.time !== undefined) {
      sets.push('time = ?');
      binds.push(String(b.time).slice(0, 10));
    }
    if (b.venue !== undefined) {
      sets.push('venue = ?');
      binds.push(String(b.venue || '').slice(0, 80));
    }
    if (b.city !== undefined) {
      sets.push('city = ?');
      binds.push(String(b.city || '').slice(0, 40));
    }
    if (b.end_time !== undefined) {
      sets.push('end_time = ?');
      binds.push(String(b.end_time || '').slice(0, 16));
    }
    if (b.performers !== undefined) {
      sets.push('performers = ?');
      binds.push(JSON.stringify(Array.isArray(b.performers) ? b.performers : []));
    }
    if (b.status !== undefined) {
      sets.push('status = ?');
      binds.push(b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming');
    }
    if (b.image !== undefined) {
      sets.push('image = ?');
      binds.push(String(b.image || '').slice(0, 255));
    }
    if (b.body !== undefined) {
      sets.push('body = ?');
      binds.push(String(b.body || '').slice(0, 20000));
    }
    if (sets.length === 0) return json({ ok: true }, 200, { request, env });
    binds.push(id);
    await env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    triggerDeploy(env);
    return json({ ok: true }, 200, { request, env });
  } catch (e) {
    return json({ error: e.message }, 500, { request, env });
  }
}

async function deleteEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400, { request, env });
    await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    triggerDeploy(env);
    return json({ ok: true }, 200, { request, env });
  } catch (e) {
    return json({ error: e.message }, 500, { request, env });
  }
}
