export function preContactLikelihood(
  score: number,
  confidence: number,
): number {
  const normalizedScore = Math.max(0, Math.min(100, score)) / 100;
  const normalizedConfidence =
    Math.max(0, Math.min(100, confidence)) / 100;

  return Math.round(
    Math.min(
      35,
      Math.max(
        1,
        1 + 34 * normalizedScore * normalizedScore * normalizedConfidence,
      ),
    ),
  );
}
