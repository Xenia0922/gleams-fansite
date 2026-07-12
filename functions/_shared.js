/**
 * Cloudflare Pages Functions — 共享工具函数
 * 消除各 API 文件中的 adminOk / json / withTable 重复代码。
 *
 * 每个 API 文件只需：
 *   import { adminOk, json, withTable } from '../_shared.js';
 */

/**
 * 返回 JSON Response
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 验证管理后台暗号
 */
export function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

/**
 * 表不存在时自动建表并重试一次，避免首请求直接 500。
 * @param {D1Database} env.DB — 从 env 传入的 D1 绑定
 * @param {() => Promise<void>} ensureTable — 建表/播种函数（每个 API 文件自定义）
 * @param {() => Promise<Response>} fn — 业务处理函数
 */
export async function withTable(env, ensureTable, fn) {
  try {
    return await fn();
  } catch (e) {
    if (/no such table/i.test(e.message || '')) {
      await ensureTable(env);
      return await fn();
    }
    throw e;
  }
}
