export type SignalType =
  | "HIRING"
  | "EXPANSION"
  | "FUNDING"
  | "LEADERSHIP"
  | "TECHNOLOGY"
  | "OPERATIONAL_PAIN"
  | "GROWTH"
  | "PROCUREMENT";

export type ConfidenceLabel =
  | "CONFIRMED"
  | "LIKELY"
  | "UNVERIFIED"
  | "OUTDATED";

export type SalesEffort = "LOW" | "MEDIUM" | "HIGH";

export interface BuyingSignal {
  id: string;
  type: SignalType;
  label: string;
  strength: number;
  confidence: number;
  observedAt: string;
  sourceLabel: string;
  verificationStatus: ConfidenceLabel;
}

export interface OpportunityInput {
  id: string;
  companyName: string;
  location: string;
  industry: string;
  employeeRange: string;
  icpFit: number;
  timing: number;
  dealPotential: number;
  contactability: number;
  evidenceConfidence: number;
  expectedDealValue: number;
  conversionProbability: number;
  salesEffort: SalesEffort;
  recommendedOffering: string;
  recommendedContact: string;
  nextBestAction: string;
  whyThisCompany: string;
  whyNow: string;
  problemHypothesis: string;
  signals: BuyingSignal[];
}

export interface ScoreBreakdown {
  icpFit: number;
  buyingIntent: number;
  timing: number;
  dealPotential: number;
  contactability: number;
  confidence: number;
}

export interface OpportunityAssessment {
  opportunityScore: number;
  scoreBreakdown: ScoreBreakdown;
  expectedRevenue: number;
  primarySignal: BuyingSignal | null;
  confidenceLabel: "Low" | "Medium" | "High";
}
