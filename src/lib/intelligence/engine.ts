import type {
  IcpRule,
  OfferingConfig,
} from "../domain/configured-opportunity";
import { collectPublicPages } from "./collector";
import { extractCompanyFeatures } from "./feature-extractor";
import { detectBuyingSignals } from "./signal-detector";
import { buildClaimCandidates } from "./claim-builder";
import { validateClaims } from "./cross-validation";
import { runConversionModelV2 } from "./model-v2";
import type {
  ExistingEvidenceInput,
} from "./claims";
import type { LocalIntelligenceRun } from "./types";

export type IntelligenceCompanyInput = {
  displayName: string;
  legalName: string | null;
  website: string | null;
  domain: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  companyType: string | null;
  serviceRegions: string[];
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
};

export async function runRevenueScoutIntelligenceV2(input: {
  company: IntelligenceCompanyInput;
  existingEvidence: ExistingEvidenceInput[];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  now?: Date;
}): Promise<LocalIntelligenceRun> {
  const now = input.now ?? new Date();

  const collector = await collectPublicPages({
    displayName: input.company.displayName,
    legalName: input.company.legalName,
    website: input.company.website,
    domain: input.company.domain,
    evidenceUrls: input.existingEvidence
      .map((item) => item.sourceUrl)
      .filter(Boolean),
    maxPages: 10,
  });

  const features = extractCompanyFeatures({
    collector,
    icps: input.icps,
  });

  const observations = detectBuyingSignals(
    collector.pages,
    now,
    collector.officialWebsite || undefined,
  );

  const claimCandidates = buildClaimCandidates({
    collector,
    observations,
    existingEvidence: input.existingEvidence,
    icps: input.icps,
  });

  const validation = validateClaims(claimCandidates, now);

  const result = runConversionModelV2({
    company: {
      displayName: input.company.displayName,
      country: input.company.country,
      state: input.company.state,
      city: input.company.city,
      industry: input.company.industry,
      subindustry: input.company.subindustry,
      employeeCount: input.company.employeeCount,
      companyType: input.company.companyType,
      serviceRegions: input.company.serviceRegions,
      entityType: input.company.entityType,
    },
    collector,
    features,
    validation,
    observations,
    icps: input.icps,
    offerings: input.offerings,
    now,
  });

  const sourceUrls = [
    ...new Set(
      validation.claims.flatMap((claim) =>
        claim.evidence.map((evidence) => evidence.sourceUrl),
      ),
    ),
  ];

  return {
    result,
    sourceUrls,
    engine: "REVENUESCOUT_INTELLIGENCE_V2",
    model: "RS_CONVERSION_V2",
    collector,
    observations,
    validation,
  };
}

export function sourceBelongsToRun(
  sourceUrl: string,
  sourceUrls: string[],
): boolean {
  return sourceUrls.includes(sourceUrl);
}
