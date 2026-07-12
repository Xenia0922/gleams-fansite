/**
 * [[path]].js — catch-all 兜底。
 * 用途：日程详情页 /schedule/:id 是构建期静态产物（仅覆盖构建种子里的活动）。
 * 后台 admin 新增的活动不在构建种子中 → 没有静态文件 → Cloudflare 返 404，
 * 用户点进去会「闪一下 404」。本函数在该路径静态页缺失时，按 D1 实时数据
 * 服务端渲染一个与站点完全一致的详情页（复用首页的外壳：CSS / 导航 / 页脚），
 * 返回 200，从而消除 404 闪现，且后台新增活动立即可见、无需重新构建。
 *
 * 已存在的静态详情页：next() 返回 200 HTML，直接放行（middleware 照常注入数据）。
 * 注意：本文件为 Cloudflare Pages Functions，必须纯 JS（不可用 TS 注解）。
 */
import { marked } from 'marked';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function renderDetail(row) {
  const id = row.id;
  const title = row.title || id;

  let dateLabel = '';
  const d = new Date(row.date);
  if (!isNaN(d.getTime())) {
    dateLabel = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  let bodyHtml = '';
  if (row.body) {
    try {
      bodyHtml = marked.parse(row.body, { async: false });
    } catch (e) {
      bodyHtml = '';
    }
  }

  const time = row.time
    ? '<span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">' + escapeHtml(row.time) + '</span>'
    : '';
  const venue = row.venue
    ? '<span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">' + escapeHtml(row.venue) + '</span>'
    : '';
  const image = row.image
    ? '<img src="' + escapeAttr(row.image) + '" alt="' + escapeAttr(title) + '" class="w-full rounded-2xl object-cover max-h-[500px] bg-gray-100 dark:bg-gray-800 mb-8" loading="lazy" decoding="async" />'
    : '';

  return (
    '\n' +
    '  <article class="max-w-3xl mx-auto px-4 py-12 md:py-16 content-enter">\n' +
    '    <a href="/schedule" class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 mb-6">← 返回日程</a>\n' +
    '    <div class="flex flex-wrap gap-2 mb-6 text-sm">\n' +
    '      <span class="bg-pink-50 dark:bg-gray-800 text-pink-600 dark:text-pink-300 px-3 py-1.5 rounded-full font-medium">' + dateLabel + '</span>\n' +
    time + '\n' +
    venue + '\n' +
    '    </div>\n' +
    '    <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">' + escapeHtml(title) + '</h1>\n' +
    image + '\n' +
    '    <div class="event-detail">' + bodyHtml + '</div>\n' +
    '  </article>'
  );
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = path.match(/^\/schedule\/([A-Za-z0-9_-]+)$/);
  if (!m || m[1] === 'index') return next();

  // 先尝试静态详情页（构建产物）
  const resp = await next();
  const ct = resp.headers.get('Content-Type') || '';
  if (resp.status < 400 && ct.includes('text/html')) return resp; // 静态页存在，放行

  // 静态页缺失 → 按 D1 实时渲染
  const id = m[1];
  let row = null;
  try {
    const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).all();
    row = results && results[0] ? results[0] : null;
  } catch (e) {}
  if (!row) return resp; // 确实不存在 → 维持 404

  // 取首页外壳（含站点的 CSS / 导航 / 页脚），保证视觉一致
  let shell = '';
  try {
    const homeResp = await fetch(new URL('/', request.url));
    shell = await homeResp.text();
  } catch (e) {}
  if (!shell) return resp;

  // 去掉首页自带的数据注入脚本，避免与 middleware 注入冲突
  shell = shell.replace(/<script>\s*window\.__SSR_DATA__=[\s\S]*?<\/script>/g, '');

  const mainOpen = shell.search(/<main[\s>]/i);
  const mainClose = shell.search(/<\/main>/i);
  if (mainOpen === -1 || mainClose === -1) return resp;

  const gt = shell.indexOf('>', mainOpen) + 1;
  let html = shell.slice(0, gt) + renderDetail(row) + shell.slice(mainClose);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(row.title || id) + ' | Gleams</title>');

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
