import { createHash } from "node:crypto";
import type {
  ClaimEvidenceCandidate,
  ClaimType,
} from "./claims";

const MULTIPART_SUFFIXES = new Set([
  "com.au",
  "net.au",
  "org.au",
  "gov.au",
  "edu.au",
  "co.uk",
  "org.uk",
  "gov.uk",
  "co.nz",
  "org.nz",
]);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function sourceDomain(urlValue: string): string {
  try {
    return new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function registrableFamily(urlValue: string): string {
  const host = sourceDomain(urlValue);
  if (host === "unknown") return host;

  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTIPART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function contentFingerprint(value: string): string {
  const normalized = [...tokenSet(value)].sort().join(" ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function assignIndependenceKeys(
  evidence: ClaimEvidenceCandidate[],
): string[] {
  const clusters: Array<{
    key: string;
    family: string;
    tokens: Set<string>;
  }> = [];

  return evidence.map((item) => {
    const family = registrableFamily(item.sourceUrl);
    const tokens = tokenSet(item.excerpt);

    const sameFamily = clusters.find((cluster) => cluster.family === family);
    if (sameFamily) return sameFamily.key;

    const nearDuplicate = clusters.find(
      (cluster) => jaccard(cluster.tokens, tokens) >= 0.78,
    );
    if (nearDuplicate) return nearDuplicate.key;

    const key = `${family}:${contentFingerprint(item.excerpt)}`;
    clusters.push({ key, family, tokens });
    return key;
  });
}

export function freshnessScore(
  observedAt: string,
  verificationStatus: ClaimEvidenceCandidate["verificationStatus"],
  now = new Date(),
): number {
  if (verificationStatus === "OUTDATED") return 0.1;

  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return 0.45;

  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - observed.getTime()) / 86_400_000),
  );

  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.85;
  if (ageDays <= 180) return 0.65;
  if (ageDays <= 365) return 0.45;
  if (ageDays <= 730) return 0.3;
  return 0.15;
}

export function sourceQuality(
  claimType: ClaimType,
  sourceType: string,
  urlValue: string,
): number {
  const source = sourceType.toUpperCase();
  const domain = sourceDomain(urlValue);

  if (source === "GLEIF" || source === "REGISTRY") {
    if (
      claimType === "INDUSTRY" ||
      claimType === "SUBINDUSTRY" ||
      claimType === "EMPLOYEE_RANGE"
    ) {
      return 0.72;
    }
    return 0.9;
  }

  if (source === "TENDER") {
    return claimType === "PROCUREMENT" ? 1 : 0.82;
  }

  if (source === "JOB_BOARD") {
    if (claimType === "HIRING" || claimType === "DECISION_ROLE") return 0.94;
    return 0.58;
  }

  if (source === "NEWS") {
    if (
      claimType === "FUNDING" ||
      claimType === "EXPANSION" ||
      claimType === "LEADERSHIP"
    ) {
      return 0.82;
    }
    if (claimType === "GROWTH") return 0.78;
    return 0.66;
  }

  if (source === "COMPANY_WEBSITE") {
    if (claimType === "INDUSTRY" || claimType === "SUBINDUSTRY") return 0.9;
    if (claimType === "HIRING") return 0.9;
    if (claimType === "EMPLOYEE_RANGE") return 0.82;
    if (claimType === "TECHNOLOGY" || claimType === "TECHNOLOGY_USE") {
      return 0.82;
    }
    if (claimType === "LEADERSHIP") return 0.86;
    if (claimType === "EXPANSION") return 0.86;
    if (claimType === "FUNDING") return 0.82;
    if (claimType === "OPERATIONAL_PAIN") return 0.66;
    return 0.78;
  }

  if (source === "MANUAL") return 0.76;

  if (
    domain.endsWith(".gov.au") ||
    domain.endsWith(".gov") ||
    domain.endsWith(".gov.uk")
  ) {
    return claimType === "PROCUREMENT" ? 1 : 0.9;
  }

  return 0.52;
}

export function isAuthoritativeSingleSource(
  claimType: ClaimType,
  sourceType: string,
  urlValue: string,
): boolean {
  const source = sourceType.toUpperCase();
  const domain = sourceDomain(urlValue);

  if (
    claimType === "PROCUREMENT" &&
    (source === "TENDER" ||
      domain.endsWith(".gov.au") ||
      domain.endsWith(".gov"))
  ) {
    return true;
  }

  if (claimType === "HIRING" && source === "JOB_BOARD") return true;

  return false;
}

export function boundedAverage(values: number[], fallback = 0): number {
  if (values.length === 0) return fallback;
  return clamp01(
    values.reduce((sum, value) => sum + clamp01(value), 0) / values.length,
  );
}
