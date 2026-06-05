# TradingAgents Web 工作台

> [English](./README.md) | **中文**

为 TradingAgents 多智能体交易框架打造的浏览器工作台。它在现有的
`TradingAgentsGraph` 引擎之上包了一层实时流式 UI：发起一次分析，实时观看每个智能体
（分析师 → 研究员 → 交易员 → 风险管理 → 投资组合经理）协作的全过程，浏览历史决策，
查看单个标的的行情图表。

命令行（`tradingagents` / `python -m cli.main`）保持不变、依然可用。Web 工作台只是在
同一引擎之上额外提供的一个前端。

```
┌─ Next.js 15 前端 (端口 3000) ─┐   REST + SSE   ┌─ FastAPI 后端 (端口 8000) ─┐
│ 总览 / 新建向导 / 运行详情     │ ─────────────► │ 封装 TradingAgentsGraph.stream │
│ 历史 / 行情 / 设置             │ ◄───────────── │ 读取决策日志 + Yahoo 行情      │
└────────────────────────────────┘                └─────────────────────────────────┘
```

## 前置条件

- Python 3.10+，且已安装本项目：在仓库根目录执行 `pip install -e .`。这会一并装上
  `fastapi`、`uvicorn`、`sse-starlette`、`httpx`。
- Node.js 18.18+（或 20+）和 npm，用于前端。
- 环境中至少导出一个 LLM 提供商的 API Key（见主
  [README](../README.md#required-apis)），例如 `export OPENAI_API_KEY=...`。没有 Key
  时界面仍可渲染，但发起分析会失败。

## 快速开始

在仓库根目录：

```bash
# 1. 安装前端依赖（仅首次需要）
cd webapp/frontend
npm install --legacy-peer-deps   # Next 15.0.3 声明了较旧的 React peer 范围
cd ../..

# 2. 启动前后端
./scripts/web.sh
```

`scripts/web.sh` 会在 **:8000** 启动 FastAPI 后端、在 **:3000** 启动 Next.js 开发服务器，
并在你停止前端（Ctrl-C）时自动关闭后端。

然后打开 **http://localhost:3000**。

### 手动分别启动两个服务

```bash
# 终端 1 —— 后端
uvicorn webapp.backend.main:app --reload --port 8000

# 终端 2 —— 前端
cd webapp/frontend && npm run dev
```

前端通过 `next.config.mjs` 里的 rewrite 把 `/api/*` 代理到后端，因此浏览器请求无需额外
配置。

## 页面

| 路由 | 作用 |
|------|------|
| `/` | 总览：运行次数、相对基准的平均超额收益、待回填的 reflection、以及最近 10 次运行。 |
| `/runs/new` | 4 步向导：标的与日期 → 选择分析师 → LLM 提供商与模型 → 辩论轮数 / 温度 / 检查点。提交后发起运行并跳转到实时详情页。 |
| `/runs/[runId]` | 实时运行详情页。左侧：智能体流水线（点击任意节点查看）。中间：所选智能体的报告 markdown、辩论气泡（多/空、风险三方）、或最终 BUY/SELL/HOLD 决策卡。右侧：实时指标与工具调用日志。通过 SSE 流式更新；运行结束后同一页面回放已捕获的事件。 |
| `/runs` | 从决策日志读取的全部历史运行表（日期、标的、评级、原始收益、超额收益、reflection 摘要）。 |
| `/markets/[ticker]` | K 线图（来自 Yahoo Finance 的 6 个月 OHLC）加上该标的的决策/reflection 历史。 |
| `/compare` | 多运行对比的占位页（见"已知限制"）。 |
| `/settings` | 提供商健康状态（哪些 API Key 已配置）与当前生效的默认配置。 |

工作台默认提供英文与简体中文两种界面，导航栏有 `EN / 中` 切换器，所选语言以 cookie 持久化。智能体**输出语言**（分析师用什么语言写报告）与界面语言完全独立，在「新建分析」向导第 4 步逐次运行设定。

## HTTP API

后端是一个精简的 FastAPI 应用（`webapp/backend/main.py`）。所有端点都在 `/api` 下。

| 方法 | 路径 | 用途 |
|------|------|------|
| `GET` | `/api/health` | 存活检查 → `{"status":"ok"}`。 |
| `POST` | `/api/runs` | 发起一次分析。请求体为 `RunRequest`（ticker、trade_date、analysts、llm_provider、模型、辩论轮数、temperature、checkpoint_enabled、output_language）。返回 `{"run_id": "..."}`。 |
| `GET` | `/api/runs/{run_id}/stream` | 该运行的 Server-Sent Events 流。事件类型：`run.started`、`agent.state`、`agent.report`、`tool.call`、`debate.message`、`metrics.tick`、`run.done`、`run.error`。 |
| `POST` | `/api/runs/{run_id}/cancel` | 取消正在进行的运行。 |
| `GET` | `/api/runs?source=memory` | 读取决策日志。可选 `ticker` 与 `pending_only` 过滤参数。 |
| `GET` | `/api/config` | `DEFAULT_CONFIG` 中的白名单键。 |
| `PUT` | `/api/config` | 持久化工作台用户默认值（仅白名单键）。未知键返回 422。 |
| `GET` | `/api/providers/health` | 各提供商的 API Key 配置状态。 |
| `GET` | `/api/markets/{ticker}?range=6mo` | 来自 Yahoo Finance 的 OHLC 数据。 |

### SSE 事件信封

每个事件为 `{ id, type, run_id, ts, payload }`。`id` 在每次运行内单调递增；后端保留 200
条事件的环形缓冲区用于回放。`type` 取值见上表；payload 结构见
`webapp/backend/schemas.py`。

## 配置 / 环境变量

| 变量 | 使用方 | 默认值 | 用途 |
|------|--------|--------|------|
| `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、… | 引擎 | — | LLM 提供商 Key（见主 README）。在 `/settings` 页展示。 |
| `WORKBENCH_CORS_ORIGINS` | 后端 | `http://localhost:3000` | 逗号分隔的 CORS 允许来源。 |
| `BACKEND_INTERNAL_URL` | 前端（服务端） | `http://localhost:8000` | 服务端组件在 SSR 期间使用的后端绝对地址。当后端不在 localhost:8000 时需设置。 |
| `TRADINGAGENTS_MEMORY_LOG_PATH` | 引擎 + 历史路由 | `~/.tradingagents/memory/trading_memory.md` | 历史/行情页读取的决策日志位置。 |
| `TRADINGAGENTS_CACHE_DIR` | 引擎 + 工作台 | `~/.tradingagents` | 基础路径；工作台把用户默认值写到该路径下的 `webapp/config.json`。 |

其余引擎参数（`TRADINGAGENTS_*`、模型选择、辩论轮数、数据源等）记录在主
[README](../README.md) 与 `tradingagents/default_config.py` 中。

## 添加新的 LLM 提供商

提供商列表（引擎与 Web 后端共用）写在唯一一份 YAML 文件
`tradingagents/llm_clients/providers.yaml`。新增一个兼容 OpenAI 协议的提供商
只需六行 YAML，无需改任何代码：

```yaml
- id: my-provider
  label: My Provider
  env_key: MY_PROVIDER_API_KEY
  openai_compatible: true
  default_base_url: https://api.my-provider.com/v1
```

重启后端（和正在运行的前端开发服务器），新提供商会自动出现在 `/settings` 与
「新建分析」向导里。异构客户端（Anthropic / Google / Azure）需将
`openai_compatible` 设为 `false` 并指定 `client:` 字段；参考现有条目。

## 并发与运行

后端用信号量限制同时进行的分析数量（默认 2）。每次运行分配一个 UUID 和一个内存事件
队列；多个浏览器标签页可以同时订阅同一次运行的 SSE 流（扇出）。

## 测试

```bash
# 后端（在仓库根目录）
python -m pytest webapp/backend -q

# 前端（在 webapp/frontend 目录）
npm test          # vitest 单元测试
npm run build     # 生产构建 / 类型检查
```

## 目录结构

```
webapp/
├── backend/                FastAPI 服务
│   ├── main.py             应用工厂 + 路由注册 + CORS
│   ├── schemas.py          pydantic DTO（RunRequest、EventEnvelope…）
│   ├── run_registry.py     带环形缓冲与扇出的内存发布/订阅
│   ├── streaming.py        AgentState chunk → SSE 事件翻译
│   ├── graph_runner.py     TradingAgentsGraph.stream 的异步封装
│   ├── routes/             runs（含 SSE）/ memory / config / providers / markets
│   └── tests/              pytest 测试套件
└── frontend/               Next.js 15（App Router）
    ├── app/                路由（见"页面"表）
    ├── components/features/ PipelineStepper、DebateBubbles、DecisionCard…
    ├── lib/                API 客户端、SSE hook、共享类型、格式化工具
    ├── stores/             Zustand 运行状态库（纯事件 reducer）
    └── tests/              vitest 测试
```

## 已知限制

- **断线重连回放**：实时流可用，但连接中断后恢复时尚不能回放遗漏的事件（浏览器原生
  `EventSource` 不会为命名事件发送 `Last-Event-Id`）。已记为后续任务。
- **对比页**：多运行对比 UI 仍是占位。
- **范围**：本地单用户工具，无鉴权，桌面优先布局。

## 免责声明

TradingAgents 是一个研究框架，**不构成**任何财务、投资或交易建议。详见
<https://tauric.ai/disclaimer/>。
