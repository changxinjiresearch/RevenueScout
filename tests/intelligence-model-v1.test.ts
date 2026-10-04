import { describe, expect, it } from "vitest";
import { runConversionModelV1 } from "../src/lib/intelligence/model-v1";
import type { IcpRule, OfferingConfig } from "../src/lib/domain/configured-opportunity";
import type { CollectorResult, ExtractedCompanyFeatures } from "../src/lib/intelligence/types";
import type { WebResearchObservation } from "../src/lib/enrichment/result-types";

const icp: IcpRule = {
  id: "icp-1",
  name: "Australian Growth Logistics SME",
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

const offering: OfferingConfig = {
  id: "offering-1",
  name: "Operations Workflow Automation",
  minContractValue: 15000,
  avgContractValue: 40000,
  idealContractValue: 80000,
};

const collector: CollectorResult = {
  officialWebsite: "https://example.com",
  websiteConfidence: 0.98,
  pages: [
    {
      url: "https://example.com",
      title: "Example Logistics",
      description: "Australian logistics and warehousing provider.",
      text: "Australian logistics and warehousing provider.",
      fetchedAt: "2026-10-04T00:00:00.000Z",
      pageKind: "HOME",
    },
    {
      url: "https://example.com/careers",
      title: "Careers",
      description: "",
      text: "We are hiring warehouse operators.",
      fetchedAt: "2026-10-04T00:00:00.000Z",
      pageKind: "CAREERS",
    },
  ],
  attemptedUrls: ["https://example.com"],
  warnings: [],
};

const features: ExtractedCompanyFeatures = {
  businessSummary: "Australian logistics and warehousing provider.",
  industry: "Logistics",
  subindustry: "",
  industryConfidence: 0.9,
  employeeLow: 90,
  employeeHigh: 110,
  employeeConfidence: 0.85,
  serviceRegions: ["NSW"],
  businessModels: ["B2B"],
  technologies: [],
  decisionRoles: ["Operations Manager"],
};

const hiringSignal: WebResearchObservation = {
  sourceType: "JOB_BOARD",
  sourceTitle: "Careers",
  sourceUrl: "https://example.com/careers",
  title: "Active hiring",
  observation: "We are hiring warehouse operators.",
  observedAt: "2026-10-04T00:00:00.000Z",
  confidence: 0.9,
  verificationStatus: "LIKELY",
  signalType: "HIRING",
  signalStrength: 80,
  signalRationale: "Active hiring indicates operating change.",
};

function run(signals: WebResearchObservation[]) {
  return runConversionModelV1({
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
    collector,
    features,
    signals,
    icps: [icp],
    offerings: [offering],
    now: new Date("2026-10-04T12:00:00.000Z"),
  });
}

describe("RS Conversion Model v1", () => {
  it("is deterministic for identical inputs", () => {
    expect(run([hiringSignal])).toEqual(run([hiringSignal]));
  });

  it("raises buying intent and timing when a current verified signal exists", () => {
    const withSignal = run([hiringSignal]);
    const withoutSignal = run([]);

    expect(withSignal.buyingIntentScore).toBeGreaterThan(
      withoutSignal.buyingIntentScore,
    );
    expect(withSignal.timingScore).toBeGreaterThan(withoutSignal.timingScore);
  });

  it("does not let an unverified signal drive the live model", () => {
    const unverified = run([
      { ...hiringSignal, verificationStatus: "UNVERIFIED" },
    ]);
    const noSignal = run([]);

    expect(unverified.buyingIntentScore).toBe(noSignal.buyingIntentScore);
    expect(unverified.timingScore).toBe(noSignal.timingScore);
  });

  it("keeps the estimated conversion likelihood conservative", () => {
    const result = run([hiringSignal]);

    expect(result.estimatedConversionPercent).toBeGreaterThanOrEqual(1);
    expect(result.estimatedConversionPercent).toBeLessThanOrEqual(35);
  });
});
