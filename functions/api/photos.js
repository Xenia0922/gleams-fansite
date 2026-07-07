/**
 * GET  /api/photos?suffix      — 列出已上传的照片
 * GET  /api/photos?suffix&key=xxx — 读取单张图片
 * POST /api/photos             — 上传照片（需暗号）
 * DELETE /api/photos           — 删除照片（需 ADMIN_CODE）
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.searchParams.has('key')) {
    return servePhoto(env, url.searchParams.get('key'));
  }

  if (request.method === 'GET') {
    return listPhotos(env);
  }

  if (request.method === 'POST') {
    return uploadPhoto(request, env);
  }

  if (request.method === 'DELETE') {
    return deletePhoto(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

async function uploadPhoto(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const member = formData.get('member') || 'other';
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';
    const code = formData.get('code')?.trim() || '';

    if (!file || !(file instanceof File)) return json({ error: '请选择图片' }, 400);
    if (code !== env.SECRET_CODE) return json({ error: '暗号不对哦' }, 403);
    if (file.size > 15 * 1024 * 1024) return json({ error: '图片不能超过 15MB' }, 400);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (!allowed.includes(file.type)) return json({ error: '仅支持 JPG/PNG/WEBP/GIF/HEIC' }, 400);

    const ext = file.name.split('.').pop() || 'jpg';
    const key = `uploads/${member}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { nickname, member, uploadedAt: new Date().toISOString() },
    });

    return json({ ok: true, url: `/api/photos?key=${encodeURIComponent(key)}`, key });
  } catch (e) {
    return json({ error: '上传失败: ' + e.message }, 500);
  }
}

async function servePhoto(env, key) {
  try {
    const obj = await env.PHOTOS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { headers });
  } catch {
    return new Response('Error', { status: 500 });
  }
}

async function listPhotos(env) {
  try {
    const { objects } = await env.PHOTOS.list({ limit: 50, prefix: 'uploads/' });
    const photos = objects.map(o => ({
      key: o.key,
      url: `/api/photos?key=${encodeURIComponent(o.key)}`,
      uploaded: o.uploaded,
    }));
    return json(photos);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deletePhoto(request, env) {
  try {
    const admin = request.headers.get('x-admin-code') || '';
    if (admin !== env.ADMIN_CODE) return json({ error: '无权限' }, 403);
    const { key } = await request.json();
    if (!key || !key.startsWith('uploads/')) return json({ error: '无效 key' }, 400);
    await env.PHOTOS.delete(key);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
