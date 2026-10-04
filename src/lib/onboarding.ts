import { db } from "./db";

export type OnboardingStep = "company" | "offering" | "icp" | "mapping" | "complete";

export interface OnboardingState {
  companyComplete: boolean;
  offeringComplete: boolean;
  icpComplete: boolean;
  mappingComplete: boolean;
  complete: boolean;
  currentStep: OnboardingStep;
  completedSteps: number;
  totalSteps: 4;
}

export function calculateOnboardingState(input: {
  companyComplete: boolean;
  offeringComplete: boolean;
  icpComplete: boolean;
  mappingComplete: boolean;
}): OnboardingState {
  const completedSteps = [
    input.companyComplete,
    input.offeringComplete,
    input.icpComplete,
    input.mappingComplete,
  ].filter(Boolean).length;

  const currentStep: OnboardingStep = !input.companyComplete
    ? "company"
    : !input.offeringComplete
      ? "offering"
      : !input.icpComplete
        ? "icp"
        : !input.mappingComplete
          ? "mapping"
          : "complete";

  return {
    ...input,
    complete: completedSteps === 4,
    currentStep,
    completedSteps,
    totalSteps: 4,
  };
}

export async function getOnboardingState(
  organizationId: string,
): Promise<OnboardingState> {
  const sql = db();

  const [company] = await sql<{ complete: boolean }[]>`
    SELECT (
      name <> ''
      AND country IS NOT NULL AND country <> ''
      AND COALESCE(array_length(service_regions, 1), 0) > 0
      AND industry IS NOT NULL AND industry <> ''
      AND company_size IS NOT NULL AND company_size <> ''
      AND description IS NOT NULL AND description <> ''
    ) AS complete
    FROM organizations
    WHERE id = ${organizationId}
  `;

  const [offering] = await sql<{ complete: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM offerings
      WHERE organization_id = ${organizationId}
        AND name <> ''
        AND description <> ''
        AND primary_problems <> ''
        AND typical_customers <> ''
        AND min_contract_value IS NOT NULL
        AND avg_contract_value IS NOT NULL
        AND ideal_contract_value IS NOT NULL
        AND sales_cycle_days IS NOT NULL
        AND unsuitable_customers <> ''
    ) AS complete
  `;

  const [icp] = await sql<{ complete: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM icps
      WHERE organization_id = ${organizationId}
        AND name <> ''
        AND (
          COALESCE(array_length(countries, 1), 0) > 0
          OR COALESCE(array_length(states, 1), 0) > 0
          OR COALESCE(array_length(cities, 1), 0) > 0
          OR COALESCE(array_length(industries, 1), 0) > 0
        )
        AND employee_min IS NOT NULL
        AND employee_max IS NOT NULL
    ) AS complete
  `;

  const [mapping] = await sql<{ complete: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM offering_icps oi
      JOIN offerings o ON o.id = oi.offering_id
      JOIN icps i ON i.id = oi.icp_id
      WHERE o.organization_id = ${organizationId}
        AND i.organization_id = ${organizationId}
    ) AS complete
  `;

  return calculateOnboardingState({
    companyComplete: company?.complete ?? false,
    offeringComplete: offering?.complete ?? false,
    icpComplete: icp?.complete ?? false,
    mappingComplete: mapping?.complete ?? false,
  });
}
