/**
 * 预构建：将 src/data/ 的种子文件同步到 functions/data/，
 * 确保 Cloudflare Pages Functions 的 esbuild 可以打包它们。
 *
 * src/data/ 为唯一真相源，functions/data/ 由本脚本自动生成。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'data');
const DST = path.join(ROOT, 'functions', 'data');

fs.mkdirSync(DST, { recursive: true });

// 1. JSON 文件直接复制
for (const name of ['schedule.json', 'members.json']) {
  const src = path.join(SRC, name);
  const dst = path.join(DST, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`[copy-seeds] ${name} → functions/data/`);
  }
}

// 2. eventBodies.ts → eventBodies.js（去掉 TS 类型注解）
const tsPath = path.join(SRC, 'eventBodies.ts');
const jsPath = path.join(DST, 'eventBodies.js');
if (fs.existsSync(tsPath)) {
  let content = fs.readFileSync(tsPath, 'utf8');
  // 移除 TS 类型注解（Record<string, string>）
  content = content.replace(
    /export const EVENT_BODIES: Record<string, string> = /,
    'export const EVENT_BODIES = '
  );
  // 移除顶层 TS 注释不影响
  fs.writeFileSync(jsPath, content);
  console.log('[copy-seeds] eventBodies.ts → eventBodies.js');
}
