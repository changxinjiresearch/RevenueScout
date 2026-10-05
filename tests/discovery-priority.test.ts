import { describe, expect, it } from "vitest";
import { rankDiscoveryCandidates } from "../src/lib/discovery/priority";
import type { DiscoveryCandidate } from "../src/lib/discovery/types";

function validatedCandidate(
  id: string,
  input: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    provider: "MULTI_SOURCE",
    providerRecordId: id,
    displayName: `Company ${id}`,
    legalName: `Company ${id} Pty Ltd`,
    website: `https://${id}.example.com`,
    domain: `${id}.example.com`,
    description: "Australian logistics and freight operator",
    country: "AU",
    state: "NSW",
    city: "Sydney",
    address: null,
    industry: "Logistics",
    subindustry: null,
    employeeCount: null,
    employeeRange: null,
    foundedYear: 2018,
    companyType: "Private",
    legalEntityCategory: "GENERAL",
    legalEntitySubcategory: null,
    entityStatus: "ACTIVE",
    registrationStatus: "ISSUED",
    jurisdiction: "AU",
    legalFormCode: null,
    registrationAuthority: null,
    registeredAs: null,
    providerLastUpdatedAt: null,
    rawSourceUrl: null,
    serviceRegions: [],
    entityType: "PRIVATE",
    sourceUrl: `https://www.wikidata.org/wiki/${id}`,
    sourceLabel: "Multi-source semantic validation",
    observedAt: "2026-10-05T00:00:00.000Z",
    sourceConfidence: 0.9,
    verificationStatus: "LIKELY",
    sourceEvidence: [
      {
        provider: "GLEIF",
        providerRecordId: `LEI-${id}`,
        sourceUrl: `https://search.gleif.org/${id}`,
        sourceLabel: "GLEIF LEI record",
        excerpt: `Company ${id} Pty Ltd`,
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.98,
        verificationStatus: "CONFIRMED",
        sourceFamily: "gleif.org",
        matchedSemantics: ["logistics"],
        supportsIndustry: false,
      },
      {
        provider: "WIKIDATA",
        providerRecordId: id,
        sourceUrl: `https://www.wikidata.org/wiki/${id}`,
        sourceLabel: "Wikidata entity",
        excerpt: "Australian logistics company",
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.8,
        verificationStatus: "LIKELY",
        sourceFamily: "wikidata.org",
        matchedSemantics: ["logistics"],
        supportsIndustry: true,
      },
      {
        provider: "OFFICIAL_WEBSITE",
        providerRecordId: null,
        sourceUrl: `https://${id}.example.com/services`,
        sourceLabel: "Verified official company website",
        excerpt: "Freight forwarding and warehousing services",
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.95,
        verificationStatus: "CONFIRMED",
        sourceFamily: `official:${id}.example.com`,
        matchedSemantics: ["freight", "warehousing"],
        supportsIndustry: true,
      },
    ],
    industryValidation: {
      query: "logistics",
      status: "CORROBORATED",
      confidence: 0.9,
      independentSupportingFamilyCount: 2,
      matchedSemantics: ["logistics", "freight", "warehousing"],
    },
    matchedSemantics: ["logistics", "freight", "warehousing"],
    providerIdentifiers: [],
    ...input,
  };
}

const icp = {
  countries: ["AU"],
  states: [],
  cities: [],
  industries: ["Logistics"],
  subindustries: [],
  employeeMin: 20,
  employeeMax: 500,
  companyAgeMin: null,
  companyAgeMax: null,
  companyTypes: [],
};

describe("discovery priority", () => {
  it("keeps missing employee count unknown rather than scoring it as a mismatch", () => {
    const [result] = rankDiscoveryCandidates(
      [validatedCandidate("Q1")],
      icp,
    );

    expect(result.discoveryPriority?.qualificationStatus).toBe(
      "PARTIALLY_QUALIFIED",
    );
    expect(result.discoveryPriority?.missingFields).toContain(
      "Employee count",
    );
    expect(result.discoveryPriority?.failedFields).not.toContain(
      "Employee count outside ICP",
    );
  });

  it("creates a real high-priority tier from the strongest validated results", () => {
    const results = rankDiscoveryCandidates(
      [
        validatedCandidate("Q1", { sourceConfidence: 0.97 }),
        validatedCandidate("Q2", { sourceConfidence: 0.91 }),
        validatedCandidate("Q3", { sourceConfidence: 0.86 }),
        validatedCandidate("Q4", { sourceConfidence: 0.82 }),
        validatedCandidate("Q5", { sourceConfidence: 0.78 }),
      ],
      icp,
    );

    expect(results.some((item) => item.discoveryPriority?.band === "HIGH")).toBe(
      true,
    );
    expect(
      results.filter((item) => item.discoveryPriority?.band === "HIGH").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("never promotes a known ICP mismatch into the high-priority tier", () => {
    const results = rankDiscoveryCandidates(
      [
        validatedCandidate("Q1"),
        validatedCandidate("Q2", { country: "US" }),
      ],
      icp,
    );

    const mismatch = results.find((item) => item.providerRecordId === "Q2");
    expect(mismatch?.discoveryPriority?.qualificationStatus).toBe(
      "NOT_QUALIFIED",
    );
    expect(mismatch?.discoveryPriority?.band).toBe("RESEARCH");
  });
});
