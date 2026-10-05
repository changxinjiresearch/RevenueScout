import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addAustralianIndustryDirectoryEvidence,
  resetIndustryDirectoryPageCacheForTests,
} from "../src/lib/discovery/industry-directories";
import { industryValidationForCandidate } from "../src/lib/discovery/multi-source";
import type { DiscoveryCandidate } from "../src/lib/discovery/types";

function candidate(): DiscoveryCandidate {
  return {
    provider: "GLEIF",
    providerRecordId: "LEI-AM-LOGISTICS",
    displayName: "AM Logistics Pty Ltd",
    legalName: "AM Logistics Pty Ltd",
    website: "https://amlogistics.example.com",
    domain: "amlogistics.example.com",
    description: null,
    country: "AU",
    state: "AU-QLD",
    city: "Brisbane",
    address: null,
    industry: "Logistics",
    subindustry: null,
    employeeCount: null,
    employeeRange: null,
    foundedYear: null,
    companyType: null,
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
    sourceUrl: "https://search.gleif.org/#/record/LEI-AM-LOGISTICS",
    sourceLabel: "GLEIF LEI record",
    observedAt: "2026-10-05T00:00:00.000Z",
    sourceConfidence: 0.98,
    verificationStatus: "CONFIRMED",
    sourceEvidence: [
      {
        provider: "GLEIF",
        providerRecordId: "LEI-AM-LOGISTICS",
        sourceUrl: "https://search.gleif.org/#/record/LEI-AM-LOGISTICS",
        sourceLabel: "GLEIF LEI record",
        excerpt: "AM Logistics Pty Ltd",
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.98,
        verificationStatus: "CONFIRMED",
        sourceFamily: "gleif.org",
        matchedSemantics: ["logistics"],
        supportsIndustry: false,
      },
      {
        provider: "OFFICIAL_WEBSITE",
        providerRecordId: null,
        sourceUrl: "https://amlogistics.example.com/services",
        sourceLabel: "Verified official company website",
        excerpt: "Freight forwarding, warehousing and logistics services.",
        observedAt: "2026-10-05T00:00:00.000Z",
        confidence: 0.95,
        verificationStatus: "CONFIRMED",
        sourceFamily: "official:amlogistics.example.com",
        matchedSemantics: ["logistics", "freight", "warehousing"],
        supportsIndustry: true,
      },
    ],
    matchedSemantics: ["logistics", "freight", "warehousing"],
    providerIdentifiers: [
      {
        provider: "GLEIF",
        identifierType: "LEI",
        identifierValue: "LEI-AM-LOGISTICS",
      },
    ],
  };
}

afterEach(() => {
  resetIndustryDirectoryPageCacheForTests();
  vi.unstubAllGlobals();
});

describe("Australian logistics directory evidence", () => {
  it("adds an independent FTA industry source and upgrades to corroborated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("freight-forwarding-customs-broker")) {
          return new Response(
            "<html><body><h3>AM Logistics Pty Ltd</h3><p>Freight forwarding and logistics services</p><a href='https://amlogistics.example.com'>Website</a></body></html>",
            { status: 200 },
          );
        }
        return new Response("<html><body>Other companies only</body></html>", {
          status: 200,
        });
      }),
    );

    const enriched = await addAustralianIndustryDirectoryEvidence(
      candidate(),
      ["logistics", "freight", "freight forwarding", "warehousing"],
    );

    const fta = enriched.sourceEvidence?.find(
      (item) => item.provider === "FTA_APSA",
    );
    expect(fta?.supportsIndustry).toBe(true);

    const validation = industryValidationForCandidate(
      enriched,
      "logistics",
    );
    expect(validation?.status).toBe("CORROBORATED");
    expect(validation?.independentSupportingFamilyCount).toBe(2);

    const families = new Set(
      enriched.sourceEvidence?.map((item) => item.sourceFamily),
    );
    expect(families.size).toBe(3);
  });

  it("keeps ALC membership as sector evidence unless nearby text directly supports logistics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("austlogistics.com.au")) {
          return new Response(
            "<html><body><h3>AM Logistics Pty Ltd</h3><p>Member</p></body></html>",
            { status: 200 },
          );
        }
        return new Response("<html><body>No match</body></html>", {
          status: 200,
        });
      }),
    );

    const enriched = await addAustralianIndustryDirectoryEvidence(
      candidate(),
      ["logistics", "freight", "warehousing"],
    );

    const alc = enriched.sourceEvidence?.find(
      (item) => item.provider === "ALC",
    );
    expect(alc).toBeDefined();
    expect(alc?.supportsIndustry).toBe(false);
  });

  it("does not add Australian directory evidence to non-Australian candidates", async () => {
    const usCandidate = { ...candidate(), country: "US" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const enriched = await addAustralianIndustryDirectoryEvidence(
      usCandidate,
      ["logistics"],
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(enriched.sourceEvidence).toEqual(usCandidate.sourceEvidence);
  });
});
