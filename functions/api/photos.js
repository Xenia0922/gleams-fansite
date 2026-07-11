/**
 * GET  /api/photos?key=xxx        — 读取单张图片
 * GET  /api/photos                 — 列出已上传的照片（含缩略图 URL + 关联场次 event）
 * POST /api/photos                 — 上传照片（支持一次多张，最多 9 张，单张 ≤23MB，需暗号）
 * DELETE /api/photos               — 删除照片（含缩略图，需 ADMIN_CODE）
 */

import { rateAllow, rateLog } from './_rate.js';

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

function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

const THUMB_SUFFIX = '_thumb';
const MAX_FILES = 9;
const MAX_SIZE = 23 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function isThumbKey(key) {
  return new RegExp(`${THUMB_SUFFIX}\\.\\w+$`).test(key);
}

function toThumbKey(key) {
  return key.replace(/\.(\w+)$/, `${THUMB_SUFFIX}.$1`);
}

async function uploadPhoto(request, env) {
  try {
    const formData = await request.formData();
    const isAdmin = adminOk(request, env);

    // 收集文件：兼容多文件 fields=('files') 与旧单文件('file')
    let files = formData.getAll('files').filter(f => f instanceof File);
    const single = formData.get('file');
    if (single && single instanceof File) files.push(single);
    if (files.length === 0) return json({ error: '请选择图片' }, 400);
    if (files.length > MAX_FILES) return json({ error: `一次最多上传 ${MAX_FILES} 张` }, 400);

    const code = formData.get('code')?.trim() || '';
    if (!isAdmin && code !== env.SECRET_CODE) return json({ error: '暗号不对哦' }, 403);

    // 逐张校验类型与大小
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) return json({ error: '仅支持 JPG/PNG/WEBP/GIF' }, 400);
      if (f.size > MAX_SIZE) return json({ error: '单张图片不能超过 23MB' }, 400);
    }

    // 限流（粉丝）：5 秒内本 IP 上传图片总数不超过 MAX_FILES
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!isAdmin) {
      const allowed = await rateAllow(env, ip, 'photo', MAX_FILES, 5000, files.length);
      if (!allowed) return json({ error: '操作太频繁，请 5 秒后再试' }, 429);
    }

    const rawMember = formData.get('member');
    const member = isAdmin
      ? (rawMember || 'other')
      : (['hakusai', 'kumo', 'yuzi', 'other'].includes(rawMember) ? rawMember : 'other');
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';
    const event = (formData.get('event') || '').slice(0, 40) || null;

    const urls = [];
    const keys = [];
    const thumbUrls = [];

    for (const file of files) {
      const rawExt = (file.name.split('.').pop() || '').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
      const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const key = `uploads/${member}/${id}.${ext}`;
      await env.PHOTOS.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { nickname, member, event: event || '', uploadedAt: new Date().toISOString() },
      });
      urls.push(`/api/photos?key=${encodeURIComponent(key)}`);
      keys.push(key);
      thumbUrls.push(null);
      if (!isAdmin) await rateLog(env, ip, 'photo');
    }

    return json({
      ok: true,
      count: files.length,
      urls,
      keys,
      thumbUrls,
      // 兼容单图消费的旧客户端
      url: urls[0] || null,
      key: keys[0] || null,
      thumbUrl: thumbUrls[0] || null,
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
          event: o.customMetadata?.event || null,
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
    await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
