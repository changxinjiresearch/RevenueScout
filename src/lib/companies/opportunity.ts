import type {
  BuyingSignal,
  ConfidenceLabel,
  OpportunityInput,
  SignalType,
} from "../domain/types";
import type {
  CandidateCompanyFacts,
  IcpRule,
  OfferingConfig,
  OfferingIcpLink,
} from "../domain/configured-opportunity";
import { configureOpportunity } from "../domain/configured-opportunity";
import {
  evidenceFreshness,
  freshnessConfidenceMultiplier,
} from "../evidence/freshness";

export type CompanyRecord = {
  id: string;
  displayName: string;
  website: string | null;
  domain: string | null;
  description: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  foundedYear: number | null;
  companyType: string | null;
  serviceRegions: string[];
  rolesObserved: string[];
  businessModels: string[];
  technologies: string[];
  fastGrowth: boolean;
  multiLocation: boolean;
  currentlyHiring: boolean;
  recentFunding: boolean;
  digitalNeed: boolean;
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
  relationshipStatus:
    | "NONE"
    | "EXISTING_CUSTOMER"
    | "PIPELINE"
    | "CONTACTED"
    | "REJECTED"
    | "UNSUBSCRIBED";
};

export type EvidenceRecord = {
  id: string;
  companyId: string;
  sourceLabel: string;
  observedAt: Date;
  confidence: number;
  verificationStatus: ConfidenceLabel;
  staleAfterDays: number;
};

export type SignalRecord = {
  id: string;
  companyId: string;
  evidenceId: string;
  signalType: SignalType;
  label: string;
  summary: string;
  rationale: string;
  strength: number;
  confidence: number;
  observedAt: Date;
  verificationStatus: ConfidenceLabel;
  sourceLabel: string;
};

function daysSince(value: Date, now = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000),
  );
}

export function timingScoreFromSignals(
  signals: SignalRecord[],
  now = new Date(),
): number {
  if (signals.length === 0) return 15;
  const freshest = Math.min(...signals.map((signal) => daysSince(signal.observedAt, now)));
  if (freshest <= 14) return 92;
  if (freshest <= 30) return 80;
  if (freshest <= 60) return 65;
  if (freshest <= 90) return 50;
  return 30;
}

export function evidenceConfidenceScore(
  evidence: EvidenceRecord[],
  now = new Date(),
): number {
  if (evidence.length === 0) return 20;

  const values = evidence.map((item) => {
    const freshness = evidenceFreshness(
      item.observedAt,
      item.staleAfterDays,
      now,
    );
    const verification =
      item.verificationStatus === "CONFIRMED"
        ? 1
        : item.verificationStatus === "LIKELY"
          ? 0.85
          : item.verificationStatus === "UNVERIFIED"
            ? 0.6
            : 0.35;

    return (
      Math.max(0, Math.min(1, item.confidence)) *
      freshnessConfidenceMultiplier(freshness) *
      verification
    );
  });

  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
  );
}

function recentSignal(
  signals: SignalRecord[],
  type: SignalType,
  maxDays: number,
  now = new Date(),
): boolean {
  return signals.some(
    (signal) =>
      signal.signalType === type &&
      daysSince(signal.observedAt, now) <= maxDays &&
      signal.verificationStatus !== "OUTDATED",
  );
}

export function companyFactsFromRecord(
  company: CompanyRecord,
  signals: SignalRecord[],
  now = new Date(),
): CandidateCompanyFacts {
  const year = now.getUTCFullYear();
  return {
    country: company.country,
    state: company.state,
    city: company.city,
    industry: company.industry,
    subindustry: company.subindustry,
    employeeCount: company.employeeCount,
    companyAgeYears:
      company.foundedYear && company.foundedYear <= year
        ? year - company.foundedYear
        : null,
    companyType: company.companyType,
    serviceRegions: company.serviceRegions,
    fastGrowth: company.fastGrowth || recentSignal(signals, "GROWTH", 180, now),
    multiLocation:
      company.multiLocation || company.serviceRegions.length > 1,
    hiring:
      company.currentlyHiring || recentSignal(signals, "HIRING", 90, now),
    recentFunding:
      company.recentFunding || recentSignal(signals, "FUNDING", 180, now),
    roles: company.rolesObserved,
    businessModels: company.businessModels,
    technologies: company.technologies,
    digitalNeed:
      company.digitalNeed ||
      recentSignal(signals, "TECHNOLOGY", 180, now) ||
      recentSignal(signals, "OPERATIONAL_PAIN", 120, now),
    entityType: company.entityType,
    existingCustomer: company.relationshipStatus === "EXISTING_CUSTOMER",
    rejected: company.relationshipStatus === "REJECTED",
    unsubscribed: company.relationshipStatus === "UNSUBSCRIBED",
  };
}

function toBuyingSignal(signal: SignalRecord): BuyingSignal {
  return {
    id: signal.id,
    type: signal.signalType,
    label: signal.label,
    strength: signal.strength,
    confidence: signal.confidence,
    observedAt: new Date(signal.observedAt).toISOString(),
    sourceLabel: signal.sourceLabel,
    verificationStatus: signal.verificationStatus,
  };
}

function recommendedContact(signals: SignalRecord[]): string {
  const type = [...signals].sort((a, b) => b.strength - a.strength)[0]?.signalType;

  if (type === "TECHNOLOGY") return "CTO / CIO";
  if (type === "PROCUREMENT") return "Procurement lead / COO";
  if (type === "FUNDING") return "CEO / COO";
  if (type === "LEADERSHIP") return "New executive / COO";
  return "COO / Head of Operations";
}

function problemHypothesis(signals: SignalRecord[]): string {
  const primary = [...signals].sort((a, b) => b.strength - a.strength)[0];

  if (!primary) {
    return "Insufficient current evidence to form a specific business-problem hypothesis.";
  }

  const byType: Record<SignalType, string> = {
    HIRING:
      "Rapid hiring may be increasing onboarding, coordination or process-consistency pressure.",
    EXPANSION:
      "Expansion may be increasing operational coordination and system-integration complexity.",
    FUNDING:
      "New capital may create budget and urgency for systems, process or growth-enablement work.",
    LEADERSHIP:
      "A leadership change may create a review window for processes, vendors and operating systems.",
    TECHNOLOGY:
      "Technology change may create integration, migration or workflow-automation requirements.",
    OPERATIONAL_PAIN:
      "Available evidence suggests a potential operational pain point that should be validated before outreach.",
    GROWTH:
      "Growth may be creating process strain and increasing the value of automation or systems work.",
    PROCUREMENT:
      "Public procurement activity suggests an active buying process or near-term vendor need.",
  };

  return byType[primary.signalType];
}

function whyNow(signals: SignalRecord[]): string {
  const primary = [...signals].sort((a, b) => b.strength - a.strength)[0];

  if (!primary) {
    return "No current buying signal has been recorded yet. Research before outreach.";
  }

  return `${primary.summary} Source: ${primary.sourceLabel}.`;
}

function baselineConversionProbability(
  signals: SignalRecord[],
  confidence: number,
): number {
  const activeSignals = signals.filter(
    (signal) => signal.verificationStatus !== "OUTDATED",
  ).length;
  const base = 0.08;
  const signalLift = Math.min(activeSignals * 0.02, 0.08);
  const confidenceLift = Math.max(0, Math.min(confidence, 100)) / 100 * 0.04;
  return Math.round((base + signalLift + confidenceLift) * 100) / 100;
}

export function buildConfiguredOpportunityFromCompany(input: {
  company: CompanyRecord;
  evidence: EvidenceRecord[];
  signals: SignalRecord[];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  links: OfferingIcpLink[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const facts = companyFactsFromRecord(input.company, input.signals, now);
  const confidence = evidenceConfidenceScore(input.evidence, now);

  const base: OpportunityInput = {
    id: input.company.id,
    companyName: input.company.displayName,
    location: [input.company.city, input.company.state, input.company.country]
      .filter(Boolean)
      .join(", "),
    industry: input.company.industry ?? "Industry not yet enriched",
    employeeRange:
      input.company.employeeRange ??
      (input.company.employeeCount
        ? String(input.company.employeeCount)
        : "Unknown"),
    icpFit: 0,
    timing: timingScoreFromSignals(input.signals, now),
    dealPotential: 0,
    contactability: input.company.website || input.company.domain ? 50 : 25,
    evidenceConfidence: confidence,
    expectedDealValue: 0,
    conversionProbability: baselineConversionProbability(
      input.signals,
      confidence,
    ),
    salesEffort: "MEDIUM",
    recommendedOffering: "No linked Offering",
    recommendedContact: recommendedContact(input.signals),
    nextBestAction:
      input.signals.length > 0
        ? "Review evidence and identify the decision maker"
        : "Research company and add buying-signal evidence",
    whyThisCompany: "",
    whyNow: whyNow(input.signals),
    problemHypothesis: problemHypothesis(input.signals),
    signals: input.signals.map(toBuyingSignal),
  };

  return configureOpportunity(
    base,
    facts,
    input.icps,
    input.offerings,
    input.links,
  );
}
