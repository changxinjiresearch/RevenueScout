import type {
  ClaimCandidate,
  ClaimType,
  ClaimValidationSummary,
  ValidatedClaim,
  ValidatedClaimEvidence,
} from "./claims";
import {
  assignIndependenceKeys,
  boundedAverage,
  freshnessScore,
  isAuthoritativeSingleSource,
  registrableFamily,
  sourceDomain,
  sourceQuality,
} from "./source-evaluation";

const DYNAMIC_CLAIMS = new Set<ClaimType>([
  "HIRING",
  "EXPANSION",
  "FUNDING",
  "LEADERSHIP",
  "TECHNOLOGY",
  "PROCUREMENT",
  "GROWTH",
  "OPERATIONAL_PAIN",
]);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function claimEvidenceFreshness(
  claimType: ClaimType,
  observedAt: string,
  verificationStatus: ClaimCandidate["evidence"]["verificationStatus"],
  now: Date,
): number {
  const base = freshnessScore(observedAt, verificationStatus, now);
  if (!DYNAMIC_CLAIMS.has(claimType)) return base;

  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return Math.min(base, 0.35);

  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - observed.getTime()) / 86_400_000),
  );

  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 0.82;
  if (ageDays <= 90) return 0.62;
  if (ageDays <= 180) return 0.38;
  return 0.15;
}

function employeeRange(value: unknown): { low: number; high: number } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const low = Number(record.low);
  const high = Number(record.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return null;
  }
  return { low, high };
}

function rangesConflict(a: unknown, b: unknown): boolean {
  const left = employeeRange(a);
  const right = employeeRange(b);
  if (!left || !right) return false;

  const overlap = Math.min(left.high, right.high) - Math.max(left.low, right.low);
  if (overlap >= 0) return false;

  const leftMid = (left.low + left.high) / 2;
  const rightMid = (right.low + right.high) / 2;
  const gap = Math.abs(leftMid - rightMid);
  const scale = Math.max(leftMid, rightMid, 1);

  return gap / scale >= 0.25;
}

function claimsConflict(a: ClaimCandidate, b: ClaimCandidate): boolean {
  if (a.claimType !== b.claimType || a.claimKey === b.claimKey) return false;

  if (a.claimType === "INDUSTRY" || a.claimType === "SUBINDUSTRY") {
    return true;
  }

  if (a.claimType === "EMPLOYEE_RANGE") {
    return rangesConflict(a.value, b.value);
  }

  return false;
}

function uniqueEvidence(candidates: ClaimCandidate[]): ClaimCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [
      candidate.claimType,
      candidate.claimKey,
      candidate.evidence.sourceUrl,
      candidate.evidence.excerpt.toLowerCase().replace(/\s+/g, " ").trim(),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function averageByFamily(
  evidence: ValidatedClaimEvidence[],
  field: "sourceQuality" | "freshnessScore" | "extractionConfidence",
): number {
  const best = new Map<string, number>();

  for (const item of evidence.filter((item) => item.stance === "SUPPORTS")) {
    best.set(
      item.independenceKey,
      Math.max(best.get(item.independenceKey) ?? 0, item[field]),
    );
  }

  return boundedAverage([...best.values()], 0);
}

function dates(evidence: ValidatedClaimEvidence[]): {
  first: string | null;
  last: string | null;
} {
  const valid = evidence
    .filter((item) => item.stance === "SUPPORTS")
    .map((item) => new Date(item.observedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    first: valid[0]?.toISOString() ?? null,
    last: valid.at(-1)?.toISOString() ?? null,
  };
}

function explanation(input: {
  status: ValidatedClaim["status"];
  supportingFamilies: number;
  conflictingFamilies: number;
  sourceCount: number;
  confidence: number;
}): string {
  const confidence = Math.round(input.confidence * 100);

  if (input.status === "CONFIRMED") {
    return `Confirmed at ${confidence}% confidence from ${input.supportingFamilies} independent evidence family/families.`;
  }
  if (input.status === "CORROBORATED") {
    return `Corroborated by ${input.supportingFamilies} independent source families at ${confidence}% confidence.`;
  }
  if (input.status === "CONFLICTED") {
    return `Conflicting evidence: ${input.supportingFamilies} supporting and ${input.conflictingFamilies} conflicting independent families.`;
  }
  if (input.status === "STALE") {
    return `Evidence exists but is too stale to drive the live commercial model.`;
  }
  if (input.status === "SINGLE_SOURCE") {
    return `Only one independent source family currently supports this claim; it is retained but cannot become a high-confidence fact.`;
  }
  return "No sufficient evidence is available.";
}

export function validateClaims(
  rawCandidates: ClaimCandidate[],
  now = new Date(),
): ClaimValidationSummary {
  const candidates = uniqueEvidence(rawCandidates);
  const independenceKeys = assignIndependenceKeys(
    candidates.map((candidate) => candidate.evidence),
  );

  const decorated = candidates.map((candidate, index) => ({
    ...candidate,
    independenceKey: independenceKeys[index],
  }));

  const groups = new Map<string, typeof decorated>();

  for (const candidate of decorated) {
    const key = `${candidate.claimType}|${candidate.claimKey}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const claims: ValidatedClaim[] = [];

  for (const group of groups.values()) {
    const representative = group[0];

    const conflicting = decorated.filter((candidate) =>
      claimsConflict(representative, candidate),
    );

    const supportEvidence: ValidatedClaimEvidence[] = group.map((candidate) => {
      const quality = sourceQuality(
        candidate.claimType,
        candidate.evidence.sourceType,
        candidate.evidence.sourceUrl,
      );

      return {
        ...candidate.evidence,
        stance: "SUPPORTS",
        sourceDomain: sourceDomain(candidate.evidence.sourceUrl),
        sourceFamily: registrableFamily(candidate.evidence.sourceUrl),
        independenceKey: candidate.independenceKey,
        sourceQuality: quality,
        freshnessScore: claimEvidenceFreshness(
          candidate.claimType,
          candidate.evidence.observedAt,
          candidate.evidence.verificationStatus,
          now,
        ),
      };
    });

    const conflictingEvidence: ValidatedClaimEvidence[] = conflicting.map(
      (candidate) => ({
        ...candidate.evidence,
        stance: "CONTRADICTS",
        sourceDomain: sourceDomain(candidate.evidence.sourceUrl),
        sourceFamily: registrableFamily(candidate.evidence.sourceUrl),
        independenceKey: candidate.independenceKey,
        sourceQuality: sourceQuality(
          candidate.claimType,
          candidate.evidence.sourceType,
          candidate.evidence.sourceUrl,
        ),
        freshnessScore: claimEvidenceFreshness(
          candidate.claimType,
          candidate.evidence.observedAt,
          candidate.evidence.verificationStatus,
          now,
        ),
      }),
    );

    const allEvidence = [...supportEvidence, ...conflictingEvidence];
    const supportFamilies = new Set(
      supportEvidence.map((item) => item.independenceKey),
    );
    const conflictFamilies = new Set(
      conflictingEvidence.map((item) => item.independenceKey),
    );

    const sourceQualityScore = averageByFamily(
      supportEvidence,
      "sourceQuality",
    );
    const freshness = averageByFamily(supportEvidence, "freshnessScore");
    const extraction = averageByFamily(
      supportEvidence,
      "extractionConfidence",
    );

    const supportingFamilyCount = supportFamilies.size;
    const conflictingFamilyCount = [...conflictFamilies].filter(
      (family) => !supportFamilies.has(family),
    ).length;

    const independence = clamp01(
      0.45 + Math.max(0, supportingFamilyCount - 1) * 0.25,
    );
    const agreement =
      supportingFamilyCount + conflictingFamilyCount > 0
        ? supportingFamilyCount /
          (supportingFamilyCount + conflictingFamilyCount)
        : 0;

    let confidence = clamp01(
      sourceQualityScore * 0.3 +
        independence * 0.2 +
        agreement * 0.2 +
        freshness * 0.15 +
        extraction * 0.15,
    );

    const authoritativeSingle =
      supportingFamilyCount === 1 &&
      supportEvidence.some((item) =>
        isAuthoritativeSingleSource(
          representative.claimType,
          item.sourceType,
          item.sourceUrl,
        ),
      );

    if (supportingFamilyCount === 1 && !authoritativeSingle) {
      confidence = Math.min(confidence, 0.68);
    }

    let status: ValidatedClaim["status"];

    if (freshness <= 0.25) {
      status = "STALE";
    } else if (conflictingFamilyCount > 0 && agreement < 0.8) {
      status = "CONFLICTED";
    } else if (
      authoritativeSingle &&
      confidence >= 0.72
    ) {
      status = "CONFIRMED";
      confidence = Math.max(confidence, 0.8);
    } else if (
      supportingFamilyCount >= 3 &&
      agreement >= 0.9 &&
      confidence >= 0.82
    ) {
      status = "CONFIRMED";
    } else if (
      supportingFamilyCount >= 2 &&
      agreement >= 0.75 &&
      confidence >= 0.7
    ) {
      status = "CORROBORATED";
    } else {
      status = "SINGLE_SOURCE";
    }

    const observed = dates(allEvidence);

    claims.push({
      claimType: representative.claimType,
      claimKey: representative.claimKey,
      value: representative.value,
      status,
      confidence,
      supportingFamilyCount,
      conflictingFamilyCount,
      sourceCount: supportEvidence.length,
      freshnessScore: freshness,
      sourceQualityScore,
      independenceScore: independence,
      agreementScore: agreement,
      extractionScore: extraction,
      firstObservedAt: observed.first,
      lastObservedAt: observed.last,
      explanation: explanation({
        status,
        supportingFamilies: supportingFamilyCount,
        conflictingFamilies: conflictingFamilyCount,
        sourceCount: supportEvidence.length,
        confidence,
      }),
      evidence: allEvidence,
    });
  }

  claims.sort((a, b) => {
    const statusOrder: Record<ValidatedClaim["status"], number> = {
      CONFIRMED: 6,
      CORROBORATED: 5,
      SINGLE_SOURCE: 4,
      CONFLICTED: 3,
      STALE: 2,
      UNKNOWN: 1,
    };

    return (
      statusOrder[b.status] - statusOrder[a.status] ||
      b.confidence - a.confidence
    );
  });

  return {
    claims,
    confirmedCount: claims.filter((claim) => claim.status === "CONFIRMED")
      .length,
    corroboratedCount: claims.filter(
      (claim) => claim.status === "CORROBORATED",
    ).length,
    singleSourceCount: claims.filter(
      (claim) => claim.status === "SINGLE_SOURCE",
    ).length,
    conflictedCount: claims.filter((claim) => claim.status === "CONFLICTED")
      .length,
    staleCount: claims.filter((claim) => claim.status === "STALE").length,
    independentFamilyCount: new Set(
      decorated.map((candidate) => candidate.independenceKey),
    ).size,
  };
}
