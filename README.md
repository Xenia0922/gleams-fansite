# Gleams 应援站

广西南宁地下偶像团体 Gleams 的非官方粉丝应援站 —— [gleams.vip](https://gleams.vip)

## 关于 Gleams

三位成员——白菜 Hakusai、云团 Kumo、柚子 Yuzi——活跃于南宁及两广地区的 Livehouse 和动漫展会。

---

## 站点功能

**公开页面**

| 页面 | 内容 |
|------|------|
| 首页 | Hero、成员卡片、演出倒计时、过往行程 |
| 成员 | 个人资料、九宫格画廊、微博 |
| 日程 | 公演日历（按月分组）、活动结算详情（歌单 / Markdown） |
| 画廊 | 照片浏览（成员筛选 + 灯箱）+ 骑士团精选 |
| 特典 | 官方特典规则 + 过往物贩 |
| 骑士团广场 | 粉丝留言板 + 返图上传 |

**后台 CMS（`/admin`）**

管理暗号保护，支持成员 / 日程 / 画廊 / 广场 / 特典 / 站点配置 / 广告的增删改查。

---

## 技术架构

```
src/
├── pages/          Astro 页面（13 个路由）
├── components/     React 岛屿 + Astro 组件
│   └── admin/      后台管理子组件
├── layouts/        全局布局
├── styles/         全局 CSS
├── data/           JSON 种子数据（首屏兜底）
└── utils/          共享工具

functions/          CF Pages Functions（9 个 API）
├── _shared.js      公共函数
└── api/            D1 CRUD + R2 上传
```

**数据流**：JSON 静态数据作为首屏兜底（SSG），React 组件 `client:load` 后通过 API 获取 D1 实时数据覆盖。D1 表首次请求自动建表播种，无需手动 migration。

---

## 技术栈

Astro 5 (Static SSG) · React 19 · TypeScript · Tailwind CSS 3 · Cloudflare Pages · D1 · R2

---

## 本地开发

```bash
npm install
npm run dev       # localhost:4321
npm run build     # 构建到 dist/
```

本地 `npm run dev` 不连接 D1/R2，留言/返图/后台等功能需部署后联调。

---

## 部署

1. Cloudflare Dashboard → Workers & Pages → 连接 GitHub 仓库
2. 框架预设 Astro，构建命令 `npm run build`，输出目录 `dist`
3. 环境变量：`SECRET_CODE`（粉丝暗号）、`ADMIN_CODE`（管理暗号）
4. 绑定：`DB`（D1 数据库）、`PHOTOS`（R2 存储桶）
5. 部署——所有表首次 API 请求时自动创建，无需手动 migration

---

## 许可

粉丝应援项目，内容版权归 Gleams 官方所有。代码 MIT。
