import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type {
  IcpRule,
  OfferingConfig,
} from "@/lib/domain/configured-opportunity";
import {
  runRevenueScoutIntelligenceV1,
  sourceBelongsToRun,
  type IntelligenceCompanyInput,
} from "@/lib/intelligence/engine";
import { publicUrl } from "@/lib/http/public-url";

function observedDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function employeeMidpoint(
  low: number,
  high: number,
  confidence: number,
): number | null {
  if (low < 0 || high < low || confidence < 0.75) return null;
  return Math.round((low + high) / 2);
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

  const [icps, offerings, evidenceUrls] = await Promise.all([
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
    sql<{ sourceUrl: string }[]>`
      SELECT DISTINCT source_url AS "sourceUrl"
      FROM company_evidence
      WHERE company_id = ${id}
        AND organization_id = ${user.organizationId}
        AND source_url IS NOT NULL
      ORDER BY source_url
      LIMIT 20
    `,
  ]);

  const runContext = {
    company,
    icpIds: icps.map((icp) => icp.id),
    offeringIds: offerings.map((offering) => offering.id),
    evidenceSourceCount: evidenceUrls.length,
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
      'REVENUESCOUT_INTELLIGENCE_V1',
      'RS_CONVERSION_V1',
      'deterministic-v1',
      ${JSON.stringify(runContext)}::text::jsonb,
      ${user.id}
    )
    RETURNING id
  `;

  try {
    const research = await runRevenueScoutIntelligenceV1({
      company,
      evidenceUrls: evidenceUrls.map((item) => item.sourceUrl),
      icps,
      offerings,
    });

    const result = research.result;
    const verified = result.observations.filter(
      (item) =>
        item.confidence >= 0.6 &&
        sourceBelongsToRun(item.sourceUrl, research.sourceUrls),
    );
    const currentVerified = verified.filter(
      (item) =>
        item.verificationStatus === "CONFIRMED" ||
        item.verificationStatus === "LIKELY",
    );

    const website =
      research.collector.websiteConfidence >= 0.8 &&
      result.officialWebsite
        ? result.officialWebsite
        : null;

    const employeeCount = employeeMidpoint(
      result.employeeLow,
      result.employeeHigh,
      result.employeeConfidence,
    );
    const employeeRange =
      employeeCount !== null
        ? `${result.employeeLow}–${result.employeeHigh}`
        : null;

    const hasServiceRegions = result.serviceRegions.length > 0;
    const hasBusinessModels = result.businessModels.length > 0;
    const hasTechnologies = result.technologies.length > 0;
    const hasDecisionRoles = result.decisionRoles.length > 0;

    await sql.begin(async (tx) => {
      for (const observation of verified) {
        const contentHash = createHash("sha256")
          .update(
            [
              observation.sourceUrl,
              observation.title,
              observation.observation,
            ].join("|"),
          )
          .digest("hex");

        const [evidenceItem] = await tx<{ id: string }[]>`
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
            created_by
          )
          VALUES (
            ${user.organizationId},
            ${id},
            ${observation.sourceType},
            ${observation.sourceUrl},
            ${observation.sourceTitle || "RevenueScout public-web collector"},
            ${observation.title},
            ${observation.observation},
            ${observedDate(observation.observedAt)},
            ${Math.max(0, Math.min(1, observation.confidence))},
            ${observation.verificationStatus},
            90,
            ${contentHash},
            ${JSON.stringify(observation)}::text::jsonb,
            ${user.id}
          )
          ON CONFLICT (company_id, content_hash)
            WHERE content_hash IS NOT NULL
          DO UPDATE SET
            confidence = EXCLUDED.confidence,
            verification_status = EXCLUDED.verification_status,
            observed_at = EXCLUDED.observed_at,
            raw_payload = EXCLUDED.raw_payload
          RETURNING id
        `;

        if (
          evidenceItem &&
          observation.signalType !== "NONE" &&
          observation.signalStrength >= 40
        ) {
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
              ${evidenceItem.id},
              ${observation.signalType},
              ${observation.title},
              ${observation.observation},
              ${observation.signalRationale},
              ${Math.max(0, Math.min(100, observation.signalStrength))},
              ${Math.max(0, Math.min(1, observation.confidence))},
              ${observedDate(observation.observedAt)},
              ${observation.verificationStatus},
              ${user.id}
            WHERE NOT EXISTS (
              SELECT 1
              FROM buying_signals
              WHERE evidence_id = ${evidenceItem.id}
                AND signal_type = ${observation.signalType}
            )
          `;
        }
      }

      await tx`
        UPDATE companies
        SET
          website = COALESCE(website, NULLIF(${website ?? ""}, '')),
          domain = COALESCE(
            domain,
            ${website ? new URL(website).hostname.replace(/^www\./, "") : null}
          ),
          description = COALESCE(
            description,
            NULLIF(${result.businessSummary.trim()}, '')
          ),
          industry = COALESCE(
            industry,
            CASE
              WHEN ${result.industry !== "" && result.evidenceConfidence >= 55}
              THEN NULLIF(${result.industry}, '')
              ELSE NULL
            END
          ),
          subindustry = COALESCE(
            subindustry,
            CASE
              WHEN ${result.subindustry !== "" && result.evidenceConfidence >= 55}
              THEN NULLIF(${result.subindustry}, '')
              ELSE NULL
            END
          ),
          employee_count = COALESCE(employee_count, ${employeeCount}),
          employee_range = COALESCE(employee_range, ${employeeRange}),
          service_regions = CASE
            WHEN cardinality(service_regions) = 0
              AND ${hasServiceRegions}
            THEN ${result.serviceRegions}::text[]
            ELSE service_regions
          END,
          business_models = CASE
            WHEN cardinality(business_models) = 0
              AND ${hasBusinessModels}
            THEN ${result.businessModels}::text[]
            ELSE business_models
          END,
          technologies = CASE
            WHEN cardinality(technologies) = 0
              AND ${hasTechnologies}
            THEN ${result.technologies}::text[]
            ELSE technologies
          END,
          roles_observed = CASE
            WHEN cardinality(roles_observed) = 0
              AND ${hasDecisionRoles}
            THEN ${result.decisionRoles}::text[]
            ELSE roles_observed
          END,
          currently_hiring =
            currently_hiring OR ${currentVerified.some(
              (item) => item.signalType === "HIRING",
            )},
          fast_growth =
            fast_growth OR ${currentVerified.some(
              (item) =>
                item.signalType === "GROWTH" ||
                item.signalType === "EXPANSION",
            )},
          recent_funding =
            recent_funding OR ${currentVerified.some(
              (item) => item.signalType === "FUNDING",
            )},
          multi_location =
            multi_location OR ${result.serviceRegions.length > 1},
          digital_need =
            digital_need OR ${currentVerified.some(
              (item) =>
                item.signalType === "TECHNOLOGY" ||
                item.signalType === "OPERATIONAL_PAIN",
            )},
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
          })}::text::jsonb,
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
