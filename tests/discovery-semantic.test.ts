import { describe, expect, it } from "vitest";
import {
  expandIndustrySemantics,
  matchedIndustrySemantics,
} from "../src/lib/discovery/semantic";
import {
  dedupeDiscoveryCandidates,
  industryValidationForCandidate,
} from "../src/lib/discovery/multi-source";
import type { DiscoveryCandidate } from "../src/lib/discovery/types";

function candidate(input: {
  provider: "GLEIF" | "WIKIDATA";
  id: string;
  name: string;
  country?: string;
  domain?: string | null;
  sourceFamily: string;
}): DiscoveryCandidate {
  return {
    provider: input.provider,
    providerRecordId: input.id,
    displayName: input.name,
    legalName: input.name,
    website: input.domain ? `https://${input.domain}` : null,
    domain: input.domain ?? null,
    description: null,
    country: input.country ?? "AU",
    state: null,
    city: null,
    address: null,
    industry: null,
    subindustry: null,
    employeeCount: null,
    employeeRange: null,
    foundedYear: null,
    companyType: null,
    legalEntityCategory: null,
    legalEntitySubcategory: null,
    entityStatus: null,
    registrationStatus: null,
    jurisdiction: input.country ?? "AU",
    legalFormCode: null,
    registrationAuthority: null,
    registeredAs: null,
    providerLastUpdatedAt: null,
    rawSourceUrl: null,
    serviceRegions: [],
    entityType: "UNKNOWN",
    sourceUrl: `https://example.test/${input.id}`,
    sourceLabel: input.provider,
    observedAt: "2026-10-05T00:00:00.000Z",
    sourceConfidence: 0.8,
    verificationStatus: "LIKELY",
    sourceEvidence: [
      {
        provider: input.provider,
        providerRecordId: input.id,
        sourceUrl: `https://example.test/${input.id}`,
        sourceLabel: input.provider,
        excerpt: input.name,
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.8,
        verificationStatus: "LIKELY",
        sourceFamily: input.sourceFamily,
        matchedSemantics: ["logistics"],
        supportsIndustry: input.provider === "WIKIDATA",
      },
    ],
    matchedSemantics: ["logistics"],
    providerIdentifiers: [
      {
        provider: input.provider,
        identifierType: input.provider,
        identifierValue: input.id,
      },
    ],
  };
}

describe("semantic discovery", () => {
  it("expands logistics into multiple commercially equivalent semantics", () => {
    const terms = expandIndustrySemantics("logistics");

    expect(terms).toContain("logistics");
    expect(terms).toContain("freight");
    expect(terms).toContain("warehousing");
    expect(terms).toContain("supply chain");
    expect(terms).toContain("3pl");
  });

  it("matches semantic variants instead of literal query only", () => {
    const terms = expandIndustrySemantics("logistics");
    const matches = matchedIndustrySemantics(
      "National freight forwarding and warehousing operator",
      terms,
    );

    expect(matches).toContain("freight");
    expect(matches).toContain("freight forwarding");
    expect(matches).toContain("warehousing");
  });


  it("rejects a candidate supported by only one industry source family", () => {
    const oneSource = candidate({
      provider: "GLEIF",
      id: "LEI-ONLY",
      name: "Solo Logistics Pty Ltd",
      country: "AU",
      sourceFamily: "gleif.org",
    });

    expect(
      industryValidationForCandidate(oneSource, "logistics"),
    ).toBeNull();
  });

  it("does not treat a GLEIF legal-name keyword as independent industry proof", () => {
    const merged = dedupeDiscoveryCandidates([
      candidate({
        provider: "GLEIF",
        id: "LEI-2",
        name: "Verified Freight Pty Ltd",
        country: "AU",
        domain: "verifiedfreight.com.au",
        sourceFamily: "gleif.org",
      }),
      candidate({
        provider: "WIKIDATA",
        id: "Q2",
        name: "Verified Freight",
        country: "AU",
        domain: "verifiedfreight.com.au",
        sourceFamily: "wikidata.org",
      }),
    ])[0];

    expect(
      industryValidationForCandidate(merged, "logistics"),
    ).toBeNull();
  });

  it("accepts industry relevance after two true industry source families agree", () => {
    const merged = dedupeDiscoveryCandidates([
      candidate({
        provider: "GLEIF",
        id: "LEI-3",
        name: "Verified Freight Pty Ltd",
        country: "AU",
        domain: "verifiedfreight.com.au",
        sourceFamily: "gleif.org",
      }),
      candidate({
        provider: "WIKIDATA",
        id: "Q3",
        name: "Verified Freight",
        country: "AU",
        domain: "verifiedfreight.com.au",
        sourceFamily: "wikidata.org",
      }),
    ])[0];

    merged.sourceEvidence = [
      ...(merged.sourceEvidence ?? []),
      {
        provider: "OFFICIAL_WEBSITE",
        providerRecordId: null,
        sourceUrl: "https://verifiedfreight.com.au/services",
        sourceLabel: "Verified official company website",
        excerpt: "Freight forwarding, warehousing and distribution services.",
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.95,
        verificationStatus: "CONFIRMED",
        sourceFamily: "official:verifiedfreight.com.au",
        matchedSemantics: ["freight", "warehousing", "distribution"],
        supportsIndustry: true,
      },
    ];

    const validation = industryValidationForCandidate(merged, "logistics");

    expect(validation).not.toBeNull();
    expect(validation?.independentSupportingFamilyCount).toBe(2);
    expect(validation?.status).toBe("CORROBORATED");
    expect(merged.sourceEvidence).toHaveLength(3);
  });

  it("deduplicates the same company across providers and retains provenance", () => {
    const results = dedupeDiscoveryCandidates([
      candidate({
        provider: "GLEIF",
        id: "LEI-1",
        name: "Boom Logistics Limited",
        country: "AU",
        domain: null,
        sourceFamily: "gleif.org",
      }),
      candidate({
        provider: "WIKIDATA",
        id: "Q1",
        name: "Boom Logistics Ltd",
        country: "AU",
        domain: "boomlogistics.com.au",
        sourceFamily: "wikidata.org",
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe("boomlogistics.com.au");
    expect(results[0].sourceEvidence).toHaveLength(2);
    expect(results[0].providerIdentifiers).toHaveLength(2);
  });
});
