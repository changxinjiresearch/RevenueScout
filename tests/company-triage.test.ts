import { describe, expect, it } from "vitest";
import {
  assessCompanyTriage,
  assessDiscoveryCandidate,
} from "../src/lib/companies/triage";
import type { DiscoveryCandidate } from "../src/lib/discovery/types";
import type { IcpRule } from "../src/lib/domain/configured-opportunity";

const candidate: DiscoveryCandidate = {
  provider: "GLEIF",
  providerRecordId: "529900SV3654YNRTIK74",
  displayName: "DIVINE LOGISTICS TRUST",
  legalName: "DIVINE LOGISTICS TRUST",
  website: null,
  domain: null,
  description: "GLEIF legal entity record",
  country: "AU",
  state: "AU-VIC",
  city: "Melbourne",
  address: "Level 45, Rialto South Tower, Melbourne",
  industry: null,
  subindustry: null,
  employeeCount: null,
  employeeRange: null,
  foundedYear: null,
  companyType: null,
  legalEntityCategory: "FUND",
  legalEntitySubcategory: null,
  entityStatus: "ACTIVE",
  registrationStatus: "ISSUED",
  jurisdiction: "AU",
  legalFormCode: "7TPC",
  registrationAuthority: "RA000013",
  registeredAs: "62 365 829 227",
  providerLastUpdatedAt: "2026-09-28T09:21:45Z",
  rawSourceUrl:
    "https://api.gleif.org/api/v1/lei-records/529900SV3654YNRTIK74",
  serviceRegions: [],
  entityType: "UNKNOWN",
  sourceUrl: "https://search.gleif.org/#/record/529900SV3654YNRTIK74",
  sourceLabel: "GLEIF LEI record",
  observedAt: "2026-09-28T09:21:45Z",
  sourceConfidence: 0.98,
  verificationStatus: "CONFIRMED",
};

const icp: IcpRule = {
  id: "icp-1",
  name: "Australian Logistics SME",
  countries: ["AU"],
  states: ["AU-VIC"],
  cities: [],
  industries: ["Logistics"],
  subindustries: [],
  employeeMin: 20,
  employeeMax: 250,
  companyAgeMin: null,
  companyAgeMax: null,
  companyTypes: [],
  serviceRegions: [],
  fastGrowth: false,
  multiLocation: false,
  hiring: false,
  recentFunding: false,
  requiredRoles: [],
  businessModels: [],
  technologies: [],
  digitalNeed: false,
  exclusions: "",
  excludedIndustries: [],
  excludeGovernment: true,
  excludeNonprofit: true,
  excludeExistingCustomer: true,
  excludeRejected: true,
  excludeUnsubscribed: true,
  employeeExcludeBelow: null,
  employeeExcludeAbove: null,
};

describe("fast company triage", () => {
  it("flags fund entities before the user imports them", () => {
    const result = assessDiscoveryCandidate(candidate);
    expect(result.status).toBe("LOW_POTENTIAL");
    expect(result.recommendation).toBe("REJECT");
  });

  it("does not ask for enrichment when an external entity type already makes the lead poor-fit", () => {
    const result = assessCompanyTriage({
      company: {
        id: "company-1",
        displayName: candidate.displayName,
        website: null,
        domain: null,
        description: null,
        country: "AU",
        state: "AU-VIC",
        city: "Melbourne",
        industry: null,
        subindustry: null,
        employeeCount: null,
        employeeRange: null,
        foundedYear: null,
        companyType: null,
        serviceRegions: [],
        rolesObserved: [],
        businessModels: [],
        technologies: [],
        fastGrowth: false,
        multiLocation: false,
        currentlyHiring: false,
        recentFunding: false,
        digitalNeed: false,
        entityType: "UNKNOWN",
        relationshipStatus: "NONE",
        legalEntityCategory: "FUND",
        entityStatus: "ACTIVE",
      },
      configured: null,
      icps: [icp],
      signals: [],
    });

    expect(result.status).toBe("LOW_POTENTIAL");
    expect(result.missingFields).toEqual([]);
  });
});
