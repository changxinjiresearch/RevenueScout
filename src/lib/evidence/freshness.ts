export type FreshnessLabel = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

export function evidenceAgeDays(
  observedAt: string | Date | null | undefined,
  now = new Date(),
): number | null {
  if (!observedAt) return null;
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - observed.getTime()) / 86_400_000));
}

export function evidenceFreshness(
  observedAt: string | Date | null | undefined,
  staleAfterDays: number,
  now = new Date(),
): FreshnessLabel {
  const age = evidenceAgeDays(observedAt, now);
  if (age === null) return "UNKNOWN";

  if (age <= Math.max(1, Math.floor(staleAfterDays * 0.5))) return "FRESH";
  if (age <= staleAfterDays) return "AGING";
  return "STALE";
}

export function freshnessConfidenceMultiplier(
  label: FreshnessLabel,
): number {
  if (label === "FRESH") return 1;
  if (label === "AGING") return 0.8;
  if (label === "STALE") return 0.45;
  return 0.6;
}
