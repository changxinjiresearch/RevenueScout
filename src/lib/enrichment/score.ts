export function weightedCommercialScore(input: {
  fit: number;
  intent: number;
  budget: number;
  timing: number;
  need: number;
}): number {
  return Math.round(
    input.fit * 0.35 +
      input.intent * 0.2 +
      input.budget * 0.15 +
      input.timing * 0.15 +
      input.need * 0.15,
  );
}
