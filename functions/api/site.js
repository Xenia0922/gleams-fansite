/**
 * GET  /api/site — 公开：返回站点可编辑内容（关于页文字、特典规则/图、各平台链接）
 * PUT  /api/site — 管理：更新部分字段（upsert），需 ADMIN_CODE
 *
 * 表 site_config 为 key-value，首次请求自动建表并播种（来自 site.json + 关于/特典 硬编码文案）。
 */

import { adminOk, json, withTable } from '../_shared.js';

const DDL = `CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);`;

// 允许的字段（白名单，防止写入无关 key）
const ALLOWED = [
  'about_worldview', 'about_intro',
  'weidian', 'staff_qq',
  'tokuten_rules', 'tokuten_images',
  'featured_square',
  'weibo', 'weibo_name', 'weibo_desc',
  'xiaohongshu', 'douyin',
  'hero_config',
];

const SEED = {
  about_worldview: '「在星界尽头，存在着一座神秘王国，由水晶支撑着整个王国的运转。有天能蚕食人间星光的阴霾突然降临，王国赖以生存的水晶随之日渐暗淡无光。正是在此存亡之际，来自不同城堡的公主，在命运的指引下相聚于此，公主们开始踏上寻找名为『Gleams』的能量宝石来守护他们的世界。」',
  about_intro: 'Gleams 是一支来自广西南宁的地下偶像团体。三位成员以「公主」的身份活跃于南宁及两广地区的 Livehouse 和动漫展会。',
  weidian: 'Gleams小铺',
  staff_qq: '3838067250',
  tokuten_rules: JSON.stringify([
    '特典规则以官方微博 @Gleams_Official 发布为准',
    '团切仅在个人队列开始前售卖10分钟',
    '电切可通过官方微店预约',
    '详细规则请关注微博获取最新信息',
  ]),
  tokuten_images: JSON.stringify([
    '/images/tokuten/tokuten_detail_0.webp',
    '/images/tokuten/tokuten_detail_1.webp',
    '/images/tokuten/tokuten_detail_2.webp',
  ]),
  weibo: 'https://weibo.com/u/7972735157',
  weibo_name: '@Gleams_Official',
  weibo_desc: '非官方粉丝应援站 ✨',
  xiaohongshu: 'https://www.xiaohongshu.com/user/profile/641e8c220000000012011e4a',
  douyin: 'https://v.douyin.com/hAh667o1k14/',
  hero_config: JSON.stringify({
    title: 'Gleams',
    subtitle: '广西南宁公主风王道系地下偶像团体',
    logo: '/logo.png',
    bg: '/hero-bg.webp',
  }),
};

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM site_config').all();
    if (results[0] && results[0].c === 0) {
      for (const [k, v] of Object.entries(SEED)) {
        await env.DB.prepare('INSERT INTO site_config (key, value) VALUES (?, ?)').bind(k, v).run();
      }
    }
  } catch (e) { console.error('[site] seed failed:', e.message); }
}

const JSON_KEYS = new Set(['tokuten_rules', 'tokuten_images', 'featured_square', 'hero_config']);

async function loadConfig(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
  const cfg = {};
  for (const r of results) {
    cfg[r.key] = JSON_KEYS.has(r.key) ? safeParse(r.value, r.key === 'hero_config' ? {} : []) : r.value;
    // 防御旧 bug 数据：hero_config 曾被 updateConfig 存为 '[]'，强制转为 {}
    if (r.key === 'hero_config' && Array.isArray(cfg[r.key])) cfg[r.key] = {};
  }
  return cfg;
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export async function onRequest(context) {
  const { request, env } = context;
  try { await ensureTable(env); } catch (e) { console.error('[site] ensureTable error:', e.message); }

  if (request.method === 'GET') return withTable(env, ensureTable, async () => json(await loadConfig(env)));
  if (request.method === 'PUT') return withTable(env, ensureTable, () => updateConfig(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function updateConfig(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const b = await request.json();
    const entries = Object.entries(b).filter(([k]) => ALLOWED.includes(k));
    if (entries.length === 0) return json({ error: '无有效字段' }, 400);
    for (const [k, v] of entries) {
      // JSON 字段：tokuten_rules/tokuten_images/featured_square 是数组，hero_config 是对象；
      // 直接 stringify 原值（null 兜底为空数组/空对象），不再强制转数组（否则 hero_config 对象会变成 []）
      const val = JSON_KEYS.has(k)
        ? JSON.stringify(v == null ? (k === 'hero_config' ? {} : []) : v)
        : String(v == null ? '' : v).slice(0, 2000);
      await env.DB.prepare('INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
        .bind(k, val, val).run();
    }
    return json({ ok: true, cfg: await loadConfig(env) });
  } catch (e) { return json({ error: e.message }, 500); }
}

