import type { ConfidenceLabel, SignalType } from "../domain/types";

export type ResearchSignalType = SignalType | "NONE";

export type WebResearchObservation = {
  sourceType: string;
  sourceTitle: string;
  sourceUrl: string;
  title: string;
  observation: string;
  observedAt: string;
  confidence: number;
  verificationStatus: ConfidenceLabel;
  signalType: ResearchSignalType;
  signalStrength: number;
  signalRationale: string;
};

export type WebResearchResult = {
  officialWebsite: string;
  businessSummary: string;
  industry: string;
  subindustry: string;
  employeeLow: number;
  employeeHigh: number;
  employeeConfidence: number;
  serviceRegions: string[];
  businessModels: string[];
  technologies: string[];
  decisionRoles: string[];
  commercialFitScore: number;
  buyingIntentScore: number;
  budgetFitScore: number;
  timingScore: number;
  needScore: number;
  evidenceConfidence: number;
  overallPotentialScore: number;
  estimatedConversionPercent: number;
  assessmentSummary: string;
  whyFit: string[];
  whyNow: string[];
  risks: string[];
  recommendedContactRole: string;
  nextAction: string;
  observations: WebResearchObservation[];
};
