export type FunnelStage = {
  key: string;
  label: string;
  count: number;
};

export type FunnelStageWithRates = FunnelStage & {
  fromStartRate: number | null;
  fromPreviousRate: number | null;
};

export type ClosedPrediction = {
  predictedProbability: number | null;
  predictedExpectedRevenue: number | null;
  actualRevenue: number;
  outcome: "WON" | "LOST";
};

export type CalibrationBin = {
  label: string;
  lower: number;
  upper: number;
  count: number;
  averagePredictedProbability: number | null;
  actualWinRate: number | null;
};

export type CalibrationSummary = {
  sampleSize: number;
  wins: number;
  losses: number;
  actualWinRate: number | null;
  averagePredictedProbability: number | null;
  brierScore: number | null;
  meanAbsoluteProbabilityError: number | null;
  status: "NO_GROUND_TRUTH" | "INSUFFICIENT_DATA" | "CALIBRATING" | "EVALUABLE";
  bins: CalibrationBin[];
};

export function safeRate(
  numerator: number,
  denominator: number,
): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function buildFunnel(
  stages: FunnelStage[],
): FunnelStageWithRates[] {
  const start = stages[0]?.count ?? 0;

  return stages.map((stage, index) => {
    const previous = index === 0 ? stage.count : stages[index - 1]?.count ?? 0;
    return {
      ...stage,
      fromStartRate: safeRate(stage.count, start),
      fromPreviousRate:
        index === 0 ? 1 : safeRate(stage.count, previous),
    };
  });
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calibrationStatus(
  sampleSize: number,
): CalibrationSummary["status"] {
  if (sampleSize <= 0) return "NO_GROUND_TRUTH";
  if (sampleSize < 10) return "INSUFFICIENT_DATA";
  if (sampleSize < 50) return "CALIBRATING";
  return "EVALUABLE";
}

export function buildCalibrationSummary(
  rows: ClosedPrediction[],
): CalibrationSummary {
  const usable = rows.filter(
    (row): row is ClosedPrediction & { predictedProbability: number } =>
      row.predictedProbability !== null &&
      Number.isFinite(row.predictedProbability),
  );

  const sampleSize = usable.length;
  const wins = usable.filter((row) => row.outcome === "WON").length;
  const losses = sampleSize - wins;

  const bins: CalibrationBin[] = Array.from({ length: 10 }, (_, index) => ({
    label: `${index * 10}–${(index + 1) * 10}%`,
    lower: index / 10,
    upper: (index + 1) / 10,
    count: 0,
    averagePredictedProbability: null,
    actualWinRate: null,
  }));

  const binProbabilities: number[][] = Array.from({ length: 10 }, () => []);
  const binOutcomes: number[][] = Array.from({ length: 10 }, () => []);

  let probabilitySum = 0;
  let squaredErrorSum = 0;
  let absoluteErrorSum = 0;

  for (const row of usable) {
    const probability = clampProbability(row.predictedProbability);
    const actual = row.outcome === "WON" ? 1 : 0;
    const error = probability - actual;

    probabilitySum += probability;
    squaredErrorSum += error * error;
    absoluteErrorSum += Math.abs(error);

    const index = Math.min(9, Math.floor(probability * 10));
    binProbabilities[index].push(probability);
    binOutcomes[index].push(actual);
  }

  for (let index = 0; index < bins.length; index += 1) {
    const probabilities = binProbabilities[index];
    const outcomes = binOutcomes[index];
    bins[index].count = probabilities.length;
    bins[index].averagePredictedProbability =
      probabilities.length > 0
        ? probabilities.reduce((sum, value) => sum + value, 0) /
          probabilities.length
        : null;
    bins[index].actualWinRate =
      outcomes.length > 0
        ? outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length
        : null;
  }

  return {
    sampleSize,
    wins,
    losses,
    actualWinRate: safeRate(wins, sampleSize),
    averagePredictedProbability:
      sampleSize > 0 ? probabilitySum / sampleSize : null,
    brierScore: sampleSize > 0 ? squaredErrorSum / sampleSize : null,
    meanAbsoluteProbabilityError:
      sampleSize > 0 ? absoluteErrorSum / sampleSize : null,
    status: calibrationStatus(sampleSize),
    bins,
  };
}

export function revenueAccuracy(rows: ClosedPrediction[]) {
  const predictedExpectedRevenue = rows.reduce(
    (sum, row) => sum + (row.predictedExpectedRevenue ?? 0),
    0,
  );
  const actualRevenue = rows.reduce(
    (sum, row) => sum + row.actualRevenue,
    0,
  );
  const delta = actualRevenue - predictedExpectedRevenue;
  const ratio =
    predictedExpectedRevenue > 0
      ? actualRevenue / predictedExpectedRevenue
      : null;

  return {
    predictedExpectedRevenue,
    actualRevenue,
    delta,
    ratio,
  };
}

export function formatCalibrationStatus(
  status: CalibrationSummary["status"],
): string {
  if (status === "NO_GROUND_TRUTH") return "No closed outcomes yet";
  if (status === "INSUFFICIENT_DATA") return "Too little data to calibrate";
  if (status === "CALIBRATING") return "Calibration evidence is accumulating";
  return "Enough ground truth for formal calibration work";
}
