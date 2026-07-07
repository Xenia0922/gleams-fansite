/**
 * POST /api/messages — 提交留言
 * GET  /api/messages — 获取最近留言
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return listMessages(env);
  }

  if (request.method === 'POST') {
    return postMessage(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

async function postMessage(request, env) {
  try {
    const body = await request.json();
    const name = body.name?.trim().slice(0, 30) || '匿名骑士';
    const message = body.message?.trim().slice(0, 500);
    const member = body.member || null;

    if (!message) {
      return json({ error: '内容不能为空' }, 400);
    }

    const { results } = await env.DB
      .prepare('INSERT INTO messages (name, message, member) VALUES (?, ?, ?) RETURNING *')
      .bind(name, message, member)
      .run();

    return json({ ok: true, msg: results[0] });
  } catch (e) {
    return json({ error: '留言失败: ' + e.message }, 500);
  }
}

async function listMessages(env) {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50')
      .all();
    return json(results);
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
