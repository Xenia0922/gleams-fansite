/**
 * 共享：events 表的建表 / 播种 / 回填。
 * 同时被 functions/api/events.js（数据接口）与 functions/_middleware.js（SSR 数据注入）引用，
 * 确保全站只有一份真实种子数据——杜绝曾经 schedule.js 写入虚构标题的问题。
 *
 * 种子数据来源：src/data/schedule.json（事件元数据）+ src/data/eventBodies.ts（日程详情正文）。
 * 新增/修改事件只需编辑这两个文件，Functions 端通过 esbuild 自动打包同步。
 *
 * 注意：Cloudflare Pages Functions 用 esbuild 打包 .js，不做 TS 类型剥离，
 * 所以本文件保持纯 JS（JSDoc 注释即可，不要写 TS 类型注解）。
 */

import scheduleData from '../../src/data/schedule.json';
import { EVENT_BODIES } from '../../src/data/eventBodies.ts';

const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  venue TEXT,
  performers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  image TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);`;

/**
 * 导出 DDL 给 _middleware.js 和 api/events.js 复用。
 * 建表语句全仓统一，避免约束不一致。
 */
export const EVENTS_DDL_SQL = DDL;

/**
 * 建表（兼容旧表加 body 列）+ 首次播种 + 已存在数据回填 image/body（仅空时填）。
 * 由 events.js 与 middleware 共用，保证全站事件数据唯一且真实。
 */
export async function ensureEvents(env) {
  await env.DB.prepare(DDL).run();
  // 旧表补 body 列（部署前已存在 events 表时）
  try {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN body TEXT').run();
  } catch (e) { /* 列已存在则忽略 */ }
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').all();
    if (results[0] && results[0].c === 0) {
      for (const e of scheduleData.events) {
        await env.DB
          .prepare(
            `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`
          )
          .bind(e.id, e.date, e.time || '', e.title, e.venue || '', JSON.stringify(e.performers || []), e.status || 'past', e.image || '', EVENT_BODIES[e.id] || '', new Date().toISOString())
          .run();
      }
    } else {
      // 已存在数据的表：回填旧 news 的 image 与 body（仅当对应字段为空，不覆盖后台已编辑内容）
      const { results: emptyImg } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE image IS NULL OR image = ''").all();
      if (emptyImg[0] && emptyImg[0].c > 0) {
        for (const e of scheduleData.events) {
          if (!e.image) continue;
          await env.DB
            .prepare('UPDATE events SET image = ? WHERE id = ? AND (image IS NULL OR image = \'\')')
            .bind(e.image, e.id)
            .run();
        }
      }
      const { results: emptyRows } = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE body IS NULL OR body = ''").all();
      if (emptyRows[0] && emptyRows[0].c > 0) {
        for (const [id, body] of Object.entries(EVENT_BODIES)) {
          await env.DB
            .prepare('UPDATE events SET body = ? WHERE id = ? AND (body IS NULL OR body = \'\')')
            .bind(body, id)
            .run();
        }
      }
    }
  } catch (e) { console.error('[seed] ensureEvents failed:', e.message); }
}
