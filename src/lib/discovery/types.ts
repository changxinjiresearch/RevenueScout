export type DiscoveryProviderId =
  | "MULTI_SOURCE"
  | "GLEIF"
  | "WIKIDATA";

export type DiscoveryEvidenceProvider =
  | Exclude<DiscoveryProviderId, "MULTI_SOURCE">
  | "OFFICIAL_WEBSITE"
  | "FTA_APSA"
  | "ATA"
  | "AFRA"
  | "ALC";

export type DiscoveryEvidenceSource = {
  provider: DiscoveryEvidenceProvider;
  providerRecordId?: string | null;
  sourceUrl: string;
  sourceLabel: string;
  excerpt: string;
  observedAt: string;
  confidence: number;
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED";
  sourceFamily: string;
  matchedSemantics: string[];
  supportsIndustry: boolean;
};

export type DiscoveryIndustryValidation = {
  query: string;
  status: "SUPPORTED" | "CORROBORATED" | "CONFIRMED";
  confidence: number;
  independentSupportingFamilyCount: number;
  matchedSemantics: string[];
};

export type DiscoveryProviderIdentifier = {
  provider: Exclude<DiscoveryProviderId, "MULTI_SOURCE">;
  identifierType: string;
  identifierValue: string;
};

export type DiscoveryQualificationStatus =
  | "QUALIFIED"
  | "PARTIALLY_QUALIFIED"
  | "NOT_QUALIFIED";

export type DiscoveryPriorityBand = "HIGH" | "MEDIUM" | "RESEARCH";

export type DiscoveryPriority = {
  band: DiscoveryPriorityBand;
  score: number;
  relativePercentile: number;
  rationale: string[];
  qualificationStatus: DiscoveryQualificationStatus;
  matchedFields: string[];
  missingFields: string[];
  failedFields: string[];
};

export type DiscoveryCandidate = {
  provider: DiscoveryProviderId;
  providerRecordId: string;
  displayName: string;
  legalName: string;
  website: string | null;
  domain: string | null;
  description: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  foundedYear: number | null;
  companyType: string | null;
  legalEntityCategory: string | null;
  legalEntitySubcategory: string | null;
  entityStatus: string | null;
  registrationStatus: string | null;
  jurisdiction: string | null;
  legalFormCode: string | null;
  registrationAuthority: string | null;
  registeredAs: string | null;
  providerLastUpdatedAt: string | null;
  rawSourceUrl: string | null;
  serviceRegions: string[];
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
  sourceUrl: string;
  sourceLabel: string;
  observedAt: string;
  sourceConfidence: number;
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED";

  /**
   * Multi-source discovery metadata. Older persisted runs may not contain these
   * fields, so they remain optional for backward compatibility.
   */
  sourceEvidence?: DiscoveryEvidenceSource[];
  industryValidation?: DiscoveryIndustryValidation | null;
  matchedSemantics?: string[];
  providerIdentifiers?: DiscoveryProviderIdentifier[];
  discoveryPriority?: DiscoveryPriority | null;
};

export type DiscoveryQuery = {
  query: string;
  country?: string | null;
  region?: string | null;

  /**
   * Retained only for adapter compatibility. The production multi-source
   * discovery path intentionally applies no product-level result cap.
   */
  limit?: number;
};

export interface DiscoveryProvider {
  id: DiscoveryProviderId;
  label: string;
  coverageNote: string;
  search(query: DiscoveryQuery): Promise<DiscoveryCandidate[]>;
}
