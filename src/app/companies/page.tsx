import Link from "next/link";
import { CompanyFields } from "@/components/company-fields";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CompanyListItem = {
  id: string;
  displayName: string;
  legalName: string | null;
  website: string | null;
  domain: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  relationshipStatus: string;
  sourceOrigin: string;
  evidenceCount: number;
  signalCount: number;
  stage: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  lastContactAt: Date | null;
  opportunityScore: number | null;
  expectedRevenue: number | null;
  conversionProbability: number | null;
  dealValueExpected: number | null;
  matchedIcpName: string | null;
  offeringName: string | null;
  latestSignalAt: Date | null;
  signalTypes: string[];
  watched: boolean;
  suppressed: boolean;
  searchText: string;
  updatedAt: Date;
};

type SearchParams = {
  q?: string;
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  stage?: string;
  owner?: string;
  signal?: string;
  icp?: string;
  offering?: string;
  watchlist?: string;
  scoreMin?: string;
  revenueMin?: string;
  employeeMin?: string;
  employeeMax?: string;
  lastContact?: string;
  lastSignal?: string;
  sort?: string;
  error?: string;
  watchlist_status?: string;
};

function money(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function label(value: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function n(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const allCompanies = await sql<CompanyListItem[]>`
    SELECT
      c.id,
      c.display_name AS "displayName",
      c.legal_name AS "legalName",
      c.website,
      c.domain,
      c.country,
      c.state,
      c.city,
      c.industry,
      c.employee_count AS "employeeCount",
      c.employee_range AS "employeeRange",
      c.relationship_status AS "relationshipStatus",
      c.source_origin AS "sourceOrigin",
      COALESCE(ev."evidenceCount", 0)::int AS "evidenceCount",
      COALESCE(sig."signalCount", 0)::int AS "signalCount",
      l.stage,
      l.owner_user_id AS "ownerUserId",
      owner.name AS "ownerName",
      l.last_contact_at AS "lastContactAt",
      opp.opportunity_score AS "opportunityScore",
      opp.expected_revenue::float8 AS "expectedRevenue",
      opp.conversion_probability::float8 AS "conversionProbability",
      opp.deal_value_expected::float8 AS "dealValueExpected",
      opp.matched_icp_name AS "matchedIcpName",
      opp.offering_name AS "offeringName",
      sig."latestSignalAt",
      COALESCE(sig."signalTypes", ARRAY[]::text[]) AS "signalTypes",
      (w.company_id IS NOT NULL) AS watched,
      EXISTS (
        SELECT 1
        FROM suppression_entries sup
        WHERE sup.organization_id = c.organization_id
          AND sup.company_id = c.id
          AND sup.scope = 'COMPANY'
          AND sup.active = TRUE
          AND (sup.expires_at IS NULL OR sup.expires_at > NOW())
      ) AS suppressed,
      LOWER(CONCAT_WS(
        ' ',
        c.display_name,
        c.legal_name,
        c.domain,
        c.industry,
        c.subindustry,
        c.country,
        c.state,
        c.city,
        l.notes,
        opp.matched_icp_name,
        opp.offering_name,
        opp.why_this_company,
        opp.why_now,
        opp.problem_hypothesis,
        opp.next_best_action,
        ct."contactText",
        act."activityText"
      )) AS "searchText",
      c.updated_at AS "updatedAt"
    FROM companies c
    LEFT JOIN company_sales_lifecycle l
      ON l.organization_id = c.organization_id
     AND l.company_id = c.id
    LEFT JOIN users owner ON owner.id = l.owner_user_id
    LEFT JOIN watchlist_entries w
      ON w.organization_id = c.organization_id
     AND w.company_id = c.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "evidenceCount"
      FROM company_evidence e
      WHERE e.organization_id = c.organization_id
        AND e.company_id = c.id
    ) ev ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "signalCount",
        MAX(s.observed_at) AS "latestSignalAt",
        ARRAY_AGG(DISTINCT s.signal_type) AS "signalTypes"
      FROM buying_signals s
      WHERE s.organization_id = c.organization_id
        AND s.company_id = c.id
    ) sig ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        os.opportunity_score,
        os.expected_revenue,
        os.conversion_probability,
        os.deal_value_expected,
        os.matched_icp_name,
        os.offering_name,
        os.why_this_company,
        os.why_now,
        os.problem_hypothesis,
        os.next_best_action
      FROM opportunity_snapshots os
      WHERE os.organization_id = c.organization_id
        AND os.company_id = c.id
      ORDER BY os.created_at DESC
      LIMIT 1
    ) opp ON TRUE
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(
        CONCAT_WS(' ', con.name, con.position, con.email, con.location),
        ' '
      ) AS "contactText"
      FROM contacts con
      WHERE con.organization_id = c.organization_id
        AND con.company_id = c.id
    ) ct ON TRUE
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(CONCAT_WS(' ', a.subject, a.summary), ' ') AS "activityText"
      FROM sales_activities a
      WHERE a.organization_id = c.organization_id
        AND a.company_id = c.id
    ) act ON TRUE
    WHERE c.organization_id = ${user.organizationId}
    ORDER BY c.updated_at DESC
  `;

  const q = (params.q ?? "").trim().toLowerCase();
  const scoreMin = n(params.scoreMin);
  const revenueMin = n(params.revenueMin);
  const employeeMin = n(params.employeeMin);
  const employeeMax = n(params.employeeMax);
  const nowMs = Date.now();

  let companies = allCompanies.filter((company) => {
    if (q && !company.searchText.includes(q)) return false;
    if (params.country && company.country !== params.country) return false;
    if (params.state && company.state !== params.state) return false;
    if (params.city && company.city !== params.city) return false;
    if (params.industry && company.industry !== params.industry) return false;
    if (params.stage && (company.stage ?? "DISCOVERED") !== params.stage) return false;
    if (params.owner && company.ownerUserId !== params.owner) return false;
    if (
      params.signal &&
      !company.signalTypes.some((signal) => signal === params.signal)
    ) return false;
    if (params.icp && company.matchedIcpName !== params.icp) return false;
    if (params.offering && company.offeringName !== params.offering) return false;
    if (params.watchlist === "yes" && !company.watched) return false;
    if (
      scoreMin !== null &&
      (company.opportunityScore === null || company.opportunityScore < scoreMin)
    ) return false;
    if (
      revenueMin !== null &&
      (company.expectedRevenue === null || company.expectedRevenue < revenueMin)
    ) return false;
    if (
      employeeMin !== null &&
      (company.employeeCount === null || company.employeeCount < employeeMin)
    ) return false;
    if (
      employeeMax !== null &&
      (company.employeeCount === null || company.employeeCount > employeeMax)
    ) return false;

    if (params.lastContact === "never" && company.lastContactAt) return false;
    if (params.lastContact && params.lastContact !== "never") {
      const days = Number(params.lastContact);
      if (
        !Number.isFinite(days) ||
        !company.lastContactAt ||
        nowMs - new Date(company.lastContactAt).getTime() > days * 86_400_000
      ) return false;
    }

    if (params.lastSignal === "never" && company.latestSignalAt) return false;
    if (params.lastSignal && params.lastSignal !== "never") {
      const days = Number(params.lastSignal);
      if (
        !Number.isFinite(days) ||
        !company.latestSignalAt ||
        nowMs - new Date(company.latestSignalAt).getTime() > days * 86_400_000
      ) return false;
    }

    return true;
  });

  const sort = params.sort ?? "updated";
  companies = [...companies].sort((a, b) => {
    if (sort === "score") {
      return (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1);
    }
    if (sort === "revenue") {
      return (b.expectedRevenue ?? -1) - (a.expectedRevenue ?? -1);
    }
    if (sort === "probability") {
      return (b.conversionProbability ?? -1) - (a.conversionProbability ?? -1);
    }
    if (sort === "deal") {
      return (b.dealValueExpected ?? -1) - (a.dealValueExpected ?? -1);
    }
    if (sort === "signal") {
      return (
        (b.latestSignalAt?.getTime() ?? 0) -
        (a.latestSignalAt?.getTime() ?? 0)
      );
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const countries = unique(allCompanies.map((company) => company.country));
  const states = unique(allCompanies.map((company) => company.state));
  const cities = unique(allCompanies.map((company) => company.city));
  const industries = unique(allCompanies.map((company) => company.industry));
  const stages = unique(allCompanies.map((company) => company.stage ?? "DISCOVERED"));
  const signals = unique(allCompanies.flatMap((company) => company.signalTypes));
  const icps = unique(allCompanies.map((company) => company.matchedIcpName));
  const offerings = unique(allCompanies.map((company) => company.offeringName));
  const owners = [...new Map(
    allCompanies
      .filter((company) => company.ownerUserId && company.ownerName)
      .map((company) => [
        company.ownerUserId as string,
        company.ownerName as string,
      ]),
  ).entries()];

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link className="nav-active" href="/companies">Search</Link>
          <Link href="/watchlist">Watchlist</Link>
          <Link href="/analytics">Analytics</Link>
          <Link href="/compliance">Compliance</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M5 · Search & daily work</div>
          <h1>Search the workspace</h1>
          <p className="lede">
            Search companies, contacts, opportunity context, notes, industries
            and locations from one surface, then filter and sort by the
            commercial dimensions that matter.
          </p>
        </div>
        <div className="workspace-chip">
          <span>Results</span>
          <strong>{companies.length}</strong>
        </div>
      </header>

      {params.error ? <div className="error-banner">{params.error}</div> : null}

      <section className="m5-search-panel">
        <form className="m5-filter-form" method="get">
          <label className="m5-search-wide">
            Search everything
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Company, contact, note, industry, location, Offering..."
            />
          </label>

          <label>
            Country
            <select name="country" defaultValue={params.country ?? ""}>
              <option value="">Any</option>
              {countries.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            State
            <select name="state" defaultValue={params.state ?? ""}>
              <option value="">Any</option>
              {states.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            City
            <select name="city" defaultValue={params.city ?? ""}>
              <option value="">Any</option>
              {cities.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Industry
            <select name="industry" defaultValue={params.industry ?? ""}>
              <option value="">Any</option>
              {industries.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Stage
            <select name="stage" defaultValue={params.stage ?? ""}>
              <option value="">Any</option>
              {stages.map((value) => <option key={value}>{label(value)}</option>)}
            </select>
          </label>
          <label>
            Owner
            <select name="owner" defaultValue={params.owner ?? ""}>
              <option value="">Any</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Signal
            <select name="signal" defaultValue={params.signal ?? ""}>
              <option value="">Any</option>
              {signals.map((value) => <option key={value}>{label(value)}</option>)}
            </select>
          </label>
          <label>
            ICP
            <select name="icp" defaultValue={params.icp ?? ""}>
              <option value="">Any</option>
              {icps.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Offering
            <select name="offering" defaultValue={params.offering ?? ""}>
              <option value="">Any</option>
              {offerings.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Watchlist
            <select name="watchlist" defaultValue={params.watchlist ?? ""}>
              <option value="">Any</option>
              <option value="yes">Watchlist only</option>
            </select>
          </label>
          <label>
            Minimum score
            <input
              name="scoreMin"
              type="number"
              min="0"
              max="100"
              defaultValue={params.scoreMin ?? ""}
            />
          </label>
          <label>
            Minimum expected revenue
            <input
              name="revenueMin"
              type="number"
              min="0"
              defaultValue={params.revenueMin ?? ""}
            />
          </label>
          <label>
            Minimum employees
            <input
              name="employeeMin"
              type="number"
              min="0"
              defaultValue={params.employeeMin ?? ""}
            />
          </label>
          <label>
            Maximum employees
            <input
              name="employeeMax"
              type="number"
              min="0"
              defaultValue={params.employeeMax ?? ""}
            />
          </label>
          <label>
            Last contact
            <select name="lastContact" defaultValue={params.lastContact ?? ""}>
              <option value="">Any</option>
              <option value="7">Within 7 days</option>
              <option value="30">Within 30 days</option>
              <option value="90">Within 90 days</option>
              <option value="never">Never contacted</option>
            </select>
          </label>
          <label>
            Last signal
            <select name="lastSignal" defaultValue={params.lastSignal ?? ""}>
              <option value="">Any</option>
              <option value="7">Within 7 days</option>
              <option value="30">Within 30 days</option>
              <option value="90">Within 90 days</option>
              <option value="never">No signal</option>
            </select>
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={sort}>
              <option value="updated">Recently updated</option>
              <option value="score">Opportunity score</option>
              <option value="revenue">Expected revenue</option>
              <option value="probability">Conversion probability</option>
              <option value="deal">Deal value</option>
              <option value="signal">Latest signal</option>
            </select>
          </label>
          <div className="m5-filter-actions">
            <button className="primary-button" type="submit">Apply</button>
            <Link className="secondary-link" href="/companies">Clear</Link>
          </div>
        </form>
      </section>

      <section className="setup-section">
        <div className="company-toolbar">
          <Link className="primary-link" href="/discover">Discover companies</Link>
          <span>{companies.length} of {allCompanies.length} shown</span>
        </div>

        {companies.length === 0 ? (
          <div className="empty-state">
            <h3>No companies match these filters.</h3>
            <p>Clear some filters or discover more companies.</p>
          </div>
        ) : (
          <div className="m5-company-list">
            {companies.map((company) => (
              <article className="m5-company-card" key={company.id}>
                <div className="m5-company-main">
                  <div>
                    <div className="m5-company-title">
                      <Link href={`/companies/${company.id}`}>
                        <strong>{company.displayName}</strong>
                      </Link>
                      {company.watched ? <span>Watching</span> : null}
                      {company.suppressed ? <span>Suppressed</span> : null}
                    </div>
                    <p>
                      {company.industry ?? "Industry unknown"} ·{" "}
                      {[company.city, company.state, company.country]
                        .filter(Boolean)
                        .join(", ") || "Location unknown"}
                    </p>
                  </div>
                  <div className="m5-company-stats">
                    <span>Stage <strong>{label(company.stage ?? "DISCOVERED")}</strong></span>
                    <span>Owner <strong>{company.ownerName ?? "Unassigned"}</strong></span>
                    <span>Score <strong>{company.opportunityScore ?? "—"}</strong></span>
                    <span>Expected revenue <strong>{money(company.expectedRevenue)}</strong></span>
                    <span>
                      Probability{" "}
                      <strong>
                        {company.conversionProbability === null
                          ? "—"
                          : `${Math.round(company.conversionProbability * 1000) / 10}%`}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="m5-company-meta">
                  <span>{company.evidenceCount} evidence</span>
                  <span>{company.signalCount} signals</span>
                  <span>{company.offeringName ?? "No Offering"}</span>
                  <span>
                    Last contact{" "}
                    {company.lastContactAt
                      ? new Date(company.lastContactAt).toLocaleDateString("en-AU")
                      : "none"}
                  </span>
                  <form
                    action={`/api/companies/${company.id}/watchlist`}
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="action"
                      value={company.watched ? "remove" : "add"}
                    />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={"/companies?" + new URLSearchParams(
                        Object.entries(params)
                          .filter(([, value]) => typeof value === "string")
                          .map(([key, value]) => [key, value as string]),
                      ).toString()}
                    />
                    <button className="text-button" type="submit">
                      {company.watched ? "Remove watch" : "Watch"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="setup-section">
        <details className="config-card create-card">
          <summary className="config-summary">
            <span>
              <strong>Add known company manually</strong>
              <small>Advanced fallback when Discover is not the source.</small>
            </span>
            <span>Open</span>
          </summary>
          <form className="form-grid edit-form" action="/api/companies" method="post">
            <CompanyFields />
            <div className="span-2 form-actions">
              <button className="primary-button" type="submit">Create company</button>
            </div>
          </form>
        </details>
      </section>
    </main>
  );
}
