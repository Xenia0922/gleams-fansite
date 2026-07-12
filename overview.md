# Gleams 应援站 · 重新体检报告（2026-07-12）

> 本次为「重新分析检查」——在上一版架构说明基础上，实际跑构建 + 读源码 + 查链路，产出**以问题为导向**的体检结论，而非再写一遍结构说明。

## ✅ 健康项（已逐项核实）

| 检查点 | 结论 | 证据 |
|---|---|---|
| 构建 | 24 页，EXIT=0，零报错 | `npm run build` |
| 成员九宫格「点＋删第一张」老 bug | **已真修** | `5b0dc3c`：根因是 `latest.current`(ref) 与 `form.gallery`(state) 双重状态源，`useEffect` 同步延迟导致异步上传读过期值覆盖；现改为 `onChange(updater)` 函数式透传单源（MemberGalleryUpload 第 7/24-26/42/69 行 + AdminMembers 第 138 行） |
| `functions/*.js` 纯 JS（CF 部署安全） | **已清** | `76bad2c` 移除 gallery.js 的 TS 注解；grep 9 个 API 零 `: Type` 注解 |
| 后台新建成员微博名/简介丢失 | **已修** | `9c4b661`：AdminMembers 现含 `weibo`/`weibo_name`/`weibo_desc` 字段 |
| 后台加图链路 | 通畅 | `upload.js` 返回 `/api/photos?key=...`，通过 gallery POST 白名单 `/^\/api\/photos|https?:\/\//` |
| `AdminGallery.tsx` 是否孤儿 | 否，仍用 | AdminPanel 第 374 行（「广场」Tab 的返图管理），归位正确 |
| 灯箱组件断链 | 无 | `ImageLightboxOverlay.tsx` 存在，AdminGalleryEdit 第 3/254 行引用正确 |
| 调试残留 | 无 | src/functions 无 `console.log`/`debugger`/`TODO`（gallery.js 的 `console.error` 为合法错误日志） |
| 可访问性 | 已做一轮 | `e016bd2` a11y P1+P2（skip-link / aria / 对比度等） |

## ✅ 资源体积（纠正上一版错误）

- **`dist/` 实际 15MB**（非上一版误写的 280MB）。死文件清理在 `8580880` 已完成（public 图 278MB→13MB）。
- `public/images/` ≈ 12.7MB，分 `events 6.9M / members 5.0M / tokuten 0.8M`，均为 webp，尺寸合理。

## ⚠️ 发现并修复的隐患

1. **`.wrangler/` 未被 gitignore**（LOW）
   - `git status` 显示其为未跟踪项（wrangler 本地态目录，含 `state/`、`tmp/`），有被误提交风险。
   - **已修复**：在 `.gitignore` 的 `# Astro` 段加入 `.wrangler/`。

## 📌 仍可留意的（非 bug，按需优化）

- **画廊排序 `sort` 编码**：PATCH 用 `成员序号×1000000 + 组内位次`，单组成员 >100 万张才会出现跨组碰撞 —— 实际不可能，仅记录。
- **`seedIfEmpty` 每次 GET 跑 2 次读**：画廊页每次请求都 `COUNT`+查 `seeded`，属轻微冗余，量级可忽略。
- **新闻内容仍是 build-time Markdown**（`src/content/news/*.md` 9 篇）：改一次要 redeploy，无法后台编辑。如需后台可编辑活动结算，要再开一张 `news` 表 + 后台 Tab（独立优化项）。
- **画廊灯箱按组翻页**：在某成员组内点开只在该组成员图间翻，不跨组。如需全局翻页可改。

## 🧭 总体判断

项目**当前可正常部署、运行、维护**。反复困扰的「成员九宫格删图」bug 这次从根因（双重状态源）彻底根除，而非表面修补；CF 部署阻塞（JS 里的 TS 注解）也已清掉。代码层面没有发现新的阻断性 bug，唯一实质改动是补 `.wrangler/` 进 gitignore。可放心继续在现有架构上加功能。
