import { describe, expect, it } from "vitest";
import { runConversionModelV2 } from "../src/lib/intelligence/model-v2";
import type {
  ClaimValidationSummary,
  ValidatedClaim,
} from "../src/lib/intelligence/claims";
import type {
  IcpRule,
  OfferingConfig,
} from "../src/lib/domain/configured-opportunity";

const icp: IcpRule = {
  id: "icp-1",
  name: "Australian Logistics SME",
  countries: ["AU"],
  states: ["NSW"],
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
  hiring: true,
  recentFunding: false,
  requiredRoles: [],
  businessModels: [],
  technologies: [],
  digitalNeed: true,
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

const offering: OfferingConfig = {
  id: "offering-1",
  name: "Operations Workflow Automation",
  minContractValue: 15000,
  avgContractValue: 40000,
  idealContractValue: 80000,
};

function claim(
  overrides: Partial<ValidatedClaim> = {},
): ValidatedClaim {
  return {
    claimType: "INDUSTRY",
    claimKey: "logistics",
    value: { industry: "Logistics" },
    status: "CORROBORATED",
    confidence: 0.78,
    supportingFamilyCount: 2,
    conflictingFamilyCount: 0,
    sourceCount: 2,
    freshnessScore: 0.9,
    sourceQualityScore: 0.85,
    independenceScore: 0.7,
    agreementScore: 1,
    extractionScore: 0.9,
    firstObservedAt: "2026-09-20T00:00:00.000Z",
    lastObservedAt: "2026-10-01T00:00:00.000Z",
    explanation: "Corroborated by two independent sources.",
    evidence: [],
    ...overrides,
  };
}

function validation(
  claims: ValidatedClaim[],
): ClaimValidationSummary {
  return {
    claims,
    confirmedCount: claims.filter((item) => item.status === "CONFIRMED").length,
    corroboratedCount: claims.filter(
      (item) => item.status === "CORROBORATED",
    ).length,
    singleSourceCount: claims.filter(
      (item) => item.status === "SINGLE_SOURCE",
    ).length,
    conflictedCount: claims.filter(
      (item) => item.status === "CONFLICTED",
    ).length,
    staleCount: claims.filter((item) => item.status === "STALE").length,
    independentFamilyCount: Math.max(
      0,
      ...claims.map((item) => item.supportingFamilyCount),
    ),
  };
}

function run(claims: ValidatedClaim[]) {
  return runConversionModelV2({
    company: {
      displayName: "Example Logistics",
      country: "AU",
      state: "NSW",
      city: "Sydney",
      industry: null,
      subindustry: null,
      employeeCount: null,
      companyType: "Private",
      serviceRegions: [],
      entityType: "PRIVATE",
    },
    collector: {
      officialWebsite: "https://example.com",
      websiteConfidence: 0.75,
      pages: [],
      attemptedUrls: [],
      warnings: [],
    },
    features: {
      businessSummary: "",
      industry: "Logistics",
      subindustry: "",
      industryConfidence: 0.9,
      employeeLow: -1,
      employeeHigh: -1,
      employeeConfidence: 0,
      serviceRegions: [],
      businessModels: [],
      technologies: [],
      decisionRoles: [],
    },
    validation: validation(claims),
    observations: [],
    icps: [icp],
    offerings: [offering],
    now: new Date("2026-10-04T00:00:00.000Z"),
  });
}

describe("RS Conversion Model v2", () => {
  it("treats missing dimensions as unknown rather than zero", () => {
    const result = run([claim()]);

    expect(result.overallPotentialScore).toBeGreaterThanOrEqual(90);
    expect(result.unknownDimensions).toContain("Buying intent");
    expect(result.unknownDimensions).toContain("Timing");
    expect(result.unknownDimensions).toContain("Need");
    expect(result.unknownDimensions).toContain("Budget fit");
    expect(result.potentialConservativeScore).toBeLessThan(
      result.overallPotentialScore,
    );
    expect(result.potentialUpsideScore).toBeGreaterThanOrEqual(
      result.overallPotentialScore,
    );
  });

  it("keeps single-source positive signals out of the live score", () => {
    const singleHiring = claim({
      claimType: "HIRING",
      claimKey: "present",
      value: { present: true, strength: 80 },
      status: "SINGLE_SOURCE",
      confidence: 0.65,
      supportingFamilyCount: 1,
    });

    const result = run([claim(), singleHiring]);

    expect(result.buyingIntentScore).toBe(0);
    expect(result.timingScore).toBe(0);
    expect(result.unknownDimensions).toContain("Buying intent");
    expect(result.researchPriorityScore).toBeGreaterThan(0);
  });

  it("turns corroborated current signals into known intent and timing", () => {
    const hiring = claim({
      claimType: "HIRING",
      claimKey: "present",
      value: { present: true, strength: 80 },
      status: "CORROBORATED",
      confidence: 0.82,
      supportingFamilyCount: 2,
      lastObservedAt: "2026-10-02T00:00:00.000Z",
    });

    const result = run([claim(), hiring]);

    expect(result.buyingIntentScore).toBeGreaterThan(0);
    expect(result.timingScore).toBeGreaterThan(0);
    expect(result.unknownDimensions).not.toContain("Buying intent");
    expect(result.unknownDimensions).not.toContain("Timing");
  });

  it("separates sales priority from research priority", () => {
    const sparse = run([claim()]);
    const hiring = claim({
      claimType: "HIRING",
      claimKey: "present",
      value: { present: true, strength: 80 },
      status: "CORROBORATED",
      confidence: 0.85,
      supportingFamilyCount: 2,
      lastObservedAt: "2026-10-02T00:00:00.000Z",
    });
    const richer = run([claim(), hiring]);

    expect(sparse.valueOfInformationScore).toBeGreaterThan(0);
    expect(sparse.researchPriorityScore).toBeGreaterThan(0);
    expect(richer.evidenceConfidence).toBeGreaterThanOrEqual(
      sparse.evidenceConfidence,
    );
  });
});
