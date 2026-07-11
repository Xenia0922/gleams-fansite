# Gleams 应援站 — 项目重新分析

**分析日期**：2026-07-12  
**仓库**：github.com/Xenia0922/gleams-fansite  
**线上**：https://gleams.vip  
**提交数**：201 commits · 318 个跟踪文件

---

## 一、项目定位

为广西南宁地下偶像团体 **Gleams**（白菜/云团/柚子，已毕业黄鱼鱼）搭建的**非官方粉丝应援站**。核心目标：展示成员信息、公演日程、活动结算，并提供粉丝互动（留言板 + 返图广场）和后台 CMS 能力。

---

## 二、技术架构

### 技术栈
| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Astro | 5.7+ (static output) |
| UI 岛 | React | 19.1 |
| 样式 | Tailwind CSS | 3.4 (darkMode: class) |
| 部署 | Cloudflare Pages | Functions + D1 + R2 |
| 字体 | Noto Sans SC/JP | via fonts.loli.net (国内CDN) |
| 其他 | Sitemap、RSS 集成 | — |

### 架构模式：Static + Runtime Hybrid

```
Build-time (Astro 静态生成 24 页)
  ├─ src/data/*.json → 首屏兜底数据（SSG 预渲染进 HTML）
  ├─ src/content/news/*.md → 活动结算文章（9 篇）
  └─ 公网页面用 client:load/idle 挂载 React 孤岛

Runtime (Cloudflare Pages Functions)
  ├─ D1 (SQLite) → members / events / messages / recruits / site_config / gallery_photos / gallery_meta / upload_log
  ├─ R2 (PHOTOS 桶) → 粉丝返图 + 后台上传图
  └─ 环境变量 → ADMIN_CODE / SECRET_CODE / DB / PHOTOS
```

**关键设计**：D1 表全部**首次请求自举建表 + 播种 JSON 兜底数据**（`CREATE TABLE IF NOT EXISTS`），无 migration 文件、无需 wrangler，部署即生效。后台编辑写 D1，公网孤岛拉 D1，`src/data/*.json` 仅作 build-time 首屏兜底，编辑后即时生效无需 redeploy。

---

## 三、页面清单（7 + 1 后台）

| 路由 | 页面 | 核心孤岛 | 数据来源 |
|---|---|---|---|
| `/` | 首页 | HomeMembers, HomeEvents, SiteBits | members.json + schedule.json + D1 |
| `/members` | 成员列表 | MembersList (client:load) | D1 /api/members |
| `/members/[slug]` | 成员详情 | MemberDetail | D1 + members.json 预渲染 |
| `/schedule` | 日程 | ScheduleList (client:load) | D1 /api/events + news/*.md |
| `/gallery` | 画廊 | GalleryGrid (client:load) | D1 /api/gallery |
| `/fans` | 广场 | MessageBoard, FanUpload, FanGallery | D1 /api/messages + R2 /api/photos |
| `/tokuten` | 特典 | TokutenContent | D1 /api/site |
| `/about` | 关于 | AboutContent | D1 /api/site |
| `/news/[slug]` | 活动结算 (9篇) | StaticImageLightbox | Markdown (Astro Content Collections) |
| `/admin` | 后台 CMS | AdminPanel (client:load) | 全部 D1 + R2 |

公网导航栏顺序：首页 → 成员 → 日程 → 画廊 → 广场 → 特典 → 关于（微博为 SNS 图标）。

---

## 四、API 端点（9 个）

| 端点 | 方法 | 功能 | 鉴权 |
|---|---|---|---|
| `/api/members` | GET/POST/PUT/DELETE | 成员 CRUD（含 gallery JSON、image） | ADMIN_CODE |
| `/api/events` | GET/POST/PUT/DELETE | 日程 CRUD（含 image 列，幂等 ALTER） | ADMIN_CODE |
| `/api/site` | GET/PUT | 站点配置 KV（关于/特典/微博链接，白名单） | ADMIN_CODE |
| `/api/gallery` | GET/POST/PATCH/DELETE | 画廊独立表（分组 sort） | ADMIN_CODE |
| `/api/photos` | GET/POST/DELETE | R2 图片服务 + 粉丝返图上传 | SECRET_CODE / ADMIN_CODE |
| `/api/messages` | GET/POST/PUT/DELETE | 留言板 CRUD（含 event 列） | SECRET_CODE / ADMIN_CODE |
| `/api/upload` | POST | 后台直传 R2（15MB 限） | ADMIN_CODE |
| `/api/recruits` | GET/POST/PUT/DELETE | 招募广告 CRUD（含排序） | ADMIN_CODE |
| `/api/_rate` | — | 每 IP 滑动窗限流（D1 upload_log） | 内部调用 |

**限流策略**：
- 粉丝上传返图：5 秒内同 IP ≤9 张（`rateAllow`，fail-open）
- 粉丝发留言：30 秒/IP 一次
- 后台登录：30 分钟内 5 次尝试限制（客户端 localStorage 计数）

---

## 五、后台 CMS（7 个 Tab）

Tab 顺序与公网菜单一致：**成员 → 日程 → 画廊 → 广场 → 特典 → 关于 → 广告**

| Tab | 组件 | 能力 |
|---|---|---|
| 成员 | AdminMembers | 增删改成员、ImageUpload 头像、MemberGalleryUpload 九宫格（点击/拖拽/粘贴上传） |
| 日程 | AdminEvents | 增删改日程、ImageUpload 活动图 |
| 画廊 | AdminGalleryEdit | 独立 gallery_photos 表，按成员分组 + 组内拖拽排序 + 分类上传 |
| 广场 | AdminMessages + AdminGallery | 留言管理 + 返图管理（并列） |
| 特典 | AdminTokuten | 特典规则/图片编辑 |
| 关于 | AdminSite | 世界观/介绍/社交链接/微博描述编辑 |
| 广告 | AdminPanel 内联 | 招募广告 CRUD + 拖拽排序 + 浅色/暗色实时预览 |

**画廊与成员简介的隔离**：
- `gallery_photos` 是独立表，首次部署自动从成员 `gallery` 九宫格复制一份快照
- 后台画廊增删/排序只动 `gallery_photos`，成员详情页九宫格（`members.gallery`）完全不受影响
- 公网画廊只读 `gallery_photos`，纯展示无上传入口

---

## 六、设计系统

### 视觉基调
- **风格**：温柔玻璃拟态（glassmorphism）+ 克制优雅渐变
- **主色**：`--accent: #e83e8c`（粉色），可被成员色动态覆盖
- **成员色**：白菜 `#FFD700` / 云团 `#4DA6FF` / 柚子 `#48D1A0`
- **字体**：Noto Sans SC/JP（国内 CDN，避免 Google Fonts 阻塞）

### 玻璃层级
| 类名 | 用途 | 桌面 | 移动 |
|---|---|---|---|
| `.glass` / `.card` | 卡片 | blur(28px) saturate(1.25) + hover translateY(-3px) | blur(14px) 无 hover 位移 |
| `.frost` | 顶部导航 | blur(22px) saturate(1.3) | blur(14px) |
| `.frost-card` | 表单/后台 | blur(18px) | blur(10px) |
| `.glass-solid` | 不透明卡 | #fff + shadow | #fff + shadow-xs |

### 主题色切换
- 圆点带 `data-member-color` + `data-color`，点击直接写 `--accent`
- `localStorage` 存 hex（`gleams-accent`），首屏内联脚本防 FOUC
- 「恢复默认色」浮动按钮：桌面在返回顶部左侧 (`bottom-6 right-20`)，移动端在上方 (`bottom-24 right-6`)
- 跨页同步：`storage` 事件 + `gleams:theme` CustomEvent

### 移动端适配
- 招募广告：桌面 320px 卡片 → 移动端左下角紧凑卡 `max-width: min(74vw, 260px)`
- 恢复主题色按钮：移动端缩小字号/内边距，置于返回顶部正上方
- 全部用 `max-md:` / `@media (max-width: 767px)` 隔离，桌面端不受影响

---

## 七、数据流总览

```
                    ┌──────────────────────────────┐
                    │     Cloudflare D1 (SQLite)    │
                    │  members | events | messages  │
                    │  site_config | recruits       │
                    │  gallery_photos | upload_log  │
                    └──────────┬────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    /api/members          /api/gallery          /api/messages
    /api/events           /api/photos           /api/recruits
    /api/site             (R2)                  /api/upload
         │                     │                     │
    ┌────┴────┐           ┌────┴────┐          ┌────┴────┐
    │公网孤岛  │           │公网孤岛  │          │后台CMS   │
    │Members  │           │Gallery  │          │Admin    │
    │Schedule │           │FanGallery│         │Panel    │
    │About    │           │FanUpload │         │         │
    └─────────┘           └─────────┘          └─────────┘
         │                     │                     │
    build-time             runtime              runtime
    JSON 兜底              fetch D1             fetch D1
```

---

## 八、当前状态评估

### ✅ 做得好的
1. **架构清晰**：Static + Runtime Hybrid 兼顾了首屏性能和运行时编辑能力，后台改完即时生效无需 redeploy。
2. **数据隔离彻底**：画廊独立表、成员简介九宫格、广场返图三者数据零耦合，互不影响。
3. **后台功能完整**：7 个 Tab 覆盖全站内容，拖拽排序、图片上传、实时预览都有。
4. **限流到位**：粉丝上传/留言都有 IP 级限流，后台登录有尝试次数限制。
5. **移动端适配**：玻璃效果减压、按钮避让、广告缩小，用 `max-md:` 隔离不影响桌面。
6. **设计克制**：符合用户偏好——无 AI 模板味的 ring/pill/渐变文字，✦ 小标题 + 纯圆形 logo。

### ⚠️ 需要注意的
1. **`dist/` 体积 280MB**：大量原始图片（158 jpg + 71 webp）直接放 `public/`，未经压缩/响应式处理，首屏加载可能偏慢。
2. **D1 自举建表分散**：9 个 API 各自 `CREATE TABLE IF NOT EXISTS`，没有统一的 migration 入口。若表结构变更（加列），靠 `ALTER TABLE ... ADD COLUMN` + try/catch 幂等，可维护性一般。
3. **`site_config` 表混合 JSON 和纯文本**：`tokuten_rules`/`tokuten_images` 存 JSON 字符串，其余存纯文本，读写时需区分 `JSON_KEYS`，容易遗漏。
4. **画廊灯箱按组翻页**：后台画廊灯箱只在当前成员组内翻页，不能跨组浏览（已提过，用户未要求改）。
5. **`upload_log` 表无 TTL**：靠每次写入时顺手清理 1 小时前记录，若流量低可能积累过期行；高流量时清理本身也是写操作。
6. **`_rate.js` 的 `ensured` 全局变量**：模块级 `let ensured = false` 在 Cloudflare Workers 复用实例时可能跳过建表——但因为 `CREATE TABLE IF NOT EXISTS` 是幂等的，实际无碍。

### 🔧 可优化方向（按优先级）
1. **图片优化**：`public/images/` 的原始 jpg/webp 可考虑接入 Cloudflare Image Resizing 或手动生成多尺寸，首屏 hero 图已有 `preload` 但成员图/活动图没有响应式 `srcset`。
2. **统一 migration**：把 9 个 API 的建表 DDL 收拢到一个 `_migrate.js`，首次请求统一执行，避免分散。
3. **画廊全局灯箱**：后台画廊灯箱改为跨组翻页（可选，用户未要求）。
4. **`upload_log` 定期清理**：改为 TTL 索引或定时清理任务（目前靠写入时顺手清，低流量时可能不触发）。
5. **新闻内容管理**：`src/content/news/*.md` 目前是 build-time Markdown，无法后台编辑。若需运行时编辑活动结算，需新建 D1 表 + API + 后台编辑器。
6. **SEO 补充**：已有 sitemap + OG tags，但缺少结构化数据（JSON-LD `MusicGroup` / `Event`）。

---

## 九、文件结构

```
e:\Gleams net\
├── astro.config.mjs          # Astro 配置（static + react + tailwind + sitemap）
├── tailwind.config.mjs       # Tailwind 配置（darkMode: class + pink 色阶 + Noto Sans）
├── package.json              # 依赖极简：astro/react/tailwind/sitemap/rss
├── functions/api/            # 9 个 Cloudflare Pages Functions
│   ├── _rate.js              # 每 IP 限流（D1 upload_log）
│   ├── members.js            # 成员 CRUD
│   ├── events.js             # 日程 CRUD
│   ├── site.js               # 站点配置 KV
│   ├── gallery.js            # 画廊独立表（分组 sort）
│   ├── photos.js             # R2 图片服务 + 粉丝返图
│   ├── messages.js           # 留言板 CRUD
│   ├── upload.js             # 后台直传 R2
│   └── recruits.js           # 招募广告 CRUD
├── src/
│   ├── layouts/BaseLayout.astro  # 全局布局（Header + Footer + ScrollFx + ColorTheme + RecruitToast）
│   ├── components/
│   │   ├── Header.astro          # 导航栏（桌面居中 + 移动汉堡 + 暗色切换）
│   │   ├── Footer.astro
│   │   ├── HeroTitle.astro
│   │   ├── ScrollFx.astro        # 返回顶部 + 滚动动画
│   │   ├── ColorTheme.astro      # 成员色主题切换 + 恢复默认按钮
│   │   ├── RecruitToast.astro    # 招募广告浮窗
│   │   ├── LazyImage.astro
│   │   ├── ImageLightboxOverlay.tsx
│   │   ├── StaticImageLightbox.tsx
│   │   ├── AdminPanel.tsx        # 后台面板入口（登录 + 7 Tab）
│   │   ├── admin/                # 后台子组件
│   │   │   ├── AdminMembers.tsx
│   │   │   ├── AdminEvents.tsx
│   │   │   ├── AdminGalleryEdit.tsx
│   │   │   ├── AdminGallery.tsx
│   │   │   ├── AdminMessages.tsx
│   │   │   ├── AdminTokuten.tsx
│   │   │   ├── AdminSite.tsx
│   │   │   ├── ImageUpload.tsx
│   │   │   └── MemberGalleryUpload.tsx
│   │   ├── MembersList.tsx       # 成员列表（运行时拉 D1）
│   │   ├── MemberDetail.tsx
│   │   ├── ScheduleList.tsx
│   │   ├── GalleryGrid.tsx       # 画廊纯展示（运行时拉 D1）
│   │   ├── MessageBoard.tsx      # 留言板（发布/浏览双模式）
│   │   ├── FanUpload.tsx         # 粉丝返图上传
│   │   ├── FanGallery.tsx        # 粉丝返图展示
│   │   ├── HomeMembers.tsx
│   │   ├── HomeEvents.tsx
│   │   ├── AboutContent.tsx
│   │   ├── TokutenContent.tsx
│   │   ├── SiteBits.tsx
│   │   └── useEvents.ts          # 共享 hook：拉 /api/events
│   ├── data/
│   │   ├── members.json          # 4 名成员（3 active + 1 graduated）
│   │   ├── schedule.json         # 9 场活动（全部 past）
│   │   └── site.json             # 站点配置兜底
│   ├── content/news/             # 9 篇活动结算 Markdown
│   ├── pages/                    # 8 个 Astro 页面 + 404
│   ├── styles/globals.css        # 设计系统（玻璃/按钮/排版/移动端）
│   └── utils/
│       ├── eventReports.ts       # 活动结算 slug 映射
│       └── eventImages.ts        # 活动图回退
├── public/images/               # 原始图片素材（158 jpg + 71 webp）
├── weibo-crawler/               # 微博爬虫（Python，独立工具）
└── dist/                        # 构建产物（280MB）
```

---

## 十、总结

这是一个**功能完整、架构合理、设计克制**的偶像应援站。核心亮点是 Static + Runtime Hybrid 架构——既保留了 Astro SSG 的首屏性能，又通过 D1 实现了运行时 CMS 能力。后台 7 个 Tab 覆盖全站内容编辑，画廊/成员简介/广场返图三者数据彻底隔离。

当前最大的优化空间在**图片处理**（280MB dist、无响应式 srcset）和**migration 统一化**。功能层面已经相当完善，后续更多是锦上添花（全局灯箱、新闻后台编辑、SEO 结构化数据）。
