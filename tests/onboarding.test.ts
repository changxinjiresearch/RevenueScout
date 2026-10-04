import { describe, expect, it } from "vitest";
import { calculateOnboardingState } from "../src/lib/onboarding";

describe("onboarding state", () => {
  it("moves through all four setup gates", () => {
    expect(calculateOnboardingState({
      companyComplete: false,
      offeringComplete: false,
      icpComplete: false,
      mappingComplete: false,
    }).currentStep).toBe("company");

    expect(calculateOnboardingState({
      companyComplete: true,
      offeringComplete: true,
      icpComplete: true,
      mappingComplete: false,
    }).currentStep).toBe("mapping");

    const complete = calculateOnboardingState({
      companyComplete: true,
      offeringComplete: true,
      icpComplete: true,
      mappingComplete: true,
    });

    expect(complete.complete).toBe(true);
    expect(complete.completedSteps).toBe(4);
  });
});
