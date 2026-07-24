/**
 * Cloudflare Pages Functions — 共享工具函数
 * 消除各 API 文件中的 adminOk / json / withTable 重复代码。
 *
 * 每个 API 文件只需：
 *   import { adminOk, json, withTable } from '../_shared.js';
 */

import { rateAllow, rateLog } from './api/_rate.js';

/**
 * 返回 JSON Response（含安全头）
 *
 * CORS 处理：默认仅 same-origin 与白名单域可跨域访问，跨域预检返回对应头。
 * - ALLOWED_ORIGINS env：逗号分隔（如 'https://gleams.vip,https://dev.gleams.vip'）
 * - 未配置：默认为 ['https://gleams.vip']，额外放行 localhost（dev）
 * - 跨域不通过时：返回 *（对非 GET 请求会失败）— 保留 GET 默认行为以兼容 SSR 中间件注入
 */
const DEFAULT_ALLOWED_ORIGINS = ['https://gleams.vip'];
const DEV_ALLOWED_ORIGINS = ['http://localhost:4321', 'http://localhost:3000', 'http://127.0.0.1:4321'];

function parseAllowedOrigins(env) {
  const list = (env?.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [...list, ...DEFAULT_ALLOWED_ORIGINS, ...DEV_ALLOWED_ORIGINS];
}

function originAllowed(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null; // same-origin 请求不带 Origin，始终允许
  const allowed = parseAllowedOrigins(env);
  return allowed.includes(origin) ? origin : null;
}

/**
 * 返回 JSON Response（含安全头 + CORS）
 *
 * 用法：
 *   return json({ ok: true }, 200, context);   ← 传入完整 context，自动注入 CORS 与 Vary
 *   return json({ error: 'msg' }, 500);         ← 仅当不需要 CORS（已用 withCors 包装的函数外层）
 */
export function json(data, status = 200, context) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    Vary: 'Origin',
  };
  if (context && context.request && context.env) {
    const allow = originAllowed(context.request, context.env);
    if (allow) headers['Access-Control-Allow-Origin'] = allow;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * CORS 预检处理器 + 入口路由助手
 *
 * 用法：在每个 onRequest 函数最顶部：
 *   const pre = handlePreFlight(context);
 *   if (pre) return pre;
 */
export function handlePreFlight(context) {
  const { request, env } = context;
  if (request.method !== 'OPTIONS') return null;
  const origin = originAllowed(request, env);
  if (origin) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-code',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }
  return new Response(null, { status: 403 });
}

/**
 * 验证管理后台暗号
 *
 * 用 Web Crypto 的 timingSafeEqual（按位 XOR + OR 累积）做常量时间比较，
 * 防止攻击者依赖字符串比较的响应时间差异反推 admin code。
 * - 两长度不一 → 失败（直接返回 false，不依赖 env 内容）
 * - env.ADMIN_CODE 未配置 → 失败（fail-closed，未配密钥不应放过任何请求）
 * - 否则按常量时间比较（长度按更长者扩展，0 也参与 XOR）
 */
export function adminOk(request, env) {
  const provided = request.headers.get('x-admin-code') || '';
  const expected = env.ADMIN_CODE || '';
  if (!expected) return false; // 未配置 admin 密钥，关闭全部写权限
  return __constantTimeEqual(provided, expected);
}

/**
 * 常量时间字符串比较：对每个字节做 XOR 后累加 OR，最终看是否严格为 0。
 * 提前长度补齐 + 长度参与对比，保证分支不依赖内容。
 * 字符以 UTF-8 字节序列解析，跨平台行为一致（Workers 8 位 charCode）。
 * 测试需要：内部导出 __constantTimeEqual 便于 unit test 直接验。
 */
export function __constantTimeEqual(a, b) {
  const ab = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

/**
 * admin 操作防护：权限验证 + IP 限流（24h 100 次）。
 * 通过返回 null（即 undefined）；拒绝返回 json Response 可直接 return。
 * 用法：const denied = await adminGuard(request, env); if (denied) return denied;
 */
export async function adminGuard(request, env) {
  if (!adminOk(request, env)) return json({ error: '无权限' }, 403);
  try {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const allowed = await rateAllow(env, ip, 'admin', 500, 24 * 3600 * 1000);
    if (!allowed) return json({ error: '操作过于频繁，请稍后再试' }, 429);
    await rateLog(env, ip, 'admin');
  } catch (e) {
    // rateAllow/rateLog 内部已 try/catch，此处兜底：任何意外异常都 fail-open 放行
    console.error('[adminGuard] rate check/log failed, fail-open:', e.message);
  }
  return null;
}

/**
 * 验证 Cloudflare Turnstile token（canonical siteverify）。
 * - 未配置 TURNSTILE_SECRET_KEY：fail-open（返回 true）
 * - token 空（Turnstile 脚本加载失败，国内常见）：fail-open（返回 true，靠限流+屏蔽词+审核兜底）
 * - token 非空：siteverify 验证，success===true 放行，否则拒绝
 */
export async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // 未配置，fail-open
  if (!token) return true; // token 空（Turnstile 脚本加载失败），fail-open
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
 * 屏蔽词命中检查。
 * - 普通词：子串匹配（大小写不敏感，含该词即命中）
 * - /pattern/ 格式：正则匹配（如 /加.{0,2}信/ 匹配"加微信/加q信"）
 * 普通词不会被正则元字符误伤（. * + 等按字面匹配）。
 */
export function containsBlocked(text, words) {
  if (!words || !Array.isArray(words) || !words.length || !text) return false;
  const lower = String(text).toLowerCase();
  for (const w of words) {
    if (!w) continue;
    const reMatch = /^\/(.+)\/([imu]*)$/.exec(w);
    if (reMatch) {
      try {
        if (new RegExp(reMatch[1], reMatch[2] || 'i').test(text)) return true;
      } catch { /* 无效正则跳过 */ }
    } else {
      if (lower.includes(String(w).toLowerCase())) return true;
    }
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
