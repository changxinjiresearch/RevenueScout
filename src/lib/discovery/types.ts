export type DiscoveryProviderId = "GLEIF";

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
};

export type DiscoveryQuery = {
  query: string;
  country?: string | null;
  region?: string | null;
  limit?: number;
};

export interface DiscoveryProvider {
  id: DiscoveryProviderId;
  label: string;
  coverageNote: string;
  search(query: DiscoveryQuery): Promise<DiscoveryCandidate[]>;
}
