/**
 * vitest.config.js
 *
 * 纯 Node 环境跑 _shared.js 的纯函数层（无 D1/R2 依赖）。
 * 后续要端到端跑 API（含 CF Workers D1 mock），可切到 @cloudflare/vitest-pool-workers 配置。
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
