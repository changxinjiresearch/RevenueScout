import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type {
  IcpRule,
  OfferingConfig,
} from "@/lib/domain/configured-opportunity";
import {
  runRevenueScoutIntelligenceV2,
  type IntelligenceCompanyInput,
} from "@/lib/intelligence/engine";
import type {
  ExistingEvidenceInput,
  ValidatedClaim,
  ValidatedClaimEvidence,
} from "@/lib/intelligence/claims";
import { publicUrl } from "@/lib/http/public-url";

const LIVE_CLAIM_STATUSES = new Set(["CONFIRMED", "CORROBORATED"]);
const SIGNAL_CLAIM_TYPES = new Set([
  "HIRING",
  "EXPANSION",
  "FUNDING",
  "LEADERSHIP",
  "TECHNOLOGY",
  "PROCUREMENT",
  "GROWTH",
  "OPERATIONAL_PAIN",
]);

function observedDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function evidenceHash(
  claimType: string,
  evidence: ValidatedClaimEvidence,
): string {
  return createHash("sha256")
    .update(
      [
        claimType,
        evidence.sourceUrl,
        evidence.excerpt.toLowerCase().replace(/\s+/g, " ").trim(),
      ].join("|"),
    )
    .digest("hex");
}

function liveClaim(
  claims: ValidatedClaim[],
  claimType: string,
): ValidatedClaim | null {
  return (
    claims
      .filter(
        (claim) =>
          claim.claimType === claimType &&
          LIVE_CLAIM_STATUSES.has(claim.status),
      )
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null
  );
}

function liveClaims(
  claims: ValidatedClaim[],
  claimType: string,
): ValidatedClaim[] {
  return claims
    .filter(
      (claim) =>
        claim.claimType === claimType &&
        LIVE_CLAIM_STATUSES.has(claim.status),
    )
    .sort((a, b) => b.confidence - a.confidence);
}

function claimObjectValue(
  claim: ValidatedClaim | null,
  key: string,
): string | null {
  if (!claim?.value || typeof claim.value !== "object") return null;
  const value = (claim.value as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function claimStringValues(
  claims: ValidatedClaim[],
  claimType: string,
  key: string,
): string[] {
  return [
    ...new Set(
      liveClaims(claims, claimType)
        .map((claim) => claimObjectValue(claim, key))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function employeeFromClaim(
  claim: ValidatedClaim | null,
): { count: number | null; range: string | null } {
  if (!claim?.value || typeof claim.value !== "object") {
    return { count: null, range: null };
  }

  const value = claim.value as Record<string, unknown>;
  const low = Number(value.low);
  const high = Number(value.high);

  if (
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    low < 0 ||
    high < low
  ) {
    return { count: null, range: null };
  }

  return {
    count: Math.round((low + high) / 2),
    range: `${low}–${high}`,
  };
}

function signalStrength(claim: ValidatedClaim): number {
  if (!claim.value || typeof claim.value !== "object") return 60;
  const value = Number(
    (claim.value as Record<string, unknown>).strength,
  );
  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 60;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const sql = db();

  const [company] = await sql<IntelligenceCompanyInput[]>`
    SELECT
      c.display_name AS "displayName",
      c.legal_name AS "legalName",
      c.website,
      c.domain,
      c.country,
      c.state,
      c.city,
      c.industry,
      c.subindustry,
      c.employee_count AS "employeeCount",
      c.company_type AS "companyType",
      c.service_regions AS "serviceRegions",
      c.entity_type AS "entityType"
    FROM companies c
    WHERE c.id = ${id}
      AND c.organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const [icps, offerings, existingEvidenceRows] = await Promise.all([
    sql<IcpRule[]>`
      SELECT
        id,
        name,
        countries,
        states,
        cities,
        industries,
        subindustries,
        employee_min AS "employeeMin",
        employee_max AS "employeeMax",
        company_age_min AS "companyAgeMin",
        company_age_max AS "companyAgeMax",
        company_types AS "companyTypes",
        service_regions AS "serviceRegions",
        fast_growth AS "fastGrowth",
        multi_location AS "multiLocation",
        hiring,
        recent_funding AS "recentFunding",
        required_roles AS "requiredRoles",
        business_models AS "businessModels",
        technologies,
        digital_need AS "digitalNeed",
        exclusions,
        excluded_industries AS "excludedIndustries",
        exclude_government AS "excludeGovernment",
        exclude_nonprofit AS "excludeNonprofit",
        exclude_existing_customer AS "excludeExistingCustomer",
        exclude_rejected AS "excludeRejected",
        exclude_unsubscribed AS "excludeUnsubscribed",
        employee_exclude_below AS "employeeExcludeBelow",
        employee_exclude_above AS "employeeExcludeAbove"
      FROM icps
      WHERE organization_id = ${user.organizationId}
    `,
    sql<OfferingConfig[]>`
      SELECT
        id,
        name,
        min_contract_value::float8 AS "minContractValue",
        avg_contract_value::float8 AS "avgContractValue",
        ideal_contract_value::float8 AS "idealContractValue"
      FROM offerings
      WHERE organization_id = ${user.organizationId}
    `,
    sql<{
      sourceType: string;
      sourceUrl: string;
      sourceLabel: string;
      title: string;
      excerpt: string;
      observedAt: Date;
      confidence: number;
      verificationStatus:
        | "CONFIRMED"
        | "LIKELY"
        | "UNVERIFIED"
        | "OUTDATED";
    }[]>`
      SELECT
        source_type AS "sourceType",
        source_url AS "sourceUrl",
        COALESCE(source_label, source_type) AS "sourceLabel",
        title,
        excerpt,
        observed_at AS "observedAt",
        confidence::float8 AS confidence,
        verification_status AS "verificationStatus"
      FROM company_evidence
      WHERE company_id = ${id}
        AND organization_id = ${user.organizationId}
        AND source_url IS NOT NULL
        AND excerpt IS NOT NULL
      ORDER BY observed_at DESC
      LIMIT 80
    `,
  ]);

  const existingEvidence: ExistingEvidenceInput[] =
    existingEvidenceRows.map((item) => ({
      ...item,
      observedAt: item.observedAt.toISOString(),
    }));

  const runContext = {
    company,
    icpIds: icps.map((icp) => icp.id),
    offeringIds: offerings.map((offering) => offering.id),
    evidenceSourceCount: existingEvidence.length,
  };

  const [run] = await sql<{ id: string }[]>`
    INSERT INTO web_enrichment_runs (
      organization_id,
      company_id,
      status,
      engine,
      model,
      prompt_version,
      request_context,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${id},
      'RUNNING',
      'REVENUESCOUT_INTELLIGENCE_V2',
      'RS_CONVERSION_V2',
      'claims-cross-validation-v1',
      ${JSON.stringify(runContext)}::text::jsonb,
      ${user.id}
    )
    RETURNING id
  `;

  try {
    const research = await runRevenueScoutIntelligenceV2({
      company,
      existingEvidence,
      icps,
      offerings,
    });

    const result = research.result;
    const claims = result.validatedClaims;
    const acceptedClaims = claims.filter((claim) =>
      LIVE_CLAIM_STATUSES.has(claim.status),
    );

    const industry = claimObjectValue(
      liveClaim(claims, "INDUSTRY"),
      "industry",
    );
    const subindustry = claimObjectValue(
      liveClaim(claims, "SUBINDUSTRY"),
      "subindustry",
    );
    const employee = employeeFromClaim(
      liveClaim(claims, "EMPLOYEE_RANGE"),
    );

    const serviceRegions = claimStringValues(
      claims,
      "SERVICE_REGION",
      "region",
    );
    const businessModels = claimStringValues(
      claims,
      "BUSINESS_MODEL",
      "businessModel",
    );
    const technologies = claimStringValues(
      claims,
      "TECHNOLOGY",
      "technology",
    );
    const decisionRoles = claimStringValues(
      claims,
      "DECISION_ROLE",
      "role",
    );

    const currentClaimTypes = new Set(
      acceptedClaims.map((claim) => claim.claimType),
    );

    const website =
      research.collector.websiteConfidence >= 0.8 &&
      result.officialWebsite
        ? result.officialWebsite
        : null;

    await sql.begin(async (tx) => {
      const evidenceIds = new Map<string, string>();

      for (const claim of claims) {
        for (const evidence of claim.evidence) {
          const hash = evidenceHash(claim.claimType, evidence);
          if (evidenceIds.has(hash)) continue;

          const [existing] = await tx<{ id: string }[]>`
            SELECT id
            FROM company_evidence
            WHERE company_id = ${id}
              AND source_url = ${evidence.sourceUrl}
              AND excerpt = ${evidence.excerpt}
            LIMIT 1
          `;

          if (existing) {
            await tx`
              UPDATE company_evidence
              SET
                source_domain = ${evidence.sourceDomain},
                source_family = ${evidence.sourceFamily},
                independence_key = ${evidence.independenceKey},
                source_quality = ${evidence.sourceQuality},
                extraction_confidence = ${evidence.extractionConfidence}
              WHERE id = ${existing.id}
            `;
            evidenceIds.set(hash, existing.id);
            continue;
          }

          const [created] = await tx<{ id: string }[]>`
            INSERT INTO company_evidence (
              organization_id,
              company_id,
              source_type,
              source_url,
              source_label,
              title,
              excerpt,
              observed_at,
              confidence,
              verification_status,
              stale_after_days,
              content_hash,
              raw_payload,
              source_domain,
              source_family,
              independence_key,
              source_quality,
              extraction_confidence,
              created_by
            )
            VALUES (
              ${user.organizationId},
              ${id},
              ${evidence.sourceType},
              ${evidence.sourceUrl},
              ${evidence.sourceTitle},
              ${claim.claimType},
              ${evidence.excerpt},
              ${observedDate(evidence.observedAt)},
              ${Math.max(
                0,
                Math.min(1, evidence.extractionConfidence),
              )},
              ${evidence.verificationStatus},
              90,
              ${hash},
              ${JSON.stringify({
                claimType: claim.claimType,
                claimKey: claim.claimKey,
                stance: evidence.stance,
              })}::text::jsonb,
              ${evidence.sourceDomain},
              ${evidence.sourceFamily},
              ${evidence.independenceKey},
              ${evidence.sourceQuality},
              ${evidence.extractionConfidence},
              ${user.id}
            )
            ON CONFLICT (company_id, content_hash)
              WHERE content_hash IS NOT NULL
            DO UPDATE SET
              source_domain = EXCLUDED.source_domain,
              source_family = EXCLUDED.source_family,
              independence_key = EXCLUDED.independence_key,
              source_quality = EXCLUDED.source_quality,
              extraction_confidence = EXCLUDED.extraction_confidence
            RETURNING id
          `;

          evidenceIds.set(hash, created.id);
        }
      }

      for (const claim of claims) {
        const [claimRow] = await tx<{ id: string }[]>`
          INSERT INTO company_claims (
            organization_id,
            company_id,
            research_run_id,
            claim_type,
            claim_key,
            value_json,
            status,
            confidence,
            supporting_family_count,
            conflicting_family_count,
            source_count,
            freshness_score,
            source_quality_score,
            independence_score,
            agreement_score,
            extraction_score,
            first_observed_at,
            last_observed_at,
            explanation
          )
          VALUES (
            ${user.organizationId},
            ${id},
            ${run.id},
            ${claim.claimType},
            ${claim.claimKey},
            ${JSON.stringify(claim.value)}::text::jsonb,
            ${claim.status},
            ${claim.confidence},
            ${claim.supportingFamilyCount},
            ${claim.conflictingFamilyCount},
            ${claim.sourceCount},
            ${claim.freshnessScore},
            ${claim.sourceQualityScore},
            ${claim.independenceScore},
            ${claim.agreementScore},
            ${claim.extractionScore},
            ${claim.firstObservedAt
              ? observedDate(claim.firstObservedAt)
              : null},
            ${claim.lastObservedAt
              ? observedDate(claim.lastObservedAt)
              : null},
            ${claim.explanation}
          )
          ON CONFLICT (company_id, claim_type, claim_key)
          DO UPDATE SET
            research_run_id = EXCLUDED.research_run_id,
            value_json = EXCLUDED.value_json,
            status = EXCLUDED.status,
            confidence = EXCLUDED.confidence,
            supporting_family_count = EXCLUDED.supporting_family_count,
            conflicting_family_count = EXCLUDED.conflicting_family_count,
            source_count = EXCLUDED.source_count,
            freshness_score = EXCLUDED.freshness_score,
            source_quality_score = EXCLUDED.source_quality_score,
            independence_score = EXCLUDED.independence_score,
            agreement_score = EXCLUDED.agreement_score,
            extraction_score = EXCLUDED.extraction_score,
            first_observed_at = EXCLUDED.first_observed_at,
            last_observed_at = EXCLUDED.last_observed_at,
            explanation = EXCLUDED.explanation,
            updated_at = NOW()
          RETURNING id
        `;

        await tx`
          DELETE FROM company_claim_evidence
          WHERE claim_id = ${claimRow.id}
        `;

        for (const evidence of claim.evidence) {
          const hash = evidenceHash(claim.claimType, evidence);
          const evidenceId = evidenceIds.get(hash);
          if (!evidenceId) continue;

          await tx`
            INSERT INTO company_claim_evidence (
              claim_id,
              evidence_id,
              stance,
              source_family,
              independence_key,
              source_quality,
              freshness_score,
              extraction_confidence
            )
            VALUES (
              ${claimRow.id},
              ${evidenceId},
              ${evidence.stance},
              ${evidence.sourceFamily},
              ${evidence.independenceKey},
              ${evidence.sourceQuality},
              ${evidence.freshnessScore},
              ${evidence.extractionConfidence}
            )
            ON CONFLICT (claim_id, evidence_id)
            DO UPDATE SET
              stance = EXCLUDED.stance,
              source_family = EXCLUDED.source_family,
              independence_key = EXCLUDED.independence_key,
              source_quality = EXCLUDED.source_quality,
              freshness_score = EXCLUDED.freshness_score,
              extraction_confidence = EXCLUDED.extraction_confidence
          `;
        }
      }

      await tx`
        DELETE FROM buying_signals bs
        USING company_evidence ce
        WHERE bs.company_id = ${id}
          AND bs.evidence_id = ce.id
          AND (
            ce.raw_payload ? 'signalType'
            OR ce.raw_payload ? 'claimType'
          )
      `;

      for (const claim of acceptedClaims) {
        if (!SIGNAL_CLAIM_TYPES.has(claim.claimType)) continue;

        const supporting = claim.evidence
          .filter((evidence) => evidence.stance === "SUPPORTS")
          .sort(
            (a, b) =>
              b.sourceQuality * b.extractionConfidence -
              a.sourceQuality * a.extractionConfidence,
          )[0];

        if (!supporting) continue;

        const evidenceId = evidenceIds.get(
          evidenceHash(claim.claimType, supporting),
        );
        if (!evidenceId) continue;

        await tx`
          INSERT INTO buying_signals (
            organization_id,
            company_id,
            evidence_id,
            signal_type,
            label,
            summary,
            rationale,
            strength,
            confidence,
            observed_at,
            verification_status,
            created_by
          )
          SELECT
            ${user.organizationId},
            ${id},
            ${evidenceId},
            ${claim.claimType},
            ${claim.claimType.replaceAll("_", " ")},
            ${supporting.excerpt},
            ${claim.explanation},
            ${signalStrength(claim)},
            ${claim.confidence},
            ${claim.lastObservedAt
              ? observedDate(claim.lastObservedAt)
              : new Date()},
            ${claim.status === "CONFIRMED"
              ? "CONFIRMED"
              : "LIKELY"},
            ${user.id}
          WHERE NOT EXISTS (
            SELECT 1
            FROM buying_signals
            WHERE company_id = ${id}
              AND signal_type = ${claim.claimType}
              AND evidence_id = ${evidenceId}
          )
        `;
      }

      await tx`
        UPDATE companies
        SET
          website = COALESCE(website, NULLIF(${website ?? ""}, '')),
          domain = COALESCE(
            domain,
            ${website
              ? new URL(website).hostname.replace(/^www\./, "")
              : null}
          ),
          description = COALESCE(
            description,
            NULLIF(${result.businessSummary.trim()}, '')
          ),
          industry = COALESCE(industry, ${industry}),
          subindustry = COALESCE(subindustry, ${subindustry}),
          employee_count = COALESCE(employee_count, ${employee.count}),
          employee_range = COALESCE(employee_range, ${employee.range}),
          service_regions = CASE
            WHEN cardinality(service_regions) = 0
              AND ${serviceRegions.length > 0}
            THEN ${serviceRegions}::text[]
            ELSE service_regions
          END,
          business_models = CASE
            WHEN cardinality(business_models) = 0
              AND ${businessModels.length > 0}
            THEN ${businessModels}::text[]
            ELSE business_models
          END,
          technologies = CASE
            WHEN cardinality(technologies) = 0
              AND ${technologies.length > 0}
            THEN ${technologies}::text[]
            ELSE technologies
          END,
          roles_observed = CASE
            WHEN cardinality(roles_observed) = 0
              AND ${decisionRoles.length > 0}
            THEN ${decisionRoles}::text[]
            ELSE roles_observed
          END,
          currently_hiring = ${currentClaimTypes.has("HIRING")},
          fast_growth = ${currentClaimTypes.has("GROWTH") ||
            currentClaimTypes.has("EXPANSION")},
          recent_funding = ${currentClaimTypes.has("FUNDING")},
          multi_location =
            multi_location OR ${serviceRegions.length > 1},
          digital_need = ${currentClaimTypes.has("TECHNOLOGY") ||
            currentClaimTypes.has("OPERATIONAL_PAIN")},
          updated_at = NOW()
        WHERE id = ${id}
          AND organization_id = ${user.organizationId}
      `;

      await tx`
        UPDATE web_enrichment_runs
        SET
          status = 'COMPLETED',
          engine = ${research.engine},
          model = ${research.model},
          source_urls = ${research.sourceUrls}::text[],
          source_count = ${research.sourceUrls.length},
          structured_result = ${JSON.stringify(result)}::text::jsonb,
          raw_response = ${JSON.stringify({
            collector: research.collector,
            validation: research.validation,
          })}::text::jsonb,
          potential_score = ${result.overallPotentialScore},
          confidence_score = ${result.evidenceConfidence},
          conservative_score = ${result.potentialConservativeScore},
          upside_score = ${result.potentialUpsideScore},
          sales_priority_score = ${result.salesPriorityScore},
          research_priority_score = ${result.researchPriorityScore},
          value_of_information_score = ${result.valueOfInformationScore},
          priority_action = ${result.priorityAction},
          completed_at = NOW()
        WHERE id = ${run.id}
      `;
    });

    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research", "complete");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "RevenueScout Intelligence Engine failed.";

    await sql`
      UPDATE web_enrichment_runs
      SET
        status = 'FAILED',
        error_message = ${message.slice(0, 1000)},
        completed_at = NOW()
      WHERE id = ${run.id}
    `;

    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research_error", "failed");
    return NextResponse.redirect(url, 303);
  }
}
