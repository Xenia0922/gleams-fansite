/**
 * GET  /api/recruits        — 公开：返回当前有效招募（enabled=1 且未过期），按 sort_order 升序，取首条
 * GET  /api/recruits?all=1 — 管理：返回全量（含禁用/过期），需 ADMIN_CODE
 * POST /api/recruits        — 新建，需 ADMIN_CODE
 * PUT  /api/recruits        — 修改，需 ADMIN_CODE
 * DELETE /api/recruits      — 删除，需 ADMIN_CODE
 *
 * 表 recruits 由本接口在首次请求时自动创建（CREATE TABLE IF NOT EXISTS），
 * 无需在 Cloudflare 控制台手动执行 migration。
 */

const DDL = `CREATE TABLE IF NOT EXISTS recruits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT '查看详情 →',
  cta_url TEXT NOT NULL,
  deadline TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`;

export async function onRequest(context) {
  const { request, env } = context;
  try { await env.DB.exec(DDL); } catch (e) { /* 表已存在，忽略 */ }
  // 旧表补列（CREATE TABLE 不会自动加字段）
  try { await env.DB.exec('ALTER TABLE recruits ADD COLUMN subtitle TEXT'); } catch (e) { /* 已存在则忽略 */ }
  // 空表时写入默认招募，部署后即可展示，无需手动录入
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM recruits').all();
    if (results[0] && results[0].c === 0) {
      await env.DB
        .prepare(
          `INSERT INTO recruits (title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          '研修生招募',
          '公主风王道系地下偶像团体',
          '微博转发关注抽 52 元偶活基金',
          '查看详情 →',
          'https://weibo.com/7972735157/R7KNSzPdt',
          '2026-08-10',
          1,
          0,
          new Date().toISOString()
        )
        .run();
    }
  } catch (e) { /* 种子失败不阻断 */ }

  if (request.method === 'GET') return listRecruits(request, env);
  if (request.method === 'POST') return createRecruit(request, env);
  if (request.method === 'PUT') return updateRecruit(request, env);
  if (request.method === 'DELETE') return deleteRecruit(request, env);
  return new Response('Method not allowed', { status: 405 });
}

function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

async function listRecruits(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';

  if (all) {
    if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
    const { results } = await env.DB
      .prepare('SELECT * FROM recruits ORDER BY sort_order ASC, id DESC')
      .all();
    return json(results);
  }

  // 公开：有效且未过期（按北京时间粗筛，前端再做精确判定）
  const { results } = await env.DB
    .prepare(
      `SELECT id, title, subtitle, body, cta_text, cta_url, deadline
       FROM recruits
       WHERE enabled = 1 AND (deadline IS NULL OR deadline >= date('now', '+8 hours'))
       ORDER BY sort_order ASC, id DESC LIMIT 10`
    )
    .all();
  return json(results);
}

async function createRecruit(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const b = await request.json();
    const title = String(b.title || '').trim().slice(0, 60);
    const subtitle = b.subtitle ? String(b.subtitle).trim().slice(0, 60) : '';
    const body = String(b.body || '').trim().slice(0, 200);
    const cta_text = String(b.cta_text || '查看详情 →').trim().slice(0, 40);
    const cta_url = String(b.cta_url || '').trim().slice(0, 500);
    const deadline = b.deadline ? String(b.deadline).slice(0, 10) : null;
    const enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
    const sort_order = Number.isFinite(+b.sort_order) ? +b.sort_order : 0;

    if (!title || !body || !cta_url) return json({ error: '标题 / 正文 / 链接必填' }, 400);
    if (!/^https?:\/\//.test(cta_url)) return json({ error: '链接需以 http(s):// 开头' }, 400);

    const info = await env.DB
      .prepare(
        `INSERT INTO recruits (title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, new Date().toISOString())
      .run();

    return json({ ok: true, id: info.meta ? info.meta.last_row_id : null });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function updateRecruit(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const b = await request.json();
    const id = +b.id;
    if (!id) return json({ error: '缺少 id' }, 400);

    const sets = [];
    const binds = [];
    if (b.title !== undefined) { sets.push('title = ?'); binds.push(String(b.title).trim().slice(0, 60)); }
    if (b.subtitle !== undefined) { sets.push('subtitle = ?'); binds.push(String(b.subtitle).trim().slice(0, 60)); }
    if (b.body !== undefined) { sets.push('body = ?'); binds.push(String(b.body).trim().slice(0, 200)); }
    if (b.cta_text !== undefined) { sets.push('cta_text = ?'); binds.push(String(b.cta_text).trim().slice(0, 40)); }
    if (b.cta_url !== undefined) {
      const u = String(b.cta_url).trim().slice(0, 500);
      if (u && !/^https?:\/\//.test(u)) return json({ error: '链接需以 http(s):// 开头' }, 400);
      sets.push('cta_url = ?'); binds.push(u);
    }
    if (b.deadline !== undefined) { sets.push('deadline = ?'); binds.push(b.deadline ? String(b.deadline).slice(0, 10) : null); }
    if (b.enabled !== undefined) { sets.push('enabled = ?'); binds.push(b.enabled === false || b.enabled === 0 ? 0 : 1); }
    if (b.sort_order !== undefined) { sets.push('sort_order = ?'); binds.push(Number.isFinite(+b.sort_order) ? +b.sort_order : 0); }

    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE recruits SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteRecruit(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400);
    await env.DB.prepare('DELETE FROM recruits WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
