# 世界斯诺克数据中心 POC

## 目标

做一个中文、移动端优先的「世界斯诺克数据中心」，核心能力是外部赛事数据自动获取、中文化、标准化、统计计算与快速展示，而不是人工赛事运营。

## POC 访问方式

- 临时挂载在现有华彩项目部署下：`/snooker`
- POC 与华彩青少年赛事仅共享同一个 Next.js/EdgeOne 部署，不共享业务数据、后台账号或赛事流程。
- `/snooker` 已从华彩公共访问统计中排除，避免把 POC 流量写入华彩赛事统计。

## 一级导航

手机端底部只保留 4 个入口：

1. 首页
2. 比赛
3. 球员
4. 数据

原计划的「赛事」不再占一级入口，合并进「比赛」。比赛页内部再分今日、本站、赛事；首页的赛事卡也可进入具体赛事。

## 主题色

主题色使用 CSS 变量，不绑定业务逻辑。POC 同时提供：

- 高级斯诺克绿（默认）
- WST 氛围红

正式上线前只需确定一套默认主题，不需要修改页面结构。

## POC 数据源

当前：

1. 主源：snooker.org 公共赛事页面
2. 官方校验：WST.tv
3. POC 接口：`/api/snooker/poc-source`

POC 接口由服务端请求 snooker.org，中国公开赛期间每 30 秒允许刷新一次；失败时用户端继续显示最近一次内置快照，不影响页面打开。

> 当前解析器只用于验证 2026 中国公开赛数据链与 EdgeOne 服务端出网能力，不代表最终通用抓取器。

## 当前 POC 数据

- 2026 中国公开赛
- 中国公开赛决赛实时/最近比分
- 最近半决赛与 1/4 决赛结果
- 2026 武汉公开赛下一站信息
- 当前世界排名 TOP 16
- TOP 16 中国球员中文映射

## 球员主数据

正式数据结构需要自己维护稳定 `player_id`，外部 ID 只作为映射：

- `player_id`
- `name_en`
- `name_zh`
- `nationality`
- `date_of_birth`
- `avatar_url`
- `avatar_source`
- `translation_status`
- `wst_id`
- `snooker_org_id`

POC 暂用字母头像。WST/其他头像源需要继续验证长期地址、授权和缓存策略。

## 独立数据库

POC 当前不写入华彩 Supabase，也不使用华彩后台登录。

进入持久化阶段后，使用独立数据库连接，例如：

- `SNOOKER_DATABASE_URL`
- 独立 Supabase 项目/数据库
- 独立后台账号体系

不复用华彩的 `DATABASE_URL`、管理员、赛事表或球员表。

## 迁移方案

现阶段放在同一仓库是为了复用现有 EdgeOne 域名和部署链路，降低 POC 成本。代码按独立命名空间放置：

- `app/snooker/*`
- `app/api/snooker/*`
- `lib/snooker/*`

正式独立时，可把以上目录迁到新的 Next.js 仓库，将 `app/snooker/page.tsx` 提升为根首页，并配置新的 EdgeOne 项目、域名和独立 Supabase。由于业务代码不依赖华彩数据库和后台，迁移不需要重写产品逻辑。

## POC 下一步

1. 部署后确认 `/api/snooker/poc-source` 能从 EdgeOne 新加坡节点稳定访问 snooker.org。
2. 将中国公开赛解析器从单场验证版升级为通用赛事/轮次/比赛解析器。
3. 建立球员英文名 → 标准中文名 → 外部 ID 映射。
4. 验证头像源。
5. 再建立独立 Supabase 表：players / events / matches / frames / breaks / ranking_snapshots / source_entity_map / sync_runs。
