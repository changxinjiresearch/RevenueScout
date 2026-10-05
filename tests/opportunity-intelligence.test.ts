import { describe, expect, it } from "vitest";
import {
  buildOpportunityIntelligence,
  dealValueRange,
  estimateConversionProbability,
} from "../src/lib/opportunities/intelligence";
import type {
  ConfiguredOpportunity,
  OfferingConfig,
} from "../src/lib/domain/configured-opportunity";
import type { OpportunityAssessment } from "../src/lib/domain/types";
import type { SignalRecord } from "../src/lib/companies/opportunity";

const offering: OfferingConfig = {
  id: "offering-1",
  name: "Workflow Automation",
  description: "Automate operations workflows",
  primaryProblems: "manual coordination, duplicated admin",
  typicalCustomers: "growing logistics companies",
  minContractValue: 15000,
  avgContractValue: 30000,
  idealContractValue: 50000,
  salesCycleDays: 45,
};

const configured: ConfiguredOpportunity = {
  matchedIcp: {
    icpId: "icp-1",
    icpName: "Australian Logistics SME",
    score: 88,
    qualified: true,
    excluded: false,
    reasons: ["Country matches: Australia", "Industry matches: Logistics"],
    mismatches: [],
    unknowns: ["Employee count"],
    qualificationFailures: [],
    exclusionReasons: [],
  },
  offeringId: "offering-1",
  offeringReason:
    "Workflow Automation is explicitly linked to Australian Logistics SME.",
  dealValueBasis: "average",
  opportunity: {
    id: "company-1",
    companyName: "Example Logistics",
    location: "Sydney, NSW, Australia",
    industry: "Logistics",
    employeeRange: "Unknown",
    icpFit: 88,
    timing: 80,
    dealPotential: 70,
    contactability: 60,
    evidenceConfidence: 72,
    expectedDealValue: 30000,
    conversionProbability: 0.12,
    salesEffort: "MEDIUM",
    recommendedOffering: "Workflow Automation",
    recommendedContact: "COO / Head of Operations",
    nextBestAction: "Review evidence",
    whyThisCompany:
      "Best ICP match: Australian Logistics SME. Country and industry match.",
    whyNow: "Recent operations hiring was observed.",
    problemHypothesis:
      "Rapid hiring may be increasing coordination pressure.",
    signals: [],
  },
};

const assessment: OpportunityAssessment = {
  opportunityScore: 77,
  scoreBreakdown: {
    icpFit: 88,
    buyingIntent: 72,
    timing: 80,
    dealPotential: 70,
    contactability: 60,
    confidence: 72,
  },
  expectedRevenue: 3600,
  primarySignal: null,
  confidenceLabel: "Medium",
};

const procurementSignal: SignalRecord = {
  id: "signal-1",
  companyId: "company-1",
  evidenceId: "evidence-1",
  signalType: "PROCUREMENT",
  label: "Tender",
  summary: "A public procurement process was observed.",
  rationale: "A procurement process is a direct buying trigger.",
  strength: 90,
  confidence: 0.9,
  observedAt: new Date("2026-10-01T00:00:00Z"),
  verificationStatus: "CONFIRMED",
  sourceLabel: "Tender source",
};

describe("M3 opportunity intelligence", () => {
  it("uses configured Offering economics as a Low / Expected / High range", () => {
    expect(dealValueRange(offering, 1)).toEqual({
      low: 15000,
      expected: 30000,
      high: 50000,
    });
  });

  it("keeps conversion probability bounded and explicitly pre-calibration", () => {
    const result = buildOpportunityIntelligence({
      configured,
      assessment,
      offerings: [offering],
      signals: [],
      now: new Date("2026-10-05T00:00:00Z"),
    });

    expect(result.conversionProbability).toBeGreaterThan(0);
    expect(result.conversionProbability).toBeLessThanOrEqual(0.35);
    expect(result.conversionConfidence).toBe("LOW");
    expect(result.calibrationState).toBe("PRE_CALIBRATION");
    expect(result.expectedRevenueLow).toBeLessThan(result.expectedRevenue);
    expect(result.expectedRevenueHigh).toBeGreaterThan(result.expectedRevenue);
  });

  it("gives a verified procurement signal a transparent probability lift", () => {
    const baseline = estimateConversionProbability({
      assessment,
      signalCount: 0,
      hasProcurementSignal: false,
      hasRecentSignal: false,
    });
    const procurement = estimateConversionProbability({
      assessment,
      signalCount: 1,
      hasProcurementSignal: true,
      hasRecentSignal: true,
    });

    expect(procurement.probability).toBeGreaterThan(baseline.probability);
    expect(
      procurement.factors.some((factor) =>
        factor.toLowerCase().includes("procurement"),
      ),
    ).toBe(true);
  });

  it("produces expected revenue, effort and next action from persisted inputs", () => {
    const result = buildOpportunityIntelligence({
      configured,
      assessment,
      offerings: [offering],
      signals: [procurementSignal],
      m2SalesPriorityScore: 82,
      now: new Date("2026-10-05T00:00:00Z"),
    });

    expect(result.dealValueExpected).toBe(30000);
    expect(result.expectedRevenue).toBe(
      Math.round(30000 * result.conversionProbability),
    );
    expect(result.salesEffort).toBe("MEDIUM");
    expect(result.revenueEfficiency).toBeGreaterThan(0);
    expect(result.rankScore).toBeGreaterThan(0);
    expect(result.nextBestAction.toLowerCase()).toContain("contact");
    expect(result.problemHypothesis).toContain("hiring");
  });
});
