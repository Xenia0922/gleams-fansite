/**
 * /schedule — 纯服务端渲染，数据直接嵌在 HTML 里，不二次加载
 */
import { adminOk, json } from '../_shared.js';

const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, date TEXT, time TEXT, title TEXT, venue TEXT,
  performers TEXT, status TEXT, image TEXT, body TEXT, created_at TEXT
)`;

const SEED = [
  { id: 'live-2026-01-25', date: '2026-01-25', time: '', title: 'Sunday Candy Vol.03（广州首演）', venue: '广州', performers: '["hakusai","kumo","yuzi","huangyuyu"]', status: 'past', image: '/images/events/live-2026-01-25.webp' },
  { id: 'live-2026-01-31', date: '2026-01-31', time: '12:40', title: '第一届 Comic Expo 国风动漫展（出道）', venue: '南宁北投明月荟（西乡塘区）', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-01-31.webp' },
  { id: 'live-2026-02-15', date: '2026-02-15', time: '', title: '桂平·ACG第七届动漫新年盛典', venue: '桂平', performers: '["hakusai","kumo","yuzi","huangyuyu"]', status: 'past', image: '/images/events/live-2026-02-15.webp' },
  { id: 'live-2026-02-23', date: '2026-02-23', time: '', title: '南宁·动觅次元春日祭', venue: '南宁', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-02-23.webp' },
  { id: 'live-2026-03-14', date: '2026-03-14', time: '', title: '桂林·ACG动漫盛典', venue: '桂林', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-03-14.webp' },
  { id: 'live-2026-03-28', date: '2026-03-28', time: '', title: '柳州·春日动漫嘉年华', venue: '柳州', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-03-28.webp' },
  { id: 'live-2026-04-26', date: '2026-04-26', time: '', title: '南宁·五一特别公演', venue: '南宁', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-04-26.webp' },
  { id: 'live-2026-05-16', date: '2026-05-16', time: '', title: '广州·夏日祭动漫展', venue: '广州', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-05-16.webp' },
  { id: 'live-2026-07-04', date: '2026-07-04', time: '', title: '南宁·盛夏公演', venue: '南宁', performers: '["hakusai","kumo","yuzi"]', status: 'past', image: '/images/events/live-2026-07-04.webp' },
];

const MEMBERS = [
  { id: 'hakusai', name: '白菜', emoji: '💛' },
  { id: 'kumo', name: '云团', emoji: '💙' },
  { id: 'yuzi', name: '柚子', emoji: '💚' },
  { id: 'huangyuyu', name: '黄鱼鱼', emoji: '🩷' },
];

async function ensureTable(env) {
  try {
    await env.DB.prepare(DDL).run();
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').all();
    if (results[0] && results[0].c === 0) {
      for (const e of SEED) {
        await env.DB.prepare('INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(e.id, e.date, e.time, e.title, e.venue, e.performers, e.status, e.image, '', new Date().toISOString()).run();
      }
    }
  } catch (e) { console.error('[schedule] ensureTable:', e.message); }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequest(context) {
  const { request, env } = context;

  try { await ensureTable(env); } catch (e) {}

  const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY date DESC, id DESC').all();

  const events = (results || []).map(r => {
    let performers = [];
    try { performers = JSON.parse(r.performers || '[]'); } catch {}
    return { ...r, performers };
  });

  const memberMap = new Map(MEMBERS.map(m => [m.id, m]));

  // 按月分组
  const groups = {};
  for (const e of events) {
    const d = new Date(e.date);
    const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    (groups[key] = groups[key] || []).push(e);
  }

  // 生成 HTML
  const groupsHtml = Object.entries(groups).map(([month, evs]) => {
    const itemsHtml = evs.map(evt => {
      const d = new Date(evt.date);
      const isPast = evt.status === 'past';
      const img = evt.image || '/images/events/default.webp';
      const chips = (evt.performers || []).map(pid => {
        const m = memberMap.get(pid);
        return m ? `<span class="chip">${m.emoji} ${m.name}</span>` : '';
      }).join('');
      return `<a href="/schedule/${evt.id}" class="${isPast ? 'opacity-65 hover:opacity-100 glass' : 'frost-card shadow-md'} flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl transition-opacity group">
        <div class="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-3xl overflow-hidden glass">
          <img src="${img}" alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
        </div>
        <div class="flex-shrink-0 text-center min-w-[44px] sm:min-w-[50px]">
          <span class="${isPast ? 'text-gray-400' : 'text-pink-500'} text-base sm:text-lg font-extrabold">${d.getMonth() + 1}/${d.getDate()}</span>
          ${evt.time ? `<p class="text-[10px] text-gray-400 mt-0.5">${evt.time}</p>` : ''}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="${isPast ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'} text-sm font-bold truncate">${escapeHtml(evt.title)}</h3>
            ${isPast ? '<span class="badge flex-shrink-0">已结束</span>' : '<span class="badge flex-shrink-0" style="background:var(--accent);color:#fff">即将到来</span>'}
          </div>
          <p class="text-xs text-gray-400 mt-1">${escapeHtml(evt.venue)}</p>
          <div class="flex flex-wrap gap-1 mt-1.5">${chips}</div>
        </div>
      </a>`;
    }).join('');
    return `<div class="mb-10"><h2 class="text-sm font-bold text-pink-500 tracking-widest mb-4">${month}</h2><div class="space-y-2">${itemsHtml}</div></div>`;
  }).join('');

  const body = events.length === 0
    ? '<p class="text-center text-gray-400 py-16">暂无日程</p>'
    : groupsHtml;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>日程 | Gleams</title>
<link rel="icon" href="/favicon.ico" />
<link rel="stylesheet" href="/_astro/*.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet" />
<style>
:root { --accent: #e83e8c; }
body { font-family: 'Noto Sans SC', sans-serif; margin: 0; }
.chip { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.05); }
.dark .chip { background: rgba(255,255,255,0.1); }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.06); color: #6b7280; }
.frost-card { background: rgba(255,255,255,0.55); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.3); }
.dark .frost-card { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
.glass { background: rgba(255,255,255,0.4); backdrop-filter: blur(8px); }
.dark .glass { background: rgba(255,255,255,0.03); }
</style>
</head>
<body>
<script>
// 主题切换 (与主站一致)
(function() {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
})();
</script>
<header style="position:sticky;top:0;z-index:50;backdrop-filter:blur(16px);background:rgba(255,255,255,0.7);border-bottom:1px solid rgba(0,0,0,0.06);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;max-width:1280px;margin:0 auto">
<a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none"><img src="/logo.png" alt="Gleams" style="width:32px;height:32px;border-radius:50%" /><span style="font-weight:700;font-size:16px;color:#333">Gleams</span></a>
<nav style="display:flex;gap:16px;font-size:13px"><a href="/members" style="text-decoration:none;color:#666">成员</a><a href="/schedule" style="text-decoration:none;color:var(--accent);font-weight:600">日程</a><a href="/gallery" style="text-decoration:none;color:#666">画廊</a><a href="/fans" style="text-decoration:none;color:#666">广场</a><a href="/about" style="text-decoration:none;color:#666">关于</a></nav>
</header>
<main style="max-width:56rem;margin:0 auto;padding:3rem 1rem">
<div style="text-align:center;margin-bottom:2.5rem"><p style="color:var(--accent);font-size:14px">✦</p><h1 style="font-size:24px;font-weight:700;margin:4px 0 0 0">日程</h1></div>
${body}
</main>
<footer style="text-align:center;padding:2rem 1rem;font-size:12px;color:#9ca3af;border-top:1px solid rgba(0,0,0,0.06);margin-top:2rem">
<p>© 2026 Gleams 应援站 · <a href="/admin" style="color:#9ca3af;text-decoration:none">管理</a></p>
</footer>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' },
  });
}
