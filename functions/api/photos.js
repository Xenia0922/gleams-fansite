/**
 * GET  /api/photos?key=xxx        — 读取单张图片
 * GET  /api/photos                 — 列出已审核照片（粉丝上传默认 pending，admin ?all=1 看全部）
 * POST /api/photos                 — 上传照片（最多 9 张，单张 ≤35MB，粉丝需 Turnstile + 审核后才公开）
 * PUT  /api/photos                 — admin 审核（approve/reject，需 ADMIN_CODE）
 * DELETE /api/photos               — 删除照片（需 ADMIN_CODE）
 */

import { rateAllow, rateLog } from './_rate.js';
import { adminOk, adminGuard, json, verifyTurnstile, handlePreFlight } from '../_shared.js';

export async function onRequest(context) {
  const pre = handlePreFlight(context);
  if (pre) return pre;
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.searchParams.has('key')) {
    return servePhoto(request, env, url.searchParams.get('key'));
  }

  if (request.method === 'GET') {
    return listPhotos(request, env);
  }

  if (request.method === 'POST') {
    return uploadPhoto(request, env);
  }

  if (request.method === 'PUT') {
    return moderatePhoto(request, env);
  }

  if (request.method === 'DELETE') {
    return deletePhoto(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

const THUMB_SUFFIX = '_thumb';
const MAX_FILES = 9;
const MAX_SIZE = 35 * 1024 * 1024;
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
    if (files.length === 0) return json({ error: '请选择图片' }, 400, { request, env });
    if (files.length > MAX_FILES) return json({ error: `一次最多上传 ${MAX_FILES} 张` }, 400, { request, env });

    // 粉丝走 Turnstile 人机验证（admin 免）
    if (!isAdmin) {
      const token = formData.get('turnstileToken')?.toString() || '';
      const ip = request.headers.get('cf-connecting-ip') || '';
      const ok = await verifyTurnstile(token, ip, env);
      if (!ok) return json({ error: '人机验证失败，请刷新重试' }, 403, { request, env });
    }

    // 逐张校验类型与大小
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) return json({ error: '仅支持 JPG/PNG/WEBP/GIF' }, 400, { request, env });
      if (f.size > MAX_SIZE) return json({ error: '单张图片不能超过 35MB' }, 400, { request, env });
    }

    // 限流（粉丝）：5 秒内本 IP 上传图片总数不超过 MAX_FILES
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!isAdmin) {
      const allowed = await rateAllow(env, ip, 'photo', MAX_FILES, 5000, files.length);
      if (!allowed) return json({ error: '操作太频繁，请 5 秒后再试' }, 429, { request, env });
    }

    const rawMember = formData.get('member');
    const member = isAdmin
      ? (rawMember || 'other')
      : (['hakusai', 'kumo', 'yuzi', 'other'].includes(rawMember) ? rawMember : 'other');
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';
    const event = (formData.get('event') || '').slice(0, 40) || null;

    const urls = [];
    const keys = [];

    for (const file of files) {
      const rawExt = (file.name.split('.').pop() || '').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
      const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      // 粉丝上传进 pending 前缀（审核后才公开），admin 上传直接进 uploads/
      const key = isAdmin ? `uploads/${member}/${id}.${ext}` : `uploads/pending/${member}/${id}.${ext}`;
      await env.PHOTOS.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { nickname, member, event: event || '', uploadedAt: new Date().toISOString() },
      });
      urls.push(`/api/photos?key=${encodeURIComponent(key)}`);
      keys.push(key);
      if (!isAdmin) await rateLog(env, ip, 'photo');
    }

    return json({
      ok: true,
      count: files.length,
      urls,
      keys,
      // 兼容单图消费的旧客户端
      url: urls[0] || null,
      key: keys[0] || null,
      // 粉丝上传需审核后才公开（admin 上传直接公开）
      pending: !isAdmin,
    }, 200, { request, env });
  } catch (e) {
    return json({ error: '上传失败: ' + e.message }, 500, { request, env });
  }
}

async function servePhoto(request, env, key) {
  // 审核防护：待审图片（uploads/pending/ 前缀）默认禁止公开直链访问，
  // 避免"审核只挡列表不挡直链"。但已登录 admin（携带有效 x-admin-code）需预览以完成审核，故放行。
  const isPending = typeof key === 'string' && key.startsWith('uploads/pending/');
  if (isPending && !adminOk(request, env)) {
    return new Response('Forbidden', { status: 403 });
  }

  // 缩略图：用 Cloudflare Image Resizing 在边缘按需缩放（零存储、CDN 缓存、format=auto 出 webp/avif）。
  // 网格用 ?w=600 请求小图，灯箱用不带 w 的原图。未开通 Image Resizing 时 cf 选项被忽略、
  // 下面 try 失败则降级为原图，不影响功能。
  const url = new URL(request.url);
  const wParam = url.searchParams.get('w') || url.searchParams.get('width');
  const width = wParam ? Math.min(parseInt(wParam, 10) || 0, 1200) : 0;
  const qParam = url.searchParams.get('q');
  const quality = qParam ? Math.min(Math.max(parseInt(qParam, 10) || 0, 1), 100) : 0;
  if (width > 0) {
    try {
      const originUrl = new URL(request.url);
      originUrl.searchParams.delete('w');
      originUrl.searchParams.delete('width');
      originUrl.searchParams.delete('q');
      const headers = {};
      const code = request.headers.get('x-admin-code');
      if (code) headers['x-admin-code'] = code; // 待审图需带 admin 头才能取到原图再缩放
      const imageOpts = { width, fit: 'scale-down', format: 'auto' };
      if (quality > 0) imageOpts.quality = quality; // ?q= 显式质量（默认 0=跟随 CF auto）
      const resized = await fetch(originUrl.toString(), {
        cf: { image: imageOpts },
        headers,
      });
      if (resized.ok && (resized.headers.get('content-type') || '').startsWith('image/')) {
        const out = new Headers(resized.headers);
        out.set('Cache-Control', 'public, max-age=31536000, immutable');
        out.set('X-Content-Type-Options', 'nosniff');
        out.set('Access-Control-Allow-Origin', '*');
        return new Response(resized.body, { status: 200, headers: out });
      }
    } catch {
      /* 降级为原图 */
    }
  }

  try {
    const obj = await env.PHOTOS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'public, max-age=31536000');
    // 图片本身是公开资源（同源 + 跨站均可见），保留 * 让 CDN/浏览器缓存协作
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { headers });
  } catch {
    return new Response('Error', { status: 500 });
  }
}

/**
 * 列出 R2 中已上传的照片（不含缩略图对象）。
 * 审核状态用 key 前缀区分：uploads/pending/{member}/... = 待审，uploads/{member}/... = 已通过。
 * 不依赖 R2 customMetadata（list 不保证返回 customMetadata，曾导致审核过滤失效）。
 * @param approvedOnly true 时只返回已审核（不含 uploads/pending/ 前缀）；false 时返回全部。
 * 同时被 GET /api/photos（包装成 JSON）与 _middleware.js（SSR 注入 featuredFan）复用。
 */
export async function listPhotosData(env, approvedOnly = true) {
  try {
    const { objects } = await env.PHOTOS.list({ limit: 1000, prefix: 'uploads/' });
    return objects
      .filter(o => !isThumbKey(o.key))
      .filter(o => !approvedOnly || !o.key.startsWith('uploads/pending/'))
      .map(o => {
        const isPending = o.key.startsWith('uploads/pending/');
        // member：uploads/pending/{member}/... 或 uploads/{member}/...
        const parts = o.key.split('/');
        const member = isPending ? (parts[2] || 'other') : (parts[1] || 'other');
        return {
          key: o.key,
          url: `/api/photos?key=${encodeURIComponent(o.key)}`,
          // 网格缩略图：边缘按需缩放（servePhoto 处理 ?w=&q=，更高压缩）。灯箱仍用原图 url。
          thumbUrl: `/api/photos?key=${encodeURIComponent(o.key)}&w=480&q=72`,
          uploaded: o.uploaded,
          member,
          event: o.customMetadata?.event || null,
          status: isPending ? 'pending' : 'approved',
        };
      });
  } catch (e) {
    console.error('[photos] list failed:', e.message);
    return [];
  }
}

async function listPhotos(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';
  // admin 可看全部（含 pending）；公开只返回 approved
  const approvedOnly = !all || !adminOk(request, env);
  return json(await listPhotosData(env, approvedOnly), 200, { request, env });
}

async function deletePhoto(request, env) {
  try {
    if (!adminOk(request, env)) return json({ error: '无权限' }, 403, { request, env });
    const { key } = await request.json();
    if (!key || !key.startsWith('uploads/')) return json({ error: '无效 key' }, 400, { request, env });
    await env.PHOTOS.delete(key);
    await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
    return json({ ok: true }, 200, { request, env });
  } catch (e) {
    return json({ error: e.message }, 500, { request, env });
  }
}

// admin 审核：支持单张（{key, action}）与批量（{keys:[...], action}）。
// approve 用 R2 内部 copy（秒级，不流经边缘）；reject 直接删对象。
async function moderatePhoto(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const body = await request.json();
    const { action } = body;
    // 兼容单张与批量：批量优先用 keys 数组，否则退化到单个 key
    const keys = (Array.isArray(body.keys) && body.keys.length)
      ? body.keys.filter((k) => typeof k === 'string')
      : (typeof body.key === 'string' && body.key ? [body.key] : []);
    if (keys.length === 0) return json({ error: '缺少 key' }, 400, { request, env });
    if (action !== 'approve' && action !== 'reject') return json({ error: '无效操作' }, 400, { request, env });
    if (keys.length > 100) return json({ error: '一次最多处理 100 张' }, 400, { request, env });

    const results = [];
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith('uploads/')) {
        results.push({ key: k, ok: false, error: '无效 key' });
        continue;
      }
      try {
        if (action === 'reject') {
          await env.PHOTOS.delete(k);
          await env.PHOTOS.delete(toThumbKey(k)).catch(() => {});
          results.push({ key: k, ok: true, action: 'rejected' });
        } else {
          // approve：R2 内部 copy 把对象从 uploads/pending/ 拷到 uploads/（保留原 metadata），
          // 避免 get+arrayBuffer+put 把大图（如 35MB）流经边缘内存/带宽，从十几秒降到秒级。
          if (!k.startsWith('uploads/pending/')) { results.push({ key: k, ok: false, error: '不是待审图片' }); continue; }
          const head = await env.PHOTOS.head(k);
          if (!head) { results.push({ key: k, ok: false, error: '图片不存在' }); continue; }
          const newKey = k.replace('uploads/pending/', 'uploads/');
          await env.PHOTOS.copy(k, newKey);
          await env.PHOTOS.delete(k);
          await env.PHOTOS.delete(toThumbKey(k)).catch(() => {});
          results.push({ key: k, ok: true, action: 'approved' });
        }
      } catch (e) {
        results.push({ key: k, ok: false, error: e.message });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return json({ ok: true, count: okCount, total: keys.length, results }, 200, { request, env });
  } catch (e) {
    return json({ error: e.message }, 500, { request, env });
  }
}
