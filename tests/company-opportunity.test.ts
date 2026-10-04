import { describe, expect, it } from "vitest";
import {
  companyFactsFromRecord,
  evidenceConfidenceScore,
  timingScoreFromSignals,
  type CompanyRecord,
  type EvidenceRecord,
  type SignalRecord,
} from "../src/lib/companies/opportunity";

const company: CompanyRecord = {
  id: "company-1",
  displayName: "Example Logistics",
  website: "https://example.com",
  domain: "example.com",
  description: null,
  country: "Australia",
  state: "NSW",
  city: "Sydney",
  industry: "Logistics",
  subindustry: "Freight",
  employeeCount: 100,
  employeeRange: "50–200",
  foundedYear: 2018,
  companyType: "Private",
  serviceRegions: ["NSW"],
  rolesObserved: ["Head of Operations"],
  businessModels: ["B2B"],
  technologies: [],
  fastGrowth: false,
  multiLocation: false,
  currentlyHiring: false,
  recentFunding: false,
  digitalNeed: false,
  entityType: "PRIVATE",
  relationshipStatus: "NONE",
};

const signal: SignalRecord = {
  id: "signal-1",
  companyId: "company-1",
  evidenceId: "evidence-1",
  signalType: "HIRING",
  label: "Operations hiring",
  summary: "New operations vacancies were observed.",
  rationale: "Hiring can indicate growing operational load.",
  strength: 80,
  confidence: 0.9,
  observedAt: new Date("2026-10-01T00:00:00Z"),
  verificationStatus: "CONFIRMED",
  sourceLabel: "Careers page",
};

const evidence: EvidenceRecord = {
  id: "evidence-1",
  companyId: "company-1",
  sourceLabel: "Careers page",
  observedAt: new Date("2026-10-01T00:00:00Z"),
  confidence: 0.9,
  verificationStatus: "CONFIRMED",
  staleAfterDays: 30,
};

describe("persisted company opportunity inputs", () => {
  it("derives business conditions from recent evidence-backed signals", () => {
    const facts = companyFactsFromRecord(
      company,
      [signal],
      new Date("2026-10-04T00:00:00Z"),
    );

    expect(facts.hiring).toBe(true);
    expect(facts.industry).toBe("Logistics");
  });

  it("gives recent signals stronger timing than no signals", () => {
    const now = new Date("2026-10-04T00:00:00Z");
    expect(timingScoreFromSignals([signal], now)).toBeGreaterThan(
      timingScoreFromSignals([], now),
    );
  });

  it("uses evidence freshness in confidence", () => {
    const score = evidenceConfidenceScore(
      [evidence],
      new Date("2026-10-04T00:00:00Z"),
    );
    expect(score).toBeGreaterThan(80);
  });
});
