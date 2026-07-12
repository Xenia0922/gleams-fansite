/**
 * _middleware.js — 拦截所有 HTML 响应，注入 D1 最新数据
 * React 组件通过 window.__SSR_DATA__ 读取，不再客户端 fetch
 */
import { adminOk, json } from './_shared.js';

const EVENT_DDL = `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, date TEXT, time TEXT, title TEXT, venue TEXT, performers TEXT, status TEXT, image TEXT, body TEXT, created_at TEXT)`;
const MEMBER_DDL = `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, nameJP TEXT, color TEXT, emoji TEXT, birthday TEXT, constellation TEXT, status TEXT, image TEXT, gallery TEXT, weibo TEXT, weiboName TEXT, weiboDesc TEXT, intro TEXT, sort_order INTEGER DEFAULT 0)`;
const GALLERY_DDL = `CREATE TABLE IF NOT EXISTS gallery_photos (id TEXT PRIMARY KEY, url TEXT NOT NULL, member TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`;
const SITE_DDL = `CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT)`;

async function ensureTables(env) {
  try {
    await env.DB.batch([
      env.DB.prepare(EVENT_DDL),
      env.DB.prepare(MEMBER_DDL),
      env.DB.prepare(GALLERY_DDL),
      env.DB.prepare(SITE_DDL),
    ]);
  } catch (e) { /* ignore */ }
}

async function fetchPageData(path, env) {
  const data = {};

  // 所有页面都可能需要 site_config (SiteBits 组件)
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
    if (results && results.length) {
      const cfg = {};
      for (const r of results) {
        try {
          cfg[r.key] = ['tokuten_rules', 'tokuten_images', 'featured_square'].includes(r.key)
            ? JSON.parse(r.value) : r.value;
        } catch { cfg[r.key] = r.value; }
      }
      data.siteConfig = cfg;
    }
  } catch {}

  // 首页 / 成员页 / 日程页 / 画廊页 都需要 events
  if (path === '/' || path === '/members' || path === '/gallery' || path.startsWith('/schedule')) {
    try {
      const { results } = await env.DB.prepare('SELECT id,date,time,title,venue,performers,status,image FROM events ORDER BY date DESC').all();
      data.events = (results || []).map(r => {
        let performers = [];
        try { performers = JSON.parse(r.performers || '[]'); } catch {}
        return { ...r, performers };
      });
    } catch {}
  }

  // 首页 / 成员页 需要 members
  if (path === '/' || path === '/members' || path.startsWith('/members/')) {
    try {
      const { results } = await env.DB.prepare("SELECT id,name,nameJP,color,emoji,birthday,constellation,status,image,gallery,weibo,weiboName,weiboDesc,intro,sort_order FROM members WHERE status!='graduated' ORDER BY sort_order ASC, id ASC").all();
      data.members = (results || []).map(r => {
        let gallery = [];
        try { gallery = JSON.parse(r.gallery || '[]'); } catch {}
        return { ...r, gallery };
      });
    } catch {}
  }

  // 画廊页需要 gallery photos + featured
  if (path === '/gallery') {
    try {
      const { results } = await env.DB.prepare('SELECT id,url,member FROM gallery_photos ORDER BY sort ASC, created_at ASC').all();
      data.galleryPhotos = results || [];
    } catch {}
    try {
      const { results } = await env.DB.prepare("SELECT value FROM site_config WHERE key='featured_square'").first();
      if (results?.value) data.featuredSquare = JSON.parse(results.value);
    } catch {}
  }

  return data;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 只处理 HTML 页面请求
  const isPage = !path.startsWith('/api/') &&
    !path.startsWith('/_astro/') &&
    !path.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|json|xml|txt|woff2?)$/i) &&
    !path.startsWith('/admin');

  if (!isPage) return next();

  // 获取原始响应
  const response = await next();

  // 只处理 HTML 响应
  const ct = response.headers.get('Content-Type') || '';
  if (!ct.includes('text/html')) return response;

  try {
    await ensureTables(env);
    const pageData = await fetchPageData(path, env);

    if (Object.keys(pageData).length === 0) return response;

    // 注入数据脚本
    const html = await response.text();
    const dataScript = `<script>window.__SSR_DATA__=${JSON.stringify(pageData)};</script>`;
    const modified = html.replace('</body>', dataScript + '</body>');

    return new Response(modified, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (e) {
    console.error('[middleware] error:', e.message);
    return response;
  }
}
