import type {
  BuyingSignal,
  OpportunityAssessment,
  OpportunityInput,
  SignalType,
} from "./types";

const COMPONENT_WEIGHTS = {
  icpFit: 0.3,
  buyingIntent: 0.25,
  timing: 0.15,
  dealPotential: 0.15,
  contactability: 0.1,
  confidence: 0.05,
} as const;

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  HIRING: 0.85,
  EXPANSION: 1,
  FUNDING: 0.95,
  LEADERSHIP: 0.7,
  TECHNOLOGY: 0.75,
  OPERATIONAL_PAIN: 0.85,
  GROWTH: 0.9,
  PROCUREMENT: 1,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function calculateBuyingIntent(signals: BuyingSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const weighted = signals.map((signal) => {
    const verifiedConfidence =
      signal.verificationStatus === "CONFIRMED"
        ? 1
        : signal.verificationStatus === "LIKELY"
          ? 0.85
          : signal.verificationStatus === "UNVERIFIED"
            ? 0.55
            : 0.3;

    return (
      clampScore(signal.strength) *
      SIGNAL_WEIGHTS[signal.type] *
      Math.max(0, Math.min(1, signal.confidence)) *
      verifiedConfidence
    );
  });

  const total = weighted.reduce((sum, score) => sum + score, 0);

  // Multiple independent signals matter, but should not allow weak noisy events
  // to inflate the score without bound.
  const multiSignalBoost = Math.min((signals.length - 1) * 4, 12);

  return clampScore(total / signals.length + multiSignalBoost);
}

function confidenceLabel(confidence: number): "Low" | "Medium" | "High" {
  if (confidence >= 75) return "High";
  if (confidence >= 50) return "Medium";
  return "Low";
}

export function assessOpportunity(
  input: OpportunityInput,
): OpportunityAssessment {
  const buyingIntent = calculateBuyingIntent(input.signals);

  const scoreBreakdown = {
    icpFit: clampScore(input.icpFit),
    buyingIntent,
    timing: clampScore(input.timing),
    dealPotential: clampScore(input.dealPotential),
    contactability: clampScore(input.contactability),
    confidence: clampScore(input.evidenceConfidence),
  };

  const opportunityScore = Math.round(
    scoreBreakdown.icpFit * COMPONENT_WEIGHTS.icpFit +
      scoreBreakdown.buyingIntent * COMPONENT_WEIGHTS.buyingIntent +
      scoreBreakdown.timing * COMPONENT_WEIGHTS.timing +
      scoreBreakdown.dealPotential * COMPONENT_WEIGHTS.dealPotential +
      scoreBreakdown.contactability * COMPONENT_WEIGHTS.contactability +
      scoreBreakdown.confidence * COMPONENT_WEIGHTS.confidence,
  );

  const expectedRevenue = Math.round(
    Math.max(0, input.expectedDealValue) *
      Math.max(0, Math.min(1, input.conversionProbability)),
  );

  const primarySignal =
    [...input.signals].sort((a, b) => b.strength - a.strength)[0] ?? null;

  return {
    opportunityScore,
    scoreBreakdown,
    expectedRevenue,
    primarySignal,
    confidenceLabel: confidenceLabel(scoreBreakdown.confidence),
  };
}
