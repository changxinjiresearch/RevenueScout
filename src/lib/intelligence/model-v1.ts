import type {
  IcpRule,
  OfferingConfig,
} from "../domain/configured-opportunity";
import type {
  WebResearchObservation,
  WebResearchResult,
} from "../enrichment/result-types";
import type {
  CollectorResult,
  ExtractedCompanyFeatures,
} from "./types";

type CompanyInput = {
  displayName: string;
  country: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  companyType: string | null;
  serviceRegions: string[];
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
};

type Criterion = {
  configured: boolean;
  known: boolean;
  matched: boolean;
  weight: number;
  label: string;
};

type IcpScore = {
  name: string;
  score: number;
  completeness: number;
  reasons: string[];
  risks: string[];
};

const SIGNAL_WEIGHT: Record<string, number> = {
  PROCUREMENT: 1,
  EXPANSION: 0.95,
  FUNDING: 0.92,
  HIRING: 0.82,
  GROWTH: 0.78,
  TECHNOLOGY: 0.75,
  LEADERSHIP: 0.68,
  OPERATIONAL_PAIN: 0.7,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function includes(values: string[], value: string): boolean {
  const target = normalise(value);
  return values.some((candidate) => normalise(candidate) === target);
}

function overlaps(a: string[], b: string[]): boolean {
  const set = new Set(a.map(normalise));
  return b.some((value) => set.has(normalise(value)));
}

function scoreIcp(
  icp: IcpRule,
  company: CompanyInput,
  features: ExtractedCompanyFeatures,
  currentSignals: WebResearchObservation[],
): IcpScore {
  const employeeMid =
    features.employeeLow >= 0 && features.employeeHigh >= features.employeeLow
      ? Math.round((features.employeeLow + features.employeeHigh) / 2)
      : company.employeeCount;

  const effectiveIndustry = features.industry || company.industry || "";
  const effectiveSubindustry =
    features.subindustry || company.subindustry || "";
  const effectiveRegions =
    features.serviceRegions.length > 0
      ? features.serviceRegions
      : company.serviceRegions;

  const signalTypes = new Set(currentSignals.map((signal) => signal.signalType));

  const criteria: Criterion[] = [
    {
      configured: icp.countries.length > 0,
      known: Boolean(company.country),
      matched: Boolean(company.country && includes(icp.countries, company.country)),
      weight: 15,
      label: "country",
    },
    {
      configured: icp.states.length > 0,
      known: Boolean(company.state),
      matched: Boolean(company.state && includes(icp.states, company.state)),
      weight: 8,
      label: "state",
    },
    {
      configured: icp.industries.length > 0,
      known: Boolean(effectiveIndustry),
      matched: Boolean(
        effectiveIndustry && includes(icp.industries, effectiveIndustry),
      ),
      weight: 22,
      label: "industry",
    },
    {
      configured: icp.subindustries.length > 0,
      known: Boolean(effectiveSubindustry),
      matched: Boolean(
        effectiveSubindustry &&
          includes(icp.subindustries, effectiveSubindustry),
      ),
      weight: 8,
      label: "subindustry",
    },
    {
      configured: icp.employeeMin !== null || icp.employeeMax !== null,
      known: employeeMid !== null && employeeMid !== undefined && employeeMid > 0,
      matched:
        employeeMid !== null &&
        employeeMid !== undefined &&
        employeeMid > 0 &&
        (icp.employeeMin === null || employeeMid >= icp.employeeMin) &&
        (icp.employeeMax === null || employeeMid <= icp.employeeMax),
      weight: 18,
      label: "employee size",
    },
    {
      configured: icp.companyTypes.length > 0,
      known: Boolean(company.companyType),
      matched: Boolean(
        company.companyType && includes(icp.companyTypes, company.companyType),
      ),
      weight: 7,
      label: "company type",
    },
    {
      configured: icp.serviceRegions.length > 0,
      known: effectiveRegions.length > 0,
      matched:
        effectiveRegions.length > 0 &&
        overlaps(icp.serviceRegions, effectiveRegions),
      weight: 7,
      label: "service region",
    },
    {
      configured: icp.hiring,
      known: true,
      matched: signalTypes.has("HIRING"),
      weight: 4,
      label: "hiring",
    },
    {
      configured: icp.fastGrowth,
      known: true,
      matched: signalTypes.has("GROWTH") || signalTypes.has("EXPANSION"),
      weight: 4,
      label: "growth",
    },
    {
      configured: icp.recentFunding,
      known: true,
      matched: signalTypes.has("FUNDING"),
      weight: 3,
      label: "funding",
    },
    {
      configured: icp.digitalNeed,
      known: true,
      matched:
        signalTypes.has("TECHNOLOGY") ||
        signalTypes.has("OPERATIONAL_PAIN"),
      weight: 4,
      label: "digital need",
    },
  ];

  const active = criteria.filter((criterion) => criterion.configured);
  if (active.length === 0) {
    return {
      name: icp.name,
      score: 50,
      completeness: 0.3,
      reasons: [],
      risks: ["The ICP has few executable qualification rules."],
    };
  }

  const totalWeight = active.reduce((sum, criterion) => sum + criterion.weight, 0);
  const known = active.filter((criterion) => criterion.known);
  const knownWeight = known.reduce((sum, criterion) => sum + criterion.weight, 0);
  const matchedWeight = known
    .filter((criterion) => criterion.matched)
    .reduce((sum, criterion) => sum + criterion.weight, 0);

  const rawFit = knownWeight > 0 ? (matchedWeight / knownWeight) * 100 : 45;
  const completeness = totalWeight > 0 ? knownWeight / totalWeight : 0;
  const score = clamp(
    rawFit * (0.65 + completeness * 0.35),
  );

  const reasons = known
    .filter((criterion) => criterion.matched)
    .slice(0, 4)
    .map((criterion) => `Matches ICP ${criterion.label}`);

  const risks = [
    ...known
      .filter((criterion) => !criterion.matched)
      .slice(0, 3)
      .map((criterion) => `Does not match ICP ${criterion.label}`),
    ...active
      .filter((criterion) => !criterion.known)
      .slice(0, 3)
      .map((criterion) => `${criterion.label} is not yet verified`),
  ];

  return {
    name: icp.name,
    score: Math.round(score),
    completeness,
    reasons,
    risks,
  };
}

function buyingIntentScore(signals: WebResearchObservation[]): number {
  if (signals.length === 0) return 12;

  const values = signals.map((signal) => {
    const typeWeight = SIGNAL_WEIGHT[signal.signalType] ?? 0.5;
    const verification =
      signal.verificationStatus === "CONFIRMED"
        ? 1
        : signal.verificationStatus === "LIKELY"
          ? 0.85
          : signal.verificationStatus === "UNVERIFIED"
            ? 0.6
            : 0.25;

    return (
      signal.signalStrength *
      signal.confidence *
      typeWeight *
      verification
    );
  });

  values.sort((a, b) => b - a);

  return Math.round(
    clamp(
      (values[0] ?? 0) +
        Math.min(14, Math.max(0, values.length - 1) * 4),
    ),
  );
}

function timingScore(
  signals: WebResearchObservation[],
  now = new Date(),
): number {
  if (signals.length === 0) return 15;

  const days = signals
    .filter((signal) => signal.verificationStatus !== "OUTDATED")
    .map((signal) => {
      const date = new Date(signal.observedAt);
      if (Number.isNaN(date.getTime())) return 365;
      return Math.max(
        0,
        Math.floor((now.getTime() - date.getTime()) / 86_400_000),
      );
    });

  if (days.length === 0) return 15;
  const freshest = Math.min(...days);

  if (freshest <= 14) return 92;
  if (freshest <= 30) return 82;
  if (freshest <= 60) return 68;
  if (freshest <= 90) return 52;
  if (freshest <= 180) return 35;
  return 20;
}

function needScore(signals: WebResearchObservation[]): number {
  let score = 20;

  for (const signal of signals) {
    if (signal.signalType === "OPERATIONAL_PAIN") score += 24;
    if (signal.signalType === "TECHNOLOGY") score += 18;
    if (signal.signalType === "EXPANSION") score += 16;
    if (signal.signalType === "HIRING") score += 10;
    if (signal.signalType === "GROWTH") score += 10;
    if (signal.signalType === "PROCUREMENT") score += 24;
  }

  return Math.round(clamp(score));
}

function budgetFitScore(
  features: ExtractedCompanyFeatures,
  offerings: OfferingConfig[],
): number {
  if (features.employeeLow < 0 || features.employeeHigh < 0) return 42;

  const employees = Math.round(
    (features.employeeLow + features.employeeHigh) / 2,
  );
  const typicalDeal = Math.max(
    0,
    ...offerings.map(
      (offering) =>
        offering.avgContractValue ??
        offering.minContractValue ??
        offering.idealContractValue ??
        0,
    ),
  );

  let sizeScore =
    employees >= 250
      ? 78
      : employees >= 100
        ? 70
        : employees >= 50
          ? 62
          : employees >= 20
            ? 55
            : 38;

  if (typicalDeal >= 100_000 && employees < 50) sizeScore -= 12;
  if (typicalDeal >= 50_000 && employees < 20) sizeScore -= 10;

  return Math.round(clamp(sizeScore));
}

function evidenceConfidenceScore(
  collector: CollectorResult,
  features: ExtractedCompanyFeatures,
  signals: WebResearchObservation[],
  fitCompleteness: number,
): number {
  const pageCoverage = Math.min(1, collector.pages.length / 5);
  const featureConfidence =
    (features.industryConfidence +
      Math.max(0, features.employeeConfidence)) /
    2;
  const signalConfidence =
    signals.length > 0
      ? signals.reduce((sum, signal) => sum + signal.confidence, 0) /
        signals.length
      : 0.35;

  return Math.round(
    clamp(
      (collector.websiteConfidence * 0.25 +
        pageCoverage * 0.2 +
        featureConfidence * 0.2 +
        signalConfidence * 0.2 +
        fitCompleteness * 0.15) *
        100,
    ),
  );
}

function logisticConversion(input: {
  fit: number;
  intent: number;
  timing: number;
  need: number;
  budget: number;
  confidence: number;
}): number {
  const n = (value: number) => clamp(value) / 100;

  const z =
    -5.2 +
    1.3 * n(input.fit) +
    0.9 * n(input.intent) +
    0.7 * n(input.timing) +
    0.7 * n(input.need) +
    0.5 * n(input.budget) +
    0.4 * n(input.confidence);

  const probability = 1 / (1 + Math.exp(-z));
  return Math.round(clamp(probability * 100, 1, 35));
}

function recommendedContact(
  signals: WebResearchObservation[],
  extractedRoles: string[],
): string {
  if (extractedRoles.length > 0) return extractedRoles[0];

  const types = new Set(signals.map((signal) => signal.signalType));
  if (types.has("TECHNOLOGY")) return "CTO / CIO";
  if (types.has("PROCUREMENT")) return "Procurement Lead / COO";
  if (types.has("LEADERSHIP")) return "COO / General Manager";
  return "COO / Head of Operations";
}

function signalReason(signal: WebResearchObservation): string {
  return `${signal.title}: ${signal.observation.slice(0, 180)}`;
}

export function runConversionModelV1(input: {
  company: CompanyInput;
  collector: CollectorResult;
  features: ExtractedCompanyFeatures;
  signals: WebResearchObservation[];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  now?: Date;
}): WebResearchResult {
  const now = input.now ?? new Date();
  const currentSignals = input.signals.filter(
    (signal) =>
      signal.verificationStatus === "CONFIRMED" ||
      signal.verificationStatus === "LIKELY",
  );

  const scoredIcps =
    input.icps.length > 0
      ? input.icps.map((icp) =>
          scoreIcp(icp, input.company, input.features, currentSignals),
        )
      : [
          {
            name: "No ICP configured",
            score: 45,
            completeness: 0.25,
            reasons: [],
            risks: ["No ICP is configured for this workspace."],
          },
        ];

  scoredIcps.sort((a, b) => b.score - a.score);
  const bestIcp = scoredIcps[0];

  const commercialFit = bestIcp.score;
  const buyingIntent = buyingIntentScore(currentSignals);
  const timing = timingScore(currentSignals, now);
  const need = needScore(currentSignals);
  const budget = budgetFitScore(input.features, input.offerings);
  const evidenceConfidence = evidenceConfidenceScore(
    input.collector,
    input.features,
    currentSignals,
    bestIcp.completeness,
  );

  const overallPotentialScore = Math.round(
    clamp(
      commercialFit * 0.35 +
        buyingIntent * 0.2 +
        timing * 0.15 +
        need * 0.15 +
        budget * 0.1 +
        evidenceConfidence * 0.05,
    ),
  );

  const estimatedConversionPercent = logisticConversion({
    fit: commercialFit,
    intent: buyingIntent,
    timing,
    need,
    budget,
    confidence: evidenceConfidence,
  });

  const topSignals = [...currentSignals]
    .sort(
      (a, b) =>
        b.signalStrength * b.confidence -
        a.signalStrength * a.confidence,
    )
    .slice(0, 3);

  const whyFit = [
    `Best ICP: ${bestIcp.name} (${commercialFit}/100 fit)`,
    ...bestIcp.reasons,
  ].slice(0, 4);

  const whyNow =
    topSignals.length > 0
      ? topSignals.map(signalReason)
      : ["No strong current buying signal was found on collected public pages."];

  const risks = [
    ...bestIcp.risks,
    ...(input.collector.pages.length === 0
      ? ["No verified official website content was collected."]
      : []),
    ...(input.features.employeeLow < 0
      ? ["Employee scale could not be verified from public pages."]
      : []),
    ...(evidenceConfidence < 50
      ? ["Evidence confidence is low; human review is recommended."]
      : []),
  ].slice(0, 5);

  const assessmentSummary =
    overallPotentialScore >= 75 && evidenceConfidence >= 55
      ? "Strong commercial candidate based on current ICP fit and public buying signals."
      : overallPotentialScore >= 55
        ? "Potential customer worth a quick human review before outreach."
        : evidenceConfidence < 45
          ? "Potential cannot be judged confidently because public evidence is incomplete."
          : "Current evidence suggests low near-term acquisition potential.";

  const nextAction =
    evidenceConfidence < 45
      ? "Verify the official website or add one reliable source, then reassess."
      : overallPotentialScore >= 70
        ? "Identify the recommended decision-maker and prepare targeted outreach."
        : overallPotentialScore >= 50
          ? "Review the strongest evidence and keep the company for sales review."
          : "Do not prioritise unless new buying signals appear.";

  return {
    officialWebsite: input.collector.officialWebsite,
    businessSummary: input.features.businessSummary,
    industry: input.features.industry,
    subindustry: input.features.subindustry,
    employeeLow: input.features.employeeLow,
    employeeHigh: input.features.employeeHigh,
    employeeConfidence: input.features.employeeConfidence,
    serviceRegions: input.features.serviceRegions,
    businessModels: input.features.businessModels,
    technologies: input.features.technologies,
    decisionRoles: input.features.decisionRoles,
    commercialFitScore: commercialFit,
    buyingIntentScore: buyingIntent,
    budgetFitScore: budget,
    timingScore: timing,
    needScore: need,
    evidenceConfidence,
    overallPotentialScore,
    estimatedConversionPercent,
    assessmentSummary,
    whyFit,
    whyNow,
    risks,
    recommendedContactRole: recommendedContact(
      currentSignals,
      input.features.decisionRoles,
    ),
    nextAction,
    observations: input.signals,
  };
}
