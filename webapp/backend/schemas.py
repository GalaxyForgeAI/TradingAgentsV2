from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class AgentName(str, enum.Enum):
    MARKET_ANALYST = "market_analyst"
    SOCIAL_ANALYST = "social_analyst"
    NEWS_ANALYST = "news_analyst"
    FUNDAMENTALS_ANALYST = "fundamentals_analyst"
    BULL_RESEARCHER = "bull_researcher"
    BEAR_RESEARCHER = "bear_researcher"
    RESEARCH_MANAGER = "research_manager"
    TRADER = "trader"
    AGGRESSIVE_ANALYST = "aggressive_analyst"
    CONSERVATIVE_ANALYST = "conservative_analyst"
    NEUTRAL_ANALYST = "neutral_analyst"
    PORTFOLIO_MANAGER = "portfolio_manager"


class EventType(str, enum.Enum):
    RUN_STARTED = "run.started"
    AGENT_STATE = "agent.state"
    AGENT_REPORT = "agent.report"
    TOOL_CALL = "tool.call"
    DEBATE_MESSAGE = "debate.message"
    METRICS_TICK = "metrics.tick"
    RUN_DONE = "run.done"
    RUN_ERROR = "run.error"


AgentStatus = Literal["pending", "running", "done", "error"]


class RunRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=24)
    trade_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    analysts: list[Literal["market", "social", "news", "fundamentals"]] = Field(
        default_factory=lambda: ["market", "social", "news", "fundamentals"]
    )
    llm_provider: str = "openai"
    deep_think_llm: str | None = None
    quick_think_llm: str | None = None
    max_debate_rounds: int = Field(default=1, ge=1, le=10)
    max_risk_discuss_rounds: int = Field(default=1, ge=1, le=10)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    checkpoint_enabled: bool = False
    output_language: str = "English"

    @field_validator("ticker")
    @classmethod
    def upper_ticker(cls, v: str) -> str:
        return v.strip().upper()


class AgentStatePayload(BaseModel):
    agent: AgentName
    status: AgentStatus


class AgentReportPayload(BaseModel):
    field: str
    markdown: str


class ToolCallPayload(BaseModel):
    agent: AgentName
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    result_preview: str | None = None


class DebateMessagePayload(BaseModel):
    side: Literal["bull", "bear", "aggressive", "conservative", "neutral"]
    round: int
    text: str


class MetricsTickPayload(BaseModel):
    llm_calls: int = 0
    tools: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    elapsed_ms: int = 0


class RunDonePayload(BaseModel):
    decision: str
    rating: str | None = None
    duration_ms: int


class RunErrorPayload(BaseModel):
    message: str
    stack: str | None = None


class EventEnvelope(BaseModel):
    id: int
    type: EventType
    run_id: str
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)


class RunSummary(BaseModel):
    run_id: str
    ticker: str
    trade_date: str
    status: Literal["queued", "running", "done", "error", "cancelled"]
    rating: str | None = None
    raw_return: float | None = None
    alpha: float | None = None
    elapsed_ms: int | None = None
    created_at: datetime
