import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PipelineStepper } from "../components/features/pipeline-stepper";

const allPending = {
  market_analyst: { status: "done" as const },
  social_analyst: { status: "running" as const },
  news_analyst: { status: "pending" as const },
  fundamentals_analyst: { status: "pending" as const },
  bull_researcher: { status: "pending" as const },
  bear_researcher: { status: "pending" as const },
  research_manager: { status: "pending" as const },
  trader: { status: "pending" as const },
  aggressive_analyst: { status: "pending" as const },
  conservative_analyst: { status: "pending" as const },
  neutral_analyst: { status: "pending" as const },
  portfolio_manager: { status: "pending" as const },
};

describe("PipelineStepper", () => {
  it("renders every agent with its status", () => {
    render(<PipelineStepper agents={allPending} selected="market_analyst" onSelect={() => {}} />);
    expect(screen.getByText(/Market Analyst/i)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio Manager/i)).toBeInTheDocument();
  });

  it("invokes onSelect when an agent row is clicked", async () => {
    const onSelect = vi.fn();
    render(<PipelineStepper agents={{ ...allPending, social_analyst: { status: "pending" } }} selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Market Analyst/i }));
    expect(onSelect).toHaveBeenCalledWith("market_analyst");
  });
});
