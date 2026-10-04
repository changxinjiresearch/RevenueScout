import type { IcpRule } from "../domain/configured-opportunity";
import type { WebResearchObservation } from "../enrichment/result-types";
import { extractCompanyFeatures } from "./feature-extractor";
import { detectBuyingSignals } from "./signal-detector";
import type {
  ClaimCandidate,
  ClaimEvidenceCandidate,
  ClaimType,
  ExistingEvidenceInput,
} from "./claims";
import type { CollectedPage, CollectorResult } from "./types";

function normaliseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pageSourceType(page: CollectedPage): string {
  if (page.pageKind === "CAREERS") return "JOB_BOARD";
  if (page.pageKind === "NEWS") return "NEWS";
  return "COMPANY_WEBSITE";
}

function evidenceForPage(
  page: CollectedPage,
  excerpt: string,
  extractionConfidence: number,
): ClaimEvidenceCandidate {
  return {
    sourceType: pageSourceType(page),
    sourceUrl: page.url,
    sourceTitle: page.title || new URL(page.url).hostname,
    excerpt: excerpt.slice(0, 700),
    observedAt: page.fetchedAt,
    extractionConfidence,
    verificationStatus: "UNVERIFIED",
  };
}

function featureClaimsFromPage(
  page: CollectedPage,
  icps: IcpRule[],
): ClaimCandidate[] {
  const collector: CollectorResult = {
    officialWebsite: page.url,
    websiteConfidence: 0.9,
    pages: [page],
    attemptedUrls: [page.url],
    warnings: [],
  };

  const features = extractCompanyFeatures({ collector, icps });
  const candidates: ClaimCandidate[] = [];

  if (features.industry) {
    candidates.push({
      claimType: "INDUSTRY",
      claimKey: normaliseKey(features.industry),
      value: { industry: features.industry },
      evidence: evidenceForPage(
        page,
        page.description || page.text.slice(0, 500),
        features.industryConfidence,
      ),
    });
  }

  if (features.subindustry) {
    candidates.push({
      claimType: "SUBINDUSTRY",
      claimKey: normaliseKey(features.subindustry),
      value: { subindustry: features.subindustry },
      evidence: evidenceForPage(
        page,
        page.description || page.text.slice(0, 500),
        Math.max(0.6, features.industryConfidence - 0.05),
      ),
    });
  }

  if (
    features.employeeLow >= 0 &&
    features.employeeHigh >= features.employeeLow
  ) {
    candidates.push({
      claimType: "EMPLOYEE_RANGE",
      claimKey: `${features.employeeLow}-${features.employeeHigh}`,
      value: {
        low: features.employeeLow,
        high: features.employeeHigh,
      },
      evidence: evidenceForPage(
        page,
        page.text.slice(0, 700),
        features.employeeConfidence,
      ),
    });
  }

  for (const region of features.serviceRegions) {
    candidates.push({
      claimType: "SERVICE_REGION",
      claimKey: normaliseKey(region),
      value: { region },
      evidence: evidenceForPage(page, page.text.slice(0, 500), 0.72),
    });
  }

  for (const businessModel of features.businessModels) {
    candidates.push({
      claimType: "BUSINESS_MODEL",
      claimKey: normaliseKey(businessModel),
      value: { businessModel },
      evidence: evidenceForPage(page, page.text.slice(0, 500), 0.68),
    });
  }

  for (const technology of features.technologies) {
    candidates.push({
      claimType: "TECHNOLOGY",
      claimKey: normaliseKey(technology),
      value: { technology },
      evidence: evidenceForPage(page, page.text.slice(0, 500), 0.72),
    });
  }

  for (const role of features.decisionRoles) {
    candidates.push({
      claimType: "DECISION_ROLE",
      claimKey: normaliseKey(role),
      value: { role },
      evidence: evidenceForPage(page, page.text.slice(0, 500), 0.7),
    });
  }

  return candidates;
}

function claimTypeForSignal(
  signalType: WebResearchObservation["signalType"],
): ClaimType | null {
  switch (signalType) {
    case "HIRING":
    case "EXPANSION":
    case "FUNDING":
    case "LEADERSHIP":
    case "TECHNOLOGY":
    case "PROCUREMENT":
    case "GROWTH":
    case "OPERATIONAL_PAIN":
      return signalType;
    default:
      return null;
  }
}

function signalClaims(
  observations: WebResearchObservation[],
): ClaimCandidate[] {
  return observations.flatMap((observation) => {
    const claimType = claimTypeForSignal(observation.signalType);
    if (!claimType) return [];

    return [
      {
        claimType,
        claimKey: "present",
        value: {
          present: true,
          label: observation.title,
          strength: observation.signalStrength,
        },
        evidence: {
          sourceType: observation.sourceType,
          sourceUrl: observation.sourceUrl,
          sourceTitle: observation.sourceTitle,
          excerpt: observation.observation,
          observedAt: observation.observedAt,
          extractionConfidence: observation.confidence,
          verificationStatus: observation.verificationStatus,
        },
      } satisfies ClaimCandidate,
    ];
  });
}

function pseudoPageFromEvidence(
  evidence: ExistingEvidenceInput,
): CollectedPage {
  return {
    url: evidence.sourceUrl,
    title: evidence.title,
    description: evidence.excerpt,
    text: evidence.excerpt,
    fetchedAt: evidence.observedAt,
    pageKind: "OTHER",
  };
}

function candidatesFromExistingEvidence(
  evidence: ExistingEvidenceInput,
  icps: IcpRule[],
): ClaimCandidate[] {
  if (!evidence.sourceUrl || !evidence.excerpt) return [];

  const page = pseudoPageFromEvidence(evidence);
  const featureCandidates = featureClaimsFromPage(page, icps).map(
    (candidate) => ({
      ...candidate,
      evidence: {
        ...candidate.evidence,
        sourceType: evidence.sourceType,
        sourceTitle: evidence.sourceLabel || evidence.title,
        observedAt: evidence.observedAt,
        verificationStatus: evidence.verificationStatus,
        extractionConfidence: Math.min(
          candidate.evidence.extractionConfidence,
          evidence.confidence,
        ),
      },
    }),
  );

  const detectedSignals = detectBuyingSignals([page]).map((observation) => ({
    ...observation,
    sourceType: evidence.sourceType,
    sourceTitle: evidence.sourceLabel || evidence.title,
    observedAt: evidence.observedAt,
    confidence: Math.min(observation.confidence, evidence.confidence),
    verificationStatus: evidence.verificationStatus,
  }));

  return [...featureCandidates, ...signalClaims(detectedSignals)];
}

export function buildClaimCandidates(input: {
  collector: CollectorResult;
  observations: WebResearchObservation[];
  existingEvidence: ExistingEvidenceInput[];
  icps: IcpRule[];
}): ClaimCandidate[] {
  const collectedFeatureClaims = input.collector.pages.flatMap((page) =>
    featureClaimsFromPage(page, input.icps),
  );

  const persistedEvidenceClaims = input.existingEvidence.flatMap((evidence) =>
    candidatesFromExistingEvidence(evidence, input.icps),
  );

  return [
    ...collectedFeatureClaims,
    ...signalClaims(input.observations),
    ...persistedEvidenceClaims,
  ];
}
