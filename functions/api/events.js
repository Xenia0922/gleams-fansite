/**
 * GET  /api/events          — 公开：全部日程（按日期降序）
 * GET  /api/events?id=xxx   — 公开：单条日程（含 body 日程详情）
 * GET  /api/events?all=1    — 管理：同公开（保留接口一致），需 ADMIN_CODE
 * POST /api/events          — 新建，需 ADMIN_CODE（id 必填）
 * PUT  /api/events          — 修改，需 ADMIN_CODE
 * DELETE /api/events        — 删除，需 ADMIN_CODE
 *
 * 表 events 由本接口首次请求时自动创建并播种（无需手动 migration）。
 * body 字段存「日程详情」Markdown 正文。
 */

const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  venue TEXT,
  performers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  image TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);`;

// 种子：来自 src/data/schedule.json 当前内容
// image 来自旧 news 的 frontmatter 封面图（/images/events/live-*.webp），合并时一并迁回
const SEED = [
  { id: 'live-2026-01-25', date: '2026-01-25', time: '', title: 'Sunday Candy Vol.03（广州首演）', venue: '广州', performers: ['hakusai','kumo','yuzi','huangyuyu'], status: 'past', image: '/images/events/live-2026-01-25.webp' },
  { id: 'live-2026-01-31', date: '2026-01-31', time: '12:40', title: '第一届 Comic Expo 国风动漫展（出道）', venue: '南宁北投明月荟（西乡塘区）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-01-31.webp' },
  { id: 'live-2026-02-15', date: '2026-02-15', time: '', title: '桂平·ACG第七届动漫新年盛典', venue: '桂平', performers: ['hakusai','kumo','yuzi','huangyuyu'], status: 'past', image: '/images/events/live-2026-02-15.webp' },
  { id: 'live-2026-02-23', date: '2026-02-23', time: '', title: 'Akatsuki Idol Party Vol.24 ～アイドル新年会～', venue: '南宁·候朋现场 HOPELIVE（中山路万象汇）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-02-23.webp' },
  { id: 'live-2026-03-14', date: '2026-03-14', time: '12:25', title: 'SUMMERL∞P MINI FES — 白情与公主有个约会', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-03-14.webp' },
  { id: 'live-2026-03-28', date: '2026-03-28', time: '13:30', title: 'Akatsuki Idol Party Vol.25', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-03-28.webp' },
  { id: 'live-2026-04-26', date: '2026-04-26', time: '', title: 'Puppy Club First Anniversary', venue: '南宁·民歌湖广场福馆 Full house', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-04-26.webp' },
  { id: 'live-2026-05-16', date: '2026-05-16', time: '14:00', title: '五碳糖 FES3.0 ～初夏の宴～', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-05-16.webp' },
  { id: 'live-2026-07-04', date: '2026-07-04', time: '', title: 'Nez Fes Vol.1 -初晴の約束 真夏の約束-（白菜生日SP）', venue: '南宁·PinkNoises Live（会展动漫城）', performers: ['hakusai','kumo','yuzi'], status: 'past', image: '/images/events/live-2026-07-04.webp' },
];

// 旧 news/*.md 正文迁移：key = 事件 id，value = Markdown 正文
// 仅回填到 body 为空的行，不会覆盖后台已编辑的内容。
const SEED_BODIES = {
  'live-2026-01-25': `## 01.25 Sunday Candy Vol.03 活动结算

【Sunday Candy Vol.03】广州首演！

**歌单：**
00. SE - Gleams
01. 《私、シンデレラ》- ワガママなラストノート
02. 《可愛いって言われたい》- 高嶺のなでしこ
MC
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子、黄鱼鱼`,
  'live-2026-01-31': `## 01.31 第一届 Comic Expo 国风动漫展 活动结算

【南宁·第一届 Comic Expo 国风动漫展】

**歌单：**
00. SE - Gleams
01. 《可愛いって言われたい》- 高嶺のなでしこ
02. 《心型病毒》- TSH48
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子`,
  'live-2026-02-15': `## 02.15 桂平·ACG 第七届动漫新年盛典 活动结算

年前最后一场封箱演出，每张特典卷获成员手写新年祝福贺卡。

**歌单：**
00. SE - Gleams
01. 《下课铃声》- SNH48
02. 《心型病毒》- TSH48
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：白菜、云团、柚子、黄鱼鱼`,
  'live-2026-02-23': `## 02.23 Akatsuki Idol Party Vol.24 ~ アイドル新年会 ~ 活动结算

2026年开箱演出！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：💛💙💚`,
  'live-2026-03-14': `## 03.14 SUMMERL∞P MINI FES 活动结算

白色情人节特别公演「白情与公主有个约会」！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls

👑 成员：💛💙💚`,
  'live-2026-03-28': `## 03.28 Akatsuki Idol Party Vol.25 活动结算

JK 盛夏服新衣装披露！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls
04. 《下课铃声》- SNH48

👑 成员：💛💙💚`,
  'live-2026-04-26': `## 04.26 Puppy Club First Anniversary 活动结算

西芭公式服1.0！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《Summer Darling》- 昼食彼女 Lunch Girls
04. 《下课铃声》- SNH48

👑 成员：💛💙💚`,
  'live-2026-05-16': `## 05.16 五碳糖 FES3.0 ~初夏の宴~ 活动结算

女仆装主题演出！

**歌单：**
00. SE - Gleams
01. 《ロマンティックガール》- ZUTTOMOTTO
02. 《可愛いって言われたい》- 高嶺のなでしこ
03. 《下课铃声》- SNH48
04. 《Kawaii Kaiwai》- Piki

👑 成员：💛💙💚`,
  'live-2026-07-04': `## 07.04 Nez Fes Vol.1 -初晴の約束 真夏の約束- 活动结算

感谢大家在台风天也努力奔赴来为我们白菜 Hakusai 庆祝生日🎂，大家都辛苦了！

新衣装「白雪云」首次披露，蓝白色赛高！

👑 成员：💛💙💚`,
};

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  // 旧表补 body 列（部署前已存在 events 表时）
  try {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN body TEXT').run();
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').all();
    if (results[0] && results[0].c === 0) {
      for (const e of SEED) {
        await env.DB
          .prepare(
            `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(e.id, e.date, e.time || '', e.title, e.venue || '', JSON.stringify(e.performers || []), e.status || 'past', '', SEED_BODIES[e.id] || '', new Date().toISOString())
          .run();
      }
    } else {
      // 已存在数据的表：回填旧 news 的 image 与 body（仅当对应字段为空，不覆盖后台已编辑内容）
      // image 回填：来自旧 news 封面图（/images/events/live-*.webp）
      const { results: emptyImg } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE image IS NULL OR image = ''").all();
      if (emptyImg[0] && emptyImg[0].c > 0) {
        for (const e of SEED) {
          if (!e.image) continue;
          await env.DB
            .prepare('UPDATE events SET image = ? WHERE id = ? AND (image IS NULL OR image = \'\')')
            .bind(e.image, e.id)
            .run();
        }
      }
      // body 回填：仅当 body 为空
      const { results: emptyRows } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE body IS NULL OR body = ''").all();
      if (emptyRows[0] && emptyRows[0].c > 0) {
        for (const [id, body] of Object.entries(SEED_BODIES)) {
          await env.DB
            .prepare('UPDATE events SET body = ? WHERE id = ? AND (body IS NULL OR body = \'\')')
            .bind(body, id)
            .run();
        }
      }
    }
  } catch (e) { console.error('[events] seed/backfill failed:', e.message); }
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

  // 单条查询（含 body 日程详情）
  const id = url.searchParams.get('id');
  if (id) {
    const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).all();
    if (!results.length) return json({ error: '未找到该日程' }, 404);
    return json(parseEvent(results[0]));
  }

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
        `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(id, String(b.date), String(b.time || '').slice(0, 10), title, String(b.venue || '').slice(0, 80),
        JSON.stringify(performers), b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming',
        String(b.image || '').slice(0, 255), String(b.body || '').slice(0, 20000), new Date().toISOString())
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
    if (b.image !== undefined) { sets.push('image = ?'); binds.push(String(b.image || '').slice(0, 255)); }
    if (b.body !== undefined) { sets.push('body = ?'); binds.push(String(b.body || '').slice(0, 20000)); }
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
