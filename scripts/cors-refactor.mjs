/**
 * CORS 自动重构：将 functions/api/*.js 中所有 json(...) 调用加上 context 参数，
 * 仅保留 upload.js / photos.js 已手工处理（和方法签名与混合写法不一致）。
 *
 * 规则：
 *   - 顶部 import 增加 handlePreFlight
 *   - onRequest 顶部增加 handlePreFlight 检查
 *   - 已有 json(data) -> json(data, status, ctx)
 *
 * 这是修复现场一次性的工具脚本，修复完后可删除。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = 'functions/api';
const SKIP = new Set(['upload.js', 'photos.js']);

const files = readdirSync(API_DIR)
  .filter(f => f.endsWith('.js') && !SKIP.has(f))
  .filter(f => f !== '_rate.js');

let totalChanged = 0;
let problems = [];

for (const file of files) {
  const path = join(API_DIR, file);
  let src = readFileSync(path, 'utf8');
  const orig = src;

  // 1) import 加上 handlePreFlight
  src = src.replace(
    /import \{ ([^}]*) \} from '..\/_shared.js';/,
    (m, names) => {
      const set = new Set(names.split(',').map(s => s.trim()));
      if (!set.has('handlePreFlight')) set.add('handlePreFlight');
      return `import { ${Array.from(set).join(', ')} } from '../_shared.js';`;
    }
  );

  // 2) onRequest 顶部插入 handlePreFlight 检查
  src = src.replace(
    /(export async function onRequest\(context\)\s*\{\s*)(const \{ request, env \})/,
    '$1const pre = handlePreFlight(context);\n  if (pre) return pre;\n  $2'
  );

  // 3) 替换所有 json(...) 调用 — 用括号匹配算配对深度
  // 简单地：在每次遇到 'json(' 开始计数，到下一个匹配的 ')' 替换
  // 跳过字符串内的 json(、注释内的；
  // 为了稳健，用一个能正确处理 JS 的简易 token 化方案
  let out = '';
  let i = 0;
  let inStr = false;
  let strCh = '';
  let inLineCom = false;
  let inBlkCom = false;
  const len = src.length;
  while (i < len) {
    const c = src[i];
    const next = src[i + 1];

    if (inLineCom) { out += c; if (c === '\n') inLineCom = false; i++; continue; }
    if (inBlkCom) { out += c; if (c === '*' && next === '/') { out += next; i += 2; inBlkCom = false; continue; } i++; continue; }
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < len) { out += src[++i]; i++; continue; }
      if (c === strCh) inStr = false;
      i++; continue;
    }
    if (c === '/' && next === '/') { inLineCom = true; out += c; i++; continue; }
    if (c === '/' && next === '*') { inBlkCom = true; out += c; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; out += c; i++; continue; }

    if (src.slice(i, i + 5) === 'json(' && /\w|^json/.test(i === 0 ? '' : src[i - 1])) {
      // 边界检查：前面是标识符字符则不是 json 调用
      const prev = i > 0 ? src[i - 1] : '';
      if (/[A-Za-z0-9_$.]/.test(prev)) { out += c; i++; continue; }

      // 找到匹配右括号
      let depth = 1;
      let j = i + 5;
      while (j < len && depth > 0) {
        const cc = src[j];
        // 嵌套字符串
        if (cc === '"' || cc === "'" || cc === '`') {
          const ch = cc;
          j++;
          while (j < len && src[j] !== ch) {
            if (src[j] === '\\') j++;
            j++;
          }
          j++; continue;
        }
        if (cc === '(') depth++;
        if (cc === ')') depth--;
        if (depth === 0) {
          // 命中右括号：args 在 [i+5, j) 之间
          const args = src.slice(i + 5, j);
          // 如果已经包含 ', { ... }' 是第三参数就跳过
          // 启发式：取 args 简单数逗号（只看到第一层逗号）
          let k = 0, dd = 0, commas = 0;
          while (k < args.length) {
            const x = args[k];
            if (x === '"' || x === "'" || x === '`') {
              const ch = x;
              k++;
              while (k < args.length && args[k] !== ch) { if (args[k] === '\\') k++; k++; }
              k++; continue;
            }
            if (x === '(' || x === '[' || x === '{') dd++;
            if (x === ')' || x === ']' || x === '}') dd--;
            if (x === ',' && dd === 0) commas++;
            k++;
          }
          if (commas >= 2) {
            // 已经有第三参数
            out += 'json(' + args + ')';
          } else {
            // 尝试提取 context 名（函数体内通常有 request/env） — 我们已知每文件
            // 函数体内前几行有 const { request, env } = context;
            // 构造一个 context 对象传过去
            const ctxExpr = '{ request, env }';
            if (commas === 0) {
              // json(data)
              out += 'json(' + args + ', 200, ' + ctxExpr + ')';
            } else if (commas === 1) {
              // json(data, status)
              out += 'json(' + args + ', ' + ctxExpr + ')';
            }
          }
          i = j + 1;
          break;
        }
        j++;
      }
      if (depth !== 0) {
        problems.push(`${file}: json() 未找到匹配 )`);
        out += c; i++; continue;
      }
      continue;
    }

    out += c;
    i++;
  }
  src = out;

  if (src !== orig) {
    writeFileSync(path, src);
    totalChanged++;
    console.log(`✅ ${file}`);
  } else {
    console.log(`⏭  ${file} (no changes)`);
  }
}

console.log(`\n重构结束：处理 ${totalChanged} 个文件，待修问题 ${problems.length} 个`);
if (problems.length) {
  console.log(problems.join('\n'));
}
