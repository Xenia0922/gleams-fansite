# ✨ Gleams 应援站

> 🎀 广西南宁地下偶像团体 **Gleams** 的非官方粉丝应援站
>
> **[gleams.vip](https://gleams.vip)**

---

## 🏰 关于 Gleams

_"在星界尽头，存在着一座神秘王国，由水晶支撑着整个王国的运转。公主们踏上寻找名为 Gleams 的能量宝石来守护他们的世界。"_

三位公主——💛 白菜 Hakusai、💙 云团 Kumo、💚 柚子 Yuzi——活跃于南宁及两广地区的 Livehouse 和动漫展会，用歌声和舞蹈点亮每一个舞台。

---

## 🎯 站点功能

### 公开页面

| 页面 | 功能 |
|------|------|
| 🏠 首页 | Hero 动画 + 成员卡片 + 演出倒计时 + 过往行程 |
| 👑 成员 | 个人资料、九宫格画廊、微博简介 |
| 📅 日程 | 公演日历（按月分组）、活动结算详情（歌单/Markdown） |
| 🖼️ 画廊 | 照片浏览（成员筛选 + 灯箱）+ 骑士团精选 |
| 🎁 特典 | 官方特典规则 + 过往物贩 |
| ⚔️ 骑士团广场 | 粉丝留言板 + 返图上传/浏览 |

### 后台系统（`/admin`）

由管理暗号保护的后台 CMS，支持：

- 👑 **成员管理** — CRUD + 头像上传 + 九宫格排序
- 📅 **日程管理** — CRUD + 状态切换（即将到来/已结束）+ Markdown 正文
- 🖼️ **画廊管理** — 批量上传 + 拖拽排序 + ⭐精选标记
- 💬 **广场管理** — 留言审核 + 返图管理
- 🎁 **特典管理** — 规则编辑（文字 + 图片）
- ℹ️ **关于管理** — 世界观/团体介绍/社交链接
- 📢 **广告管理** — 招募/公告 CRUD + 拖拽排序 + 浅色/暗色实时预览

### 特色亮点

- 🎨 **成员色主题** — 粉/蓝/绿三套配色，CSS 变量驱动，一键切换
- 🌓 **暗黑模式** — Tailwind class 策略，全局适配
- ⏱️ **演出倒计时** — 首页实时显示最近一场 upcoming 演出的倒计时
- ✨ **骑士团精选** — 管理员可从画廊中精选优质照片，独立板块展示
- 📱 **响应式** — Mobile-first 设计，玻璃拟态 UI（frosted glass）
- ♿ **可访问性** — 语义化标签、skip-link、WCAG AA 对比度
- 🔒 **安全** — CSP 头、暗号验证、IP 限流、防暴破

---

## 🏗️ 技术架构

```
gleams-fansite/
├── src/
│   ├── pages/          # Astro 页面（13 个路由）
│   ├── components/     # React 岛屿（17 个组件）+ Astro 组件（7 个）
│   │   └── admin/      # 后台管理子组件（7 个 Tab）
│   ├── layouts/        # 全局布局（Header/Footer/SEO/暗黑模式）
│   ├── styles/         # 全局 CSS（CSS 变量 + Tailwind 扩展）
│   ├── data/           # JSON 种子数据（首屏兜底 + SSG 预渲染）
│   └── utils/          # 共享工具（API client、成员元数据）
├── functions/          # Cloudflare Pages Functions（9 个 API）
│   ├── _shared.js      # 公共函数（json/adminOk/withTable）
│   └── api/            # D1 CRUD + R2 上传
│       ├── members.js      # 成员 CRUD
│       ├── events.js       # 日程 CRUD（含 Markdown body）
│       ├── gallery.js      # 画廊管理（含精选标记）
│       ├── messages.js     # 留言板
│       ├── photos.js       # R2 图片上传/读取（含限流）
│       ├── recruits.js     # 招募公告
│       ├── site.js         # 站点配置 key-value
│       ├── upload.js       # 后台上传
│       └── _rate.js        # IP 限流工具
├── public/             # 静态资源（图片/图标/_headers）
└── dist/               # 构建产物（24 页，~15MB）
```

### 数据流

```
┌──────────────┐    首次渲染（SSG）    ┌──────────────┐
│  JSON 种子    │ ──────────────────→  │  Astro 页面   │
│  src/data/   │    props 兜底        │  (首屏极速)   │
└──────────────┘                      └──────┬───────┘
                                             │
┌──────────────┐    运行时覆盖（CSR）  │ client:load
│  D1 数据库    │ ←─── API 请求 ────── │
│  + R2 存储   │                      │ React 组件
└──────────────┘                      │ (实时数据)
```

- **渐进增强**：JSON 静态数据作为首屏兜底 → API 异步覆盖实现动态内容
- **零 migration**：D1 表首次请求自动 `CREATE TABLE IF NOT EXISTS` + 播种，部署即用
- **CustomEvent 解耦**：粉丝广场三个组件通过事件总线通信，无需互知对方存在

---

## 🛠️ 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Astro 5（Static SSG） |
| 交互 | React 19（客户端岛屿） |
| 样式 | Tailwind CSS 3 + 自定义 CSS 变量 |
| 语言 | TypeScript（strict） + JavaScript（CF Functions） |
| 数据库 | Cloudflare D1（5 张表，自举建表） |
| 存储 | Cloudflare R2（照片上传/缩略图） |
| 部署 | Cloudflare Pages（自动 CI/CD） |
| 安全 | CSP + X-Frame-Options + 暗号验证 + IP 限流 |

---

## 🚀 本地开发

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # 构建到 dist/
```

> 本地 `npm run dev` 不连接 D1/R2。留言/返图/后台等功能需部署后在线上联调，或用 `wrangler pages dev` 配置本地绑定。

---

## 📦 部署到 Cloudflare Pages

1. **Fork/Clone** 本仓库到你的 GitHub
2. **Cloudflare Dashboard** → Workers & Pages → 连接仓库
3. **构建设置**：框架预设 `Astro`，构建命令 `npm run build`，输出目录 `dist`
4. **环境变量**（Settings → Environment variables）：
   | 变量 | 用途 |
   |------|------|
   | `SECRET_CODE` | 粉丝广场暗号 |
   | `ADMIN_CODE` | 后台管理暗号 |
5. **绑定**（Settings → Functions）：
   | 绑定 | 类型 | 用途 |
   |------|------|------|
   | `DB` | D1 | 数据库（需先创建 D1 数据库） |
   | `PHOTOS` | R2 | 照片存储（需先创建 R2 桶） |
6. **部署** — 推送代码自动触发，或手动 Deploy

> 无需 wrangler.toml，无需手动 migration。所有表在首次 API 请求时自动创建。

---

## ⚙️ 环境变量说明

| 变量 | 消费位置 | 说明 |
|------|---------|------|
| `SECRET_CODE` | `photos.js`, `messages.js` | 粉丝上传/留言的验证暗号 |
| `ADMIN_CODE` | 所有 API（`adminOk()`） | `/admin` 后台管理暗号 |
| `DB` | 所有 API（`env.DB`） | D1 数据库绑定 |
| `PHOTOS` | `photos.js`, `upload.js` | R2 存储桶绑定 |

---

## 📸 照片存储

- 上传时浏览器端 Canvas 生成缩略图（长边 480px，webp）
- 画廊网格使用缩略图，灯箱大图使用原图
- 历史返图无缩略图时自动回退显示原图

---

## 📄 许可

粉丝应援项目，内容版权归 Gleams 官方所有。代码 MIT。

---

*Presented by [Xenia](https://github.com/Xenia0922)*
