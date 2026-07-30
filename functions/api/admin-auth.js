/**
 * POST /api/admin-auth — 纯暗号校验，零 D1 依赖。
 *
 * 登录鉴权与"读取后台数据"解耦：原先登录走 GET /api/recruits?all=1，
 * 该接口在权限校验同时还会 SELECT recruits，D1 偶发抖动会让整请求 500，
 * 前端把非 200/非 403 统一显示成「验证失败，请稍后重试」→ 偶发登不进。
 *
 * 本接口只用 adminOk（基于 env.ADMIN_CODE 的常量时间比较），不涉及任何数据库，
 * 因此不会因 D1 抖动/冷启动而 500，登录链路彻底稳定。
 *
 * 200 → 暗号正确；403 → 暗号错误；其它（理论上不会）才视为异常。
 */

import { adminOk, json, handlePreFlight } from '../_shared.js';

export async function onRequest(context) {
  const pre = handlePreFlight(context);
  if (pre) return pre;
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (adminOk(request, env)) return json({ ok: true }, 200);
  return json({ error: '暗号错误' }, 403);
}
