import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { runCompanyEnrichment, sourceWasRetrieved } from "@/lib/enrichment/responses-client";
import { WEB_RESEARCH_PROMPT_VERSION } from "@/lib/enrichment/prompt";
import { publicUrl } from "@/lib/http/public-url";

function observedDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const sql = db();

  const [company] = await sql<Record<string, unknown>[]>`
    SELECT
      c.id,
      c.display_name AS "displayName",
      c.legal_name AS "legalName",
      c.website, c.domain, c.country, c.state, c.city, c.address,
      c.legal_entity_category AS "legalEntityCategory",
      c.entity_status AS "entityStatus",
      (SELECT ci.identifier_value FROM company_identifiers ci
       WHERE ci.company_id = c.id AND ci.identifier_type = 'LEI' LIMIT 1) AS lei
    FROM companies c
    WHERE c.id = ${id} AND c.organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const [seller] = await sql<Record<string, unknown>[]>`
    SELECT name, website, country, industry, company_size AS "companySize",
           description, service_regions AS "serviceRegions"
    FROM organizations
    WHERE id = ${user.organizationId}
    LIMIT 1
  `;

  const [icps, offerings] = await Promise.all([
    sql`
      SELECT name, countries, states, cities, industries, subindustries,
             employee_min AS "employeeMin", employee_max AS "employeeMax",
             company_types AS "companyTypes", service_regions AS "serviceRegions",
             fast_growth AS "fastGrowth", multi_location AS "multiLocation",
             hiring, recent_funding AS "recentFunding",
             required_roles AS "requiredRoles", business_models AS "businessModels",
             technologies, digital_need AS "digitalNeed", exclusions
      FROM icps
      WHERE organization_id = ${user.organizationId}
    `,
    sql`
      SELECT name, description, primary_problems AS "primaryProblems",
             typical_customers AS "typicalCustomers",
             min_contract_value::float8 AS "minContractValue",
             avg_contract_value::float8 AS "avgContractValue",
             ideal_contract_value::float8 AS "idealContractValue",
             sales_cycle_days AS "salesCycleDays",
             unsuitable_customers AS "unsuitableCustomers"
      FROM offerings
      WHERE organization_id = ${user.organizationId}
    `,
  ]);

  const researchContext = {
    company,
    seller: seller ?? {},
    icps: [...icps],
    offerings: [...offerings],
  };

  const model = process.env.OPENAI_ENRICHMENT_MODEL?.trim() || "gpt-5.6";
  const [run] = await sql<{ id: string }[]>`
    INSERT INTO web_enrichment_runs (
      organization_id, company_id, status, engine, model,
      prompt_version, request_context, created_by
    )
    VALUES (
      ${user.organizationId}, ${id}, 'RUNNING', 'RESPONSES_WEB_SEARCH',
      ${model}, ${WEB_RESEARCH_PROMPT_VERSION},
      ${JSON.stringify(researchContext)}::text::jsonb, ${user.id}
    )
    RETURNING id
  `;

  try {
    const research = await runCompanyEnrichment(researchContext);
    const result = research.result;
    const officialWebsite =
      result.officialWebsite &&
      sourceWasRetrieved(result.officialWebsite, research.sourceUrls)
        ? result.officialWebsite
        : null;

    const verified = result.observations.filter(
      (item) => item.confidence >= 0.6 && sourceWasRetrieved(item.sourceUrl, research.sourceUrls),
    );

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
            ${observation.sourceTitle || "Web research"},
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
          website = COALESCE(website, NULLIF(${officialWebsite ?? ""}, '')),
          description = COALESCE(description, NULLIF(${result.businessSummary.trim()}, '')),
          industry = COALESCE(
            industry,
            CASE WHEN ${result.evidenceConfidence} >= 65
                 THEN NULLIF(${result.industry.trim()}, '') ELSE NULL END
          ),
          subindustry = COALESCE(
            subindustry,
            CASE WHEN ${result.evidenceConfidence} >= 65
                 THEN NULLIF(${result.subindustry.trim()}, '') ELSE NULL END
          ),
          service_regions = CASE
            WHEN cardinality(service_regions) = 0 AND cardinality(${result.serviceRegions}) > 0
            THEN ${result.serviceRegions} ELSE service_regions END,
          business_models = CASE
            WHEN cardinality(business_models) = 0 AND cardinality(${result.businessModels}) > 0
            THEN ${result.businessModels} ELSE business_models END,
          technologies = CASE
            WHEN cardinality(technologies) = 0 AND cardinality(${result.technologies}) > 0
            THEN ${result.technologies} ELSE technologies END,
          roles_observed = CASE
            WHEN cardinality(roles_observed) = 0 AND cardinality(${result.decisionRoles}) > 0
            THEN ${result.decisionRoles} ELSE roles_observed END,
          currently_hiring = currently_hiring OR ${verified.some((x) => x.signalType === "HIRING")},
          fast_growth = fast_growth OR ${verified.some((x) => x.signalType === "GROWTH")},
          recent_funding = recent_funding OR ${verified.some((x) => x.signalType === "FUNDING")},
          multi_location = multi_location OR ${result.serviceRegions.length > 1},
          digital_need = digital_need OR ${verified.some((x) => x.signalType === "TECHNOLOGY" || x.signalType === "OPERATIONAL_PAIN")},
          updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${user.organizationId}
      `;

      await tx`
        UPDATE web_enrichment_runs
        SET status = 'COMPLETED',
            model = ${research.model},
            source_urls = ${research.sourceUrls},
            source_count = ${research.sourceUrls.length},
            structured_result = ${JSON.stringify(result)}::text::jsonb,
            raw_response = ${JSON.stringify(research.rawResponse)}::text::jsonb,
            completed_at = NOW()
        WHERE id = ${run.id}
      `;
    });

    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research", "complete");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Web research failed.";
    await sql`
      UPDATE web_enrichment_runs
      SET status = 'FAILED', error_message = ${message.slice(0, 1000)}, completed_at = NOW()
      WHERE id = ${run.id}
    `;
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research_error", "failed");
    return NextResponse.redirect(url, 303);
  }
}
