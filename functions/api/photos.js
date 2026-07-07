/**
 * POST /api/photos — 粉丝上传照片到 R2
 * GET  /api/photos — 列出已上传的照片
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    return listPhotos(env);
  }

  if (request.method === 'POST') {
    return uploadPhoto(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

/** 上传单张照片 */
async function uploadPhoto(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const member = formData.get('member') || 'other';
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';

    if (!file || !(file instanceof File)) {
      return json({ error: '请选择图片' }, 400);
    }

    if (file.size > 8 * 1024 * 1024) {
      return json({ error: '图片不能超过 8MB' }, 400);
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return json({ error: '仅支持 JPG/PNG/WEBP/GIF/HEIC' }, 400);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const key = `uploads/${member}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { nickname, member, uploadedAt: new Date().toISOString() },
    });

    return json({
      ok: true,
      url: `/photos/${key}`,
      nickname,
    });
  } catch (e) {
    return json({ error: '上传失败: ' + e.message }, 500);
  }
}

/** 列出最近 50 张照片 */
async function listPhotos(env) {
  const { objects } = await env.PHOTOS.list({ limit: 50 });
  const photos = objects.map(o => ({
    key: o.key,
    url: `/photos/${o.key}`,
    uploaded: o.uploaded,
  }));
  return json(photos);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
