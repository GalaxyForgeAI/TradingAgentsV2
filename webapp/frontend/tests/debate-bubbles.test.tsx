import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebateBubbles } from "../components/features/debate-bubbles";

describe("DebateBubbles", () => {
  it("renders bull and bear messages in two columns", () => {
    render(
      <DebateBubbles
        sides={[
          { side: "bull", label: "Bull", messages: [{ side: "bull", round: 1, text: "Strong earnings" }] },
          { side: "bear", label: "Bear", messages: [{ side: "bear", round: 1, text: "Overvalued" }] },
        ]}
      />,
    );
    expect(screen.getByText("Strong earnings")).toBeInTheDocument();
    expect(screen.getByText("Overvalued")).toBeInTheDocument();
  });
});
