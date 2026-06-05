import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DebateBubbles } from "../components/features/debate-bubbles";

const messages = {
  runDetail: {
    debate: {
      round: "Round {n}",
      side: {
        bull: "Bull",
        bear: "Bear",
        aggressive: "Aggressive",
        conservative: "Conservative",
        neutral: "Neutral",
      },
    },
  },
};

function renderWithI18n(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("DebateBubbles", () => {
  it("renders bull and bear messages in two columns", () => {
    renderWithI18n(
      <DebateBubbles
        sides={[
          { side: "bull", messages: [{ side: "bull", round: 1, text: "Strong earnings" }] },
          { side: "bear", messages: [{ side: "bear", round: 1, text: "Overvalued" }] },
        ]}
      />,
    );
    expect(screen.getByText("Strong earnings")).toBeInTheDocument();
    expect(screen.getByText("Overvalued")).toBeInTheDocument();
  });
});
