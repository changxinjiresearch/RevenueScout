import { describe, expect, it } from "vitest";
import { assessOpportunity } from "../src/lib/domain/opportunity-score";
import type { OpportunityInput } from "../src/lib/domain/types";

const baseOpportunity: OpportunityInput = {
  id: "test",
  companyName: "Test Co",
  location: "Sydney",
  industry: "Logistics",
  employeeRange: "50–200",
  icpFit: 90,
  timing: 80,
  dealPotential: 70,
  contactability: 60,
  evidenceConfidence: 50,
  expectedDealValue: 40000,
  conversionProbability: 0.2,
  salesEffort: "MEDIUM",
  recommendedOffering: "Workflow Automation",
  recommendedContact: "COO",
  nextBestAction: "Contact now",
  whyThisCompany: "Strong fit",
  whyNow: "Expansion",
  problemHypothesis: "Potential coordination complexity",
  signals: [
    {
      id: "signal",
      type: "EXPANSION",
      label: "New site",
      strength: 90,
      confidence: 1,
      observedAt: "2026-10-01",
      sourceLabel: "Company website",
      verificationStatus: "CONFIRMED",
    },
  ],
};

describe("assessOpportunity", () => {
  it("calculates expected revenue from probability and deal value", () => {
    const result = assessOpportunity(baseOpportunity);
    expect(result.expectedRevenue).toBe(8000);
  });

  it("keeps the opportunity score inside the 0-100 range", () => {
    const result = assessOpportunity({
      ...baseOpportunity,
      icpFit: 200,
      timing: 200,
      dealPotential: 200,
      contactability: 200,
      evidenceConfidence: 200,
    });

    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);
  });

  it("uses evidence verification to reduce unverified buying intent", () => {
    const confirmed = assessOpportunity(baseOpportunity);
    const unverified = assessOpportunity({
      ...baseOpportunity,
      signals: [
        {
          ...baseOpportunity.signals[0],
          verificationStatus: "UNVERIFIED",
        },
      ],
    });

    expect(confirmed.scoreBreakdown.buyingIntent).toBeGreaterThan(
      unverified.scoreBreakdown.buyingIntent,
    );
  });
});
