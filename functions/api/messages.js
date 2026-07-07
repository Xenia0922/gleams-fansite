/**
 * POST /api/messages — 提交留言 → R2（需暗号）
 * GET  /api/messages — 获取最近留言 ← R2
 * DELETE /api/messages — 删除留言（需 ADMIN_CODE）
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return listMessages(env);
  }

  if (request.method === 'POST') {
    return postMessage(request, env);
  }

  if (request.method === 'DELETE') {
    return deleteMessage(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

async function postMessage(request, env) {
  try {
    const body = await request.json();
    const name = body.name?.trim().slice(0, 30) || '匿名骑士';
    const message = body.message?.trim().slice(0, 500);
    const member = body.member || null;
    const code = body.code?.trim() || '';

    if (!message) {
      return json({ error: '内容不能为空' }, 400);
    }

    if (code !== env.SECRET_CODE) {
      return json({ error: '暗号不对哦' }, 403);
    }

    // 简易限流
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { objects } = await env.PHOTOS.list({ prefix: `messages/`, limit: 3 });
    for (const obj of objects) {
      const item = await env.PHOTOS.get(obj.key);
      if (item) {
        const prev = JSON.parse(await item.text());
        if (prev.ip === ip) {
          const elapsed = Date.now() - new Date(prev.created_at).getTime();
          if (elapsed < 30000) {
            return json({ error: '发太快了，等30秒再试' }, 429);
          }
        }
      }
    }

    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const key = `messages/${id}.json`;
    const data = JSON.stringify({
      id, name, message, member,
      created_at: new Date().toISOString(),
    });

    await env.PHOTOS.put(key, data, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { ip },
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
          results.push(JSON.parse(await item.text()));
        }
      } catch { /* skip */ }
    }
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteMessage(request, env) {
  try {
    const admin = request.headers.get('x-admin-code') || '';
    if (admin !== env.ADMIN_CODE) {
      return json({ error: '无权限' }, 403);
    }
    const { key } = await request.json();
    if (!key || !key.startsWith('messages/')) {
      return json({ error: '无效 key' }, 400);
    }
    await env.PHOTOS.delete(key);
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
