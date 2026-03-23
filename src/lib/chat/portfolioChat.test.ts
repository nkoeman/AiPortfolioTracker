import { describe, expect, it } from "vitest";
import { shouldRefuseAdviceRequest } from "@/lib/chat/portfolioChat";

describe("portfolio chat guardrails", () => {
  it("refuses direct recommendation requests", () => {
    expect(shouldRefuseAdviceRequest("What should I sell from my portfolio?")).toBe(true);
    expect(shouldRefuseAdviceRequest("What should I buy next?")).toBe(true);
  });

  it("refuses tax and legal questions", () => {
    expect(shouldRefuseAdviceRequest("How should I optimize taxes for my gains?")).toBe(true);
    expect(shouldRefuseAdviceRequest("Give me legal advice for this portfolio.")).toBe(true);
  });

  it("allows descriptive analytics questions", () => {
    expect(shouldRefuseAdviceRequest("Show my country exposure.")).toBe(false);
    expect(shouldRefuseAdviceRequest("How did my portfolio perform this month?")).toBe(false);
  });
});
