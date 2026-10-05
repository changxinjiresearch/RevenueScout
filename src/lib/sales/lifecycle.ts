export type LifecycleStage =
  | "DISCOVERED"
  | "QUALIFIED"
  | "READY_TO_CONTACT"
  | "CONTACTED"
  | "REPLIED"
  | "MEETING"
  | "OPPORTUNITY"
  | "PROPOSAL"
  | "WON"
  | "LOST"
  | "NOT_FIT"
  | "DO_NOT_CONTACT"
  | "SUPPRESSED";

export type ContactabilityStatus =
  | "CONTACT_PERMITTED"
  | "EXISTING_RELATIONSHIP"
  | "USER_CONFIRMED_CONSENT"
  | "PUBLIC_BUSINESS_CONTACT"
  | "UNCERTAIN"
  | "DO_NOT_CONTACT"
  | "UNSUBSCRIBED";

export type DecisionRelevance =
  | "PRIMARY_DECISION_MAKER"
  | "DECISION_MAKER"
  | "INFLUENCER"
  | "CHAMPION"
  | "PROCUREMENT"
  | "TECHNICAL"
  | "GATEKEEPER"
  | "UNKNOWN";

export type ContactForRecommendation = {
  id: string;
  name: string;
  position: string;
  decisionRelevance: DecisionRelevance;
  contactabilityStatus: ContactabilityStatus;
  contactStatus: "ACTIVE" | "UNKNOWN" | "INVALID" | "LEFT_COMPANY";
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED" | "OUTDATED";
  confidence: number;
};

export type RecommendedContact = {
  contactId: string | null;
  roleTarget: string;
  score: number;
  reason: string;
};

export const lifecycleStages: LifecycleStage[] = [
  "DISCOVERED",
  "QUALIFIED",
  "READY_TO_CONTACT",
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "OPPORTUNITY",
  "PROPOSAL",
  "WON",
  "LOST",
  "NOT_FIT",
  "DO_NOT_CONTACT",
  "SUPPRESSED",
];

const ACTIVE_PIPELINE_STAGES = new Set<LifecycleStage>([
  "QUALIFIED",
  "READY_TO_CONTACT",
  "REPLIED",
  "MEETING",
  "OPPORTUNITY",
  "PROPOSAL",
]);

export function relationshipStatusForStage(
  stage: LifecycleStage,
): "NONE" | "EXISTING_CUSTOMER" | "PIPELINE" | "CONTACTED" | "REJECTED" | "UNSUBSCRIBED" {
  if (stage === "WON") return "EXISTING_CUSTOMER";
  if (stage === "CONTACTED") return "CONTACTED";
  if (ACTIVE_PIPELINE_STAGES.has(stage)) return "PIPELINE";
  if (stage === "LOST" || stage === "NOT_FIT") return "REJECTED";
  if (stage === "DO_NOT_CONTACT" || stage === "SUPPRESSED") return "UNSUBSCRIBED";
  return "NONE";
}

const STAGE_PROGRESS: Partial<Record<LifecycleStage, number>> = {
  DISCOVERED: 0,
  QUALIFIED: 1,
  READY_TO_CONTACT: 2,
  CONTACTED: 3,
  REPLIED: 4,
  MEETING: 5,
  OPPORTUNITY: 6,
  PROPOSAL: 7,
  WON: 8,
  LOST: 8,
};

export function shouldAdvanceLifecycle(
  current: LifecycleStage,
  suggested: LifecycleStage,
): boolean {
  const currentRank = STAGE_PROGRESS[current];
  const suggestedRank = STAGE_PROGRESS[suggested];
  if (currentRank === undefined || suggestedRank === undefined) return false;
  if (current === "WON" || current === "LOST") return false;
  return suggestedRank > currentRank;
}

export function isClosedStage(stage: LifecycleStage): boolean {
  return (
    stage === "WON" ||
    stage === "LOST" ||
    stage === "NOT_FIT" ||
    stage === "DO_NOT_CONTACT" ||
    stage === "SUPPRESSED"
  );
}

export function canRecordOutboundContact(
  status: ContactabilityStatus,
): boolean {
  return (
    status === "CONTACT_PERMITTED" ||
    status === "EXISTING_RELATIONSHIP" ||
    status === "USER_CONFIRMED_CONSENT"
  );
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roleTokens(role: string): string[] {
  const text = normalise(role);
  const groups: string[][] = [];

  if (/(coo|operations|workflow|process)/.test(text)) {
    groups.push(["coo", "chief operating", "operations", "operational"]);
  }
  if (/(cto|cio|technology|technical|software|it)/.test(text)) {
    groups.push(["cto", "cio", "technology", "technical", "it", "systems"]);
  }
  if (/(procurement|purchasing|buyer)/.test(text)) {
    groups.push(["procurement", "purchasing", "buyer", "sourcing"]);
  }
  if (/(ceo|founder|owner|managing director)/.test(text)) {
    groups.push(["ceo", "founder", "owner", "managing director"]);
  }
  if (/(sales|revenue|commercial)/.test(text)) {
    groups.push(["sales", "revenue", "commercial", "growth"]);
  }

  const tokens = groups.flat();
  return tokens.length > 0 ? [...new Set(tokens)] : text.split(" ");
}

function relevanceWeight(value: DecisionRelevance): number {
  if (value === "PRIMARY_DECISION_MAKER") return 28;
  if (value === "DECISION_MAKER") return 22;
  if (value === "CHAMPION") return 15;
  if (value === "PROCUREMENT") return 14;
  if (value === "TECHNICAL") return 12;
  if (value === "INFLUENCER") return 9;
  if (value === "GATEKEEPER") return 2;
  return 0;
}

function contactabilityWeight(value: ContactabilityStatus): number {
  if (value === "EXISTING_RELATIONSHIP") return 18;
  if (value === "USER_CONFIRMED_CONSENT") return 16;
  if (value === "CONTACT_PERMITTED") return 14;
  if (value === "PUBLIC_BUSINESS_CONTACT") return 9;
  if (value === "UNCERTAIN") return -12;
  return -100;
}

export function recommendContact(
  contacts: ContactForRecommendation[],
  recommendedRole: string,
): RecommendedContact {
  const tokens = roleTokens(recommendedRole);
  const eligible = contacts.filter(
    (contact) =>
      contact.contactStatus === "ACTIVE" &&
      contact.contactabilityStatus !== "DO_NOT_CONTACT" &&
      contact.contactabilityStatus !== "UNSUBSCRIBED",
  );

  if (eligible.length === 0) {
    return {
      contactId: null,
      roleTarget: recommendedRole,
      score: 0,
      reason: `No usable contact is stored yet. Find a verified ${recommendedRole} contact.`,
    };
  }

  const ranked = eligible
    .map((contact) => {
      const position = normalise(contact.position);
      const tokenHits = tokens.filter((token) =>
        position.includes(normalise(token)),
      ).length;
      const verificationBonus =
        contact.verificationStatus === "CONFIRMED"
          ? 10
          : contact.verificationStatus === "LIKELY"
            ? 6
            : contact.verificationStatus === "UNVERIFIED"
              ? 1
              : -8;
      const score =
        tokenHits * 18 +
        relevanceWeight(contact.decisionRelevance) +
        contactabilityWeight(contact.contactabilityStatus) +
        verificationBonus +
        Math.round(contact.confidence * 10);
      return { contact, score, tokenHits };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const reasons = [
    best.tokenHits > 0
      ? `Title aligns with the recommended role: ${recommendedRole}.`
      : `Best available contact for the recommended role: ${recommendedRole}.`,
    best.contact.decisionRelevance !== "UNKNOWN"
      ? `Decision relevance: ${best.contact.decisionRelevance.replaceAll("_", " ").toLowerCase()}.`
      : "Decision relevance has not been confirmed.",
    `Contactability: ${best.contact.contactabilityStatus.replaceAll("_", " ").toLowerCase()}.`,
  ];

  return {
    contactId: best.contact.id,
    roleTarget: recommendedRole,
    score: Math.max(0, Math.min(100, best.score)),
    reason: reasons.join(" "),
  };
}

export function recommendedStageForActivity(
  activityType:
    | "OUTREACH"
    | "FOLLOW_UP"
    | "REPLY"
    | "MEETING"
    | "PROPOSAL"
    | "NOTE"
    | "STAGE_CHANGE",
): LifecycleStage | null {
  if (activityType === "OUTREACH" || activityType === "FOLLOW_UP") {
    return "CONTACTED";
  }
  if (activityType === "REPLY") return "REPLIED";
  if (activityType === "MEETING") return "MEETING";
  if (activityType === "PROPOSAL") return "PROPOSAL";
  return null;
}

export function salesCycleDays(
  firstContactAt: Date | null,
  closedAt: Date,
): number | null {
  if (!firstContactAt) return null;
  const delta = closedAt.getTime() - firstContactAt.getTime();
  if (delta < 0) return null;
  return Math.floor(delta / 86_400_000);
}

export function predictionRealityDelta(input: {
  predictedDealValue: number | null;
  actualContractValue: number | null;
  predictedProbability: number | null;
  outcome: "WON" | "LOST";
}) {
  const dealDelta =
    input.predictedDealValue !== null && input.actualContractValue !== null
      ? input.actualContractValue - input.predictedDealValue
      : null;
  const actualBinary = input.outcome === "WON" ? 1 : 0;
  const probabilityError =
    input.predictedProbability === null
      ? null
      : actualBinary - input.predictedProbability;

  return {
    dealDelta,
    probabilityError,
  };
}
