/**
 * GET  /api/photos?suffix      — 列出已上传的照片（含缩略图 URL）
 * GET  /api/photos?suffix&key=xxx — 读取单张图片
 * POST /api/photos             — 上传照片 + 可选缩略图（需暗号）
 * DELETE /api/photos           — 删除照片（含缩略图，需 ADMIN_CODE）
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

const THUMB_SUFFIX = '_thumb';

function isThumbKey(key) {
  return new RegExp(`${THUMB_SUFFIX}\\.\\w+$`).test(key);
}

function toThumbKey(key) {
  return key.replace(/\.(\w+)$/, `${THUMB_SUFFIX}.$1`);
}

async function uploadPhoto(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const thumb = formData.get('thumb'); // 可选：浏览器端生成的缩略图
    const rawMember = formData.get('member');
    const member = ['hakusai', 'kumo', 'yuzi', 'other'].includes(rawMember) ? rawMember : 'other';
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';
    const code = formData.get('code')?.trim() || '';

    if (!file || !(file instanceof File)) return json({ error: '请选择图片' }, 400);
    if (code !== env.SECRET_CODE) return json({ error: '暗号不对哦' }, 403);
    if (file.size > 15 * 1024 * 1024) return json({ error: '图片不能超过 15MB' }, 400);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) return json({ error: '仅支持 JPG/PNG/WEBP/GIF' }, 400);

    const rawExt = (file.name.split('.').pop() || '').toLowerCase();
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `uploads/${member}/${id}.${ext}`;

    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { nickname, member, uploadedAt: new Date().toISOString() },
    });

    let thumbUrl = null;
    if (thumb && thumb instanceof File) {
      const thumbExt = (thumb.name.split('.').pop() || 'webp').replace(/_thumb$/, '');
      const thumbKey = `uploads/${member}/${id}${THUMB_SUFFIX}.${thumbExt}`;
      await env.PHOTOS.put(thumbKey, thumb.stream(), {
        httpMetadata: { contentType: thumb.type },
        customMetadata: { original: key },
      });
      thumbUrl = `/api/photos?key=${encodeURIComponent(thumbKey)}`;
    }

    return json({
      ok: true,
      url: `/api/photos?key=${encodeURIComponent(key)}`,
      key,
      thumbUrl,
    });
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
    const thumbKeys = new Set(objects.filter(o => isThumbKey(o.key)).map(o => o.key));
    const photos = objects
      .filter(o => !isThumbKey(o.key))
      .map(o => {
        const thumbKey = toThumbKey(o.key);
        return {
          key: o.key,
          url: `/api/photos?key=${encodeURIComponent(o.key)}`,
          uploaded: o.uploaded,
          member: o.key.split('/')[1] || 'other',
          thumbUrl: thumbKeys.has(thumbKey)
            ? `/api/photos?key=${encodeURIComponent(thumbKey)}`
            : null,
        };
      });
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
    // 最佳努力删除配套缩略图
    await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
