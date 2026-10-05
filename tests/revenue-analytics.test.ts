import { describe, expect, it } from "vitest";
import {
  buildCalibrationSummary,
  buildFunnel,
  calibrationStatus,
  revenueAccuracy,
  safeRate,
} from "../src/lib/analytics/revenue";

describe("M6 revenue analytics", () => {
  it("calculates funnel rates without inventing conversion when denominator is zero", () => {
    expect(safeRate(1, 0)).toBeNull();

    const funnel = buildFunnel([
      { key: "discovered", label: "Discovered", count: 100 },
      { key: "contacted", label: "Contacted", count: 40 },
      { key: "meeting", label: "Meeting", count: 10 },
      { key: "won", label: "Won", count: 4 },
    ]);

    expect(funnel[1].fromStartRate).toBeCloseTo(0.4);
    expect(funnel[2].fromPreviousRate).toBeCloseTo(0.25);
    expect(funnel[3].fromStartRate).toBeCloseTo(0.04);
  });

  it("compares predicted expected revenue with actual revenue", () => {
    const summary = revenueAccuracy([
      {
        predictedProbability: 0.2,
        predictedExpectedRevenue: 10000,
        actualRevenue: 20000,
        outcome: "WON",
      },
      {
        predictedProbability: 0.4,
        predictedExpectedRevenue: 5000,
        actualRevenue: 0,
        outcome: "LOST",
      },
    ]);

    expect(summary.predictedExpectedRevenue).toBe(15000);
    expect(summary.actualRevenue).toBe(20000);
    expect(summary.delta).toBe(5000);
    expect(summary.ratio).toBeCloseTo(4 / 3);
  });

  it("builds transparent probability calibration metrics from Won/Lost ground truth", () => {
    const summary = buildCalibrationSummary([
      {
        predictedProbability: 0.2,
        predictedExpectedRevenue: 1000,
        actualRevenue: 0,
        outcome: "LOST",
      },
      {
        predictedProbability: 0.8,
        predictedExpectedRevenue: 4000,
        actualRevenue: 5000,
        outcome: "WON",
      },
      {
        predictedProbability: 0.6,
        predictedExpectedRevenue: 3000,
        actualRevenue: 0,
        outcome: "LOST",
      },
      {
        predictedProbability: null,
        predictedExpectedRevenue: null,
        actualRevenue: 0,
        outcome: "LOST",
      },
    ]);

    expect(summary.sampleSize).toBe(3);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(2);
    expect(summary.actualWinRate).toBeCloseTo(1 / 3);
    expect(summary.averagePredictedProbability).toBeCloseTo(0.533333, 5);
    expect(summary.brierScore).toBeCloseTo((0.04 + 0.04 + 0.36) / 3);
    expect(summary.status).toBe("INSUFFICIENT_DATA");
    expect(summary.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it("does not label a small sample as calibrated", () => {
    expect(calibrationStatus(0)).toBe("NO_GROUND_TRUTH");
    expect(calibrationStatus(9)).toBe("INSUFFICIENT_DATA");
    expect(calibrationStatus(10)).toBe("CALIBRATING");
    expect(calibrationStatus(49)).toBe("CALIBRATING");
    expect(calibrationStatus(50)).toBe("EVALUABLE");
  });
});
