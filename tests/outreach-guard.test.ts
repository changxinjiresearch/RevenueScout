import { describe, expect, it } from "vitest";
import { evaluateOutreachGuard } from "../src/lib/compliance/outreach";

const policy = {
  contactWindowDays: 7,
  maxContactOutbound: 2,
  companyWindowDays: 14,
  maxCompanyOutbound: 4,
  duplicateWarningHours: 48,
};

describe("M5 outreach guard", () => {
  it("allows outreach only when permission and frequency state are safe", () => {
    const result = evaluateOutreachGuard({
      contactabilityStatus: "CONTACT_PERMITTED",
      companyStage: "QUALIFIED",
      activeCompanySuppression: false,
      activeContactSuppression: false,
      contactOutboundCount: 1,
      companyOutboundCount: 2,
      lastOutboundByOtherUserAt: null,
      policy,
      now: new Date("2026-10-05T00:00:00Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks suppressed and unpermitted contacts", () => {
    const result = evaluateOutreachGuard({
      contactabilityStatus: "PUBLIC_BUSINESS_CONTACT",
      companyStage: "QUALIFIED",
      activeCompanySuppression: true,
      activeContactSuppression: true,
      contactOutboundCount: 0,
      companyOutboundCount: 0,
      lastOutboundByOtherUserAt: null,
      policy,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
    expect(
      result.blockers.some((item) => item.toLowerCase().includes("permission")),
    ).toBe(true);
    expect(
      result.blockers.some((item) => item.toLowerCase().includes("suppression")),
    ).toBe(true);
  });

  it("blocks when contact or company frequency policy is reached", () => {
    const result = evaluateOutreachGuard({
      contactabilityStatus: "EXISTING_RELATIONSHIP",
      companyStage: "CONTACTED",
      activeCompanySuppression: false,
      activeContactSuppression: false,
      contactOutboundCount: 2,
      companyOutboundCount: 4,
      lastOutboundByOtherUserAt: null,
      policy,
    });

    expect(result.allowed).toBe(false);
    expect(
      result.blockers.some((item) => item.includes("Contact frequency limit")),
    ).toBe(true);
    expect(
      result.blockers.some((item) => item.includes("Company frequency limit")),
    ).toBe(true);
  });

  it("warns about recent outreach by another workspace member without inventing a hard block", () => {
    const result = evaluateOutreachGuard({
      contactabilityStatus: "USER_CONFIRMED_CONSENT",
      companyStage: "READY_TO_CONTACT",
      activeCompanySuppression: false,
      activeContactSuppression: false,
      contactOutboundCount: 0,
      companyOutboundCount: 0,
      lastOutboundByOtherUserAt: new Date("2026-10-04T12:00:00Z"),
      policy,
      now: new Date("2026-10-05T00:00:00Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("workspace member");
  });
});
