import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  buildConfiguredOpportunityFromCompany,
  type CompanyRecord,
  type EvidenceRecord,
  type SignalRecord,
} from "@/lib/companies/opportunity";
import type {
  IcpRule,
  OfferingConfig,
  OfferingIcpLink,
} from "@/lib/domain/configured-opportunity";
import { assessOpportunity } from "@/lib/domain/opportunity-score";
import {
  buildOpportunityIntelligence,
  type OpportunityIntelligence,
} from "./intelligence";

export type OpportunityOverride = {
  companyId: string;
  priorityOverride: "AUTO" | "HIGH" | "MEDIUM" | "LOW" | "HOLD";
  conversionProbabilityOverride: number | null;
  expectedDealValueOverride: number | null;
  offeringIdOverride: string | null;
  nextBestActionOverride: string | null;
  note: string;
  updatedAt: Date;
};

export type PersistedOpportunitySnapshot = OpportunityIntelligence & {
  snapshotId: string;
  configVersion: number;
  inputHash: string;
  createdAt: Date;
};

export type EffectiveOpportunity = PersistedOpportunitySnapshot & {
  override: OpportunityOverride | null;
  effectiveOfferingId: string | null;
  effectiveOfferingName: string;
  effectiveConversionProbability: number;
  effectiveDealValue: number;
  effectiveExpectedRevenue: number;
  effectiveNextBestAction: string;
  effectiveRankScore: number;
  hasHumanOverride: boolean;
};

function stableInputHash(input: {
  configVersion: number;
  company: CompanyRecord;
  evidence: EvidenceRecord[];
  signals: SignalRecord[];
  offerings: OfferingConfig[];
  links: OfferingIcpLink[];
  m2SalesPriorityScore?: number | null;
  asOfDay: string;
}): string {
  const payload = {
    configVersion: input.configVersion,
    company: input.company,
    evidence: [...input.evidence]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        confidence: item.confidence,
        verificationStatus: item.verificationStatus,
        observedAt: new Date(item.observedAt).toISOString(),
        staleAfterDays: item.staleAfterDays,
      })),
    signals: [...input.signals]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        type: item.signalType,
        strength: item.strength,
        confidence: item.confidence,
        observedAt: new Date(item.observedAt).toISOString(),
        verificationStatus: item.verificationStatus,
      })),
    offerings: [...input.offerings]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        min: item.minContractValue,
        avg: item.avgContractValue,
        ideal: item.idealContractValue,
        cycle: item.salesCycleDays ?? null,
      })),
    links: [...input.links].sort((a, b) =>
      (a.offeringId + ":" + a.icpId).localeCompare(
        b.offeringId + ":" + b.icpId,
      ),
    ),
    m2SalesPriorityScore: input.m2SalesPriorityScore ?? null,
    asOfDay: input.asOfDay,
  };

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function createOrGetOpportunitySnapshot(input: {
  organizationId: string;
  userId: string;
  configVersion: number;
  company: CompanyRecord;
  evidence: EvidenceRecord[];
  signals: SignalRecord[];
  icps: IcpRule[];
  offerings: OfferingConfig[];
  links: OfferingIcpLink[];
  m2SalesPriorityScore?: number | null;
  now?: Date;
}): Promise<PersistedOpportunitySnapshot | null> {
  const now = input.now ?? new Date();
  const configured = buildConfiguredOpportunityFromCompany({
    company: input.company,
    evidence: input.evidence,
    signals: input.signals,
    icps: input.icps,
    offerings: input.offerings,
    links: input.links,
    now,
  });

  if (!configured) return null;

  const assessment = assessOpportunity(configured.opportunity);
  const intelligence = buildOpportunityIntelligence({
    configured,
    assessment,
    offerings: input.offerings,
    signals: input.signals,
    m2SalesPriorityScore: input.m2SalesPriorityScore,
    now,
  });

  const inputHash = stableInputHash({
    configVersion: input.configVersion,
    company: input.company,
    evidence: input.evidence,
    signals: input.signals,
    offerings: input.offerings,
    links: input.links,
    m2SalesPriorityScore: input.m2SalesPriorityScore,
    asOfDay: now.toISOString().slice(0, 10),
  });

  const sql = db();
  let snapshotId = "";
  let createdAt = new Date();

  await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string; createdAt: Date }[]>`
      INSERT INTO opportunity_snapshots (
        organization_id, company_id, config_version, input_hash, model_version,
        matched_icp_id, matched_icp_name, offering_id, offering_name,
        offering_reason, opportunity_score, icp_fit, buying_intent, timing_score,
        deal_potential, contactability, evidence_confidence, deal_value_low,
        deal_value_expected, deal_value_high, deal_value_basis,
        conversion_probability, conversion_confidence, calibration_state,
        expected_revenue_low, expected_revenue, expected_revenue_high,
        sales_effort, revenue_efficiency, rank_score, recommended_contact,
        next_best_action, why_this_company, why_now, problem_hypothesis,
        conversion_factors, score_explanation, created_by
      )
      VALUES (
        ${input.organizationId}, ${input.company.id}, ${input.configVersion},
        ${inputHash}, ${intelligence.modelVersion},
        ${intelligence.matchedIcpId}, ${intelligence.matchedIcpName},
        ${intelligence.offeringId}, ${intelligence.offeringName},
        ${intelligence.offeringReason}, ${intelligence.opportunityScore},
        ${intelligence.scoreBreakdown.icpFit},
        ${intelligence.scoreBreakdown.buyingIntent},
        ${intelligence.scoreBreakdown.timing},
        ${intelligence.scoreBreakdown.dealPotential},
        ${intelligence.scoreBreakdown.contactability},
        ${intelligence.scoreBreakdown.confidence},
        ${intelligence.dealValueLow}, ${intelligence.dealValueExpected},
        ${intelligence.dealValueHigh}, ${intelligence.dealValueBasis},
        ${intelligence.conversionProbability},
        ${intelligence.conversionConfidence}, ${intelligence.calibrationState},
        ${intelligence.expectedRevenueLow}, ${intelligence.expectedRevenue},
        ${intelligence.expectedRevenueHigh}, ${intelligence.salesEffort},
        ${intelligence.revenueEfficiency}, ${intelligence.rankScore},
        ${intelligence.recommendedContact}, ${intelligence.nextBestAction},
        ${intelligence.whyThisCompany}, ${intelligence.whyNow},
        ${intelligence.problemHypothesis},
        ${JSON.stringify(intelligence.conversionFactors)}::text::jsonb,
        ${JSON.stringify(intelligence.scoreBreakdown)}::text::jsonb,
        ${input.userId}
      )
      ON CONFLICT (organization_id, company_id, input_hash)
      DO NOTHING
      RETURNING id, created_at AS "createdAt"
    `;

    if (created) {
      snapshotId = created.id;
      createdAt = created.createdAt;

      await tx`
        INSERT INTO opportunity_audit_events (
          organization_id, company_id, snapshot_id, event_type,
          after_json, note, actor_id
        )
        VALUES (
          ${input.organizationId}, ${input.company.id}, ${created.id},
          'SNAPSHOT_CREATED',
          ${JSON.stringify({
            opportunityScore: intelligence.opportunityScore,
            expectedRevenue: intelligence.expectedRevenue,
            conversionProbability: intelligence.conversionProbability,
            offeringId: intelligence.offeringId,
          })}::text::jsonb,
          'Opportunity snapshot created from current persisted evidence and GTM configuration.',
          ${input.userId}
        )
      `;
      return;
    }

    const [existing] = await tx<{ id: string; createdAt: Date }[]>`
      SELECT id, created_at AS "createdAt"
      FROM opportunity_snapshots
      WHERE organization_id = ${input.organizationId}
        AND company_id = ${input.company.id}
        AND input_hash = ${inputHash}
      LIMIT 1
    `;

    if (!existing) {
      throw new Error("Opportunity snapshot could not be persisted.");
    }

    snapshotId = existing.id;
    createdAt = existing.createdAt;
  });

  return {
    ...intelligence,
    snapshotId,
    configVersion: input.configVersion,
    inputHash,
    createdAt,
  };
}

export function applyOpportunityOverride(input: {
  snapshot: PersistedOpportunitySnapshot;
  override: OpportunityOverride | null;
  offerings: OfferingConfig[];
}): EffectiveOpportunity {
  const { snapshot, override } = input;
  const overrideOffering = override?.offeringIdOverride
    ? input.offerings.find(
        (offering) => offering.id === override.offeringIdOverride,
      ) ?? null
    : null;

  const effectiveConversionProbability =
    override?.conversionProbabilityOverride ?? snapshot.conversionProbability;
  const effectiveDealValue =
    override?.expectedDealValueOverride ?? snapshot.dealValueExpected;
  const effectiveExpectedRevenue = Math.round(
    effectiveConversionProbability * effectiveDealValue,
  );

  const priorityMultiplier =
    override?.priorityOverride === "HIGH"
      ? 1.5
      : override?.priorityOverride === "MEDIUM"
        ? 0.9
        : override?.priorityOverride === "LOW"
          ? 0.45
          : override?.priorityOverride === "HOLD"
            ? 0
            : 1;

  const revenueScale =
    snapshot.expectedRevenue > 0
      ? effectiveExpectedRevenue / snapshot.expectedRevenue
      : effectiveExpectedRevenue > 0
        ? 1
        : 0;
  const effectiveBaseRank =
    snapshot.rankScore > 0
      ? snapshot.rankScore * revenueScale
      : effectiveExpectedRevenue;

  return {
    ...snapshot,
    override,
    effectiveOfferingId: overrideOffering?.id ?? snapshot.offeringId,
    effectiveOfferingName: overrideOffering?.name ?? snapshot.offeringName,
    effectiveConversionProbability,
    effectiveDealValue,
    effectiveExpectedRevenue,
    effectiveNextBestAction:
      override?.nextBestActionOverride?.trim() || snapshot.nextBestAction,
    effectiveRankScore: effectiveBaseRank * priorityMultiplier,
    hasHumanOverride: Boolean(
      override &&
        (override.priorityOverride !== "AUTO" ||
          override.conversionProbabilityOverride !== null ||
          override.expectedDealValueOverride !== null ||
          override.offeringIdOverride !== null ||
          Boolean(override.nextBestActionOverride?.trim())),
    ),
  };
}
