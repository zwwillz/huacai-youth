# 华彩十六球青少年系列赛

公众赛事网站与赛事管理后台，使用标准 Next.js 16 开发，部署目标为腾讯云 EdgeOne Pages，后台数据存储在 Supabase PostgreSQL。

## 系统结构

- 公众前端：赛事、规程、赛程、对阵、排名和球员资料。
- 管理后台：赛事管理、内容发布、报名、球员、竞赛执行、排名积分和账号管理。
- 登录方式：系统自有用户名和密码，不开放注册。
- 角色：系统管理员、组委会、裁判。
- 数据库：Supabase PostgreSQL，通过 Drizzle ORM 访问。

## 本地开发

需要 Node.js 22.17 或更高版本。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中填写 Supabase 提供的 PostgreSQL 连接池地址：

```env
DATABASE_URL=postgresql://...
```

## 初始化数据库

先在 Supabase 创建项目，再将 `drizzle` 目录中的 PostgreSQL 迁移应用到数据库。也可以在配置好 `DATABASE_URL` 后运行：

```bash
npm run db:migrate
```

数据库迁移完成后打开 `/admin/login`：

1. 系统检测到没有后台账号时进入首次设置。
2. 首位系统管理员用户名固定为 `admin`。
3. 页面要求立即设置至少 8 位密码。
4. 设置完成后首次设置入口永久关闭。
5. `admin` 在“账号与日志”中创建组委会和裁判账号，并分发用户名与初始密码。

原始密码不会写入数据库、日志或 GitHub；数据库只保存 bcrypt 密码哈希。

## EdgeOne Pages 部署

在 EdgeOne Pages 中导入 GitHub 仓库 `zwwillz/huacai-youth`，使用以下配置：

- Framework Preset：Next.js
- Production Branch：`main`
- Node.js：`22.17.1`
- Install Command：`npm ci`
- Build Command：`npm run build`
- Output Directory：`.next`
- Environment Variable：`DATABASE_URL`
- Auto Deploy：开启

以后推送到 GitHub `main` 分支后，EdgeOne Pages 会自动构建并更新正式网站。

## 常用命令

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```
