import Link from "next/link";
import { redirect } from "next/navigation";
import { demoOpportunities } from "@/data/demo-opportunities";
import { getCurrentUser } from "@/lib/auth/session";
import {
  configureOpportunity,
  type IcpRule,
  type OfferingConfig,
  type OfferingIcpLink,
} from "@/lib/domain/configured-opportunity";
import { assessOpportunity } from "@/lib/domain/opportunity-score";
import type { OpportunityInput } from "@/lib/domain/types";
import { db } from "@/lib/db";
import { getOnboardingState } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

type TodayItem = OpportunityInput & {
  assessment: ReturnType<typeof assessOpportunity>;
  matchedIcpName: string | null;
  offeringReason: string | null;
  dealValueBasis: string | null;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function Home() {
  const user = await getCurrentUser();
  let items: TodayItem[] = [];
  let configVersion: number | null = null;

  if (user) {
    const onboarding = await getOnboardingState(user.organizationId);
    if (!onboarding.complete) {
      redirect("/onboarding");
    }

    const sql = db();
    const icps = await sql<IcpRule[]>`
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
    `;

    const offerings = await sql<OfferingConfig[]>`
      SELECT
        id,
        name,
        min_contract_value::float8 AS "minContractValue",
        avg_contract_value::float8 AS "avgContractValue",
        ideal_contract_value::float8 AS "idealContractValue"
      FROM offerings
      WHERE organization_id = ${user.organizationId}
    `;

    const links = await sql<OfferingIcpLink[]>`
      SELECT
        oi.offering_id AS "offeringId",
        oi.icp_id AS "icpId"
      FROM offering_icps oi
      JOIN offerings o ON o.id = oi.offering_id
      WHERE o.organization_id = ${user.organizationId}
    `;

    const configuredItems: TodayItem[] = [];

    for (const demo of demoOpportunities) {
      const configured = configureOpportunity(
        demo,
        demo.facts,
        icps,
        offerings,
        links,
      );

      if (!configured) continue;

      const opportunity = configured.opportunity;
      configuredItems.push({
        ...opportunity,
        assessment: assessOpportunity(opportunity),
        matchedIcpName: configured.matchedIcp.icpName,
        offeringReason: configured.offeringReason,
        dealValueBasis: configured.dealValueBasis,
      });
    }

    items = configuredItems;
    configVersion = user.configVersion;
  } else {
    items = demoOpportunities.map(({ facts: _facts, ...opportunity }) => ({
      ...opportunity,
      assessment: assessOpportunity(opportunity),
      matchedIcpName: null,
      offeringReason: null,
      dealValueBasis: null,
    }));
  }

  items.sort(
    (a, b) =>
      b.assessment.expectedRevenue - a.assessment.expectedRevenue ||
      b.assessment.opportunityScore - a.assessment.opportunityScore,
  );

  const expectedRevenue = items.reduce(
    (sum, item) => sum + item.assessment.expectedRevenue,
    0,
  );

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
              <Link className="status-pill" href="/setup">Market Setup</Link>
              <Link className="status-pill" href="/workspace">Workspace</Link>
              <div className="status-pill">Config v{configVersion}</div>
            </>
          ) : (
            <>
              <Link className="status-pill" href="/register">Create workspace</Link>
              <div className="status-pill">Demo mode</div>
            </>
          )}
        </div>
      </header>

      <section className="summary-grid" aria-label="Today summary">
        <article className="summary-card">
          <span>Recommended opportunities</span>
          <strong>{items.length}</strong>
        </article>
        <article className="summary-card">
          <span>Expected revenue</span>
          <strong>{money(expectedRevenue)}</strong>
        </article>
        <article className="summary-card">
          <span>Strongest signal</span>
          <strong>{items[0]?.assessment.primarySignal?.type ?? "—"}</strong>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <div className="eyebrow">Priority queue</div>
          <h2>Today&apos;s Best Opportunities</h2>
        </div>
        <p>
          {user
            ? "Ranked using your current ICP and Offering configuration. Core ICP qualification gates and hard exclusions are applied before scoring and ranking."
            : "Demo data shows the decision surface. Create a workspace to make ICP Fit and deal value respond to your own configuration."}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="empty-state">
          <h3>No current candidate passes your ICP rules.</h3>
          <p>
            That is a valid result: RevenueScout does not recommend excluded or
            non-matching companies merely to fill the queue.
          </p>
          <Link className="primary-link" href="/setup">Review Market Setup</Link>
        </section>
      ) : (
        <section className="opportunity-list">
          {items.map((opportunity, index) => (
            <article className="opportunity-card" key={opportunity.id}>
              <div className="rank">{index + 1}</div>

              <div className="company-column">
                <div className="company-title-row">
                  <div>
                    <h3>{opportunity.companyName}</h3>
                    <p>
                      {opportunity.industry} · {opportunity.location} ·{" "}
                      {opportunity.employeeRange} employees
                    </p>
                  </div>
                  <span className="confidence">
                    {opportunity.assessment.confidenceLabel} confidence
                  </span>
                </div>

                {opportunity.matchedIcpName ? (
                  <div className="decision-context">
                    <span>Matched ICP: <strong>{opportunity.matchedIcpName}</strong></span>
                    <span>Deal basis: <strong>{opportunity.dealValueBasis}</strong></span>
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
                    <p>{opportunity.recommendedOffering}</p>
                    {opportunity.offeringReason ? (
                      <small className="reason-note">{opportunity.offeringReason}</small>
                    ) : null}
                  </div>
                </div>

                <div className="signal-row">
                  {opportunity.signals.map((signal) => (
                    <span className="signal-chip" key={signal.id}>
                      {signal.type.replaceAll("_", " ")} · {signal.label}
                    </span>
                  ))}
                </div>

                <div className="next-action">
                  <span className="field-label">Next best action</span>
                  <strong>{opportunity.nextBestAction}</strong>
                  <span>Best person: {opportunity.recommendedContact}</span>
                </div>
              </div>

              <aside className="score-column">
                <div className="score-block">
                  <span>Opportunity Score</span>
                  <strong>{opportunity.assessment.opportunityScore}</strong>
                  <small>/100</small>
                </div>

                <div className="revenue-block">
                  <span>Expected Revenue</span>
                  <strong>{money(opportunity.assessment.expectedRevenue)}</strong>
                  <small>
                    {Math.round(opportunity.conversionProbability * 100)}% ×{" "}
                    {money(opportunity.expectedDealValue)}
                  </small>
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

      <footer className="disclaimer">
        Buying-signal and candidate-company records on this M1 screen are still
        synthetic test fixtures. When signed in, ICP Fit, exclusions,
        Recommended Offering and deal value are calculated from your saved
        configuration. Real company discovery begins in M2.
      </footer>
    </main>
  );
}
