/**
 * GET  /api/events        — 公开：全部日程（按日期降序），客户端自行分组
 * GET  /api/events?all=1 — 管理：同公开（当前无隐藏字段，保留接口一致），需 ADMIN_CODE
 * POST /api/events        — 新建，需 ADMIN_CODE（id 必填）
 * PUT  /api/events        — 修改，需 ADMIN_CODE
 * DELETE /api/events      — 删除，需 ADMIN_CODE
 *
 * 表 events 由本接口首次请求时自动创建并播种（无需手动 migration）。
 */

const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  venue TEXT,
  performers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TEXT NOT NULL
);`;

// 种子：来自 src/data/schedule.json 当前内容
const SEED = [
  { id: 'live-2026-01-25', date: '2026-01-25', time: '', title: 'Sunday Candy Vol.03（广州首演）', venue: '广州', performers: ['hakusai','kumo','yuzi','huangyuyu'], status: 'past' },
  { id: 'live-2026-01-31', date: '2026-01-31', time: '12:40', title: '第一届 Comic Expo 国风动漫展（出道）', venue: '南宁北投明月荟（西乡塘区）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-02-15', date: '2026-02-15', time: '', title: '桂平·ACG第七届动漫新年盛典', venue: '桂平', performers: ['hakusai','kumo','yuzi','huangyuyu'], status: 'past' },
  { id: 'live-2026-02-23', date: '2026-02-23', time: '', title: 'Akatsuki Idol Party Vol.24 ～アイドル新年会～', venue: '南宁·候朋现场 HOPELIVE（中山路万象汇）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-03-14', date: '2026-03-14', time: '12:25', title: 'SUMMERL∞P MINI FES — 白情与公主有个约会', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-03-28', date: '2026-03-28', time: '13:30', title: 'Akatsuki Idol Party Vol.25', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-04-26', date: '2026-04-26', time: '', title: 'Puppy Club First Anniversary', venue: '南宁·民歌湖广场福馆 Full house', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-05-16', date: '2026-05-16', time: '14:00', title: '五碳糖 FES3.0 ～初夏の宴～', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
  { id: 'live-2026-07-04', date: '2026-07-04', time: '', title: 'Nez Fes Vol.1 -初晴の約束 真夏の約束-（白菜生日SP）', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past' },
];

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').all();
    if (results[0] && results[0].c === 0) {
      for (const e of SEED) {
        await env.DB
          .prepare(
            `INSERT INTO events (id,date,time,title,venue,performers,status,created_at)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          .bind(e.id, e.date, e.time || '', e.title, e.venue || '', JSON.stringify(e.performers || []), e.status || 'past', new Date().toISOString())
          .run();
      }
    }
  } catch (e) { console.error('[events] seed failed:', e.message); }
}

async function withTable(env, fn) {
  try { return await fn(); }
  catch (e) {
    if (/no such table/i.test(e.message || '')) { await ensureTable(env); return await fn(); }
    throw e;
  }
}

function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

function parseEvent(row) {
  if (!row) return row;
  try { row.performers = JSON.parse(row.performers || '[]'); } catch { row.performers = []; }
  return row;
}

export async function onRequest(context) {
  const { request, env } = context;
  try { await ensureTable(env); } catch (e) { console.error('[events] ensureTable error:', e.message); }

  if (request.method === 'GET') return withTable(env, () => listEvents(request, env));
  if (request.method === 'POST') return withTable(env, () => createEvent(request, env));
  if (request.method === 'PUT') return withTable(env, () => putEvent(request, env));
  if (request.method === 'DELETE') return withTable(env, () => deleteEvent(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function listEvents(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';
  if (all && !adminOk(request, env)) return json({ error: '无权限' }, 403);
  const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY date DESC, id DESC').all();
  results.forEach(parseEvent);
  return json(results);
}

async function createEvent(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    const title = String(b.title || '').trim().slice(0, 80);
    if (!id || !title) return json({ error: 'id 与标题必填' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) return json({ error: '日期格式应为 YYYY-MM-DD' }, 400);
    const performers = Array.isArray(b.performers) ? b.performers : [];
    await env.DB
      .prepare(
        `INSERT INTO events (id,date,time,title,venue,performers,status,created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .bind(id, String(b.date), String(b.time || '').slice(0, 10), title, String(b.venue || '').slice(0, 80),
        JSON.stringify(performers), b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming', new Date().toISOString())
      .run();
    return json({ ok: true, id });
  } catch (e) {
    if (/UNIQUE|primary key/i.test(e.message || '')) return json({ error: '该 id 已存在' }, 409);
    return json({ error: e.message }, 500);
  }
}

async function putEvent(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    if (!id) return json({ error: '缺少 id' }, 400);
    const sets = [];
    const binds = [];
    if (b.title !== undefined) { sets.push('title = ?'); binds.push(String(b.title).trim().slice(0, 80)); }
    if (b.date !== undefined) { sets.push('date = ?'); binds.push(String(b.date).slice(0, 10)); }
    if (b.time !== undefined) { sets.push('time = ?'); binds.push(String(b.time).slice(0, 10)); }
    if (b.venue !== undefined) { sets.push('venue = ?'); binds.push(String(b.venue).slice(0, 80)); }
    if (b.performers !== undefined) { sets.push('performers = ?'); binds.push(JSON.stringify(Array.isArray(b.performers) ? b.performers : [])); }
    if (b.status !== undefined) { sets.push('status = ?'); binds.push(b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming'); }
    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return json({ ok: true });
  } catch (e) { return json({ error: e.message }, 500); }
}

async function deleteEvent(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400);
    await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) { return json({ error: e.message }, 500); }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
