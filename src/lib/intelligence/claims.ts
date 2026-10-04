export type ClaimType =
  | "INDUSTRY"
  | "SUBINDUSTRY"
  | "EMPLOYEE_RANGE"
  | "SERVICE_REGION"
  | "BUSINESS_MODEL"
  | "TECHNOLOGY"
  | "DECISION_ROLE"
  | "HIRING"
  | "EXPANSION"
  | "FUNDING"
  | "LEADERSHIP"
  | "PROCUREMENT"
  | "GROWTH"
  | "OPERATIONAL_PAIN";

export type ClaimStatus =
  | "CONFIRMED"
  | "CORROBORATED"
  | "SINGLE_SOURCE"
  | "CONFLICTED"
  | "STALE"
  | "UNKNOWN";

export type ClaimEvidenceCandidate = {
  sourceType: string;
  sourceUrl: string;
  sourceTitle: string;
  excerpt: string;
  observedAt: string;
  extractionConfidence: number;
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED" | "OUTDATED";
};

export type ClaimCandidate = {
  claimType: ClaimType;
  claimKey: string;
  value: unknown;
  evidence: ClaimEvidenceCandidate;
};

export type ValidatedClaimEvidence = ClaimEvidenceCandidate & {
  stance: "SUPPORTS" | "CONTRADICTS";
  sourceDomain: string;
  sourceFamily: string;
  independenceKey: string;
  sourceQuality: number;
  freshnessScore: number;
};

export type ValidatedClaim = {
  claimType: ClaimType;
  claimKey: string;
  value: unknown;
  status: ClaimStatus;
  confidence: number;
  supportingFamilyCount: number;
  conflictingFamilyCount: number;
  sourceCount: number;
  freshnessScore: number;
  sourceQualityScore: number;
  independenceScore: number;
  agreementScore: number;
  extractionScore: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  explanation: string;
  evidence: ValidatedClaimEvidence[];
};

export type ClaimValidationSummary = {
  claims: ValidatedClaim[];
  confirmedCount: number;
  corroboratedCount: number;
  singleSourceCount: number;
  conflictedCount: number;
  staleCount: number;
  independentFamilyCount: number;
};


export type ExistingEvidenceInput = {
  sourceType: string;
  sourceUrl: string;
  sourceLabel: string;
  title: string;
  excerpt: string;
  observedAt: string;
  confidence: number;
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED" | "OUTDATED";
};
