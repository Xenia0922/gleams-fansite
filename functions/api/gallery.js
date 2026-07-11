/**
 * /api/gallery — 照片画廊页数据聚合（公开）
 *
 *   GET    /api/gallery
 *           → { members:[{id,name,emoji,color,gallery}], extras:[{id,url,caption}], isAdmin }
 *             members 为 status='active' 的成员及其 9 宫格（来自 D1 members.gallery）
 *             extras  为后台单独管理的「画廊页照片」（gallery_extras 表），与成员简介互不干扰
 *             isAdmin 仅当请求带正确 x-admin-code 时为 true（供前台决定是否显示增删控件）
 *
 *   POST   /api/gallery  （需 ADMIN_CODE） body { url, caption? } → 新增一张画廊页照片
 *   DELETE /api/gallery?id=xxx （需 ADMIN_CODE） → 删除一张画廊页照片
 *
 * 表 gallery_extras 由本接口首次请求时自动创建（无需手动 migration）。
 */

const DDL = `CREATE TABLE IF NOT EXISTS gallery_extras (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  caption TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

function parseGallery(v) {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    await ensureTable(env);
  } catch (e) {
    console.error('[gallery] ensureTable:', e.message);
  }

  // ---- 公开读取：聚合成员 9 宫格 + 后台独立照片 ----
  if (request.method === 'GET') {
    try {
      const { results: mres } = await env.DB.prepare(
        "SELECT id,name,emoji,color,gallery FROM members WHERE status='active' ORDER BY sort_order ASC, id ASC"
      ).all();
      const members = (mres || []).map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        color: r.color || '#e83e8c',
        gallery: parseGallery(r.gallery),
      }));

      const { results: eres } = await env.DB.prepare(
        'SELECT id,url,caption FROM gallery_extras ORDER BY sort ASC, created_at ASC'
      ).all();
      const extras = (eres || []).map((e) => ({ id: e.id, url: e.url, caption: e.caption || '' }));

      return json({ members, extras, isAdmin: adminOk(request, env) });
    } catch (e) {
      return json({ members: [], extras: [], isAdmin: false, error: e.message }, 500);
    }
  }

  // ---- 以下均需管理员暗号 ----
  if (request.method === 'POST') {
    if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
    try {
      const b = await request.json();
      const url = String(b.url || '').trim();
      if (!url) return json({ error: '缺少图片地址' }, 400);
      if (!/^\/api\/photos|^https?:\/\//.test(url)) {
        return json({ error: '仅支持本站图片（/api/photos?...）或 http(s) 链接' }, 400);
      }
      const id = crypto.randomUUID();
      const sort = Number.isFinite(+b.sort) ? +b.sort : 0;
      await env.DB.prepare(
        'INSERT INTO gallery_extras (id,url,caption,sort,created_at) VALUES (?,?,?,?,?)'
      )
        .bind(id, url, String(b.caption || '').slice(0, 200), sort, new Date().toISOString())
        .run();
      return json({ ok: true, id });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (request.method === 'DELETE') {
    if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
    try {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      await env.DB.prepare('DELETE FROM gallery_extras WHERE id = ?').bind(id).run();
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
