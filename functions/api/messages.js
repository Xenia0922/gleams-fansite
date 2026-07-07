/**
 * POST /api/messages — 提交留言 → R2
 * GET  /api/messages — 获取最近留言 ← R2
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

    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const key = `messages/${id}.json`;
    const data = JSON.stringify({ id, name, message, member, created_at: new Date().toISOString() });

    await env.PHOTOS.put(key, data, {
      httpMetadata: { contentType: 'application/json' },
    });

    return json({ ok: true, msg: { id, name, message, member } });
  } catch (e) {
    return json({ error: '留言失败: ' + e.message }, 500);
  }
}

async function listMessages(env) {
  try {
    const { objects } = await env.PHOTOS.list({ prefix: 'messages/', limit: 50 });
    const results = [];
    for (const obj of objects) {
      try {
        const item = await env.PHOTOS.get(obj.key);
        if (item) {
          const text = await item.text();
          results.push(JSON.parse(text));
        }
      } catch { /* skip malformed */ }
    }
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
