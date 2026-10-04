import { describe, expect, it } from "vitest";
import {
  configureOpportunity,
  evaluateIcp,
  type CandidateCompanyFacts,
  type IcpRule,
} from "../src/lib/domain/configured-opportunity";
import type { OpportunityInput } from "../src/lib/domain/types";

const company: CandidateCompanyFacts = {
  country: "Australia",
  state: "NSW",
  city: "Sydney",
  industry: "Logistics",
  subindustry: "Freight",
  employeeCount: 90,
  companyAgeYears: 8,
  companyType: "Private",
  serviceRegions: ["NSW", "VIC"],
  fastGrowth: true,
  multiLocation: true,
  hiring: true,
  recentFunding: false,
  roles: ["Head of Operations"],
  businessModels: ["B2B"],
  technologies: ["Xero"],
  digitalNeed: true,
  entityType: "PRIVATE",
  existingCustomer: false,
  rejected: false,
  unsubscribed: false,
};

const icp: IcpRule = {
  id: "icp-1",
  name: "Australian Logistics SME",
  countries: ["Australia"],
  states: [],
  cities: [],
  industries: ["Logistics"],
  subindustries: [],
  employeeMin: 20,
  employeeMax: 200,
  companyAgeMin: null,
  companyAgeMax: null,
  companyTypes: [],
  serviceRegions: [],
  fastGrowth: true,
  multiLocation: true,
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
  employeeExcludeBelow: 5,
  employeeExcludeAbove: 5000,
};

const base: OpportunityInput = {
  id: "opp-1",
  companyName: "ABC Logistics",
  location: "Sydney, NSW",
  industry: "Logistics",
  employeeRange: "50–200",
  icpFit: 1,
  timing: 90,
  dealPotential: 1,
  contactability: 80,
  evidenceConfidence: 80,
  expectedDealValue: 1,
  conversionProbability: 0.2,
  salesEffort: "MEDIUM",
  recommendedOffering: "placeholder",
  recommendedContact: "Head of Operations",
  nextBestAction: "Contact this week",
  whyThisCompany: "placeholder",
  whyNow: "Expansion",
  problemHypothesis: "Potential coordination complexity",
  signals: [],
};

describe("ICP and Offering configuration", () => {
  it("scores a company from configured ICP criteria", () => {
    const result = evaluateIcp(company, icp);
    expect(result.excluded).toBe(false);
    expect(result.score).toBe(100);
  });

  it("enforces hard exclusions before ranking", () => {
    const result = evaluateIcp({ ...company, existingCustomer: true }, icp);
    expect(result.excluded).toBe(true);
    expect(result.score).toBe(0);
  });

  it("uses linked Offering economics instead of demo deal value", () => {
    const configured = configureOpportunity(
      base,
      company,
      [icp],
      [{
        id: "offering-1",
        name: "Workflow Automation",
        minContractValue: 15000,
        avgContractValue: 30000,
        idealContractValue: 50000,
      }],
      [{ offeringId: "offering-1", icpId: "icp-1" }],
    );

    expect(configured?.opportunity.recommendedOffering).toBe("Workflow Automation");
    expect(configured?.opportunity.expectedDealValue).toBe(50000);
    expect(configured?.dealValueBasis).toBe("ideal");
  });
});
