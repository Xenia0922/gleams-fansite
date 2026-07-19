/**
 * Cloudflare Pages Functions — 共享工具函数
 * 消除各 API 文件中的 adminOk / json / withTable 重复代码。
 *
 * 每个 API 文件只需：
 *   import { adminOk, json, withTable } from '../_shared.js';
 */

/**
 * 返回 JSON Response（含安全头）
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * 验证管理后台暗号
 */
export function adminOk(request, env) {
  return (request.headers.get('x-admin-code') || '') === env.ADMIN_CODE;
}

/**
 * 验证 Cloudflare Turnstile token（canonical siteverify）。
 * 未配置 TURNSTILE_SECRET_KEY 时 fail-open（返回 true，靠限流+屏蔽词+审核兜底）；
 * 配置了则强制 siteverify，验证失败 fail-closed（返回 false）。
 */
export async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // 未配置，fail-open
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip || '',
      }).toString(),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] verify failed:', e.message);
    return false; // 验证服务异常，fail-closed
  }
}

/**
 * 屏蔽词命中检查（大小写不敏感，子串匹配）。
 * words 为字符串数组；text 为待检文本。命中返回 true。
 */
export function containsBlocked(text, words) {
  if (!words || !Array.isArray(words) || !words.length || !text) return false;
  const lower = String(text).toLowerCase();
  for (const w of words) {
    if (w && lower.includes(String(w).toLowerCase())) return true;
  }
  return false;
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
