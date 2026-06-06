# AI 文生图工作室

基于 Next.js 的 AI 驱动文生图工具，支持关键词组合生成专业提示词，调用生图模型异步生成图片，瀑布流展示。

## 功能

- **关键词组合** — 8 组 120+ 预设关键词（场景/人物/风格/光线/构图/服饰/姿势/部位/输出规格），多选组合自动生成专业提示词
- **手动输入** — 支持直接编写提示词生图
- **异步任务** — 生成任务后台处理，刷新不丢，占位卡片实时轮询状态
- **瀑布流画廊** — 响应式多列布局，点击放大查看详情，一键复制提示词、下载或删除
- **主题切换** — 暗黑/明亮双主题，偏好持久化
- **后台管理** — 关键词组管理、模型端点配置、生成历史、用户管理
- **输出规格** — 支持多比例（1:1/4:3/16:9/9:16）和多档分辨率

## 技术栈

| 层级 | 方案 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | SQLite + Drizzle ORM |
| 认证 | JWT (jose) + bcryptjs |

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（含默认配置和关键词）
npm run db:seed

# 开发模式
npm run dev

# 一键启动（监听局域网）
./start.sh

# 停止
./stop.sh
```

首次启动后访问 `http://localhost:3000`，后台入口 `/admin/login`（默认账号 `admin` / `admin123`）。

## 配置

进入后台 → 模型配置，填入 OpenAI 兼容接口的端点、Key 和模型名：

| 配置项 | 说明 |
|--------|------|
| LLM API 端点 | 提示词生成模型（chat/completions） |
| LLM 模型名称 | 如 gpt-4o、deepseek-v4-pro |
| 生图 API 端点 | 图片生成模型（images/generations） |
| 生图模型名称 | 如 dall-e-3、agnes-image-2.1-flash |
| 图片尺寸 | 默认输出尺寸 |

## 项目结构

```
src/
├── app/
│   ├── page.tsx                 # 首页
│   ├── admin/                   # 后台管理
│   └── api/                     # API 路由
├── components/                  # React 组件
├── lib/db/                      # 数据库
└── types/                       # 类型定义
```
