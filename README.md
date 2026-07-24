# Gleams 应援站

广西南宁地下偶像团体 Gleams 的非官方粉丝应援站 —— [gleams.vip](https://gleams.vip)

---

## 站点功能

**公开页面**

| 页面 | 内容 |
|------|------|
| 首页 | Hero（可后台自定义）、成员卡片、演出倒计时、过往行程 |
| 成员 | 个人资料（无字数限制）、九宫格画廊、微博 |
| 日程 | 公演日历（按月分组）、活动结算详情（Markdown 正文） |
| 画廊 | 照片浏览（成员筛选 + 灯箱）+ 骑士团精选 |
| 特典 | 官方特典规则 + 过往物贩 |
| 骑士团广场 | 粉丝留言板 + 返图上传 + Emoji 反应（Telegram reaction 风格） |
| 关于 | 世界观、团体介绍、支持方式 |

**后台 CMS（`/admin`）**

`ADMIN_CODE` 保护，支持：
- 成员 / 日程 / 画廊 / 广场 / 特典 / 站点配置 / 广告的增删改查
- 图片审核（粉丝上传默认 pending，admin 通过后才公开）
- Hero 栏自定义（标题/副标题/Logo/背景图/透明度/焦点位置 + 实时预览）
- 留言屏蔽词管理（子串匹配 + `/正则/` 格式）

---

## 技术架构

```
src/
├── pages/           Astro 页面（含 [id] 动态路由）
├── components/      React 岛屿 + Astro 组件
│   ├── admin/       后台管理子组件
│   └── SkeletonSwap.tsx   骨架→内容交叉淡入过渡
├── layouts/         全局布局（含防 FOUC 主题色）
├── styles/          全局 CSS（设计系统 + 移动端适配）
├── data/            JSON / TS 种子数据（唯一真相源 + 首屏兜底）
└── utils/           共享工具

functions/            CF Pages Functions（纯 JS，esbuild 打包）
├── _middleware.js   SSR 数据注入（按路径查 D1 → __SSR_DATA__）
├── _shared.js       公共函数（adminOk / verifyTurnstile / containsBlocked）
├── _seed.js         events 表播种（读取 functions/data/）
├── _rate.js         IP 限流
├── [[path]].js      catch-all 兜底（后台新增日程详情动态渲染）
├── data/            种子数据（由 prebuild 从 src/data 自动生成）
│   ├── schedule.json
│   ├── members.json
│   └── eventBodies.js
└── api/             接口：members / events / photos / messages /
                     gallery / site / recruits / reactions / upload

scripts/
└── copy-seeds.cjs   prebuild 钩子：src/data → functions/data 同步
```

**数据流**：`src/data/` 是**唯一真相源**（JSON / TS 种子）→ `prebuild` 钩子（`scripts/copy-seeds.cjs`）在构建前把它们同步进 `functions/data/`（`.ts` 去类型注解转 `.js`，供 CF Pages Functions 的 esbuild 正常打包）→ 构建期 JSON 同时作为首屏兜底（SSG）。运行时 `middleware` 按路径查询 D1 注入 `window.__SSR_DATA__` → React 岛优先读 SSR 数据（零二次加载），无 SSR 才回退 fetch。D1 表首次请求自动建表播种，无需手动 migration。

**零二次加载架构**：所有数据岛采用「骨架优先」——`useState` 初始空 + `loading=true`，`useEffect` 按 SSR > 种子 > fetch 优先级填充，`SkeletonSwap` 实现骨架→内容交叉淡入（无空档、无布局跳动）。骨架微光为连续流光（`background-position` 匀速循环，非单条扫过即停）。

**粉丝内容防护**（去暗号后分层）：
1. Cloudflare Turnstile 人机验证（挡 bot，国内加载失败时 fail-open）
2. 留言屏蔽词（子串匹配 + 正则，admin 可编辑）
3. IP 限流（30 秒/条留言，5 秒/次上传）
4. 图片审核（粉丝上传 `uploads/pending/` 待审，admin 通过后 copy 到 `uploads/` 才公开，不依赖 R2 customMetadata）

---

## 技术栈

Astro 5 (Static SSG) · React 19（岛屿） · TypeScript · Tailwind CSS 3 · Cloudflare Pages（Functions · D1 · R2）

---

## 本地开发

要求 **Node 20+**（Astro 5 兼容 `^18.17.1 || ^20.3.0 || >=22.0.0`）。

```bash
npm install
npm run dev      # http://localhost:4321
npm run build     # 构建到 dist/（自动先跑 prebuild 同步种子数据）
npm run preview   # 本地预览 dist/
```

> 本地 `npm run dev` 不连接 D1/R2，留言/返图/后台等功能需部署后联调；页面用 `src/data/` 种子兜底渲染。

---

## 部署

1. Cloudflare Dashboard → Workers & Pages → 连接 GitHub 仓库
2. 框架预设 Astro，构建命令 `npm run build`，输出目录 `dist`（`prebuild` 钩子会自动把 `src/data/` 种子同步进 `functions/data/`，无需手动处理）
3. 环境变量：
   - `ADMIN_CODE`（后台管理 / 删除 / 上传）
   - `TURNSTILE_SITE_KEY`（Turnstile widget site key，前端渲染用）
   - `TURNSTILE_SECRET_KEY`（Turnstile siteverify secret，私密）
4. 绑定：`DB`（D1 数据库）、`PHOTOS`（R2 存储桶）
5. 部署——所有表首次 API 请求时自动创建，无需手动 migration

> Turnstile site key 与 secret 均通过环境变量配置，不硬编码在源码中。未配置时 widget 不渲染、后端 fail-open，靠限流 + 屏蔽词 + 图片审核兜底。

---

## 许可

粉丝应援项目，内容版权归 Gleams 官方所有。代码 MIT（见 [LICENSE](LICENSE)）。
