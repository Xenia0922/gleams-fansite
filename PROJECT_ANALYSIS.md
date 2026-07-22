# Gleams 应援站 · 项目分析报告

> 分析视角：UI Designer（前端架构 / 设计系统 / 可访问性 / 组件一致性）
> 分析日期：2026-07-12

---

## 一、项目定位

- **是什么**：广西南宁地下偶像团体 **Gleams** 的非官方粉丝应援站（粉丝自建），线上地址 `gleams.vip`。
- **受众**：粉丝（自称"骑士团"）。核心诉求是查看成员信息、公演日程与结算、浏览/上传返图、留言互动、了解特典规则。
- **性质**：内容型站点 + 轻量 UGC（留言、返图、后台编辑），无重业务逻辑。

---

## 二、技术栈

| 层 | 选型 |
|----|------|
| 框架 | Astro 5（Static 输出 SSG） |
| 交互 | React 19 岛屿（`client:load`） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 3 + 手写设计系统（`globals.css`） |
| 托管 | Cloudflare Pages（静态 + Functions） |
| 数据 | D1（SQLite）+ R2（对象存储） |
| 渲染 | `marked`（Markdown → HTML，构建期 + 运行时服务端） |

---

## 三、架构剖析（核心亮点）

### 3.1 混合渲染：SSG 兜底 + 运行时注入（"零二次加载"）

这是本项目最成熟的架构决策：

- **构建期**：`src/data/*.json` + `eventBodies.ts` 作为首屏兜底种子，Astro 预渲染出完整静态 HTML（成员卡片、日程列表、详情正文直出，无"加载中"占位）。
- **运行时**：Cloudflare Pages Functions 的 `_middleware.js` 拦截所有 HTML 响应，按路径把 D1 最新数据注入 `window.__SSR_DATA__`；React 孤岛优先读它、**跳过客户端 fetch**，从而不影响布局、无二次加载抖动。
- **回退**：静态种子保证首屏永远有内容；D1 数据负责运行时增量覆盖与可编辑性。

### 3.2 数据自举（D1 自动建表 + 播种）

`functions/_seed.js` 在首次 API 请求时自动 `CREATE TABLE` + 播种**真实**种子数据，并与 middleware 共用同一份种子，杜绝了早期"虚构标题"回归问题。`withTable()` 封装在表不存在时自动重试一次，避免首请求 500。

### 3.3 目录与分层

```
src/
  pages/        Astro 路由（13 个：首页/成员/日程/画廊/特典/关于/广场/后台/404）
  components/   React 岛屿 + Astro 组件 + admin 子组件
  layouts/      BaseLayout（SEO / 字体 / FOUC 防护 / 全局组件挂载）
  styles/       globals.css（设计系统本体）
  data/         JSON 种子（首屏兜底）
  utils/        api.ts（前端 API 封装）/ members.ts（成员元数据）/ useEvents.ts
functions/
  _middleware.js  运行时数据注入
  _shared.js       adminOk / json / withTable（去重工具）
  _seed.js         events 表建表+播种（与 middleware 共用）
  _rate.js         限流
  api/*.js         9 个 CRUD 接口（members/events/gallery/messages/site/recruits/upload/photos）
```

### 3.4 跨组件通信

用 `window` 的 `CustomEvent` 事件总线（`gleams-code-set`、`fan-member-filter`、`fan-event-filter`、`tab-browse-visible` 等）做暗号状态同步与成员/场次筛选联动，避免层层 prop 透传。

---

## 四、设计系统评估（UI Designer 视角）

### 4.1 品牌语言：统一且克制 ✅

设计语言为 **"温柔玻璃拟态 + 分层优雅渐变 + 公主风粉色"**，整体调性统一：

- 主色 `--accent`（默认 `#e83e8c`，可被成员色覆盖）；
- 背景是 4 层 `radial-gradient` + 极淡 SVG 颗粒噪声（无额外请求），营造高级触感；
- **明确避开了"AI 模板味"**：无 logo 玻璃环框、无 section 标题胶囊徽章，小标题用纯净的 `✦` 字符。这与项目审美偏好完全一致。

### 4.2 设计 Token 体系

`globals.css` 用 CSS 变量建立了一套可维护的 token：

- **圆角**：14–32px 阶梯；
- **主色**：`--accent` 及 soft/line 衍生（成员色运行时覆盖，防 FOUC）；
- **文字**：`--text` / `--text-strong` / `--text-soft`，深色模式独立映射；
- **阴影**：xs→lg 四级分层柔和阴影 + `--shadow-accent`；
- **过渡**：`--ease` / `--ease-soft` 统一缓动曲线。

移动端用轻量玻璃（`blur(14px)`）减压 GPU，桌面端升级为全量玻璃（`blur(28px) saturate(1.25)`）；`@media (hover: none)` 下禁用悬浮位移；深色模式完整。

### 4.3 可访问性：超出同类粉丝站平均水平 ✅

- 对比度已做 **WCAG AA 修正**：`--text-soft` 调到 `#6f6b86`（4.98:1）；并覆盖 Tailwind `gray-400` 浅色（2.54:1 不达标→用 gray-500）、`gray-400` 暗色（6.7:1）；
- 统一焦点环 `:focus-visible` + 圆角；`skip-link` 键盘第一站跳主内容；
- Header 菜单 / 深色按钮补齐 `aria-expanded` / `aria-pressed` / 动态 label，ESC 关闭；
- `prefers-reduced-motion` 下禁用动画 / 平滑滚动；`content-visibility: auto` 懒加载长区块。

### 4.4 性能细节

- `BaseLayout` 内联脚本首屏前应用 localStorage 成员色（防 FOUC）；
- 字体走国内镜像 `fonts.loli.net`（避免 Google Fonts 阻塞）；
- 移动端强制 `input/textarea/button font-size:16px` 防 iOS 缩放；`*-tap-highlight-color: transparent`。

---

## 五、代码质量与亮点

1. **分层清晰**：`_shared.js`（`adminOk/json/withTable`）、`_seed.js`（共用种子）、`_middleware.js`（注入）各司其职，CRUD 文件极薄。
2. **前端 API 封装成熟**：`api.ts` 统一超时（8s `AbortController`）、`ApiError` 类、管理暗号头、TS 类型定义。
3. **安全头齐备**：`X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy` 已在 `json()` 中统一注入。
4. **移动端性能优化**到位（轻量玻璃、content-visibility、字体防缩放）。
5. **SEO 完整**：集成 `@astrojs/sitemap` + 完整 OpenGraph / Twitter Card。

---

## 六、风险点与改进建议（按优先级）

### P0 — 长期维护必须处理

1. **数据契约双源漂移**：`api.ts` 的 `MemberInfo`/`EventData` 等 TS 接口，与 D1 表结构、Functions 端字段处理是**三套独立定义、靠人工对齐**。内容字段一旦变更极易漏改。
   → 建议：Functions 端引入运行时校验（如 `zod`），并考虑从 D1 schema 生成共享类型。
2. **种子数据三处重复**：真实事件数据硬编码在 `_seed.js`、`src/data/schedule.json`、`src/data/eventBodies.ts`。更新内容需改三处，迟早不一致。
   → 建议：单一来源（D1 为主，JSON 仅作兜底），构建期从 D1 导出 / 反之一处维护。
3. **`functions/api/*.js` 必须纯 JS 的约束易被踩坑**：CF 用 esbuild 打包 `.js` 且**不做 TS 类型剥离**，写 `const x: Type` 会在部署时才报 `Expected ";" but found ":"`（本地 `astro build` 不检查 functions）。
   → 已在项目备忘固化，但建议加 CI 部署前 `wrangler deploy --dry-run` 或 lint 校验。
4. **硬编码 hex 破坏 Token 系统**：`MessageBoard.tsx` 中成员按钮颜色写死了 `'#FFD700' / '#4DA6FF' / '#48D1A0'`，未引用 `members.ts` 的 `MEMBER_META.color` / CSS `--accent`。
   → 建议：统一从成员元数据取色，保证改主色时全站联动。

### P1 — 安全性与健壮性

5. **admin 鉴权为明文比对**：`x-admin-code === env.ADMIN_CODE`，存在时序侧信道。
   → 建议：`crypto.subtle.timingSafeEqual` 比较。粉丝站风险可控，但成本低应修。
6. **CORS 为 `*`（所有 API 开放跨域）**。
   → 建议：限定 `gleams.vip` 来源（留言/上传接口更需收紧）。
7. **`marked` 未 sanitize**：当前 `body` 仅后台可信输入，风险低；一旦未来开放 UGC Markdown，需 `DOMPurify` 或 `marked` 的安全配置。
8. **静默 catch 过多**：组件与 Functions 中大量 `catch { /* ignore */ }`，线上排查困难。
   → 建议：至少开发环境 `console.error`，关键路径上报。
9. **零自动化测试**：全仓无 `test` 脚本，CRUD / seed 逻辑纯靠手动联调。
   → 建议：针对 `functions/api/*` 加最小 `vitest` + `wrangler` 本地测试（至少覆盖 seed、CRUD、鉴权）。

### P2 — 工程整洁度（观察）

10. **`weibo-crawler/` 是独立 Python 项目混入仓库**，建议拆为子模块或独立仓库，保持主站干净。
11. **`public/` 图片资产**：此前已清理 155 个死文件（278MB→13MB），仍建议定期审查 `public/images` 是否被引用，避免再次膨胀。
12. **Node 版本陷阱**：用托管 Node 22 调 `astro build` 会**静默失败**（日志 0 字节、exit 0）；必须用系统 Node 24 走 `npm run build`。建议在仓库加 `.nvmrc` 固化。

---

## 七、总体评价

| 维度 | 评级 | 说明 |
|------|------|------|
| 架构设计 | ★★★★★ | SSG 兜底 + 运行时注入，性能与可编辑性平衡极佳 |
| 设计系统 | ★★★★★ | 品牌统一、克制、深色完整、Token 化 |
| 可访问性 | ★★★★☆ | 已做 AA 修正与焦点/语义，仍有细微空间 |
| 代码整洁 | ★★★★☆ | 分层清晰，但契约双源 / 硬编码 hex 待收敛 |
| 安全与测试 | ★★★☆☆ | 安全头齐备，缺鉴权加固与自动化测试 |

**结论**：这是一个**成熟度超出同类粉丝站**的项目——架构在数据可编辑性与首屏性能之间取得了很好的平衡，设计语言克制且有品牌辨识度。主要技术债集中在**数据契约的单一来源**与**自动化测试缺失**两块；UI 层面最该修的是 `MessageBoard` 的硬编码颜色，让它回到 Token 体系内。
