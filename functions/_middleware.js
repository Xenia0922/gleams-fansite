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
import { ensureEvents, EVENTS_DDL_SQL } from './_seed.js';
import { listPhotosData } from './api/photos.js';
import { MEMBER_DDL_SQL } from './api/members.js';
import { MESSAGES_DDL_SQL } from './api/messages.js';
import { marked } from 'marked';

const GALLERY_DDL = `CREATE TABLE IF NOT EXISTS gallery_photos (id TEXT PRIMARY KEY, url TEXT NOT NULL, member TEXT, sort INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`;
const SITE_DDL = `CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT)`;

async function ensureTables(env) {
  try {
    await env.DB.batch([
      env.DB.prepare(EVENTS_DDL_SQL),
      env.DB.prepare(MEMBER_DDL_SQL),
      env.DB.prepare(MESSAGES_DDL_SQL),
      env.DB.prepare(GALLERY_DDL),
      env.DB.prepare(SITE_DDL),
    ]);
  } catch (e) {
    /* ignore */
  }
}

// ---- 模块级缓存：把「逐请求冷 D1 查询」变成「短 TTL 热缓存」 ----
// 页面数据仅后台编辑时变动，30s 内复用同一份结果即可；
// 冷 D1 下每次查询可慢至数百毫秒，串行累加后 TTFB 动辄数秒，
// 缓存后热流量几乎零 D1 开销，HTML 秒回。
const PAGE_CACHE_TTL = 30 * 1000;
const pageCache = new Map(); // path -> { ts, data }

// ensureTables 只需在单个 isolate 生命周期内跑一次（表在 D1 中持久存在）。
let tablesReady = false;
let tablesPromise = null;
async function ensureTablesOnce(env) {
  if (tablesReady) return;
  if (!tablesPromise) {
    tablesPromise = (async () => {
      try {
        await ensureTables(env);
        tablesReady = true;
      } catch (e) {
        /* ignore */
      } finally {
        tablesPromise = null;
      }
    })();
  }
  return tablesPromise;
}

// 读取（命中则用缓存，未命中才真正查 D1）。
// 仅在「查到了多于 turnstileSiteKey 的数据」时才缓存，避免把 D1 瞬时故障的空结果缓存住。
async function getPageData(path, env) {
  const now = Date.now();
  const hit = pageCache.get(path);
  if (hit && now - hit.ts < PAGE_CACHE_TTL) return hit.data;
  const data = await fetchPageData(path, env);
  if (Object.keys(data).length > 1) {
    if (pageCache.size > 64) {
      // 简单淘汰最旧项，避免无限增长
      let oldestKey = null;
      let oldestTs = Infinity;
      for (const [k, v] of pageCache) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) pageCache.delete(oldestKey);
    }
    pageCache.set(path, { ts: now, data });
  }
  return data;
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
  data.turnstileSiteKey = env.TURNSTILE_SITE_KEY || null;

  // 所有 D1 查询彼此独立，全部并发发起（Promise.all），
  // 冷 D1 下从「串行 await 累加」变为「取最慢一项」，TTFB 显著下降。
  const tasks = [];

  // site_config（所有页面都可能用，SiteBits 组件）
  tasks.push((async () => {
    try {
      const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
      if (results && results.length) {
        const cfg = {};
        for (const r of results) {
          try {
            cfg[r.key] = ['tokuten_rules', 'tokuten_images', 'featured_square', 'hero_config', 'blocked_words'].includes(r.key)
              ? JSON.parse(r.value)
              : r.value;
            // 防御旧 bug 数据：hero_config 曾被 updateConfig 存为 '[]'，强制转为 {}
            if (r.key === 'hero_config' && Array.isArray(cfg[r.key])) cfg[r.key] = {};
          } catch {
            cfg[r.key] = r.value;
          }
        }
        data.siteConfig = cfg;
        // 屏蔽词仅服务端使用，不注入前端 HTML
        delete data.siteConfig.blocked_words;
      }
    } catch {}
  })());

  // events：首页 / 成员 / 日程 / 画廊 / 粉丝 都需要
  if (path === '/' || path === '/members' || path === '/gallery' || path === '/fans' || path.startsWith('/schedule')) {
    tasks.push((async () => {
      try {
        let events = null;
        try {
          events = await fetchEvents(env);
        } catch (e) {
          // D1 偶发超时/错误，重试一次
          console.error('[middleware] fetchEvents first try failed:', e.message);
          events = await fetchEvents(env);
        }
        // 全新 D1：首次访问时确保已播种真实数据，再取一次
        if (!events || !events.length) {
          await ensureEvents(env);
          events = await fetchEvents(env);
        }
        data.events = events || [];
      } catch (e) {
        console.error('[middleware] fetchEvents all retries failed:', e.message);
      }
    })());
  }

  // members：首页 / 成员
  if (path === '/' || path === '/members' || path.startsWith('/members/')) {
    tasks.push((async () => {
      try {
        const { results } = await env.DB
          .prepare(
            "SELECT id,name,name_jp,color,emoji,birthday,constellation,status,image,gallery,weibo,weibo_name,weibo_desc,intro,sort_order FROM members ORDER BY sort_order ASC, id ASC"
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
    })());
  }

  // membersMeta：画廊 / 粉丝 分组显示
  if (path === '/gallery' || path === '/fans') {
    tasks.push((async () => {
      try {
        const { results } = await env.DB
          .prepare("SELECT id,name,emoji,color FROM members WHERE status='active' ORDER BY sort_order ASC, id ASC")
          .all();
        data.membersMeta = results || [];
      } catch {}
    })());
  }

  // 粉丝广场：留言 + 返图（SSR 直出，消除 MessageBoard/FanGallery 的二次 fetch）
  if (path === '/fans') {
    tasks.push((async () => {
      try {
        const { results: msgRows } = await env.DB
          .prepare('SELECT id, name, message, member, event, created_at FROM messages ORDER BY created_at DESC LIMIT 50')
          .all();
        data.messages = msgRows || [];
      } catch {}
    })());
    tasks.push((async () => {
      try {
        data.photos = await listPhotosData(env, true); // 仅已审核（pending 不对外）
      } catch {}
    })());
  }

  // 画廊：gallery photos + 骑士团精选（已解析 url，免二次 fetch）
  if (path === '/gallery') {
    tasks.push((async () => {
      try {
        const { results } = await env.DB
          .prepare('SELECT id,url,member FROM gallery_photos ORDER BY sort ASC, created_at ASC')
          .all();
        data.galleryPhotos = results || [];
      } catch {}
    })());
    tasks.push((async () => {
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
    })());
  }

  // 日程详情页：单条 event（含 body + bodyHtml），EventDetail 直接渲染，无需 fetch、无需客户端异步加载 marked
  const m = path.match(/^\/schedule\/([\w-]+)$/);
  if (m && m[1] !== 'index') {
    tasks.push((async () => {
      try {
        const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(m[1]).all();
        if (results && results.length) {
          const row = results[0];
          try {
            row.performers = JSON.parse(row.performers || '[]');
          } catch {
            row.performers = [];
          }
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
    })());
  }

  await Promise.all(tasks);
  return data;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 倒计时卡片：对 `/` 路径，按 D1 events 中「最近 upcoming」直填 data-countdown 元素
// （首屏 pre-JS 即见真实场次/日期/场馆，无「空白 → 填充」闪动，与 applyHero 同模式）。
// 替换失败（匹配不到钩子）则保留原样，不影响渲染。
function applyCountdown(html, ev) {
  if (!ev) return html;
  const d = new Date(ev.date + 'T00:00:00');
  const ds = isNaN(d.getTime())
    ? ''
    : String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0') +
      ' 周' +
      ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  html = html.replace(
    /(<[^>]*data-countdown="title"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
    (m, a, _c, b) => a + escapeHtml(ev.title || '') + b
  );
  html = html.replace(
    /(<[^>]*data-countdown="date"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
    (m, a, _c, b) => a + escapeHtml(ds) + b
  );
  html = html.replace(
    /(<[^>]*data-countdown="venue"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
    (m, a, _c, b) => a + escapeHtml(ev.venue || '') + b
  );
  return html;
}

// hero 栏可自定义：对 `/` 路径，按 D1 hero_config 替换 data-hero 元素（首屏直出最新值，无闪烁）。
// 替换失败（匹配不到）则保留原样，不影响渲染。
function applyHero(html, hero, weiboDesc) {
  if (!hero) return html;
  if (hero.title) {
    html = html.replace(/(<[^>]*data-hero="title"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i, (m, a, _c, b) => a + escapeHtml(hero.title) + b);
  }
  if (hero.subtitle) {
    html = html.replace(/(<[^>]*data-hero="subtitle"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i, (m, a, _c, b) => a + escapeHtml(hero.subtitle) + b);
  }
  // desc 复用 weibo_desc
  if (weiboDesc) {
    html = html.replace(/(<[^>]*data-hero="desc"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i, (m, a, _c, b) => a + escapeHtml(weiboDesc) + b);
  }
  if (hero.logo) {
    // src 可能在 data-hero 前或后，先匹配整个 img 标签再替换其 src（与属性顺序无关）
    html = html.replace(/<img[^>]*data-hero="logo"[^>]*>/i, (m) => m.replace(/\bsrc="[^"]*"/i, `src="${escapeHtml(hero.logo)}"`));
  }
  if (hero.bg || hero.bgOpacity != null || hero.bgPosition != null) {
    // bg img：替换 src + 替换 style（--bg-opacity + object-position）
    const opacity = hero.bgOpacity != null ? hero.bgOpacity : 0.22;
    const pos = hero.bgPosition || 'center center';
    html = html.replace(/<img[^>]*data-hero="bg"[^>]*>/i, (m) => {
      let out = m;
      if (hero.bg) {
        out = out.replace(/\bsrc="[^"]*"/i, `src="${escapeHtml(hero.bg)}"`);
      }
      // bg img 的 style 只含 --bg-opacity 与 object-position，整段替换安全
      const newStyle = `--bg-opacity:${opacity};object-position:${escapeHtml(pos)}`;
      if (/\bstyle="[^"]*"/i.test(out)) {
        out = out.replace(/\bstyle="[^"]*"/i, `style="${newStyle}"`);
      } else {
        out = out.replace(/\/?>/, ` style="${newStyle}"$&`);
      }
      return out;
    });
  }
  return html;
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

  // 边缘缓存（Cache API）：命中则直接返回「注入后的 HTML」——不碰 D1、不重解析响应体，TTFB ≈ 静态资源。
  // 关键：Cloudflare 不会缓存 Pages *Function* 自身响应（cf-cache-status 恒为 DYNAMIC，仅靠 Cache-Control
  // 的 s-maxage 无效），故用 caches.default 显式缓存。它跨 isolate / 跨 PoP 生效，冷数据中心也只需每 TTL
  // 付一次 D1。全站数据一致（无用户态），按 path 缓存安全；admin 路径已被上面的 isPage 排除，不受影响。
  const canCache = request.method === 'GET' && typeof caches !== 'undefined' && caches.default;
  const cacheKey = canCache ? new Request(new URL(path, url.origin)) : null;
  if (cacheKey) {
    try {
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
    } catch {}
  }

  // 获取原始响应
  const response = await next();

  // 只处理 HTML 响应
  const ct = response.headers.get('Content-Type') || '';
  if (!ct.includes('text/html')) return response;

  try {
    await ensureTablesOnce(env);
    const pageData = await getPageData(path, env);

    if (Object.keys(pageData).length === 0) return response;

    // 注入数据脚本（转义 < 防止数据含 </script> 破坏 HTML，JSON.parse 自动还原）
    const html = await response.text();
    const dataStr = JSON.stringify(pageData).replace(/</g, '\\u003c');
    const dataScript = `<script>window.__SSR_DATA__=${dataStr};</script>`;
    let modified = html.replace('</body>', dataScript + '</body>');
    // hero 栏可自定义：对 `/` 路径替换 data-hero 元素（首屏直出 D1 最新值，无闪烁）
    if (path === '/' && pageData.siteConfig && pageData.siteConfig.hero_config) {
      modified = applyHero(modified, pageData.siteConfig.hero_config, pageData.siteConfig.weibo_desc);
    }
    // 倒计时卡片：对 `/` 路径按 D1 最近 upcoming 直填 data-countdown（首屏 pre-JS 即真实场次，无闪动）
    if (path === '/' && Array.isArray(pageData.events) && pageData.events.length) {
      const up = pageData.events
        .filter((e) => e && e.status === 'upcoming')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      if (up) modified = applyCountdown(modified, up);
    }

    const respHeaders = new Headers(response.headers);
    respHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // 注入后 HTML 边缘缓存 60s：后台编辑后最多 60s 自然生效；s-maxage 同时供 CF/CDN 在支持时缓存。
    respHeaders.set('Cache-Control', 'public, max-age=0, s-maxage=60');

    const finalResp = new Response(modified, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
    // 存入 Cache API（TTL 由上面的 s-maxage=60 控制），供后续同 path 请求毫秒级命中
    if (cacheKey) {
      try {
        await caches.default.put(cacheKey, finalResp.clone());
      } catch {}
    }
    return finalResp;
  } catch (e) {
    console.error('[middleware] error:', e.message);
    return response;
  }
}
