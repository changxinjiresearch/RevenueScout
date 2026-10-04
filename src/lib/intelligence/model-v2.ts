import type {
  IcpRule,
  OfferingConfig,
} from "../domain/configured-opportunity";
import type { WebResearchResult } from "../enrichment/result-types";
import type {
  ClaimValidationSummary,
  ValidatedClaim,
} from "./claims";
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
  conservative: number;
  upside: number;
  reasons: string[];
  risks: string[];
};

type Dimension = {
  key: string;
  label: string;
  weight: number;
  value: number | null;
  conservativeUnknown: number;
  upsideUnknown: number;
};

const LIVE_STATUSES = new Set(["CONFIRMED", "CORROBORATED"]);

const SIGNAL_STRENGTH: Record<string, number> = {
  PROCUREMENT: 96,
  EXPANSION: 88,
  FUNDING: 86,
  HIRING: 78,
  GROWTH: 74,
  TECHNOLOGY: 72,
  LEADERSHIP: 65,
  OPERATIONAL_PAIN: 62,
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

function liveClaim(
  claims: ValidatedClaim[],
  claimType: string,
  claimKey?: string,
): ValidatedClaim | null {
  return (
    claims.find(
      (claim) =>
        claim.claimType === claimType &&
        LIVE_STATUSES.has(claim.status) &&
        (claimKey === undefined || claim.claimKey === claimKey),
    ) ?? null
  );
}

function liveClaims(
  claims: ValidatedClaim[],
  claimTypes: string[],
): ValidatedClaim[] {
  const allowed = new Set(claimTypes);
  return claims.filter(
    (claim) =>
      allowed.has(claim.claimType) && LIVE_STATUSES.has(claim.status),
  );
}

function scoreIcp(
  icp: IcpRule,
  company: CompanyInput,
  features: ExtractedCompanyFeatures,
  claims: ValidatedClaim[],
): IcpScore {
  const employeeClaim = liveClaim(claims, "EMPLOYEE_RANGE");
  const employeeValue =
    employeeClaim?.value && typeof employeeClaim.value === "object"
      ? (employeeClaim.value as Record<string, unknown>)
      : null;
  const claimEmployeeMid =
    employeeValue &&
    Number.isFinite(Number(employeeValue.low)) &&
    Number.isFinite(Number(employeeValue.high))
      ? Math.round(
          (Number(employeeValue.low) + Number(employeeValue.high)) / 2,
        )
      : null;

  const employeeMid =
    claimEmployeeMid ?? company.employeeCount;

  const industryClaim = liveClaim(claims, "INDUSTRY");
  const industryValue =
    industryClaim?.value && typeof industryClaim.value === "object"
      ? String(
          (industryClaim.value as Record<string, unknown>).industry ?? "",
        )
      : "";

  const subindustryClaim = liveClaim(claims, "SUBINDUSTRY");
  const subindustryValue =
    subindustryClaim?.value && typeof subindustryClaim.value === "object"
      ? String(
          (subindustryClaim.value as Record<string, unknown>).subindustry ?? "",
        )
      : "";

  const effectiveIndustry =
    company.industry || industryValue || "";
  const effectiveSubindustry =
    company.subindustry || subindustryValue || "";

  const regionClaims = liveClaims(claims, ["SERVICE_REGION"]).map(
    (claim) => {
      const value =
        claim.value && typeof claim.value === "object"
          ? (claim.value as Record<string, unknown>).region
          : null;
      return typeof value === "string" ? value : "";
    },
  ).filter(Boolean);

  const effectiveRegions =
    company.serviceRegions.length > 0
      ? company.serviceRegions
      : regionClaims;

  const hasHiring = Boolean(liveClaim(claims, "HIRING", "present"));
  const hasGrowth = Boolean(
    liveClaim(claims, "GROWTH", "present") ||
      liveClaim(claims, "EXPANSION", "present"),
  );
  const hasFunding = Boolean(liveClaim(claims, "FUNDING", "present"));
  const hasDigitalNeed = Boolean(
    liveClaim(claims, "TECHNOLOGY", "present") ||
      liveClaim(claims, "OPERATIONAL_PAIN", "present"),
  );

  const criteria: Criterion[] = [
    {
      configured: icp.countries.length > 0,
      known: Boolean(company.country),
      matched: Boolean(
        company.country && includes(icp.countries, company.country),
      ),
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
      known: employeeMid !== null && employeeMid > 0,
      matched:
        employeeMid !== null &&
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
      known: hasHiring,
      matched: hasHiring,
      weight: 4,
      label: "hiring",
    },
    {
      configured: icp.fastGrowth,
      known: hasGrowth,
      matched: hasGrowth,
      weight: 4,
      label: "growth",
    },
    {
      configured: icp.recentFunding,
      known: hasFunding,
      matched: hasFunding,
      weight: 3,
      label: "funding",
    },
    {
      configured: icp.digitalNeed,
      known: hasDigitalNeed,
      matched: hasDigitalNeed,
      weight: 4,
      label: "digital need",
    },
  ];

  const active = criteria.filter((criterion) => criterion.configured);

  if (active.length === 0) {
    return {
      name: icp.name,
      score: 50,
      completeness: 0.25,
      conservative: 30,
      upside: 85,
      reasons: [],
      risks: ["The ICP has few executable qualification rules."],
    };
  }

  const totalWeight = active.reduce(
    (sum, criterion) => sum + criterion.weight,
    0,
  );
  const known = active.filter((criterion) => criterion.known);
  const knownWeight = known.reduce(
    (sum, criterion) => sum + criterion.weight,
    0,
  );
  const matchedWeight = known
    .filter((criterion) => criterion.matched)
    .reduce((sum, criterion) => sum + criterion.weight, 0);

  const score =
    knownWeight > 0 ? clamp((matchedWeight / knownWeight) * 100) : 50;
  const completeness =
    totalWeight > 0 ? clamp((knownWeight / totalWeight) * 100) / 100 : 0;

  const conservative = clamp(
    score * completeness + 20 * (1 - completeness),
  );
  const upside = clamp(
    score * completeness + 95 * (1 - completeness),
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
      .slice(0, 4)
      .map(
        (criterion) =>
          `${criterion.label} is unknown, not a negative signal`,
      ),
  ];

  return {
    name: icp.name,
    score: Math.round(score),
    completeness,
    conservative: Math.round(conservative),
    upside: Math.round(upside),
    reasons,
    risks,
  };
}

function claimSignalScore(claims: ValidatedClaim[]): number | null {
  const signals = liveClaims(claims, [
    "HIRING",
    "EXPANSION",
    "FUNDING",
    "LEADERSHIP",
    "TECHNOLOGY",
    "PROCUREMENT",
    "GROWTH",
    "OPERATIONAL_PAIN",
  ]);

  if (signals.length === 0) return null;

  const values = signals.map((claim) => {
    const base = SIGNAL_STRENGTH[claim.claimType] ?? 55;
    return base * claim.confidence;
  });

  values.sort((a, b) => b - a);

  return Math.round(
    clamp((values[0] ?? 0) + Math.min(14, (values.length - 1) * 4)),
  );
}

function timingScore(
  claims: ValidatedClaim[],
  now: Date,
): number | null {
  const signals = liveClaims(claims, [
    "HIRING",
    "EXPANSION",
    "FUNDING",
    "LEADERSHIP",
    "TECHNOLOGY",
    "PROCUREMENT",
    "GROWTH",
    "OPERATIONAL_PAIN",
  ]);

  const dates = signals
    .map((claim) => claim.lastObservedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (dates.length === 0) return null;

  const freshest = Math.min(
    ...dates.map((date) =>
      Math.max(
        0,
        Math.floor((now.getTime() - date.getTime()) / 86_400_000),
      ),
    ),
  );

  if (freshest <= 14) return 94;
  if (freshest <= 30) return 84;
  if (freshest <= 60) return 70;
  if (freshest <= 90) return 56;
  if (freshest <= 180) return 38;
  return 22;
}

function needScore(claims: ValidatedClaim[]): number | null {
  const signals = liveClaims(claims, [
    "OPERATIONAL_PAIN",
    "TECHNOLOGY",
    "EXPANSION",
    "HIRING",
    "GROWTH",
    "PROCUREMENT",
  ]);

  if (signals.length === 0) return null;

  let score = 28;

  for (const claim of signals) {
    if (claim.claimType === "OPERATIONAL_PAIN") score += 24;
    if (claim.claimType === "TECHNOLOGY") score += 18;
    if (claim.claimType === "EXPANSION") score += 16;
    if (claim.claimType === "HIRING") score += 10;
    if (claim.claimType === "GROWTH") score += 10;
    if (claim.claimType === "PROCUREMENT") score += 24;
  }

  return Math.round(clamp(score));
}

function employeeMidpointFromClaims(
  claims: ValidatedClaim[],
  companyEmployeeCount: number | null,
): number | null {
  const claim = liveClaim(claims, "EMPLOYEE_RANGE");

  if (claim?.value && typeof claim.value === "object") {
    const value = claim.value as Record<string, unknown>;
    const low = Number(value.low);
    const high = Number(value.high);
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low) {
      return Math.round((low + high) / 2);
    }
  }

  return companyEmployeeCount && companyEmployeeCount > 0
    ? companyEmployeeCount
    : null;
}

function budgetFitScore(
  claims: ValidatedClaim[],
  companyEmployeeCount: number | null,
  offerings: OfferingConfig[],
): number | null {
  const employees = employeeMidpointFromClaims(
    claims,
    companyEmployeeCount,
  );
  if (employees === null) return null;

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

  let score =
    employees >= 250
      ? 78
      : employees >= 100
        ? 70
        : employees >= 50
          ? 62
          : employees >= 20
            ? 55
            : 38;

  if (typicalDeal >= 100_000 && employees < 50) score -= 12;
  if (typicalDeal >= 50_000 && employees < 20) score -= 10;

  return Math.round(clamp(score));
}

function evidenceConfidenceScore(
  validation: ClaimValidationSummary,
  fitCompleteness: number,
  collector: CollectorResult,
): number {
  const activeClaims = validation.claims.filter(
    (claim) =>
      claim.status === "CONFIRMED" ||
      claim.status === "CORROBORATED" ||
      claim.status === "SINGLE_SOURCE",
  );

  const claimConfidence =
    activeClaims.length > 0
      ? activeClaims.reduce((sum, claim) => sum + claim.confidence, 0) /
        activeClaims.length
      : 0.2;

  const corroboration =
    activeClaims.length > 0
      ? activeClaims.filter(
          (claim) =>
            claim.status === "CONFIRMED" ||
            claim.status === "CORROBORATED",
        ).length / activeClaims.length
      : 0;

  const conflictPenalty = Math.min(
    0.3,
    validation.conflictedCount * 0.08,
  );

  return Math.round(
    clamp(
      (claimConfidence * 0.42 +
        corroboration * 0.23 +
        fitCompleteness * 0.2 +
        collector.websiteConfidence * 0.15 -
        conflictPenalty) *
        100,
    ),
  );
}

function weightedKnownAverage(dimensions: Dimension[]): number {
  const known = dimensions.filter((dimension) => dimension.value !== null);
  const totalWeight = known.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );

  if (totalWeight === 0) return 50;

  return clamp(
    known.reduce(
      (sum, dimension) =>
        sum + (dimension.value ?? 0) * dimension.weight,
      0,
    ) / totalWeight,
  );
}

function boundedPotential(
  dimensions: Dimension[],
  fit: IcpScore,
): { current: number; conservative: number; upside: number } {
  const current = weightedKnownAverage(dimensions);

  const conservative = clamp(
    dimensions.reduce((sum, dimension) => {
      const value =
        dimension.key === "fit"
          ? fit.conservative
          : dimension.value ?? dimension.conservativeUnknown;
      return sum + value * dimension.weight;
    }, 0) /
      dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
  );

  const upside = clamp(
    dimensions.reduce((sum, dimension) => {
      const value =
        dimension.key === "fit"
          ? fit.upside
          : dimension.value ?? dimension.upsideUnknown;
      return sum + value * dimension.weight;
    }, 0) /
      dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
  );

  return {
    current: Math.round(current),
    conservative: Math.round(Math.min(current, conservative)),
    upside: Math.round(Math.max(current, upside)),
  };
}

function conversionEstimate(potential: number): number {
  const z = -5 + 4.1 * (clamp(potential) / 100);
  const probability = 1 / (1 + Math.exp(-z));
  return Math.round(clamp(probability * 100, 1, 35));
}

function valueOfInformation(input: {
  conservative: number;
  upside: number;
  confidence: number;
  unknownCount: number;
  singleSourceCount: number;
  conflictedCount: number;
}): number {
  const range = Math.max(0, input.upside - input.conservative);
  const uncertainty = 1 - clamp(input.confidence) / 100;
  const unknownBonus = Math.min(1, input.unknownCount / 4);
  const weakEvidenceBonus = Math.min(
    1,
    (input.singleSourceCount + input.conflictedCount * 1.5) / 4,
  );

  return Math.round(
    clamp(
      range * 0.75 +
        uncertainty * 35 +
        unknownBonus * 15 +
        weakEvidenceBonus * 10,
    ),
  );
}

function buildResearchTargets(input: {
  dimensions: Dimension[];
  validation: ClaimValidationSummary;
  fitCompleteness: number;
}): WebResearchResult["researchTargets"] {
  const candidates: WebResearchResult["researchTargets"] = [];

  const dimensionTargets: Record<string, { target: string; valueScore: number }> = {
    intent: { target: "Current buying signals", valueScore: 92 },
    timing: { target: "Recency of buying signals", valueScore: 78 },
    need: { target: "Operational need / change evidence", valueScore: 84 },
    budget: { target: "Employee size / budget proxy", valueScore: 66 },
  };

  for (const dimension of input.dimensions) {
    if (dimension.value !== null) continue;
    const target = dimensionTargets[dimension.key];
    if (!target) continue;

    candidates.push({
      target: target.target,
      reason: `${dimension.label} is currently unknown. A reliable source could materially narrow the potential range.`,
      valueScore: target.valueScore,
      status: "UNKNOWN",
    });
  }

  if (input.fitCompleteness < 0.8) {
    candidates.push({
      target: "Missing ICP qualification facts",
      reason:
        "Some configured ICP criteria are still unknown. Confirming them could materially change commercial fit without treating the missing values as negative.",
      valueScore: Math.round(70 + (1 - input.fitCompleteness) * 25),
      status: "UNKNOWN",
    });
  }

  for (const claim of input.validation.claims) {
    if (claim.status === "CONFLICTED") {
      candidates.push({
        target: claim.claimType.replaceAll("_", " "),
        reason:
          "Independent sources disagree. Resolve the conflict before using this claim as a company fact or buying signal.",
        valueScore: 96,
        status: "CONFLICTED",
      });
    }

    if (claim.status === "SINGLE_SOURCE") {
      candidates.push({
        target: claim.claimType.replaceAll("_", " "),
        reason:
          "Only one independent source family supports this claim. Find a second independent source to corroborate it.",
        valueScore: Math.round(68 + claim.confidence * 18),
        status: "SINGLE_SOURCE",
      });
    }
  }

  const best = new Map<string, WebResearchResult["researchTargets"][number]>();
  for (const candidate of candidates) {
    const current = best.get(candidate.target);
    if (!current || candidate.valueScore > current.valueScore) {
      best.set(candidate.target, candidate);
    }
  }

  return [...best.values()]
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 6);
}

function priorityAction(input: {
  potential: number;
  confidence: number;
  upside: number;
  salesPriority: number;
  researchPriority: number;
}): WebResearchResult["priorityAction"] {
  if (input.potential >= 75 && input.confidence >= 70) {
    return "CONTACT_NOW";
  }

  if (
    input.potential >= 70 &&
    input.confidence < 70 &&
    input.researchPriority >= 60
  ) {
    return "INVESTIGATE_URGENTLY";
  }

  if (
    input.potential < 40 &&
    input.confidence >= 70 &&
    input.upside < 55
  ) {
    return "REJECT";
  }

  if (input.potential >= 55 && input.confidence >= 60) {
    return "REVIEW";
  }

  if (input.confidence < 60 && input.researchPriority >= 50) {
    return "GATHER_MORE_DATA";
  }

  return "DEPRIORITISE_RESEARCH";
}

function claimReason(claim: ValidatedClaim): string {
  const evidence = claim.evidence.find((item) => item.stance === "SUPPORTS");
  const snippet = evidence?.excerpt?.slice(0, 150) ?? claim.explanation;
  return `${claim.claimType}: ${snippet}`;
}

function recommendedContact(
  claims: ValidatedClaim[],
  extractedRoles: string[],
): string {
  const roleClaim = liveClaim(claims, "DECISION_ROLE");
  if (roleClaim?.value && typeof roleClaim.value === "object") {
    const role = (roleClaim.value as Record<string, unknown>).role;
    if (typeof role === "string" && role) return role;
  }

  if (extractedRoles.length > 0) return extractedRoles[0];

  if (liveClaim(claims, "TECHNOLOGY")) return "CTO / CIO";
  if (liveClaim(claims, "PROCUREMENT")) return "Procurement Lead / COO";
  if (liveClaim(claims, "LEADERSHIP")) return "COO / General Manager";

  return "COO / Head of Operations";
}

export function runConversionModelV2(input: {
  company: CompanyInput;
  collector: CollectorResult;
  features: ExtractedCompanyFeatures;
  validation: ClaimValidationSummary;
  observations: WebResearchResult["observations"];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  now?: Date;
}): WebResearchResult {
  const now = input.now ?? new Date();

  const scoredIcps =
    input.icps.length > 0
      ? input.icps.map((icp) =>
          scoreIcp(
            icp,
            input.company,
            input.features,
            input.validation.claims,
          ),
        )
      : [
          {
            name: "No ICP configured",
            score: 50,
            completeness: 0.25,
            conservative: 30,
            upside: 90,
            reasons: [],
            risks: ["No ICP is configured for this workspace."],
          },
        ];

  scoredIcps.sort((a, b) => b.score - a.score);
  const bestIcp = scoredIcps[0];

  const buyingIntent = claimSignalScore(input.validation.claims);
  const timing = timingScore(input.validation.claims, now);
  const need = needScore(input.validation.claims);
  const budget = budgetFitScore(
    input.validation.claims,
    input.company.employeeCount,
    input.offerings,
  );

  const baseEvidenceConfidence = evidenceConfidenceScore(
    input.validation,
    bestIcp.completeness,
    input.collector,
  );

  const dimensions: Dimension[] = [
    {
      key: "fit",
      label: "Commercial fit",
      weight: 0.35,
      value: bestIcp.score,
      conservativeUnknown: 20,
      upsideUnknown: 95,
    },
    {
      key: "intent",
      label: "Buying intent",
      weight: 0.2,
      value: buyingIntent,
      conservativeUnknown: 18,
      upsideUnknown: 90,
    },
    {
      key: "timing",
      label: "Timing",
      weight: 0.15,
      value: timing,
      conservativeUnknown: 20,
      upsideUnknown: 90,
    },
    {
      key: "need",
      label: "Need",
      weight: 0.15,
      value: need,
      conservativeUnknown: 25,
      upsideUnknown: 92,
    },
    {
      key: "budget",
      label: "Budget fit",
      weight: 0.15,
      value: budget,
      conservativeUnknown: 25,
      upsideUnknown: 82,
    },
  ];

  const unknownDimensions = dimensions
    .filter((dimension) => dimension.value === null)
    .map((dimension) => dimension.label);

  const totalDimensionWeight = dimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );
  const knownDimensionWeight = dimensions
    .filter((dimension) => dimension.value !== null)
    .reduce((sum, dimension) => sum + dimension.weight, 0);
  const dimensionCoverage =
    totalDimensionWeight > 0
      ? knownDimensionWeight / totalDimensionWeight
      : 0;

  const evidenceConfidence = Math.round(
    clamp(
      baseEvidenceConfidence *
        (0.45 + 0.55 * dimensionCoverage),
    ),
  );

  const potential = boundedPotential(dimensions, bestIcp);

  const voi = valueOfInformation({
    conservative: potential.conservative,
    upside: potential.upside,
    confidence: evidenceConfidence,
    unknownCount: unknownDimensions.length,
    singleSourceCount: input.validation.singleSourceCount,
    conflictedCount: input.validation.conflictedCount,
  });

  const salesPriority = Math.round(
    clamp(
      potential.current *
        (0.55 + 0.45 * (evidenceConfidence / 100)),
    ),
  );

  const researchPriority = Math.round(
    clamp(
      potential.upside * 0.4 +
        voi * 0.45 +
        potential.current * 0.15,
    ),
  );

  const researchTargets = buildResearchTargets({
    dimensions,
    validation: input.validation,
    fitCompleteness: bestIcp.completeness,
  });

  const action = priorityAction({
    potential: potential.current,
    confidence: evidenceConfidence,
    upside: potential.upside,
    salesPriority,
    researchPriority,
  });

  const liveSignalClaims = liveClaims(input.validation.claims, [
    "HIRING",
    "EXPANSION",
    "FUNDING",
    "LEADERSHIP",
    "TECHNOLOGY",
    "PROCUREMENT",
    "GROWTH",
    "OPERATIONAL_PAIN",
  ])
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const whyFit = [
    `Best ICP: ${bestIcp.name} (${bestIcp.score}/100 potential fit on known criteria)`,
    ...bestIcp.reasons,
  ].slice(0, 4);

  const whyNow =
    liveSignalClaims.length > 0
      ? liveSignalClaims.map(claimReason)
      : [
          "No cross-validated current buying signal is available; this is unknown rather than negative.",
        ];

  const risks = [
    ...bestIcp.risks,
    ...(input.validation.conflictedCount > 0
      ? [
          `${input.validation.conflictedCount} claim(s) contain conflicting independent sources.`,
        ]
      : []),
    ...(input.validation.singleSourceCount > 0
      ? [
          `${input.validation.singleSourceCount} claim(s) are supported by only one independent source family.`,
        ]
      : []),
    ...(unknownDimensions.length > 0
      ? [
          `Unknown dimensions: ${unknownDimensions.join(", ")}. Missing data is not scored as a negative.`,
        ]
      : []),
  ].slice(0, 6);

  const assessmentSummary =
    action === "CONTACT_NOW"
      ? "High potential with sufficiently corroborated evidence for immediate sales attention."
      : action === "INVESTIGATE_URGENTLY"
        ? "High potential but evidence confidence is still limited; prioritise further research before outreach."
        : action === "REJECT"
          ? "Low potential with high confidence and little plausible upside."
          : action === "GATHER_MORE_DATA"
            ? "Current evidence is insufficient; the upside range justifies targeted evidence collection."
            : action === "REVIEW"
              ? "Moderate-to-high potential with enough evidence for human review."
              : "Current upside does not justify high sales or research priority.";

  const nextAction =
    action === "CONTACT_NOW"
      ? "Identify the recommended decision-maker and prepare targeted outreach."
      : action === "INVESTIGATE_URGENTLY"
        ? "Resolve the highest-value unknown or single-source claim before contacting."
        : action === "GATHER_MORE_DATA"
          ? "Collect an independent source for the highest-value unknown claim."
          : action === "REJECT"
            ? "Reject unless materially new evidence appears."
            : action === "REVIEW"
              ? "Review corroborated claims and decide whether to add to pipeline."
              : "Deprioritise research until a new buying signal appears.";

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
    commercialFitScore: bestIcp.score,
    buyingIntentScore: buyingIntent ?? 0,
    budgetFitScore: budget ?? 0,
    timingScore: timing ?? 0,
    needScore: need ?? 0,
    evidenceConfidence,
    overallPotentialScore: potential.current,
    potentialConservativeScore: potential.conservative,
    potentialUpsideScore: potential.upside,
    estimatedConversionPercent: conversionEstimate(potential.current),
    salesPriorityScore: salesPriority,
    researchPriorityScore: researchPriority,
    valueOfInformationScore: voi,
    priorityAction: action,
    unknownDimensions,
    researchTargets,
    assessmentSummary,
    whyFit,
    whyNow,
    risks,
    recommendedContactRole: recommendedContact(
      input.validation.claims,
      input.features.decisionRoles,
    ),
    nextAction,
    observations: input.observations,
    validatedClaims: input.validation.claims,
    claimValidation: {
      confirmedCount: input.validation.confirmedCount,
      corroboratedCount: input.validation.corroboratedCount,
      singleSourceCount: input.validation.singleSourceCount,
      conflictedCount: input.validation.conflictedCount,
      staleCount: input.validation.staleCount,
      independentFamilyCount: input.validation.independentFamilyCount,
    },
  };
}
