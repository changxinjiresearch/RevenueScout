import { describe, expect, it } from "vitest";
import {
  canRecordOutboundContact,
  predictionRealityDelta,
  recommendContact,
  relationshipStatusForStage,
  salesCycleDays,
  shouldAdvanceLifecycle,
  type ContactForRecommendation,
} from "../src/lib/sales/lifecycle";

const baseContact: ContactForRecommendation = {
  id: "c1",
  name: "Alex Morgan",
  position: "Head of Operations",
  decisionRelevance: "DECISION_MAKER",
  contactabilityStatus: "PUBLIC_BUSINESS_CONTACT",
  contactStatus: "ACTIVE",
  verificationStatus: "CONFIRMED",
  confidence: 0.9,
};

describe("M4 sales lifecycle", () => {
  it("recommends the contact whose title and decision relevance best fit the M3 role", () => {
    const result = recommendContact(
      [
        baseContact,
        {
          ...baseContact,
          id: "c2",
          name: "Jamie Lee",
          position: "Marketing Coordinator",
          decisionRelevance: "INFLUENCER",
        },
      ],
      "COO / Head of Operations",
    );

    expect(result.contactId).toBe("c1");
    expect(result.score).toBeGreaterThan(0);
    expect(result.reason.toLowerCase()).toContain("recommended role");
  });

  it("does not recommend do-not-contact or unsubscribed contacts", () => {
    const result = recommendContact(
      [
        {
          ...baseContact,
          contactabilityStatus: "DO_NOT_CONTACT",
        },
      ],
      "Head of Operations",
    );

    expect(result.contactId).toBeNull();
  });

  it("blocks outbound contact for uncertain, do-not-contact and unsubscribed contacts", () => {
    expect(canRecordOutboundContact("UNCERTAIN")).toBe(false);
    expect(canRecordOutboundContact("DO_NOT_CONTACT")).toBe(false);
    expect(canRecordOutboundContact("UNSUBSCRIBED")).toBe(false);
    expect(canRecordOutboundContact("PUBLIC_BUSINESS_CONTACT")).toBe(true);
  });

  it("advances activity-driven lifecycle forward but never backwards or beyond closed stages", () => {
    expect(shouldAdvanceLifecycle("QUALIFIED", "CONTACTED")).toBe(true);
    expect(shouldAdvanceLifecycle("MEETING", "CONTACTED")).toBe(false);
    expect(shouldAdvanceLifecycle("WON", "PROPOSAL")).toBe(false);
  });

  it("maps lifecycle stages into the existing company relationship state", () => {
    expect(relationshipStatusForStage("PROPOSAL")).toBe("PIPELINE");
    expect(relationshipStatusForStage("CONTACTED")).toBe("CONTACTED");
    expect(relationshipStatusForStage("WON")).toBe("EXISTING_CUSTOMER");
    expect(relationshipStatusForStage("LOST")).toBe("REJECTED");
    expect(relationshipStatusForStage("DO_NOT_CONTACT")).toBe("UNSUBSCRIBED");
  });

  it("calculates sales cycle and prediction-vs-reality deltas", () => {
    const first = new Date("2026-09-01T00:00:00Z");
    const closed = new Date("2026-10-01T00:00:00Z");
    expect(salesCycleDays(first, closed)).toBe(30);

    const won = predictionRealityDelta({
      predictedDealValue: 25000,
      actualContractValue: 42000,
      predictedProbability: 0.3,
      outcome: "WON",
    });

    expect(won.dealDelta).toBe(17000);
    expect(won.probabilityError).toBeCloseTo(0.7);

    const lost = predictionRealityDelta({
      predictedDealValue: 25000,
      actualContractValue: null,
      predictedProbability: 0.3,
      outcome: "LOST",
    });

    expect(lost.dealDelta).toBeNull();
    expect(lost.probabilityError).toBeCloseTo(-0.3);
  });
});
