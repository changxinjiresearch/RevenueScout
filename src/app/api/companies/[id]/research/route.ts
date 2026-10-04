import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";
import {
  RESEARCH_PROMPT_VERSION,
  type CompanyResearchContext,
} from "@/lib/enrichment/prompt";
import {
  runCompanyWebResearch,
  sourceWasRetrieved,
} from "@/lib/enrichment/research-agent";
import { weightedCommercialScore } from "@/lib/enrichment/score";
import { preContactLikelihood } from "@/lib/enrichment/likelihood";

type CompanyRow = {
  id: string;
  displayName: string;
  legalName: string | null;
  website: string | null;
  domain: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  legalEntityCategory: string | null;
  entityStatus: string | null;
};

type SellerRow = {
  name: string;
  description: string | null;
  website: string | null;
};

function safeWebsite(
  candidate: string,
  sourceUrls: string[],
): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return sourceWasRetrieved(url.toString(), sourceUrls)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function statusFor(
  score: number,
  confidence: number,
  sources: number,
): "HIGH_POTENTIAL" | "MEDIUM_POTENTIAL" | "LOW_POTENTIAL" | "NEEDS_MORE_DATA" {
  if (confidence < 45 || sources < 2) return "NEEDS_MORE_DATA";
  if (score >= 75) return "HIGH_POTENTIAL";
  if (score >= 55) return "MEDIUM_POTENTIAL";
  return "LOW_POTENTIAL";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research_error", "not_configured");
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  const [company] = await sql<CompanyRow[]>\`
    SELECT
      id,
      display_name AS "displayName",
      legal_name AS "legalName",
      website,
      domain,
      country,
      state,
      city,
      address,
      legal_entity_category AS "legalEntityCategory",
      entity_status AS "entityStatus"
    FROM companies
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  \`;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const [seller] = await sql<SellerRow[]>\`
    SELECT name, description, website
    FROM organizations
    WHERE id = ${user.organizationId}
    LIMIT 1
  \`;

  const [leiRow] = await sql<{ identifierValue: string }[]>\`
    SELECT identifier_value AS "identifierValue"
    FROM company_identifiers
    WHERE company_id = ${id}
      AND identifier_type = 'LEI'
    LIMIT 1
  \`;

  const [icps, offerings] = await Promise.all([
    sql\`
      SELECT
        name,
        countries,
        states,
        industries,
        subindustries,
        employee_min AS "employeeMin",
        employee_max AS "employeeMax",
        company_types AS "companyTypes",
        fast_growth AS "fastGrowth",
        multi_location AS "multiLocation",
        hiring,
        recent_funding AS "recentFunding",
        required_roles AS "requiredRoles",
        business_models AS "businessModels",
        technologies,
        digital_need AS "digitalNeed"
      FROM icps
      WHERE organization_id = ${user.organizationId}
    \`,
    sql\`
      SELECT
        name,
        description,
        primary_problems AS "primaryProblems",
        typical_customers AS "typicalCustomers",
        min_contract_value::float8 AS "minContractValue",
        avg_contract_value::float8 AS "avgContractValue",
        ideal_contract_value::float8 AS "idealContractValue"
      FROM offerings
      WHERE organization_id = ${user.organizationId}
    \`,
  ]);

  const researchContext: CompanyResearchContext = {
    company: {
      displayName: company.displayName,
      legalName: company.legalName,
      website: company.website,
      domain: company.domain,
      country: company.country,
      state: company.state,
      city: company.city,
      address: company.address,
      legalEntityCategory: company.legalEntityCategory,
      entityStatus: company.entityStatus,
      lei: leiRow?.identifierValue ?? null,
    },
    seller: {
      name: seller?.name ?? "RevenueScout workspace",
      description: seller?.description ?? null,
      website: seller?.website ?? null,
    },
    icps: [...icps],
    offerings: [...offerings],
  };

  const initialModel =
    process.env.OPENAI_ENRICHMENT_MODEL?.trim() || "gpt-6-luna";

  const [run] = await sql<{ id: string }[]>\`
    INSERT INTO company_research_runs (
      organization_id,
      company_id,
      status,
      provider,
      model,
      prompt_version,
      request_context,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${id},
      'RUNNING',
      'OPENAI',
      ${initialModel},
      ${RESEARCH_PROMPT_VERSION},
      ${JSON.stringify(researchContext)}::text::jsonb,
      ${user.id}
    )
    RETURNING id
  \`;

  try {
    const research = await runCompanyWebResearch(researchContext);
    const result = research.result;
    const potentialScore = weightedCommercialScore({
      fit: result.commercialFitScore,
      intent: result.buyingIntentScore,
      budget: result.budgetFitScore,
      timing: result.timingScore,
      need: result.needScore,
    });
    const likelihood = preContactLikelihood(
      potentialScore,
      result.evidenceConfidence,
    );
    const recommendation = statusFor(
      potentialScore,
      result.evidenceConfidence,
      research.sourceUrls.length,
    );
    const officialWebsite = safeWebsite(
      result.officialWebsite,
      research.sourceUrls,
    );

    const observedSignals = result.observations.filter(
      (item) =>
        item.signalType !== "NONE" &&
        item.confidence >= 0.6 &&
        sourceWasRetrieved(item.sourceUrl, research.sourceUrls),
    );

    await sql.begin(async (tx) => {
      await tx\`
        UPDATE companies
        SET
          website = COALESCE(website, ${officialWebsite}),
          domain = COALESCE(
            domain,
            ${officialWebsite
              ? new URL(officialWebsite).hostname.replace(/^www\./, "")
              : null}
          ),
          description = COALESCE(
            description,
            NULLIF(${result.businessSummary.trim()}, '')
          ),
          industry = COALESCE(
            industry,
            CASE
              WHEN ${result.evidenceConfidence} >= 65
              THEN NULLIF(${result.industry.trim()}, '')
              ELSE NULL
            END
          ),
          subindustry = COALESCE(
            subindustry,
            CASE
              WHEN ${result.evidenceConfidence} >= 65
              THEN NULLIF(${result.subindustry.trim()}, '')
              ELSE NULL
            END
          ),
          service_regions = CASE
            WHEN cardinality(service_regions) = 0
              AND cardinality(${result.serviceRegions}) > 0
            THEN ${result.serviceRegions}
            ELSE service_regions
          END,
          business_models = CASE
            WHEN cardinality(business_models) = 0
              AND cardinality(${result.businessModels}) > 0
            THEN ${result.businessModels}
            ELSE business_models
          END,
          technologies = CASE
            WHEN cardinality(technologies) = 0
              AND cardinality(${result.technologies}) > 0
            THEN ${result.technologies}
            ELSE technologies
          END,
          roles_observed = CASE
            WHEN cardinality(roles_observed) = 0
              AND cardinality(${result.decisionRoles}) > 0
            THEN ${result.decisionRoles}
            ELSE roles_observed
          END,
          currently_hiring =
            currently_hiring OR ${observedSignals.some((item) => item.signalType === "HIRING")},
          fast_growth =
            fast_growth OR ${observedSignals.some((item) => item.signalType === "GROWTH")},
          recent_funding =
            recent_funding OR ${observedSignals.some((item) => item.signalType === "FUNDING")},
          multi_location =
            multi_location OR ${result.serviceRegions.length > 1},
          digital_need =
            digital_need OR ${observedSignals.some(
              (item) =>
                item.signalType === "TECHNOLOGY" ||
                item.signalType === "OPERATIONAL_PAIN",
            )},
          updated_at = NOW()
        WHERE id = ${id}
          AND organization_id = ${user.organizationId}
      \`;

      await tx\`
        UPDATE company_research_runs
        SET
          status = 'COMPLETED',
          model = ${research.model},
          source_urls = ${research.sourceUrls},
          source_count = ${research.sourceUrls.length},
          official_website = ${officialWebsite},
          business_summary = ${result.businessSummary},
          researched_industry = NULLIF(${result.industry}, ''),
          researched_subindustry = NULLIF(${result.subindustry}, ''),
          employee_low =
            CASE WHEN ${result.employeeLow} >= 0 THEN ${result.employeeLow} ELSE NULL END,
          employee_high =
            CASE WHEN ${result.employeeHigh} >= 0 THEN ${result.employeeHigh} ELSE NULL END,
          employee_confidence = ${result.employeeConfidence},
          researched_service_regions = ${result.serviceRegions},
          researched_business_models = ${result.businessModels},
          researched_technologies = ${result.technologies},
          researched_roles = ${result.decisionRoles},
          commercial_fit_score = ${result.commercialFitScore},
          buying_intent_score = ${result.buyingIntentScore},
          budget_fit_score = ${result.budgetFitScore},
          timing_score = ${result.timingScore},
          need_score = ${result.needScore},
          evidence_confidence = ${result.evidenceConfidence},
          potential_score = ${potentialScore},
          conversion_likelihood = ${likelihood / 100},
          recommendation = ${recommendation},
          assessment_summary = ${result.assessmentSummary},
          why_fit = ${result.whyFit},
          why_now = ${result.whyNow},
          risks = ${result.risks},
          recommended_contact_role = ${result.recommendedContactRole},
          next_action = ${result.nextAction},
          structured_result = ${JSON.stringify(result)}::text::jsonb,
          raw_response = ${JSON.stringify(research.rawResponse)}::text::jsonb,
          completed_at = NOW()
        WHERE id = ${run.id}
      \`;
    });

    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research", "complete");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI web research failed.";

    await sql\`
      UPDATE company_research_runs
      SET
        status = 'FAILED',
        error_message = ${message.slice(0, 1000)},
        completed_at = NOW()
      WHERE id = ${run.id}
    \`;

    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("research_error", "failed");
    return NextResponse.redirect(url, 303);
  }
}
