/**
 * _middleware.js — 拦截所有 HTML 响应，注入 D1 最新数据。
 * React 组件通过 window.__SSR_DATA__ 读取，不再客户端 fetch（避免影响布局的二次加载）。
 *
 * 注入内容：
 *   - siteConfig      所有页面（SiteBits 等）
 *   - events          首页 / 成员 / 画廊 / 日程（列表与详情）
 *   - event           日程详情页 /schedule/:id（含 body，供 EventDetail 直接渲染，免 fetch）
 *   - members         首页 / 成员
 *   - galleryPhotos   画廊（成员分组图）
 *   - featuredFan     画廊「骑士团精选」区（已由 R2 解析出 url，免二次 fetch）
 */
import { ensureEvents } from './_seed.js';
import { listPhotosData } from './api/photos.js';
import { marked } from 'marked';

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
  } catch (e) {
    /* ignore */
  }
}

async function fetchEvents(env) {
  const { results } = await env.DB.prepare(
    'SELECT id,date,time,title,venue,performers,status,image FROM events ORDER BY date DESC'
  ).all();
  return (results || []).map((r) => {
    let performers = [];
    try {
      performers = JSON.parse(r.performers || '[]');
    } catch {}
    return { ...r, performers };
  });
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
            ? JSON.parse(r.value)
            : r.value;
        } catch {
          cfg[r.key] = r.value;
        }
      }
      data.siteConfig = cfg;
    }
  } catch {}

  // 首页 / 成员页 / 日程页 / 画廊页 都需要 events
  if (path === '/' || path === '/members' || path === '/gallery' || path.startsWith('/schedule')) {
    try {
      let events = await fetchEvents(env);
      // 全新 D1：首次访问时确保已播种真实数据，再取一次
      if (!events.length) {
        await ensureEvents(env);
        events = await fetchEvents(env);
      }
      data.events = events;
    } catch {}
  }

  // 首页 / 成员页 需要 members
  if (path === '/' || path === '/members' || path.startsWith('/members/')) {
    try {
      const { results } = await env.DB
        .prepare(
          "SELECT id,name,nameJP,color,emoji,birthday,constellation,status,image,gallery,weibo,weiboName,weiboDesc,intro,sort_order FROM members WHERE status!='graduated' ORDER BY sort_order ASC, id ASC"
        )
        .all();
      data.members = (results || []).map((r) => {
        let gallery = [];
        try {
          gallery = JSON.parse(r.gallery || '[]');
        } catch {}
        return { ...r, gallery };
      });
    } catch {}
  }

  // 画廊页需要 gallery photos + 骑士团精选（已解析 url，免二次 fetch）
  if (path === '/gallery') {
    try {
      const { results } = await env.DB
        .prepare('SELECT id,url,member FROM gallery_photos ORDER BY sort ASC, created_at ASC')
        .all();
      data.galleryPhotos = results || [];
    } catch {}
    try {
      const fs = await env.DB
        .prepare("SELECT value FROM site_config WHERE key='featured_square'")
        .first();
      const featuredSquare = fs?.value ? JSON.parse(fs.value) : [];
      const featuredKeys = Array.isArray(featuredSquare)
        ? featuredSquare.map((e) => (typeof e === 'string' ? e : e.key)).filter(Boolean)
        : [];
      if (featuredKeys.length) {
        const photos = await listPhotosData(env);
        const keySet = new Set(featuredKeys);
        data.featuredFan = photos.filter((p) => keySet.has(p.key));
      } else {
        data.featuredFan = [];
      }
    } catch {}
  }

  // 日程详情页：注入单条完整 event（含 body + bodyHtml），EventDetail 直接渲染，无需 fetch、无需客户端异步加载 marked
  const m = path.match(/^\/schedule\/([\w-]+)$/);
  if (m && m[1] !== 'index') {
    try {
      const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(m[1]).all();
      if (results && results.length) {
        const row = results[0];
        try {
          row.performers = JSON.parse(row.performers || '[]');
        } catch {
          row.performers = [];
        }
        // 服务端预渲染 body 为 HTML，客户端 Get 到即可直接使用，无需异步加载 marked
        if (row.body) {
          try {
            row.bodyHtml = marked.parse(row.body, { async: false });
          } catch {
            row.bodyHtml = '';
          }
        } else {
          row.bodyHtml = '';
        }
        data.event = row;
      }
    } catch {}
  }

  return data;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 只处理 HTML 页面请求
  const isPage =
    !path.startsWith('/api/') &&
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
