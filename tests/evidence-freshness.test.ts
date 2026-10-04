import { describe, expect, it } from "vitest";
import {
  evidenceFreshness,
  freshnessConfidenceMultiplier,
} from "../src/lib/evidence/freshness";

describe("evidence freshness", () => {
  const now = new Date("2026-10-04T00:00:00Z");

  it("distinguishes fresh, aging and stale evidence", () => {
    expect(
      evidenceFreshness("2026-09-25T00:00:00Z", 30, now),
    ).toBe("FRESH");
    expect(
      evidenceFreshness("2026-09-10T00:00:00Z", 30, now),
    ).toBe("AGING");
    expect(
      evidenceFreshness("2026-08-01T00:00:00Z", 30, now),
    ).toBe("STALE");
  });

  it("reduces confidence as evidence ages", () => {
    expect(freshnessConfidenceMultiplier("FRESH")).toBeGreaterThan(
      freshnessConfidenceMultiplier("AGING"),
    );
    expect(freshnessConfidenceMultiplier("AGING")).toBeGreaterThan(
      freshnessConfidenceMultiplier("STALE"),
    );
  });
});
