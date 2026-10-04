import type {
  IcpRule,
  OfferingConfig,
} from "../domain/configured-opportunity";
import { collectPublicPages } from "./collector";
import { extractCompanyFeatures } from "./feature-extractor";
import { detectBuyingSignals } from "./signal-detector";
import { runConversionModelV1 } from "./model-v1";
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

export async function runRevenueScoutIntelligenceV1(input: {
  company: IntelligenceCompanyInput;
  evidenceUrls: string[];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  now?: Date;
}): Promise<LocalIntelligenceRun> {
  const collector = await collectPublicPages({
    displayName: input.company.displayName,
    legalName: input.company.legalName,
    website: input.company.website,
    domain: input.company.domain,
    evidenceUrls: input.evidenceUrls,
  });

  const features = extractCompanyFeatures({
    collector,
    icps: input.icps,
  });

  const observations = detectBuyingSignals(
    collector.pages,
    input.now ?? new Date(),
  );

  const result = runConversionModelV1({
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
    signals: observations,
    icps: input.icps,
    offerings: input.offerings,
    now: input.now,
  });

  return {
    result,
    sourceUrls: collector.pages.map((page) => page.url),
    engine: "REVENUESCOUT_INTELLIGENCE_V1",
    model: "RS_CONVERSION_V1",
    collector,
    observations,
  };
}

export function sourceBelongsToRun(
  sourceUrl: string,
  sourceUrls: string[],
): boolean {
  return sourceUrls.includes(sourceUrl);
}
