# Gleams Fansite

> 🎀 广西南宁地下偶像团体 **Gleams** 的非官方应援站

**[gleams.vip](https://gleams.vip)**

## 关于 Gleams

来自广西南宁的地下偶像团体。三位公主——💛白菜、💙云团、💚柚子——在命运的指引下相聚，用歌声和舞蹈守护被阴霾侵蚀的王国。

## 技术栈

- **框架**：[Astro 5](https://astro.build) 静态站点生成
- **样式**：[Tailwind CSS](https://tailwindcss.com)
- **交互**：React 组件（画廊灯箱 / 成员筛选）
- **部署**：[Cloudflare Pages](https://pages.cloudflare.com)

## 功能

- 成员介绍（含个人微博自我介绍）
- 公演日程（按月分组）
- 活动结算（含歌单 / 出演成员）
- 照片画廊（成员筛选 + 灯箱大图）
- 特典规则（官方规则原图）
- 暗黑模式

## 开发

```bash
npm install
npm run dev      # 本地预览 http://localhost:4321
npm run build    # 构建到 dist/
```

## 环境变量（Cloudflare Pages）

项目**不需要** `wrangler.toml`，以下变量请在 Cloudflare Pages 后台 **Settings → Environment variables** 中配置：

| 变量名 | 用途 | 说明 |
|---|---|---|
| `SECRET_CODE` | 粉丝上传暗号 | 在 `/fans` 页上传照片时校验身份 |
| `ADMIN_CODE` | 后台管理暗号 | `/admin` 页删除留言 / 照片时使用 |
| `DB` | D1 数据库绑定 | 存储留言板数据 |
| `PHOTOS` | R2 存储桶绑定 | 存储粉丝返图（原图 + 缩略图） |

`functions/api/*.js` 通过 `context.env` 读取上述绑定。本地 `npm run dev` 不会连接 D1 / R2，留言与返图相关功能需部署后（或本地用 `wrangler dev` 并配置绑定）才能联调。

## 照片存储说明

- 上传时浏览器端用 canvas 生成缩略图（长边 **480px**，导出 webp，不支持则回退 jpeg），随原图一并写入 R2
- 画廊网格 / 后台列表使用缩略图，灯箱大图使用原图
- 已存在的历史返图无缩略图时自动回退显示原图，不影响现有数据

## 许可

粉丝应援项目，内容版权归 Gleams 官方所有。

---

*Presented by [Xenia](https://github.com/Xenia0922)*
