/**
 * 预构建（D1 → 构建种子同步）
 * ------------------------------------------------------------
 * 始终向 src/data/schedule.gen.json 写入一份「构建期事件种子」：
 *   - 配置了 Cloudflare D1 REST API 凭据 → 从 D1 拉全部 events（含后台 admin 编辑后的最新数据）。
 *   - 凭据缺失 / 网络错误 / D1 异常 / 无全局 fetch → 退回提交版 schedule.json 作为兜底。
 *
 * [id].astro 的 getStaticPaths 静态 import 该文件，因此该文件「必须始终存在」，
 * 故本脚本任何分支下都会写出 gen 文件（失败分支写兜底），绝不让 astro build 因
 * 「模块不存在」而崩溃。
 *
 * 触发链：
 *   admin 后台改 events → functions/api/events.js 触发 CF Deploy Hook
 *   → CF 重新构建 → 本脚本从 D1 拉最新 events → 静态详情页常新。
 *
 * 软失败原则：单条失败只告警并退回兜底，绝不让构建中断（避免部署失败）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GEN = path.join(ROOT, 'src', 'data', 'schedule.gen.json');
const COMMITTED = path.join(ROOT, 'src', 'data', 'schedule.json');

/** 兜底：用提交版 schedule.json 写入 gen（body 留空，[id].astro 会退回 EVENT_BODIES） */
function writeFallback() {
  try {
    const committed = JSON.parse(fs.readFileSync(COMMITTED, 'utf8'));
    fs.writeFileSync(GEN, JSON.stringify({ events: committed.events || [], bodies: {} }, null, 2));
    console.log('[sync-events-seed] 已写入兜底种子（提交版 schedule.json）');
  } catch (e) {
    console.warn('[sync-events-seed] 兜底种子写入失败（[id].astro 将退回提交版）：', e.message);
    try {
      if (fs.existsSync(GEN)) fs.unlinkSync(GEN);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID) {
    console.log('[sync-events-seed] 未配置 D1 凭据（CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID），使用提交版兜底');
    return writeFallback();
  }
  if (typeof fetch !== 'function') {
    console.warn('[sync-events-seed] 运行环境无全局 fetch（需 Node 18+），使用提交版兜底');
    return writeFallback();
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT id,date,time,title,venue,city,performers,status,image,body,end_time FROM events ORDER BY date DESC, id DESC',
      }),
    });
    const data = await res.json();
    if (!data || data.success !== true || !Array.isArray(data.result) || !data.result[0]) {
      throw new Error('D1 查询响应异常：' + JSON.stringify(data).slice(0, 200));
    }
    const rows = data.result[0].results || [];
    const events = [];
    const bodies = {};
    for (const r of rows) {
      let performers = [];
      try {
        performers = JSON.parse(r.performers || '[]');
      } catch {
        performers = [];
      }
      // 有效状态：end_time 过期则自动判为 'past'（与运行时 api/middleware 一致）
      const eff = (r.status === 'past') ? 'past'
        : (r.end_time && !isNaN(new Date(String(r.end_time).replace(' ', 'T') + ':00+08:00').getTime()) && Date.now() > new Date(String(r.end_time).replace(' ', 'T') + ':00+08:00').getTime())
          ? 'past' : (r.status || 'upcoming');
      events.push({
        id: r.id,
        date: r.date || '',
        time: r.time || '',
        title: r.title || '',
        venue: r.venue || '',
        city: r.city || '',
        performers,
        status: eff,
        image: r.image || '',
        end_time: r.end_time || '',
      });
      if (r.body) bodies[r.id] = r.body;
    }
    fs.writeFileSync(GEN, JSON.stringify({ events, bodies }, null, 2));
    console.log(`[sync-events-seed] 已从 D1 同步 ${events.length} 条 events → src/data/schedule.gen.json`);
  } catch (e) {
    console.warn('[sync-events-seed] D1 同步失败，退回提交版兜底：', e.message);
    writeFallback();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
