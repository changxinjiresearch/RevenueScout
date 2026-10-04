import { describe, expect, it } from "vitest";
import { extractEmployeeEstimate } from "../src/lib/intelligence/feature-extractor";

describe("RevenueScout feature extractor", () => {
  it("extracts a bounded employee estimate from explicit workforce language", () => {
    const result = extractEmployeeEstimate(
      "Our Australian logistics business employs approximately 120 people.",
    );

    expect(result.low).toBe(108);
    expect(result.high).toBe(132);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("does not invent employee scale when no workforce evidence exists", () => {
    const result = extractEmployeeEstimate(
      "We provide freight and warehousing services across Australia.",
    );

    expect(result).toEqual({ low: -1, high: -1, confidence: 0 });
  });
});
