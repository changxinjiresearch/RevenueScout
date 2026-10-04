import { describe, expect, it } from "vitest";
import { detectBuyingSignals } from "../src/lib/intelligence/signal-detector";
import type { CollectedPage } from "../src/lib/intelligence/types";

function page(overrides: Partial<CollectedPage>): CollectedPage {
  return {
    url: "https://example.com/careers",
    title: "Careers",
    description: "",
    text: "",
    fetchedAt: "2026-10-04T00:00:00.000Z",
    pageKind: "CAREERS",
    ...overrides,
  };
}

describe("RevenueScout buying signal detector", () => {
  it("detects current hiring from a careers page", () => {
    const signals = detectBuyingSignals([
      page({
        text: "We are hiring. Join our team of warehouse operators in Sydney.",
      }),
    ]);

    const hiring = signals.find((signal) => signal.signalType === "HIRING");
    expect(hiring).toBeDefined();
    expect(hiring?.verificationStatus).toBe("LIKELY");
    expect(hiring?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps undated non-careers signals unverified", () => {
    const signals = detectBuyingSignals([
      page({
        url: "https://example.com/about",
        pageKind: "ABOUT",
        text: "We opened a new warehouse to support our customers.",
      }),
    ]);

    const expansion = signals.find(
      (signal) => signal.signalType === "EXPANSION",
    );
    expect(expansion?.verificationStatus).toBe("UNVERIFIED");
  });
});
