import type {
  ConfiguredOpportunity,
  OfferingConfig,
} from "@/lib/domain/configured-opportunity";
import type { OpportunityAssessment, SalesEffort } from "@/lib/domain/types";
import type { SignalRecord } from "@/lib/companies/opportunity";

export type ConversionConfidence = "LOW" | "MEDIUM" | "HIGH";
export type CalibrationState =
  | "PRE_CALIBRATION"
  | "CALIBRATING"
  | "CALIBRATED";

export type OpportunityIntelligence = {
  modelVersion: "RS_OPPORTUNITY_V1";
  companyId: string;
  matchedIcpId: string;
  matchedIcpName: string;
  offeringId: string | null;
  offeringName: string;
  offeringReason: string;
  dealValueBasis: "minimum" | "average" | "ideal" | "none";
  opportunityScore: number;
  scoreBreakdown: OpportunityAssessment["scoreBreakdown"];
  dealValueLow: number;
  dealValueExpected: number;
  dealValueHigh: number;
  conversionProbability: number;
  conversionConfidence: ConversionConfidence;
  calibrationState: CalibrationState;
  conversionFactors: string[];
  expectedRevenueLow: number;
  expectedRevenue: number;
  expectedRevenueHigh: number;
  salesEffort: SalesEffort;
  revenueEfficiency: number;
  rankScore: number;
  recommendedContact: string;
  nextBestAction: string;
  whyThisCompany: string;
  whyNow: string;
  problemHypothesis: string;
  unknownQualificationFields: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moneyRound(value: number): number {
  return Math.max(0, Math.round(value));
}

function selectedOffering(
  configured: ConfiguredOpportunity,
  offerings: OfferingConfig[],
): OfferingConfig | null {
  if (!configured.offeringId) return null;
  return (
    offerings.find((offering) => offering.id === configured.offeringId) ?? null
  );
}

export function dealValueRange(
  offering: OfferingConfig | null,
  fallbackExpected: number,
): { low: number; expected: number; high: number } {
  if (!offering) {
    const expected = Math.max(0, fallbackExpected);
    return {
      low: moneyRound(expected * 0.65),
      expected: moneyRound(expected),
      high: moneyRound(expected * 1.45),
    };
  }

  const minimum = offering.minContractValue;
  const average = offering.avgContractValue;
  const ideal = offering.idealContractValue;

  const expected =
    average ??
    (minimum !== null && ideal !== null
      ? (minimum + ideal) / 2
      : minimum !== null
        ? minimum * 1.4
        : ideal !== null
          ? ideal * 0.7
          : fallbackExpected);

  const low =
    minimum ??
    (average !== null
      ? average * 0.65
      : ideal !== null
        ? ideal * 0.4
        : expected * 0.65);

  const high =
    ideal ??
    (average !== null
      ? average * 1.5
      : minimum !== null
        ? minimum * 2
        : expected * 1.45);

  return {
    low: moneyRound(Math.min(low, expected)),
    expected: moneyRound(expected),
    high: moneyRound(Math.max(high, expected)),
  };
}

export function estimateConversionProbability(input: {
  assessment: OpportunityAssessment;
  signalCount: number;
  hasProcurementSignal: boolean;
  hasRecentSignal: boolean;
}): { probability: number; factors: string[] } {
  const { scoreBreakdown } = input.assessment;

  const probability =
    0.015 +
    (scoreBreakdown.icpFit / 100) * 0.055 +
    (scoreBreakdown.buyingIntent / 100) * 0.07 +
    (scoreBreakdown.timing / 100) * 0.04 +
    (scoreBreakdown.contactability / 100) * 0.025 +
    (scoreBreakdown.confidence / 100) * 0.025 +
    (input.hasProcurementSignal ? 0.025 : 0) +
    (input.signalCount >= 2 ? 0.015 : 0);

  const bounded = clamp(probability, 0.01, 0.35);
  const factors = [
    `ICP fit contributes ${Math.round(scoreBreakdown.icpFit)}/100.`,
    `Buying intent contributes ${Math.round(scoreBreakdown.buyingIntent)}/100.`,
    `Timing contributes ${Math.round(scoreBreakdown.timing)}/100.`,
    `Evidence confidence is ${Math.round(scoreBreakdown.confidence)}/100.`,
  ];

  if (input.hasProcurementSignal) {
    factors.push("A procurement signal provides additional near-term buying evidence.");
  } else if (input.hasRecentSignal) {
    factors.push("At least one recent buying signal supports near-term relevance.");
  } else {
    factors.push("No recent buying signal is available, so the estimate remains conservative.");
  }

  factors.push(
    "Probability is pre-calibration until RevenueScout has real Won/Lost outcomes.",
  );

  return {
    probability: Math.round(bounded * 1000) / 1000,
    factors,
  };
}

export function inferSalesEffort(
  offering: OfferingConfig | null,
  expectedDealValue: number,
): SalesEffort {
  const cycle = offering?.salesCycleDays ?? null;
  if (cycle !== null) {
    if (cycle <= 30) return "LOW";
    if (cycle <= 90) return "MEDIUM";
    return "HIGH";
  }

  if (expectedDealValue < 20_000) return "LOW";
  if (expectedDealValue < 75_000) return "MEDIUM";
  return "HIGH";
}

export function recommendNextBestAction(input: {
  assessment: OpportunityAssessment;
  signals: SignalRecord[];
  conversionProbability: number;
  unknownFields: string[];
}): string {
  const activeSignals = input.signals.filter(
    (signal) => signal.verificationStatus !== "OUTDATED",
  );
  const hasProcurement = activeSignals.some(
    (signal) => signal.signalType === "PROCUREMENT",
  );

  if (hasProcurement && input.assessment.scoreBreakdown.contactability >= 50) {
    return "Contact the relevant buyer now and prepare a procurement-specific value proposition";
  }

  if (
    input.conversionProbability >= 0.16 &&
    input.assessment.scoreBreakdown.timing >= 65 &&
    input.assessment.scoreBreakdown.contactability >= 50
  ) {
    return "Identify the decision maker and begin targeted outreach this week";
  }

  if (input.unknownFields.length > 0) {
    return `Research ${input.unknownFields[0]} before committing sales time`;
  }

  if (activeSignals.length > 0) {
    return "Review the strongest evidence and identify the most relevant decision maker";
  }

  return "Research the company for a current buying trigger before outreach";
}

export function buildOpportunityIntelligence(input: {
  configured: ConfiguredOpportunity;
  assessment: OpportunityAssessment;
  offerings: OfferingConfig[];
  signals: SignalRecord[];
  m2SalesPriorityScore?: number | null;
}): OpportunityIntelligence {
  const offering = selectedOffering(input.configured, input.offerings);
  const deal = dealValueRange(
    offering,
    input.configured.opportunity.expectedDealValue,
  );

  const activeSignals = input.signals.filter(
    (signal) => signal.verificationStatus !== "OUTDATED",
  );
  const hasProcurementSignal = activeSignals.some(
    (signal) => signal.signalType === "PROCUREMENT",
  );
  const now = Date.now();
  const hasRecentSignal = activeSignals.some((signal) => {
    const observed = new Date(signal.observedAt).getTime();
    if (!Number.isFinite(observed)) return false;
    return now - observed <= 90 * 86_400_000;
  });

  const conversion = estimateConversionProbability({
    assessment: input.assessment,
    signalCount: activeSignals.length,
    hasProcurementSignal,
    hasRecentSignal,
  });

  const lowProbability = clamp(conversion.probability * 0.65, 0.005, 0.3);
  const highProbability = clamp(conversion.probability * 1.35, 0.015, 0.5);
  const expectedRevenueLow = moneyRound(deal.low * lowProbability);
  const expectedRevenue = moneyRound(
    deal.expected * conversion.probability,
  );
  const expectedRevenueHigh = moneyRound(deal.high * highProbability);

  const salesEffort = inferSalesEffort(offering, deal.expected);
  const effortWeight =
    salesEffort === "LOW" ? 1 : salesEffort === "MEDIUM" ? 2 : 3;
  const revenueEfficiency = moneyRound(expectedRevenue / effortWeight);

  const m2SalesPriority =
    input.m2SalesPriorityScore === null ||
    input.m2SalesPriorityScore === undefined
      ? input.assessment.opportunityScore
      : clamp(input.m2SalesPriorityScore, 0, 100);

  const confidenceMultiplier =
    0.65 + (input.assessment.scoreBreakdown.confidence / 100) * 0.35;
  const rankScore =
    (expectedRevenue / effortWeight) *
    confidenceMultiplier *
    (0.75 + m2SalesPriority / 200);

  const unknownFields = input.configured.matchedIcp.unknowns;
  const nextBestAction = recommendNextBestAction({
    assessment: input.assessment,
    signals: input.signals,
    conversionProbability: conversion.probability,
    unknownFields,
  });

  return {
    modelVersion: "RS_OPPORTUNITY_V1",
    companyId: input.configured.opportunity.id,
    matchedIcpId: input.configured.matchedIcp.icpId,
    matchedIcpName: input.configured.matchedIcp.icpName,
    offeringId: input.configured.offeringId,
    offeringName: input.configured.opportunity.recommendedOffering,
    offeringReason: input.configured.offeringReason,
    dealValueBasis: input.configured.dealValueBasis,
    opportunityScore: input.assessment.opportunityScore,
    scoreBreakdown: input.assessment.scoreBreakdown,
    dealValueLow: deal.low,
    dealValueExpected: deal.expected,
    dealValueHigh: deal.high,
    conversionProbability: conversion.probability,
    conversionConfidence: "LOW",
    calibrationState: "PRE_CALIBRATION",
    conversionFactors: conversion.factors,
    expectedRevenueLow,
    expectedRevenue,
    expectedRevenueHigh,
    salesEffort,
    revenueEfficiency,
    rankScore: Math.round(rankScore * 100) / 100,
    recommendedContact: input.configured.opportunity.recommendedContact,
    nextBestAction,
    whyThisCompany: input.configured.opportunity.whyThisCompany,
    whyNow: input.configured.opportunity.whyNow,
    problemHypothesis: input.configured.opportunity.problemHypothesis,
    unknownQualificationFields: unknownFields,
  };
}
