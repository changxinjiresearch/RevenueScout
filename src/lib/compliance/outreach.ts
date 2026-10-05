export type FrequencyPolicy = {
  contactWindowDays: number;
  maxContactOutbound: number;
  companyWindowDays: number;
  maxCompanyOutbound: number;
  duplicateWarningHours: number;
};

export type OutreachGuardInput = {
  contactabilityStatus: string;
  companyStage: string;
  activeCompanySuppression: boolean;
  activeContactSuppression: boolean;
  contactOutboundCount: number;
  companyOutboundCount: number;
  lastOutboundByOtherUserAt: Date | null;
  now?: Date;
  policy: FrequencyPolicy;
};

export type OutreachGuardResult = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
};

export function evaluateOutreachGuard(
  input: OutreachGuardInput,
): OutreachGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (
    ![
      "CONTACT_PERMITTED",
      "EXISTING_RELATIONSHIP",
      "USER_CONFIRMED_CONSENT",
    ].includes(input.contactabilityStatus)
  ) {
    blockers.push(
      "Contact does not have an explicit outbound-permission state.",
    );
  }

  if (
    input.companyStage === "DO_NOT_CONTACT" ||
    input.companyStage === "SUPPRESSED"
  ) {
    blockers.push("Company lifecycle blocks outbound contact.");
  }

  if (input.activeCompanySuppression) {
    blockers.push("Company is on the organisation suppression list.");
  }

  if (input.activeContactSuppression) {
    blockers.push("Contact is on the organisation suppression list.");
  }

  if (input.contactOutboundCount >= input.policy.maxContactOutbound) {
    blockers.push(
      "Contact frequency limit reached: " +
        input.contactOutboundCount +
        "/" +
        input.policy.maxContactOutbound +
        " outbound touches in " +
        input.policy.contactWindowDays +
        " days.",
    );
  }

  if (input.companyOutboundCount >= input.policy.maxCompanyOutbound) {
    blockers.push(
      "Company frequency limit reached: " +
        input.companyOutboundCount +
        "/" +
        input.policy.maxCompanyOutbound +
        " outbound touches in " +
        input.policy.companyWindowDays +
        " days.",
    );
  }

  if (input.lastOutboundByOtherUserAt) {
    const now = (input.now ?? new Date()).getTime();
    const last = new Date(input.lastOutboundByOtherUserAt).getTime();
    const ageHours = Math.max(0, (now - last) / 3_600_000);
    if (ageHours <= input.policy.duplicateWarningHours) {
      warnings.push(
        "Another workspace member contacted this person " +
          Math.max(0, Math.floor(ageHours)) +
          " hours ago.",
      );
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function feedbackReasonLabel(reason: string | null): string {
  if (!reason) return "";
  return reason
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
