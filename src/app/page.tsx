import Link from "next/link";
import { redirect } from "next/navigation";
import { demoOpportunities } from "@/data/demo-opportunities";
import { getCurrentUser } from "@/lib/auth/session";
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
import type { OpportunityInput } from "@/lib/domain/types";
import { db } from "@/lib/db";
import { getOnboardingState } from "@/lib/onboarding";
import {
  applyOpportunityOverride,
  createOrGetOpportunitySnapshot,
  type EffectiveOpportunity,
  type OpportunityOverride,
} from "@/lib/opportunities/service";

export const dynamic = "force-dynamic";

type PriorityRun = {
  companyId: string;
  potentialScore: number | null;
  confidenceScore: number | null;
  conservativeScore: number | null;
  upsideScore: number | null;
  salesPriorityScore: number | null;
  researchPriorityScore: number | null;
  valueOfInformationScore: number | null;
  priorityAction: string | null;
};

type TodayLifecycle = {
  companyId: string;
  stage: string;
  ownerUserId: string | null;
  ownerName: string | null;
  lastContactAt: Date | null;
  nextActionAt: Date | null;
  nextAction: string;
  watched: boolean;
  suppressed: boolean;
};

type TodayItem = OpportunityInput & {
  assessment: ReturnType<typeof assessOpportunity>;
  matchedIcpName: string | null;
  offeringReason: string | null;
  dealValueBasis: string | null;
  companyHref: string | null;
  salesPriorityScore: number | null;
  researchPriorityScore: number | null;
  potentialScore: number | null;
  confidenceScore: number | null;
  priorityAction: string | null;
  m3: EffectiveOpportunity | null;
  m4: TodayLifecycle | null;
};

type ResearchQueueItem = {
  companyId: string;
  companyName: string;
  location: string;
  potentialScore: number;
  confidenceScore: number;
  conservativeScore: number;
  upsideScore: number;
  researchPriorityScore: number;
  valueOfInformationScore: number;
  priorityAction: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    stage?: string;
    sort?: string;
    feedback?: string;
    activity?: string;
    assigned?: string;
    watchlist?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  let items: TodayItem[] = [];
  let configVersion: number | null = null;
  let storedCompanyCount = 0;
  let researchQueue: ResearchQueueItem[] = [];

  if (user) {
    const onboarding = await getOnboardingState(user.organizationId);
    if (!onboarding.complete) {
      redirect("/onboarding");
    }

    const sql = db();
    const [
      icps,
      offerings,
      links,
      companies,
      evidence,
      signals,
      priorityRuns,
      opportunityOverrides,
      lifecycleRows,
    ] = await Promise.all([
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
            description,
            primary_problems AS "primaryProblems",
            typical_customers AS "typicalCustomers",
            min_contract_value::float8 AS "minContractValue",
            avg_contract_value::float8 AS "avgContractValue",
            ideal_contract_value::float8 AS "idealContractValue",
            sales_cycle_days AS "salesCycleDays"
          FROM offerings
          WHERE organization_id = ${user.organizationId}
        `,
        sql<OfferingIcpLink[]>`
          SELECT
            oi.offering_id AS "offeringId",
            oi.icp_id AS "icpId"
          FROM offering_icps oi
          JOIN offerings o ON o.id = oi.offering_id
          WHERE o.organization_id = ${user.organizationId}
        `,
        sql<CompanyRecord[]>`
          SELECT
            id,
            display_name AS "displayName",
            website,
            domain,
            description,
            country,
            state,
            city,
            industry,
            subindustry,
            employee_count AS "employeeCount",
            employee_range AS "employeeRange",
            founded_year AS "foundedYear",
            company_type AS "companyType",
            service_regions AS "serviceRegions",
            roles_observed AS "rolesObserved",
            business_models AS "businessModels",
            technologies,
            fast_growth AS "fastGrowth",
            multi_location AS "multiLocation",
            currently_hiring AS "currentlyHiring",
            recent_funding AS "recentFunding",
            digital_need AS "digitalNeed",
            entity_type AS "entityType",
            relationship_status AS "relationshipStatus"
          FROM companies
          WHERE organization_id = ${user.organizationId}
          ORDER BY updated_at DESC
        `,
        sql<EvidenceRecord[]>`
          SELECT
            id,
            company_id AS "companyId",
            source_label AS "sourceLabel",
            observed_at AS "observedAt",
            confidence::float8 AS confidence,
            verification_status AS "verificationStatus",
            stale_after_days AS "staleAfterDays"
          FROM company_evidence
          WHERE organization_id = ${user.organizationId}
        `,
        sql<SignalRecord[]>`
          SELECT
            s.id,
            s.company_id AS "companyId",
            s.evidence_id AS "evidenceId",
            s.signal_type AS "signalType",
            s.label,
            s.summary,
            s.rationale,
            s.strength,
            s.confidence::float8 AS confidence,
            s.observed_at AS "observedAt",
            s.verification_status AS "verificationStatus",
            e.source_label AS "sourceLabel"
          FROM buying_signals s
          JOIN company_evidence e ON e.id = s.evidence_id
          WHERE s.organization_id = ${user.organizationId}
        `,
        sql<PriorityRun[]>`
          SELECT DISTINCT ON (company_id)
            company_id AS "companyId",
            potential_score AS "potentialScore",
            confidence_score AS "confidenceScore",
            conservative_score AS "conservativeScore",
            upside_score AS "upsideScore",
            sales_priority_score AS "salesPriorityScore",
            research_priority_score AS "researchPriorityScore",
            value_of_information_score AS "valueOfInformationScore",
            priority_action AS "priorityAction"
          FROM web_enrichment_runs
          WHERE organization_id = ${user.organizationId}
            AND status = 'COMPLETED'
            AND engine = 'REVENUESCOUT_INTELLIGENCE_V2'
          ORDER BY company_id, created_at DESC
        `,
        sql<OpportunityOverride[]>`
          SELECT
            company_id AS "companyId",
            priority_override AS "priorityOverride",
            conversion_probability_override::float8 AS "conversionProbabilityOverride",
            expected_deal_value_override::float8 AS "expectedDealValueOverride",
            offering_id_override AS "offeringIdOverride",
            next_best_action_override AS "nextBestActionOverride",
            note,
            updated_at AS "updatedAt"
          FROM opportunity_overrides
          WHERE organization_id = ${user.organizationId}
        `,
        sql<TodayLifecycle[]>`
          SELECT
            c.id AS "companyId",
            COALESCE(l.stage, 'DISCOVERED') AS stage,
            l.owner_user_id AS "ownerUserId",
            owner.name AS "ownerName",
            l.last_contact_at AS "lastContactAt",
            l.next_action_at AS "nextActionAt",
            COALESCE(l.next_action, '') AS "nextAction",
            (w.company_id IS NOT NULL) AS watched,
            EXISTS (
              SELECT 1
              FROM suppression_entries s
              WHERE s.organization_id = c.organization_id
                AND s.company_id = c.id
                AND s.scope = 'COMPANY'
                AND s.active = TRUE
                AND (s.expires_at IS NULL OR s.expires_at > NOW())
            ) AS suppressed
          FROM companies c
          LEFT JOIN company_sales_lifecycle l
            ON l.organization_id = c.organization_id
           AND l.company_id = c.id
          LEFT JOIN users owner ON owner.id = l.owner_user_id
          LEFT JOIN watchlist_entries w
            ON w.organization_id = c.organization_id
           AND w.company_id = c.id
          WHERE c.organization_id = ${user.organizationId}
        `,
      ]);

    storedCompanyCount = companies.length;
    const configuredItems: TodayItem[] = [];
    const salesCompanyIds = new Set<string>();
    const runByCompany = new Map(
      priorityRuns.map((run) => [run.companyId, run]),
    );
    const overrideByCompany = new Map(
      opportunityOverrides.map((override) => [override.companyId, override]),
    );
    const lifecycleByCompany = new Map(
      lifecycleRows.map((lifecycle) => [lifecycle.companyId, lifecycle]),
    );
    const suppressedCompanyIds = new Set(
      lifecycleRows
        .filter((lifecycle) => lifecycle.suppressed)
        .map((lifecycle) => lifecycle.companyId),
    );

    for (const company of companies) {
      if (suppressedCompanyIds.has(company.id)) continue;
      const companyEvidence = evidence.filter(
        (item) => item.companyId === company.id,
      );
      const companySignals = signals.filter(
        (signal) => signal.companyId === company.id,
      );
      const priorityRun = runByCompany.get(company.id) ?? null;

      const configured = buildConfiguredOpportunityFromCompany({
        company,
        evidence: companyEvidence,
        signals: companySignals,
        icps,
        offerings,
        links,
      });

      if (configured) {
        salesCompanyIds.add(company.id);
        const opportunity = configured.opportunity;
        const snapshot = await createOrGetOpportunitySnapshot({
          organizationId: user.organizationId,
          userId: user.id,
          configVersion: user.configVersion,
          company,
          evidence: companyEvidence,
          signals: companySignals,
          icps,
          offerings,
          links,
          m2SalesPriorityScore: priorityRun?.salesPriorityScore ?? null,
        });
        const m3 = snapshot
          ? applyOpportunityOverride({
              snapshot,
              override: overrideByCompany.get(company.id) ?? null,
              offerings,
            })
          : null;

        configuredItems.push({
          ...opportunity,
          assessment: assessOpportunity(opportunity),
          matchedIcpName: configured.matchedIcp.icpName,
          offeringReason: configured.offeringReason,
          dealValueBasis: configured.dealValueBasis,
          companyHref: `/companies/${company.id}`,
          salesPriorityScore: priorityRun?.salesPriorityScore ?? null,
          researchPriorityScore: priorityRun?.researchPriorityScore ?? null,
          potentialScore: priorityRun?.potentialScore ?? null,
          confidenceScore: priorityRun?.confidenceScore ?? null,
          priorityAction: priorityRun?.priorityAction ?? null,
          m3,
          m4: lifecycleByCompany.get(company.id) ?? null,
        });
      }
    }

    const companyById = new Map(companies.map((company) => [company.id, company]));

    researchQueue = priorityRuns
      .filter(
        (run) =>
          run.researchPriorityScore !== null &&
          run.potentialScore !== null &&
          run.confidenceScore !== null &&
          run.conservativeScore !== null &&
          run.upsideScore !== null &&
          run.valueOfInformationScore !== null &&
          run.priorityAction !== "REJECT" &&
          !suppressedCompanyIds.has(run.companyId) &&
          (run.priorityAction === "INVESTIGATE_URGENTLY" ||
            run.priorityAction === "GATHER_MORE_DATA" ||
            (run.researchPriorityScore ?? 0) > (run.salesPriorityScore ?? 0) ||
            !salesCompanyIds.has(run.companyId)),
      )
      .map((run) => {
        const company = companyById.get(run.companyId);
        return {
          companyId: run.companyId,
          companyName: company?.displayName ?? "Unknown company",
          location: [company?.city, company?.state, company?.country]
            .filter(Boolean)
            .join(", "),
          potentialScore: run.potentialScore ?? 0,
          confidenceScore: run.confidenceScore ?? 0,
          conservativeScore: run.conservativeScore ?? 0,
          upsideScore: run.upsideScore ?? 0,
          researchPriorityScore: run.researchPriorityScore ?? 0,
          valueOfInformationScore: run.valueOfInformationScore ?? 0,
          priorityAction: run.priorityAction ?? "GATHER_MORE_DATA",
        };
      })
      .sort(
        (a, b) =>
          b.researchPriorityScore - a.researchPriorityScore ||
          b.valueOfInformationScore - a.valueOfInformationScore,
      );

    items = configuredItems;
    configVersion = user.configVersion;
  } else {
    items = demoOpportunities.map(({ facts: _facts, ...opportunity }) => ({
      ...opportunity,
      assessment: assessOpportunity(opportunity),
      matchedIcpName: null,
      offeringReason: null,
      dealValueBasis: null,
      companyHref: null,
      salesPriorityScore: null,
      researchPriorityScore: null,
      potentialScore: null,
      confidenceScore: null,
      priorityAction: null,
      m3: null,
      m4: null,
    }));
  }

  function overrideOrder(item: TodayItem): number {
    const priority = item.m3?.override?.priorityOverride ?? "AUTO";
    if (priority === "HIGH") return 5;
    if (priority === "MEDIUM") return 4;
    if (priority === "AUTO") return 3;
    if (priority === "LOW") return 2;
    return 1;
  }

  const allOpportunityItems = [...items];
  const now = new Date();

  if (user) {
    if (params.view === "mine") {
      items = items.filter((item) => item.m4?.ownerUserId === user.id);
    } else if (params.view === "due") {
      items = items.filter(
        (item) =>
          item.m4?.nextActionAt &&
          new Date(item.m4.nextActionAt).getTime() <= now.getTime(),
      );
    } else if (params.view === "unassigned") {
      items = items.filter((item) => !item.m4?.ownerUserId);
    } else if (params.view === "watchlist") {
      items = items.filter((item) => item.m4?.watched);
    }

    if (params.stage) {
      items = items.filter(
        (item) => (item.m4?.stage ?? "DISCOVERED") === params.stage,
      );
    }
  }

  const sortMode = params.sort ?? "priority";
  items.sort((a, b) => {
    if (sortMode === "revenue") {
      return (
        (b.m3?.effectiveExpectedRevenue ?? b.assessment.expectedRevenue) -
        (a.m3?.effectiveExpectedRevenue ?? a.assessment.expectedRevenue)
      );
    }
    if (sortMode === "score") {
      return b.assessment.opportunityScore - a.assessment.opportunityScore;
    }
    if (sortMode === "probability") {
      return (
        (b.m3?.effectiveConversionProbability ?? b.conversionProbability) -
        (a.m3?.effectiveConversionProbability ?? a.conversionProbability)
      );
    }
    if (sortMode === "next") {
      return (
        (a.m4?.nextActionAt
          ? new Date(a.m4.nextActionAt).getTime()
          : Number.MAX_SAFE_INTEGER) -
        (b.m4?.nextActionAt
          ? new Date(b.m4.nextActionAt).getTime()
          : Number.MAX_SAFE_INTEGER)
      );
    }

    return (
      overrideOrder(b) - overrideOrder(a) ||
      (b.m3?.effectiveRankScore ?? -1) - (a.m3?.effectiveRankScore ?? -1) ||
      (b.salesPriorityScore ?? -1) - (a.salesPriorityScore ?? -1) ||
      b.assessment.opportunityScore - a.assessment.opportunityScore
    );
  });

  const expectedRevenue = items.reduce(
    (sum, item) =>
      sum + (item.m3?.effectiveExpectedRevenue ?? item.assessment.expectedRevenue),
    0,
  );

  const dueActionCount = allOpportunityItems.filter(
    (item) =>
      item.m4?.nextActionAt &&
      new Date(item.m4.nextActionAt).getTime() <= now.getTime(),
  ).length;
  const watchCount = allOpportunityItems.filter((item) => item.m4?.watched).length;
  const unassignedCount = allOpportunityItems.filter(
    (item) => !item.m4?.ownerUserId,
  ).length;
  const stageOptions = [
    ...new Set(
      allOpportunityItems.map((item) => item.m4?.stage ?? "DISCOVERED"),
    ),
  ].sort();

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">RevenueScout</div>
          <h1>Today</h1>
          <p className="lede">
            The opportunities most worth your sales time right now.
          </p>
        </div>
        <div className="top-actions">
          {user ? (
            <>
              <Link className="status-pill" href="/discover">Discover</Link>
              <Link className="status-pill" href="/companies">Search</Link>
              <Link className="status-pill" href="/watchlist">Watchlist</Link>
              <Link className="status-pill" href="/analytics">Analytics</Link>
              <Link className="status-pill" href="/compliance">Compliance</Link>
              <Link className="status-pill" href="/setup">Market Setup</Link>
              <Link className="status-pill" href="/workspace">Workspace</Link>
              <div className="status-pill">Config v{configVersion}</div>
            </>
          ) : (
            <>
              <Link className="status-pill" href="/login">Sign in</Link>
              <Link className="status-pill" href="/register">Create workspace</Link>
              <div className="status-pill">Demo mode</div>
            </>
          )}
        </div>
      </header>

      {params.feedback ? (
        <div className="success-banner">Recommendation feedback recorded.</div>
      ) : null}
      {params.activity ? (
        <div className="success-banner">Sales activity recorded.</div>
      ) : null}
      {params.assigned ? (
        <div className="success-banner">Opportunity assigned to you.</div>
      ) : null}
      {params.watchlist ? (
        <div className="success-banner">Watchlist updated.</div>
      ) : null}

      <section className="summary-grid m5-summary-grid" aria-label="Today summary">
        <article className="summary-card">
          <span>Visible opportunities</span>
          <strong>{items.length}</strong>
        </article>
        <article className="summary-card">
          <span>Expected revenue</span>
          <strong>{money(expectedRevenue)}</strong>
        </article>
        <article className="summary-card">
          <span>Due actions</span>
          <strong>{dueActionCount}</strong>
        </article>
        <article className="summary-card">
          <span>Watchlist</span>
          <strong>{watchCount}</strong>
        </article>
        <article className="summary-card">
          <span>Unassigned</span>
          <strong>{unassignedCount}</strong>
        </article>
        <article className="summary-card">
          <span>Research candidates</span>
          <strong>{researchQueue.length}</strong>
        </article>
      </section>

      {user ? (
        <section className="m5-today-toolbar">
          <div className="m5-view-links">
            <Link className={params.view ? "" : "active"} href="/">All</Link>
            <Link className={params.view === "mine" ? "active" : ""} href="/?view=mine">Mine</Link>
            <Link className={params.view === "due" ? "active" : ""} href="/?view=due">Due</Link>
            <Link className={params.view === "unassigned" ? "active" : ""} href="/?view=unassigned">Unassigned</Link>
            <Link className={params.view === "watchlist" ? "active" : ""} href="/?view=watchlist">Watchlist</Link>
          </div>
          <form className="m5-today-filters" method="get">
            {params.view ? <input type="hidden" name="view" value={params.view} /> : null}
            <select name="stage" defaultValue={params.stage ?? ""}>
              <option value="">Any stage</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage
                    .toLowerCase()
                    .split("_")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
            <select name="sort" defaultValue={sortMode}>
              <option value="priority">Best opportunity</option>
              <option value="revenue">Expected revenue</option>
              <option value="probability">Conversion probability</option>
              <option value="score">Opportunity score</option>
              <option value="next">Next action date</option>
            </select>
            <button className="secondary-button" type="submit">Apply</button>
          </form>
        </section>
      ) : null}

      <section className="section-heading">
        <div>
          <div className="eyebrow">Sales priority</div>
          <h2>Who is most worth contacting now?</h2>
        </div>
        <p>
          {user
            ? `Ranked from ${storedCompanyCount} persisted company records using M3 Expected Revenue, sales effort, confidence, M2 Sales Priority and any explicit human priority override.`
            : "This is synthetic demo data. Sign in to use persisted companies and traceable evidence."}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="empty-state">
          <h3>
            {user && storedCompanyCount === 0
              ? "No companies have been added yet."
              : "No stored company currently passes your ICP rules."}
          </h3>
          <p>
            {user && storedCompanyCount === 0
              ? "Discover a real legal entity or add a known company manually. RevenueScout will not manufacture companies just to populate Today."
              : "A company may need industry/headcount enrichment, may fail a qualification gate, or may be suppressed by a hard exclusion."}
          </p>
          {user ? (
            <div className="empty-actions">
              <Link className="primary-link" href="/discover">Discover companies</Link>
              <Link className="secondary-link" href="/companies">Open company database</Link>
            </div>
          ) : (
            <Link className="primary-link" href="/login">Sign in</Link>
          )}
        </section>
      ) : (
        <section className="opportunity-list">
          {items.map((opportunity, index) => (
            <article className="opportunity-card" key={opportunity.id}>
              <div className="rank">{index + 1}</div>

              <div className="company-column">
                <div className="company-title-row">
                  <div>
                    <h3>
                      {opportunity.companyHref ? (
                        <Link href={opportunity.companyHref}>
                          {opportunity.companyName}
                        </Link>
                      ) : (
                        opportunity.companyName
                      )}
                    </h3>
                    <p>
                      {opportunity.industry} · {opportunity.location || "Location unknown"} ·{" "}
                      {opportunity.employeeRange} employees
                    </p>
                  </div>
                  <span className="confidence">
                    {opportunity.m3
                      ? `${opportunity.m3.conversionConfidence.toLowerCase()} conversion confidence`
                      : `${opportunity.assessment.confidenceLabel} confidence`}
                    {opportunity.m3?.hasHumanOverride ? " · human override" : ""}
                  </span>
                </div>

                {opportunity.matchedIcpName ? (
                  <div className="decision-context">
                    <span>Matched ICP: <strong>{opportunity.matchedIcpName}</strong></span>
                    <span>Deal basis: <strong>{opportunity.dealValueBasis}</strong></span>
                  </div>
                ) : null}

                {opportunity.m4 ? (
                  <div className="decision-context m4-today-context">
                    <span>
                      Stage:{" "}
                      <strong>
                        {opportunity.m4.stage
                          .toLowerCase()
                          .split("_")
                          .map(
                            (part) =>
                              part.charAt(0).toUpperCase() + part.slice(1),
                          )
                          .join(" ")}
                      </strong>
                    </span>
                    <span>
                      Owner:{" "}
                      <strong>{opportunity.m4.ownerName ?? "Unassigned"}</strong>
                    </span>
                    <span>
                      Last contact:{" "}
                      <strong>
                        {opportunity.m4.lastContactAt
                          ? new Date(
                              opportunity.m4.lastContactAt,
                            ).toLocaleDateString("en-AU")
                          : "None"}
                      </strong>
                    </span>
                  </div>
                ) : null}

                <div className="explanation-grid">
                  <div>
                    <span className="field-label">Why this company</span>
                    <p>{opportunity.whyThisCompany}</p>
                  </div>
                  <div>
                    <span className="field-label">Why now</span>
                    <p>{opportunity.whyNow}</p>
                  </div>
                  <div>
                    <span className="field-label">Problem hypothesis</span>
                    <p>{opportunity.problemHypothesis}</p>
                  </div>
                  <div>
                    <span className="field-label">Recommended Offering</span>
                    <p>
                      {opportunity.m3?.effectiveOfferingName ??
                        opportunity.recommendedOffering}
                    </p>
                    {opportunity.m3?.effectiveOfferingReason ||
                    opportunity.offeringReason ? (
                      <small className="reason-note">
                        {opportunity.m3?.effectiveOfferingReason ??
                          opportunity.offeringReason}
                      </small>
                    ) : null}
                  </div>
                </div>

                <div className="signal-row">
                  {opportunity.signals.length === 0 ? (
                    <span className="signal-chip signal-empty">No current buying signal</span>
                  ) : (
                    opportunity.signals.map((signal) => (
                      <span className="signal-chip" key={signal.id}>
                        {signal.type.replaceAll("_", " ")} · {signal.label}
                      </span>
                    ))
                  )}
                </div>

                <div className="next-action">
                  <span className="field-label">Next best action</span>
                  <strong>
                    {opportunity.m3?.effectiveNextBestAction ??
                      opportunity.nextBestAction}
                  </strong>
                  <span>Best person: {opportunity.recommendedContact}</span>
                </div>

                {user ? (
                  <div className="m5-card-action-area">
                    <div className="m5-card-actions">
                      {opportunity.m4?.ownerUserId !== user.id ? (
                        <form
                          action={`/api/companies/${opportunity.id}/assign-self`}
                          method="post"
                        >
                          <input type="hidden" name="returnTo" value="/" />
                          <button className="text-button" type="submit">
                            Assign to me
                          </button>
                        </form>
                      ) : (
                        <span className="m5-inline-state">Mine</span>
                      )}
                      <form
                        action={`/api/companies/${opportunity.id}/watchlist`}
                        method="post"
                      >
                        <input
                          type="hidden"
                          name="action"
                          value={opportunity.m4?.watched ? "remove" : "add"}
                        />
                        <input type="hidden" name="returnTo" value="/" />
                        <button className="text-button" type="submit">
                          {opportunity.m4?.watched ? "Stop watching" : "Watch"}
                        </button>
                      </form>
                    </div>
                    <div className="m5-feedback-row">
                    <form action="/api/feedback" method="post">
                      <input type="hidden" name="companyId" value={opportunity.id} />
                      <input type="hidden" name="useful" value="true" />
                      <input type="hidden" name="returnTo" value="/" />
                      <button className="text-button" type="submit">
                        👍 Useful
                      </button>
                    </form>
                    <details>
                      <summary>👎 Not useful</summary>
                      <form className="m5-feedback-form" action="/api/feedback" method="post">
                        <input type="hidden" name="companyId" value={opportunity.id} />
                        <input type="hidden" name="useful" value="false" />
                        <input type="hidden" name="returnTo" value="/" />
                        <select name="reason" defaultValue="WRONG_TIMING" required>
                          <option value="WRONG_COMPANY">Wrong company</option>
                          <option value="WRONG_TIMING">Wrong timing</option>
                          <option value="WRONG_SIGNAL">Wrong signal</option>
                          <option value="WRONG_OFFERING">Wrong Offering</option>
                          <option value="TOO_SMALL">Too small</option>
                          <option value="TOO_LARGE">Too large</option>
                          <option value="ALREADY_CONTACTED">Already contacted</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <button className="secondary-button" type="submit">
                          Submit
                        </button>
                      </form>
                    </details>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="score-column">
                {opportunity.salesPriorityScore !== null ? (
                  <>
                    <div className="score-block">
                      <span>Sales Priority</span>
                      <strong>{opportunity.salesPriorityScore}</strong>
                      <small>/100</small>
                    </div>
                    <div className="research-priority-mini">
                      <span>
                        Potential <strong>{opportunity.potentialScore}</strong>
                      </span>
                      <span>
                        Confidence <strong>{opportunity.confidenceScore}</strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="score-block">
                    <span>Opportunity Score</span>
                    <strong>{opportunity.assessment.opportunityScore}</strong>
                    <small>/100</small>
                  </div>
                )}

                <div className="revenue-block">
                  <span>Expected Revenue</span>
                  <strong>
                    {money(
                      opportunity.m3?.effectiveExpectedRevenue ??
                        opportunity.assessment.expectedRevenue,
                    )}
                  </strong>
                  <small>
                    {opportunity.m3
                      ? `${Math.round(opportunity.m3.effectiveConversionProbability * 1000) / 10}% × ${money(opportunity.m3.effectiveDealValue)}`
                      : `${Math.round(opportunity.conversionProbability * 100)}% × ${money(opportunity.expectedDealValue)}`}
                  </small>
                  {opportunity.m3 ? (
                    <>
                      <small>
                        Revenue range {money(opportunity.m3.expectedRevenueLow)}–
                        {money(opportunity.m3.expectedRevenueHigh)}
                      </small>
                      <small>
                        Deal range {money(opportunity.m3.dealValueLow)}–
                        {money(opportunity.m3.dealValueHigh)} ·{" "}
                        {opportunity.m3.salesEffort.toLowerCase()} sales effort
                      </small>
                    </>
                  ) : null}
                </div>

                <details>
                  <summary>Why this score?</summary>
                  <dl className="score-breakdown">
                    {Object.entries(opportunity.assessment.scoreBreakdown).map(
                      ([label, score]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{Math.round(score)}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                </details>
              </aside>
            </article>
          ))}
        </section>
      )}

      {user ? (
        <>
          <section className="section-heading research-queue-heading">
            <div>
              <div className="eyebrow">Research priority</div>
              <h2>Which uncertain companies are most worth investigating?</h2>
            </div>
            <p>
              Missing data is not treated as negative. This queue ranks
              companies by plausible upside and Value of Information, so a
              potentially excellent customer is not buried just because public
              evidence is incomplete.
            </p>
          </section>

          {researchQueue.length === 0 ? (
            <section className="empty-state compact-empty-state">
              <h3>No high-value research target right now.</h3>
              <p>
                Companies appear here when uncertainty is material and further
                evidence could meaningfully change the sales decision.
              </p>
            </section>
          ) : (
            <section className="research-priority-list">
              {researchQueue.map((item, index) => (
                <article className="research-priority-card" key={item.companyId}>
                  <div className="rank">{index + 1}</div>
                  <div className="research-priority-main">
                    <div className="company-title-row">
                      <div>
                        <h3>
                          <Link href={`/companies/${item.companyId}`}>
                            {item.companyName}
                          </Link>
                        </h3>
                        <p>{item.location || "Location unknown"}</p>
                      </div>
                      <span className="confidence">
                        {item.priorityAction.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="research-metric-grid">
                      <div>
                        <span>Potential</span>
                        <strong>{item.potentialScore}</strong>
                      </div>
                      <div>
                        <span>Confidence</span>
                        <strong>{item.confidenceScore}</strong>
                      </div>
                      <div>
                        <span>Potential range</span>
                        <strong>
                          {item.conservativeScore}–{item.upsideScore}
                        </strong>
                      </div>
                      <div>
                        <span>Research Priority</span>
                        <strong>{item.researchPriorityScore}</strong>
                      </div>
                      <div>
                        <span>Value of Information</span>
                        <strong>{item.valueOfInformationScore}</strong>
                      </div>
                    </div>

                    <div className="next-action">
                      <span className="field-label">Next best action</span>
                      <strong>Open the company and resolve the highest-value unknown claim.</strong>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      ) : null}

      <footer className="disclaimer">
        {user
          ? "Today combines M2 evidence intelligence with persisted M3 revenue opportunities. Missing data stays unknown, conversion estimates remain explicitly pre-calibration until real Won/Lost outcomes exist, and human overrides remain separate from the model snapshot."
          : "Demo mode uses synthetic fixtures only. No demo company should be interpreted as a real discovered business."}
      </footer>
    </main>
  );
}
