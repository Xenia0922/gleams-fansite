/**
 * tests/shared.test.js
 *
 * 覆盖 _shared.js 里关键纯逻辑：时序安全 admin 校验、屏蔽词、ORIGIN 白名单。
 * 完整测试列表：
 *  1. __constantTimeEqual — 字符串相等 / 不同 / 长度差异 / 空 / Unicode
 *  2. adminOk — 正确暗号通过 / 错误暗号拒绝 / 空 header / 同前缀差异
 *  3. adminOk — env 未配置 ADMIN_CODE 时强制拒绝（fail-closed）
 *  4. containsBlocked — 命中 / 未命中 / 正则命中 / 大小写忽略 / 空文本
 *  5. json — 默认安全头存在 / CORS 同源（同源不带 Origin） / 跨域允许白名单
 *
 * 跑测：npm test
 */
import { describe, it, expect } from 'vitest';
import {
  __constantTimeEqual,
  adminOk,
  containsBlocked,
  json,
  handlePreFlight,
} from '../functions/_shared.js';

function mkEnv(extra = {}) {
  return {
    ADMIN_CODE: 'secret-123',
    ALLOWED_ORIGINS: '',
    ...extra,
  };
}

function mkRequest({ method = 'GET', origin = null, headers = {} } = {}) {
  return {
    method,
    url: 'https://gleams.vip/api/members',
    headers: new Map(Object.entries({
      'x-admin-code': '',
      ...headers,
      ...(origin ? { origin } : {}),
    })),
  };
}

describe('__constantTimeEqual', () => {
  it('相同字符串返回 true', () => {
    expect(__constantTimeEqual('secret123', 'secret123')).toBe(true);
  });
  it('不同字符串返回 false', () => {
    expect(__constantTimeEqual('secret123', 'secret124')).toBe(false);
  });
  it('长度不同返回 false', () => {
    expect(__constantTimeEqual('sec', 'secret')).toBe(false);
    expect(__constantTimeEqual('', 'x')).toBe(false);
  });
  it('空字符串比较返回 true', () => {
    expect(__constantTimeEqual('', '')).toBe(true);
  });
  it('Unicode 输入按字节比较', () => {
    expect(__constantTimeEqual('中文', '中文')).toBe(true);
    expect(__constantTimeEqual('中文', '英文')).toBe(false);
  });
  it('null / undefined 输入安全', () => {
    expect(__constantTimeEqual(null, 'x')).toBe(false);
    expect(__constantTimeEqual('x', undefined)).toBe(false);
  });
});

describe('adminOk — 时序安全 + fail-closed', () => {
  it('正确暗号通过', () => {
    const req = mkRequest({ headers: { 'x-admin-code': 'secret-123' } });
    expect(adminOk(req, mkEnv())).toBe(true);
  });
  it('错误暗号拒绝', () => {
    const req = mkRequest({ headers: { 'x-admin-code': 'wrong' } });
    expect(adminOk(req, mkEnv())).toBe(false);
  });
  it('空 header 拒绝', () => {
    expect(adminOk(mkRequest(), mkEnv())).toBe(false);
  });
  it('共享前缀但末位不同 — 必须拒绝', () => {
    const req = mkRequest({ headers: { 'x-admin-code': 'secret-124' } });
    expect(adminOk(req, mkEnv())).toBe(false);
  });
  it('env 未配置 ADMIN_CODE — 全部拒绝（fail-closed）', () => {
    const req = mkRequest({ headers: { 'x-admin-code': 'secret-123' } });
    expect(adminOk(req, mkEnv({ ADMIN_CODE: '' }))).toBe(false);
    expect(adminOk(req, { ALLOWED_ORIGINS: '' })).toBe(false); // 完全没 ADMIN_CODE 字段
  });
});

describe('containsBlocked — 屏蔽词', () => {
  it('命中普通词', () => {
    expect(containsBlocked('加微信dd', ['加微信'])).toBe(true);
    expect(containsBlocked('我的微信', ['微信'])).toBe(true);
  });
  it('大小写不敏感', () => {
    expect(containsBlocked('Buy DD NOW', ['dd'])).toBe(true);
  });
  it('普通词不会受正则元字符影响', () => {
    // . * + 应按字面匹配 — 不是正则
    expect(containsBlocked('1+1', ['+'])).toBe(true);
    expect(containsBlocked('dot.dot', ['.'])).toBe(true);
  });
  it('命中正则模式', () => {
    expect(containsBlocked('加 微 信', ['/加\\W*微\\W*信/'])).toBe(true);
    expect(containsBlocked('加微信', ['/^加/'])).toBe(true);
  });
  it('未命中', () => {
    expect(containsBlocked('hello world', ['dd', 'bank'])).toBe(false);
  });
  it('空文本 / 空列表', () => {
    expect(containsBlocked('', ['dd'])).toBe(false);
    expect(containsBlocked('xxx', [])).toBe(false);
    expect(containsBlocked('xxx', undefined)).toBe(false);
  });
  it('无效正则静默跳过', () => {
    expect(containsBlocked('abc', ['/[invalid(/'])).toBe(false);
  });
});

describe('json — 安全头 + CORS', () => {
  it('默认安全头齐全', () => {
    const res = json({ ok: true }, 200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('同源请求（同源不带 Origin）不带 CORS 头', () => {
    const req = mkRequest({ origin: null });
    const env = mkEnv();
    const res = json({ ok: true }, 200, { request: req, env });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });

  it('跨域请求带入白名单源返回 CORS 头', () => {
    const req = mkRequest({ origin: 'https://gleams.vip' });
    const env = mkEnv();
    const res = json({ ok: true }, 200, { request: req, env });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gleams.vip');
  });

  it('跨域请求非白名单源不带 CORS 头', () => {
    const req = mkRequest({ origin: 'https://evil.com' });
    const env = mkEnv();
    const res = json({ ok: true }, 200, { request: req, env });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });

  it('env 配置 ALLOWED_ORIGINS 生效', () => {
    const req = mkRequest({ origin: 'https://staging.gleams.vip' });
    const env = mkEnv({ ALLOWED_ORIGINS: 'https://staging.gleams.vip' });
    const res = json({ ok: true }, 200, { request: req, env });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://staging.gleams.vip');
  });

  it('localhost 开发源放行', () => {
    const req = mkRequest({ origin: 'http://localhost:4321' });
    const res = json({ ok: true }, 200, { request: req, env: mkEnv() });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
  });
});

describe('handlePreFlight', () => {
  it('非 OPTIONS 请求 — 返回 null', () => {
    expect(handlePreFlight({ request: mkRequest({ method: 'GET' }), env: mkEnv() })).toBe(null);
  });
  it('OPTIONS 白名单源 — 返回 204 + 头齐全', () => {
    const res = handlePreFlight({
      request: mkRequest({ method: 'OPTIONS', origin: 'https://gleams.vip' }),
      env: mkEnv(),
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gleams.vip');
    expect(res.headers.get('Access-Control-Allow-Methods')).toMatch(/POST/);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('x-admin-code');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
  it('OPTIONS 非白名单源 — 返回 403', () => {
    const res = handlePreFlight({
      request: mkRequest({ method: 'OPTIONS', origin: 'https://evil.com' }),
      env: mkEnv(),
    });
    expect(res.status).toBe(403);
  });
});
