import { expandIndustrySemantics } from "./semantic";
import type { DiscoveryCandidate } from "./types";

export type ProgressiveDiscoveryStage =
  | "DISCOVERY"
  | "VALIDATION"
  | "COMPLETE";

export type ProgressiveDiscoveryWorkState = {
  version: 1;
  stage: ProgressiveDiscoveryStage;
  semantics: string[];
  semanticIndex: number;
  candidates: DiscoveryCandidate[];
  validationIndex: number;
};

export type ProgressiveDiscoveryProgress = {
  stage: ProgressiveDiscoveryStage;
  semanticTotal: number;
  semanticCompleted: number;
  candidateCount: number;
  validationTotal: number;
  validationCompleted: number;
  validatedCount: number;
  message: string;
};

export function initialProgressiveDiscoveryState(
  query: string,
): ProgressiveDiscoveryWorkState {
  return {
    version: 1,
    stage: "DISCOVERY",
    semantics: expandIndustrySemantics(query),
    semanticIndex: 0,
    candidates: [],
    validationIndex: 0,
  };
}

export function parseProgressiveDiscoveryState(
  value: unknown,
  query: string,
): ProgressiveDiscoveryWorkState {
  if (!value || typeof value !== "object") {
    return initialProgressiveDiscoveryState(query);
  }

  const input = value as Partial<ProgressiveDiscoveryWorkState>;
  if (
    input.version !== 1 ||
    !Array.isArray(input.semantics) ||
    !Array.isArray(input.candidates)
  ) {
    return initialProgressiveDiscoveryState(query);
  }

  return {
    version: 1,
    stage:
      input.stage === "VALIDATION" || input.stage === "COMPLETE"
        ? input.stage
        : "DISCOVERY",
    semantics: input.semantics.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    ),
    semanticIndex:
      typeof input.semanticIndex === "number" && input.semanticIndex >= 0
        ? Math.floor(input.semanticIndex)
        : 0,
    candidates: input.candidates,
    validationIndex:
      typeof input.validationIndex === "number" && input.validationIndex >= 0
        ? Math.floor(input.validationIndex)
        : 0,
  };
}

export function discoveryProgress(
  state: ProgressiveDiscoveryWorkState,
  validatedCount: number,
): ProgressiveDiscoveryProgress {
  const semanticTotal = state.semantics.length;
  const semanticCompleted = Math.min(state.semanticIndex, semanticTotal);
  const validationTotal = state.candidates.length;
  const validationCompleted = Math.min(
    state.validationIndex,
    validationTotal,
  );

  const message =
    state.stage === "DISCOVERY"
      ? `Searching semantic market variants ${semanticCompleted}/${semanticTotal}…`
      : state.stage === "VALIDATION"
        ? `Validating independent industry evidence ${validationCompleted}/${validationTotal}…`
        : `Discovery complete: ${validatedCount} unique validated companies.`;

  return {
    stage: state.stage,
    semanticTotal,
    semanticCompleted,
    candidateCount: state.candidates.length,
    validationTotal,
    validationCompleted,
    validatedCount,
    message,
  };
}
