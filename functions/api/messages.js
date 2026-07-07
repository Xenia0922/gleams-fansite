/**
 * POST /api/messages — 提交留言 → D1（需暗号）
 * GET  /api/messages — 获取最近留言 ← D1
 * DELETE /api/messages — 删除留言（需 ADMIN_CODE）
 */

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'GET') return listMessages(env);
  if (request.method === 'POST') return postMessage(request, env);
  if (request.method === 'DELETE') return deleteMessage(request, env);
  return new Response('Method not allowed', { status: 405 });
}

async function postMessage(request, env) {
  try {
    const body = await request.json();
    const name = body.name?.trim().slice(0, 30) || '匿名骑士';
    const message = body.message?.trim().slice(0, 500);
    const member = body.member || null;
    const code = body.code?.trim() || '';

    if (!message) return json({ error: '内容不能为空' }, 400);
    if (code !== env.SECRET_CODE) return json({ error: '暗号不对哦' }, 403);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { results: recent } = await env.DB
      .prepare('SELECT created_at FROM messages WHERE ip = ? ORDER BY created_at DESC LIMIT 1')
      .bind(ip).all();
    if (recent.length > 0 && Date.now() - new Date(recent[0].created_at + 'Z').getTime() < 30000) {
      return json({ error: '发太快了，等30秒再试' }, 429);
    }

    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    await env.DB.prepare('INSERT INTO messages (id, name, message, member, ip) VALUES (?,?,?,?,?)')
      .bind(id, name, message, member, ip).run();

    return json({ ok: true, msg: { id, name, message, member } });
  } catch (e) {
    return json({ error: '留言失败: ' + e.message }, 500);
  }
}

async function listMessages(env) {
  try {
    const { results } = await env.DB
      .prepare('SELECT id, name, message, member, created_at FROM messages ORDER BY created_at DESC LIMIT 50')
      .all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteMessage(request, env) {
  try {
    const admin = request.headers.get('x-admin-code') || '';
    if (admin !== env.ADMIN_CODE) return json({ error: '无权限' }, 403);
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400);
    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
