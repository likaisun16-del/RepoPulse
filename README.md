# RepoPulse

RepoPulse 是一个中文 GitHub 开源项目增长榜。它按每日快照计算候选仓库最近 1、7、14、30 天的 Star 净增长，并提供筛选、项目详情和趋势图。

榜单中的仓库标题只显示仓库名，详情页保留组织或用户名称以便识别。常见仓库的 GitHub 英文简介会通过前端本地映射显示为中文；未配置本地翻译的实时仓库会回退到 GitHub 原始简介。

## 技术栈

- Next.js、React、TypeScript
- FastAPI、Pydantic、SQLAlchemy、Alembic
- Celery、Redis、PostgreSQL
- Pytest、Playwright、Ruff、Mypy

## 快速启动

### FastAPI

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

开发环境默认使用 SQLite，并自动初始化带有一年快照的演示数据。生产环境设置 `ENVIRONMENT=production` 后不会写入演示数据。

### Next.js

```powershell
cd frontend
npm install
npm run dev
```

网站地址：<http://localhost:3000>  
API 文档：<http://localhost:8000/docs>

Compose 默认将 `SEED_DEMO_DATA` 设为 `true`，首次本地启动会在 PostgreSQL 中写入演示榜单和一年快照，便于直接体验页面。连接真实 GitHub 采集前，将其设为 `false` 并配置 `GITHUB_TOKEN`。

### PostgreSQL 与 Redis

```powershell
docker compose up -d postgres redis
```

然后根据 [.env.example](./.env.example) 设置数据库、Redis 和 GitHub Token。多个 Token 可以用逗号分隔。采集服务需要 Redis：

```powershell
$env:PYTHONPATH="backend;."
backend\.venv\Scripts\celery.exe -A worker.app.celery_app.celery_app worker --loglevel=INFO
backend\.venv\Scripts\celery.exe -A worker.app.celery_app.celery_app beat --loglevel=INFO
```

候选集可以通过 `CANDIDATE_LANGUAGES`、`CANDIDATE_TOPICS`、
`MANUAL_SEED_REPOSITORIES` 和 `EXCLUDED_REPOSITORIES` 调整。生产环境可设置
`SENTRY_DSN` 开启 API 与 Worker 错误追踪。

Celery Beat 每天 `00:15 UTC`（北京时间 `08:15`）发现一次候选仓库；每天
`02:00 UTC`（北京时间 `10:00`）保存快照并生成 1、7、14、30 天榜单。

## 排名口径

```text
net_delta   = end_stars - start_stars
growth_rate = net_delta / start_stars
```

- 基线快照必须早于周期边界，且与边界相差不超过 36 小时。
- 缺少有效基线的仓库仍会进入当期榜单，显示为无增长，待历史快照满足周期后切换为真实增量。
- 榜单只代表 RepoPulse 当前跟踪的候选仓库，不表示全 GitHub 排名。
- 只保存仓库聚合数据，不保存 Star 用户身份。

## 验证

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check app ..\worker tests
.\.venv\Scripts\python.exe -m mypy app ..\worker
.\.venv\Scripts\python.exe -m pytest

cd ..\frontend
npm run lint
npm run typecheck
npm run build
npm test -- --project=chromium
```

## 环境变量与提交安全

复制 `.env.example` 为 `.env` 后再填写本地配置。`.env` 可能包含 GitHub Token、数据库连接和其他敏感值，已被 `.gitignore` 忽略，禁止提交；提交时只保留 `.env.example`。数据库、缓存、测试截图和构建产物同样不会进入版本库。
