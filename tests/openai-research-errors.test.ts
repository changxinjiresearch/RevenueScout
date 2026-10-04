import { describe, expect, it } from "vitest";
import { classifyOpenAIResearchError } from "../src/lib/enrichment/responses-client";

describe("classifyOpenAIResearchError", () => {
  it("identifies exhausted API credit as non-retryable", () => {
    const result = classifyOpenAIResearchError(429, {
      error: {
        code: "credit_balance_exhausted",
        type: "insufficient_quota",
        message: "You have no credit balance.",
      },
    });

    expect(result.retryable).toBe(false);
    expect(result.message).toContain("credit balance is exhausted");
  });

  it("identifies transient rate limits as retryable", () => {
    const result = classifyOpenAIResearchError(429, {
      error: {
        code: "rate_limit_exceeded",
        type: "rate_limit_error",
        message: "Too many requests.",
      },
    });

    expect(result.retryable).toBe(true);
    expect(result.message).toContain("rate_limit_exceeded");
  });

  it("does not retry spend-limit failures", () => {
    const result = classifyOpenAIResearchError(429, {
      error: {
        code: "project_spend_limit_exceeded",
        type: "insufficient_quota",
        message: "Project budget exceeded.",
      },
    });

    expect(result.retryable).toBe(false);
    expect(result.message).toContain("project spend limit");
  });
});
