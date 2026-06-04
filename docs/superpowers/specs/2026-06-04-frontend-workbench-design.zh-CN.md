# TradingAgents Web 工作台 —— 设计

> [English](./2026-06-04-frontend-workbench-design.md) | **中文**

- **状态**：草案
- **日期**：2026-06-04
- **负责人**：Frontend Workbench
- **相关代码**：`tradingagents/graph/trading_graph.py`、`cli/main.py`

## 1. 问题与目标

如今 TradingAgents 只有命令行界面。CLI 已经能通过 `Rich.Live` 仪表盘流式展示进度（智能体
状态、工具调用、Token 计数、报告 markdown），但每次运行都是一次性的、单会话的，且无法跨
运行对比。目前没有办法：

- 并排查看多次历史运行
- 回放一次已完成的运行
- 可视化地审视多/空与风险辩论
- 把决策叠加到价格图表上
- 不改环境变量就管理提供商/模型/数据源配置
- 从界面触发 reflection 回填

**目标**：交付一个浏览器工作台，在复用现有 `TradingAgentsGraph` 引擎（保持不变）的前提下，
超越 CLI 的体验。工作台须支持实时流式、回放、历史、对比、单标的图表叠加，以及一个引导式的
"新建运行"向导。

**非目标**：替换 CLI（两者并存）、接入真实券商、用户账户 / 多租户、移动端优先设计。

## 2. 用户与核心任务

本地单用户研究工具。核心任务：

1. 几次点击就发起一次新分析，并实时观看智能体工作。
2. 浏览过往运行，按标的/日期/评级过滤，打开其一查看。
3. 对比 2–4 次运行（例如同一标的不同模型）。
4. 查看某标的历次决策落在价格图表上的位置。
5. 管理 API Key、默认模型、辩论轮数、各数据类别的供应商。

## 3. 信息架构

```
/                     总览
/runs/new             新建分析向导
/runs/[runId]         运行详情（实时或回放）
/runs                 全部历史运行（决策日志）
/markets/[ticker]     单标的视图（图表 + 历史 + reflection）
/compare              多运行对比（≤4）
/settings             API Key / 模型 / 智能体行为 / 数据源
```

## 4. UX 模块说明

### 4.1 总览（`/`）

- 顶部行：4 张指标卡——本月运行数、相对基准的平均超额收益、待回填 reflection 数、Token 消耗。
- 中部：最近 10 次运行的紧凑时间线，按五档评级着色的横向条。
- 底部：Pending Reflections 列表（点击触发结果回填）+ Quick Run 卡片（一键复跑昨日标的）。

### 4.2 新建分析向导（`/runs/new`）

stepper 形式的四步：

1. 标的与日期（按后缀 `.HK`、`.T`、`.SS` 等自动识别市场）
2. 选择分析师（market / sentiment / news / fundamentals 中选 1–4，可视化卡片）
3. LLM 提供商 + 深思/快思模型 + 推理强度滑杆
4. 高级（辩论轮数、温度、检查点、语言）

右侧栏的"成本预估"根据 Token × 提供商 × 辩论轮数实时更新。

提交 → POST `/api/runs` → 跳转 `/runs/[runId]`。

### 4.3 运行详情（`/runs/[runId]`）—— 主界面

三栏布局：

| 栏 | 宽度 | 内容 |
|----|------|------|
| 左 | 20% | 流水线 stepper：所有智能体节点的垂直列表，四态（pending/running/done/error）+ spinner |
| 中 | 55% | 当前所选智能体的输出——带代码高亮、可折叠表格的 markdown |
| 右 | 25% | 实时指标：LLM 调用数、工具调用数、Token 进/出、已用时长；滚动的工具调用日志 |

流水线 stepper 同时充当导航：

- 点击某分析师 → 中栏渲染对应的 `*_report` markdown。
- 点击研究辩论节点 → 中栏切换到**辩论气泡**视图：两列 chat 气泡（多左空右），按轮次堆叠，底部是 Research Manager 的结论。
- 点击风险辩论节点 → 三列气泡（激进 / 保守 / 中性）+ Portfolio Manager 结论。
- 点击 Portfolio Manager → 最终决策卡：BUY / SELL / HOLD、五档评级、自信度条、理由。

行内价格标注：在 Market Analyst 的 markdown 里，智能体提到的价格/指标值会被高亮，hover 弹出用
`lightweight-charts` 绘制的 mini K 线。

流式：SSE chunk 增量 patch 对应智能体的 slice。按钮：暂停、继续、取消。

运行结束后进入回放模式。底部时间轴滑块按时间顺序重放事件流，让用户能按实时发生的顺序重新
观看各智能体的出现。

### 4.4 历史（`/runs`）

表格列：`日期 | 标的 | 提供商/模型 | 评级 | 原始收益 | 超额收益 | reflection 摘要 | 耗时 |
Token`。顶部过滤：标的、日期范围、评级、提供商、仅待回填。勾选 ≤4 行可启用"对比"操作。

### 4.5 对比（`/compare`）

≤4 次运行并排，每列结构相同（决策、各分析师摘要、辩论摘要）。各列差异用段落级 diff 高亮。
顶部一张图对比各运行相对区域基准的实现超额收益。

### 4.6 标的视图（`/markets/[ticker]`）

- 上：K 线图，叠加该标的历次决策的标记（按 BUY/SELL/HOLD 着色）。
- 中：MACD、RSI、布林带各自独立的子图。
- 下：该标的全部 reflection 的倒序卡片，按实现超额收益的正负着色。

### 4.7 设置（`/settings`）

- 提供商健康行：通过 `/api/providers/health` ping 每个已配置提供商，显示红/绿点。
- 默认提供商、深思/快思模型下拉、推理强度选择器。
- 各数据类别的供应商选择器（取自 `default_config.py` 的 `data_vendors`）。
- 全局参数：辩论轮数、风险轮数、温度、检查点开关、memory log 路径。

## 5. 架构

### 5.1 分层

```
┌──────────────────────────────────────────────┐
│  Next.js 15 (App Router) + RSC               │
│  - TypeScript / Tailwind / shadcn/ui         │
│  - TanStack Query（服务端状态）              │
│  - Zustand（每次运行的 UI 状态）             │
│  - lightweight-charts（K 线）+ Recharts      │
│  - Framer Motion（流水线动画）               │
└────────────┬─────────────────────────────────┘
             │  REST + SSE
┌────────────▼─────────────────────────────────┐
│  FastAPI 桥接（Python）                      │
│  - POST  /api/runs                           │
│  - GET   /api/runs/{id}/stream  (SSE)        │
│  - GET   /api/runs                           │
│  - GET   /api/runs/{id}                      │
│  - POST  /api/runs/{id}/cancel               │
│  - GET   /api/config  / PUT /api/config      │
│  - GET   /api/markets/{ticker}               │
│  - GET   /api/providers/health               │
│  - POST  /api/runs/{id}/reflect              │
└────────────┬─────────────────────────────────┘
             │  进程内 import
┌────────────▼─────────────────────────────────┐
│  TradingAgentsGraph.stream(...)              │
│  TradingMemoryLog.load_entries()             │
│  dataflows.*（yfinance / stockstats / …）    │
└──────────────────────────────────────────────┘
```

### 5.2 仓库布局（新增部分）

```
TradingAgents/
├── tradingagents/        （不变）
├── cli/                  （不变）
├── webapp/               ← 新增
│   ├── backend/
│   │   ├── main.py            FastAPI 应用工厂
│   │   ├── routes/            runs / config / markets / memory / providers
│   │   ├── streaming.py       围绕 graph.stream 的 SSE 适配器
│   │   ├── run_registry.py    内存 + 磁盘的运行状态
│   │   ├── schemas.py         Pydantic DTO
│   │   └── tests/
│   └── frontend/
│       ├── app/               App Router 路由
│       ├── components/        ui (shadcn) + features（PipelineStepper、RunCard…）
│       ├── lib/               API 客户端、SSE hook、格式化工具
│       ├── stores/            Zustand 切片（run、metrics、debates）
│       └── tests/
└── scripts/
    └── web.sh                 一键启动（uvicorn + next dev）
```

### 5.3 SSE 事件信封

```ts
type Event = {
  id: number;            // 单调递增，用于 Last-Event-ID 恢复
  type: EventType;
  runId: string;
  ts: string;            // ISO
  payload: unknown;
};

type EventType =
  | "run.started"
  | "agent.state"       // {agent, status}
  | "agent.token"       // {agent, delta}
  | "agent.report"      // {field, markdown}
  | "tool.call"         // {agent, tool, args, resultPreview}
  | "debate.message"    // {side, round, text}
  | "metrics.tick"      // {llmCalls, tools, tokensIn, tokensOut, elapsed}
  | "run.done"          // {finalState, decision, durationMs}
  | "run.error";        // {message, stack}
```

前端按 `type` 分发到对应的 Zustand 切片。后端通过对相邻 `AgentState` 快照做 diff，把
`graph.stream(stream_mode="values")` 的 chunk 翻译成这些事件。

## 6. 数据流

- **启动**：POST `/api/runs` → 后端分配 `runId`（uuid），在后台任务里启动
  `graph.stream(...)`，把事件队列挂在 `runId` 下，立即返回。
- **订阅**：GET `/api/runs/{runId}/stream`（SSE）消费该队列。多个浏览器标签页可对同一运行
  扇出订阅。
- **恢复**：每个事件带 `id`；客户端重连时发送 `Last-Event-ID`；后端保留最近 200 条事件的
  环形缓冲。
- **回放**：运行结束后，完整事件序列追加到 `~/.tradingagents/cache/runs/{runId}.jsonl`。
  GET `/api/runs/{runId}` 以 `replay: true` 标记回放该文件。
- **历史**：GET `/api/runs` 调用 `TradingMemoryLog.load_entries()`；服务端按标的/日期/评级/
  待回填过滤。
- **行情**：GET `/api/markets/{ticker}?range=6mo` 调用 `yfinance` + `stockstats_utils`，进程内
  缓存 5 分钟。
- **Reflection 回填**：POST `/api/runs/{id}/reflect` 按需对单条记录触发
  `_resolve_pending_entries`。

## 7. 错误处理与边界

- **缺少 API Key**：`/api/providers/health` 启动时探测；设置页显示红/绿；所选提供商为红灯时
  向导禁用提交。
- **运行中崩溃**：发出 `run.error`，释放注册表槽位。前端展示错误卡，若 `checkpoint_enabled`
  则提供"从最近检查点恢复"按钮。
- **并发**：进程级信号量将同时运行数限制为 2（可调）。新运行排队，显示 `"Queued (#N)"`。
- **数据源限流**：Reddit / Alpha Vantage 失败时降级为行内提示（"该窗口暂无情绪数据"），不
  中断整次运行。
- **大段流式 markdown**：`setState` 节流到每 50ms 一次；用 `react-markdown` + memo 渲染；
  对最长的报告做虚拟化。

## 8. 测试策略

| 层 | 工具 | 重点 |
|----|------|------|
| 后端单元 | pytest | SSE 适配器的事件翻译；memory log 解析 |
| 后端集成 | pytest + httpx + AsyncClient | 用打桩 graph 端到端：断言事件序列与最终状态 |
| 前端单元 | Vitest + Testing Library | Zustand reducer；PipelineStepper 状态机；SSE hook 重连路径 |
| 前端 E2E | Playwright | 向导流程 → 经 mock SSE 的实时运行 → 所有面板渲染；重连；回放滑块 |
| 视觉回归 | Playwright 截图 | 总览、运行详情、对比三页 |

由一次真实运行录制的 fixture jsonl 喂给 mock SSE 服务器，使 E2E 不烧 Token。

## 9. 待解问题

设计阶段无；在此列出以备规划时浮现：

- 运行详情页是否额外暴露一个原始"事件"标签（开发者模式）。初步答案：否，避免噪声；如有需要
  再加。
- 鉴权：v1 不在范围内（仅本地）。

## 10. 不在范围内（v1）

- 鉴权 / 多用户。
- 移动端布局（响应式但桌面优先）。
- 真实券商接入。
- 运行开始后的实时盘中更新（提交时锁定分析日期）。
