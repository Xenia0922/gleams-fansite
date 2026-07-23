/**
 * Pass 2: 给所有 json(...) 调用加上 context 参数。
 * 用一个稳健的字符级扫描：识别 token "json" + 空白 + "("，跟踪括号深度。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'functions/api/events.js',
  'functions/api/members.js',
  'functions/api/messages.js',
  'functions/api/gallery.js',
  'functions/api/recruits.js',
  'functions/api/reactions.js',
  // site.js 不需要（不在第一阶段）
];

let total = 0;

for (const path of FILES) {
  let src = readFileSync(path, 'utf8');
  const orig = src;
  let changed = 0;

  // 用一个简单粗暴 state machine
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    // 检查是否匹配 "json(" 这个 token
    if (src.startsWith('json(', i)) {
      // 确保前一个字符不是字母数字下划线点（即不跟前一个标识符连在一起）
      const prev = i > 0 ? src[i - 1] : '';
      if (!/[A-Za-z0-9_$.]/.test(prev)) {
        // 找到匹配的右括号位置
        let depth = 1;
        let j = i + 5;
        while (j < n && depth > 0) {
          const cc = src[j];
          if (cc === '"' || cc === "'" || cc === '`') {
            const ch = cc;
            j++;
            while (j < n && src[j] !== ch) {
              if (src[j] === '\\' && j + 1 < n) j++;
              j++;
            }
            j++;
            continue;
          }
          if (cc === '(') depth++;
          if (cc === ')') depth--;
          if (depth === 0) break;
          j++;
        }
        if (depth === 0) {
          // 提取参数
          const args = src.slice(i + 5, j);
          // 数顶层逗号
          let k = 0;
          let commas = 0;
          let dd2 = 0;
          while (k < args.length) {
            const x = args[k];
            if (x === '"' || x === "'" || x === '`') {
              const ch = x;
              k++;
              while (k < args.length && args[k] !== ch) { if (args[k] === '\\') k++; k++; }
              k++;
              continue;
            }
            if (x === '(' || x === '[' || x === '{') dd2++;
            if (x === ')' || x === ']' || x === '}') dd2--;
            if (x === ',' && dd2 === 0) commas++;
            k++;
          }
          const ctx = '{ request, env }';
          let newCall;
          if (commas >= 2) {
            newCall = 'json(' + args + ')'; // 不动
          } else if (commas === 1) {
            newCall = 'json(' + args + ', ' + ctx + ')';
          } else {
            // 0 个顶层逗号 — data 单参
            // 处理 string 单参： json('Method not allowed', 405)  等等
            // 实际上我们刚才数到 0，说明连 status 默认都缺
            newCall = 'json(' + args + ', 200, ' + ctx + ')';
          }
          out += newCall;
          i = j + 1;
          changed++;
          continue;
        }
      }
    }
    out += src[i];
    i++;
  }
  if (changed) {
    writeFileSync(path, out);
    total += changed;
    console.log(`✅ ${path}: ${changed} 处 json() 调用已加 context`);
  } else {
    console.log(`⏭  ${path}`);
  }
}
// site.js 处理（先看内容）
const siteSrc = new TextDecoder().decode(readFileSync('functions/api/site.js'));
if (siteSrc.includes('json(') && !siteSrc.includes('{ request, env }')) {
  console.log('site.js 需手工处理');
}

console.log(`\n总计: ${total} 处`);
