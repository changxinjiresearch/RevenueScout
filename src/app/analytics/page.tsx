import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildCalibrationSummary,
  buildFunnel,
  formatCalibrationStatus,
  revenueAccuracy,
  safeRate,
  type ClosedPrediction,
} from "@/lib/analytics/revenue";

export const dynamic = "force-dynamic";

type FunnelRow = {
  discovered: number;
  qualified: number;
  contacted: number;
  replied: number;
  meeting: number;
  opportunity: number;
  proposal: number;
  won: number;
};

type PeriodSummary = {
  newQualified: number;
  closedWon: number;
  closedLost: number;
  actualRevenue: number;
  averageDealSize: number | null;
  averageSalesCycleDays: number | null;
};

type ForecastRow = {
  openCompanies: number;
  openDealValue: number;
  upsidePotentialRevenue: number;
  expectedRevenue: number;
};

type PerformanceRow = {
  key: string;
  companies: number;
  contacted: number;
  meetings: number;
  proposals: number;
  wins: number;
  revenue: number;
  averageDealSize: number | null;
  averageSalesCycleDays: number | null;
};

type RolePerformanceRow = {
  key: string;
  companies: number;
  wins: number;
  revenue: number;
  averageDealSize: number | null;
  averageSalesCycleDays: number | null;
};

type LostReasonRow = {
  reason: string;
  count: number;
};

type FeedbackRow = {
  useful: number;
  notUseful: number;
};

type FeedbackReasonRow = {
  reason: string;
  count: number;
};

type AttributionRow = {
  sourceOrigin: string;
  wins: number;
  revenue: number;
};

type ClosedDealRow = {
  companyId: string;
  companyName: string;
  outcome: "WON" | "LOST";
  predictedProbability: number | null;
  predictedDealValue: number | null;
  predictedExpectedRevenue: number | null;
  actualContractValue: number | null;
  salesCycleDays: number | null;
  lostReason: string | null;
  closedAt: Date;
  matchedIcpName: string | null;
  offeringName: string | null;
};

type MonthlyRevenueRow = {
  month: Date;
  wonDeals: number;
  lostDeals: number;
  predictedExpectedRevenue: number;
  actualRevenue: number;
};

function money(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function label(value: string | null): string {
  if (!value) return "Unknown";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rangeStart(range: string): Date | null {
  if (range === "all") return null;
  const days =
    range === "30" ? 30 : range === "365" ? 365 : 90;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function performanceWinRate(row: PerformanceRow): number | null {
  return safeRate(row.wins, row.contacted || row.companies);
}

function maxPerformanceRevenue(rows: PerformanceRow[]): number {
  return Math.max(1, ...rows.map((row) => row.revenue));
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const selectedRange = ["30", "90", "365", "all"].includes(params.range ?? "")
    ? (params.range as string)
    : "90";
  const start = rangeStart(selectedRange);
  const startIso = start?.toISOString() ?? null;
  const sql = db();

  const [
    funnelRows,
    periodRows,
    forecastRows,
    closedPredictionRows,
    signalRows,
    icpRows,
    offeringRows,
    roleRows,
    lostReasons,
    feedbackRows,
    feedbackReasons,
    attributionRows,
    closedDeals,
    monthlyRows,
  ] = await Promise.all([
    sql<FunnelRow[]>`
      SELECT
        COUNT(DISTINCT c.id)::int AS discovered,
        COUNT(DISTINCT c.id) FILTER (WHERE l.qualified_at IS NOT NULL)::int AS qualified,
        COUNT(DISTINCT c.id) FILTER (WHERE l.first_contact_at IS NOT NULL)::int AS contacted,
        COUNT(DISTINCT c.id) FILTER (WHERE l.replied_at IS NOT NULL)::int AS replied,
        COUNT(DISTINCT c.id) FILTER (WHERE l.meeting_at IS NOT NULL)::int AS meeting,
        COUNT(DISTINCT c.id) FILTER (WHERE l.opportunity_at IS NOT NULL)::int AS opportunity,
        COUNT(DISTINCT c.id) FILTER (WHERE l.proposal_at IS NOT NULL)::int AS proposal,
        COUNT(DISTINCT c.id) FILTER (WHERE o.outcome = 'WON')::int AS won
      FROM companies c
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = c.organization_id
       AND l.company_id = c.id
      LEFT JOIN sales_outcomes o
        ON o.organization_id = c.organization_id
       AND o.company_id = c.id
      WHERE c.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          c.created_at >= ${startIso}::timestamptz
        )
    `,
    sql<PeriodSummary[]>`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM company_sales_lifecycle l
          WHERE l.organization_id = ${user.organizationId}
            AND l.qualified_at IS NOT NULL
            AND (
              ${startIso}::timestamptz IS NULL OR
              l.qualified_at >= ${startIso}::timestamptz
            )
        ) AS "newQualified",
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS "closedWon",
        COUNT(*) FILTER (WHERE o.outcome = 'LOST')::int AS "closedLost",
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS "actualRevenue",
        AVG(o.actual_contract_value) FILTER (
          WHERE o.outcome = 'WON' AND o.actual_contract_value IS NOT NULL
        )::float8 AS "averageDealSize",
        AVG(o.sales_cycle_days) FILTER (
          WHERE o.sales_cycle_days IS NOT NULL
        )::float8 AS "averageSalesCycleDays"
      FROM sales_outcomes o
      WHERE o.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
    `,
    sql<ForecastRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (os.company_id)
          os.company_id,
          os.deal_value_high::float8 AS deal_value_high,
          os.deal_value_expected::float8 AS deal_value_expected,
          os.conversion_probability::float8 AS conversion_probability
        FROM opportunity_snapshots os
        WHERE os.organization_id = ${user.organizationId}
        ORDER BY os.company_id, os.created_at DESC
      )
      SELECT
        COUNT(*)::int AS "openCompanies",
        COALESCE(
          SUM(COALESCE(ov.expected_deal_value_override, latest.deal_value_expected)),
          0
        )::float8 AS "openDealValue",
        COALESCE(SUM(latest.deal_value_high), 0)::float8 AS "upsidePotentialRevenue",
        COALESCE(
          SUM(
            COALESCE(ov.expected_deal_value_override, latest.deal_value_expected) *
            COALESCE(
              ov.conversion_probability_override,
              latest.conversion_probability
            )
          ),
          0
        )::float8 AS "expectedRevenue"
      FROM latest
      JOIN companies c
        ON c.id = latest.company_id
       AND c.organization_id = ${user.organizationId}
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = c.organization_id
       AND l.company_id = c.id
      LEFT JOIN opportunity_overrides ov
        ON ov.organization_id = c.organization_id
       AND ov.company_id = c.id
      WHERE COALESCE(l.stage, 'DISCOVERED') NOT IN (
        'WON','LOST','NOT_FIT','DO_NOT_CONTACT','SUPPRESSED'
      )
        AND NOT EXISTS (
          SELECT 1
          FROM suppression_entries s
          WHERE s.organization_id = c.organization_id
            AND s.company_id = c.id
            AND s.scope = 'COMPANY'
            AND s.active = TRUE
            AND (s.expires_at IS NULL OR s.expires_at > NOW())
        )
    `,
    sql<ClosedPrediction[]>`
      SELECT
        o.predicted_conversion_probability::float8 AS "predictedProbability",
        o.predicted_expected_revenue::float8 AS "predictedExpectedRevenue",
        CASE
          WHEN o.outcome = 'WON' THEN COALESCE(o.actual_contract_value, 0)
          ELSE 0
        END::float8 AS "actualRevenue",
        o.outcome
      FROM sales_outcomes o
      WHERE o.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
      ORDER BY o.closed_at DESC
    `,
    sql<PerformanceRow[]>`
      WITH signal_companies AS (
        SELECT DISTINCT
          s.signal_type AS key,
          s.company_id
        FROM buying_signals s
        JOIN companies c
          ON c.id = s.company_id
         AND c.organization_id = s.organization_id
        WHERE s.organization_id = ${user.organizationId}
          AND s.verification_status <> 'OUTDATED'
          AND (
            ${startIso}::timestamptz IS NULL OR
            c.created_at >= ${startIso}::timestamptz
          )
      )
      SELECT
        sc.key,
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE l.first_contact_at IS NOT NULL)::int AS contacted,
        COUNT(*) FILTER (WHERE l.meeting_at IS NOT NULL)::int AS meetings,
        COUNT(*) FILTER (WHERE l.proposal_at IS NOT NULL)::int AS proposals,
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS wins,
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS revenue,
        AVG(o.actual_contract_value) FILTER (
          WHERE o.outcome = 'WON' AND o.actual_contract_value IS NOT NULL
        )::float8 AS "averageDealSize",
        AVG(o.sales_cycle_days) FILTER (
          WHERE o.sales_cycle_days IS NOT NULL
        )::float8 AS "averageSalesCycleDays"
      FROM signal_companies sc
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = ${user.organizationId}
       AND l.company_id = sc.company_id
      LEFT JOIN sales_outcomes o
        ON o.organization_id = ${user.organizationId}
       AND o.company_id = sc.company_id
      GROUP BY sc.key
      ORDER BY revenue DESC, wins DESC, companies DESC
    `,
    sql<PerformanceRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (os.company_id)
          os.company_id,
          os.matched_icp_name
        FROM opportunity_snapshots os
        WHERE os.organization_id = ${user.organizationId}
        ORDER BY os.company_id, os.created_at DESC
      ),
      classified AS (
        SELECT
          c.id AS company_id,
          COALESCE(origin.matched_icp_name, latest.matched_icp_name, 'Unknown') AS key
        FROM companies c
        LEFT JOIN company_sales_lifecycle l
          ON l.organization_id = c.organization_id
         AND l.company_id = c.id
        LEFT JOIN opportunity_snapshots origin
          ON origin.id = l.origin_opportunity_snapshot_id
        LEFT JOIN latest ON latest.company_id = c.id
        WHERE c.organization_id = ${user.organizationId}
          AND (
            ${startIso}::timestamptz IS NULL OR
            c.created_at >= ${startIso}::timestamptz
          )
      )
      SELECT
        classified.key,
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE l.first_contact_at IS NOT NULL)::int AS contacted,
        COUNT(*) FILTER (WHERE l.meeting_at IS NOT NULL)::int AS meetings,
        COUNT(*) FILTER (WHERE l.proposal_at IS NOT NULL)::int AS proposals,
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS wins,
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS revenue,
        AVG(o.actual_contract_value) FILTER (
          WHERE o.outcome = 'WON' AND o.actual_contract_value IS NOT NULL
        )::float8 AS "averageDealSize",
        AVG(o.sales_cycle_days) FILTER (
          WHERE o.sales_cycle_days IS NOT NULL
        )::float8 AS "averageSalesCycleDays"
      FROM classified
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = ${user.organizationId}
       AND l.company_id = classified.company_id
      LEFT JOIN sales_outcomes o
        ON o.organization_id = ${user.organizationId}
       AND o.company_id = classified.company_id
      GROUP BY classified.key
      ORDER BY revenue DESC, wins DESC, companies DESC
    `,
    sql<PerformanceRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (os.company_id)
          os.company_id,
          os.offering_name
        FROM opportunity_snapshots os
        WHERE os.organization_id = ${user.organizationId}
        ORDER BY os.company_id, os.created_at DESC
      ),
      classified AS (
        SELECT
          c.id AS company_id,
          COALESCE(origin.offering_name, latest.offering_name, 'Unknown') AS key
        FROM companies c
        LEFT JOIN company_sales_lifecycle l
          ON l.organization_id = c.organization_id
         AND l.company_id = c.id
        LEFT JOIN opportunity_snapshots origin
          ON origin.id = l.origin_opportunity_snapshot_id
        LEFT JOIN latest ON latest.company_id = c.id
        WHERE c.organization_id = ${user.organizationId}
          AND (
            ${startIso}::timestamptz IS NULL OR
            c.created_at >= ${startIso}::timestamptz
          )
      )
      SELECT
        classified.key,
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE l.first_contact_at IS NOT NULL)::int AS contacted,
        COUNT(*) FILTER (WHERE l.meeting_at IS NOT NULL)::int AS meetings,
        COUNT(*) FILTER (WHERE l.proposal_at IS NOT NULL)::int AS proposals,
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS wins,
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS revenue,
        AVG(o.actual_contract_value) FILTER (
          WHERE o.outcome = 'WON' AND o.actual_contract_value IS NOT NULL
        )::float8 AS "averageDealSize",
        AVG(o.sales_cycle_days) FILTER (
          WHERE o.sales_cycle_days IS NOT NULL
        )::float8 AS "averageSalesCycleDays"
      FROM classified
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = ${user.organizationId}
       AND l.company_id = classified.company_id
      LEFT JOIN sales_outcomes o
        ON o.organization_id = ${user.organizationId}
       AND o.company_id = classified.company_id
      GROUP BY classified.key
      ORDER BY revenue DESC, wins DESC, companies DESC
    `,
    sql<RolePerformanceRow[]>`
      SELECT
        COALESCE(c.decision_relevance, 'UNKNOWN') AS key,
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS wins,
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS revenue,
        AVG(o.actual_contract_value) FILTER (
          WHERE o.outcome = 'WON' AND o.actual_contract_value IS NOT NULL
        )::float8 AS "averageDealSize",
        AVG(o.sales_cycle_days) FILTER (
          WHERE o.sales_cycle_days IS NOT NULL
        )::float8 AS "averageSalesCycleDays"
      FROM sales_outcomes o
      LEFT JOIN contacts c ON c.id = o.primary_contact_id
      WHERE o.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
      GROUP BY COALESCE(c.decision_relevance, 'UNKNOWN')
      ORDER BY revenue DESC, wins DESC, companies DESC
    `,
    sql<LostReasonRow[]>`
      SELECT
        COALESCE(o.lost_reason, 'OTHER') AS reason,
        COUNT(*)::int AS count
      FROM sales_outcomes o
      WHERE o.organization_id = ${user.organizationId}
        AND o.outcome = 'LOST'
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
      GROUP BY COALESCE(o.lost_reason, 'OTHER')
      ORDER BY count DESC, reason
    `,
    sql<FeedbackRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE useful = TRUE)::int AS useful,
        COUNT(*) FILTER (WHERE useful = FALSE)::int AS "notUseful"
      FROM recommendation_feedback
      WHERE organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          created_at >= ${startIso}::timestamptz
        )
    `,
    sql<FeedbackReasonRow[]>`
      SELECT
        COALESCE(reason, 'OTHER') AS reason,
        COUNT(*)::int AS count
      FROM recommendation_feedback
      WHERE organization_id = ${user.organizationId}
        AND useful = FALSE
        AND (
          ${startIso}::timestamptz IS NULL OR
          created_at >= ${startIso}::timestamptz
        )
      GROUP BY COALESCE(reason, 'OTHER')
      ORDER BY count DESC, reason
    `,
    sql<AttributionRow[]>`
      SELECT
        c.source_origin AS "sourceOrigin",
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS wins,
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS revenue
      FROM sales_outcomes o
      JOIN companies c ON c.id = o.company_id
      WHERE o.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
      GROUP BY c.source_origin
      ORDER BY revenue DESC, wins DESC
    `,
    sql<ClosedDealRow[]>`
      SELECT
        c.id AS "companyId",
        c.display_name AS "companyName",
        o.outcome,
        o.predicted_conversion_probability::float8 AS "predictedProbability",
        o.predicted_deal_value::float8 AS "predictedDealValue",
        o.predicted_expected_revenue::float8 AS "predictedExpectedRevenue",
        o.actual_contract_value::float8 AS "actualContractValue",
        o.sales_cycle_days AS "salesCycleDays",
        o.lost_reason AS "lostReason",
        o.closed_at AS "closedAt",
        os.matched_icp_name AS "matchedIcpName",
        os.offering_name AS "offeringName"
      FROM sales_outcomes o
      JOIN companies c ON c.id = o.company_id
      LEFT JOIN opportunity_snapshots os
        ON os.id = o.opportunity_snapshot_id
      WHERE o.organization_id = ${user.organizationId}
        AND (
          ${startIso}::timestamptz IS NULL OR
          o.closed_at >= ${startIso}::timestamptz
        )
      ORDER BY o.closed_at DESC
      LIMIT 50
    `,
    sql<MonthlyRevenueRow[]>`
      SELECT
        date_trunc('month', o.closed_at) AS month,
        COUNT(*) FILTER (WHERE o.outcome = 'WON')::int AS "wonDeals",
        COUNT(*) FILTER (WHERE o.outcome = 'LOST')::int AS "lostDeals",
        COALESCE(SUM(o.predicted_expected_revenue), 0)::float8 AS "predictedExpectedRevenue",
        COALESCE(
          SUM(o.actual_contract_value) FILTER (WHERE o.outcome = 'WON'),
          0
        )::float8 AS "actualRevenue"
      FROM sales_outcomes o
      WHERE o.organization_id = ${user.organizationId}
        AND o.closed_at >= date_trunc('month', NOW()) - interval '11 months'
      GROUP BY date_trunc('month', o.closed_at)
      ORDER BY month
    `,
  ]);

  const funnelRow = funnelRows[0] ?? {
    discovered: 0,
    qualified: 0,
    contacted: 0,
    replied: 0,
    meeting: 0,
    opportunity: 0,
    proposal: 0,
    won: 0,
  };

  const funnel = buildFunnel([
    { key: "discovered", label: "Discovered", count: funnelRow.discovered },
    { key: "qualified", label: "Qualified", count: funnelRow.qualified },
    { key: "contacted", label: "Contacted", count: funnelRow.contacted },
    { key: "replied", label: "Replied", count: funnelRow.replied },
    { key: "meeting", label: "Meeting", count: funnelRow.meeting },
    { key: "opportunity", label: "Opportunity", count: funnelRow.opportunity },
    { key: "proposal", label: "Proposal", count: funnelRow.proposal },
    { key: "won", label: "Won", count: funnelRow.won },
  ]);

  const period = periodRows[0] ?? {
    newQualified: 0,
    closedWon: 0,
    closedLost: 0,
    actualRevenue: 0,
    averageDealSize: null,
    averageSalesCycleDays: null,
  };
  const forecast = forecastRows[0] ?? {
    openCompanies: 0,
    openDealValue: 0,
    upsidePotentialRevenue: 0,
    expectedRevenue: 0,
  };

  const calibration = buildCalibrationSummary(closedPredictionRows);
  const revenueComparison = revenueAccuracy(closedPredictionRows);
  const feedback = feedbackRows[0] ?? { useful: 0, notUseful: 0 };
  const feedbackTotal = feedback.useful + feedback.notUseful;
  const attributedRevenue = closedDeals
    .filter((deal) => deal.outcome === "WON" && deal.predictedExpectedRevenue !== null)
    .reduce((sum, deal) => sum + (deal.actualContractValue ?? 0), 0);
  const totalWonRevenue = closedDeals
    .filter((deal) => deal.outcome === "WON")
    .reduce((sum, deal) => sum + (deal.actualContractValue ?? 0), 0);
  const attributedCoverage =
    totalWonRevenue > 0 ? attributedRevenue / totalWonRevenue : null;

  const rangeLabel =
    selectedRange === "all"
      ? "All time"
      : `Last ${selectedRange} days`;

  const maxFunnelCount = Math.max(1, ...funnel.map((stage) => stage.count));
  const maxSignalRevenue = maxPerformanceRevenue(signalRows);
  const maxIcpRevenue = maxPerformanceRevenue(icpRows);
  const maxOfferingRevenue = maxPerformanceRevenue(offeringRows);
  const maxMonthlyRevenue = Math.max(
    1,
    ...monthlyRows.map((row) =>
      Math.max(row.actualRevenue, row.predictedExpectedRevenue),
    ),
  );

  return (
    <main className="setup-shell analytics-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/companies">Search</Link>
          <Link href="/watchlist">Watchlist</Link>
          <Link className="nav-active" href="/analytics">Analytics</Link>
          <Link href="/compliance">Compliance</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M6 · Revenue learning</div>
          <h1>Did RevenueScout create revenue?</h1>
          <p className="lede">
            Compare recommendations with real Won/Lost outcomes, see where the
            funnel leaks, and identify which signals, ICPs, Offerings and contact
            roles are associated with actual revenue.
          </p>
        </div>
        <form className="m6-range-form" method="get">
          <label>
            Analysis window
            <select name="range" defaultValue={selectedRange}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <button className="secondary-button" type="submit">Apply</button>
        </form>
      </header>

      <section className="m6-kpi-grid">
        <article>
          <span>New qualified opportunities</span>
          <strong>{period.newQualified}</strong>
          <small>{rangeLabel}</small>
        </article>
        <article>
          <span>Actual won revenue</span>
          <strong>{money(period.actualRevenue)}</strong>
          <small>{period.closedWon} won · {period.closedLost} lost</small>
        </article>
        <article>
          <span>Open expected revenue</span>
          <strong>{money(forecast.expectedRevenue)}</strong>
          <small>{forecast.openCompanies} active predicted opportunities</small>
        </article>
        <article>
          <span>Open upside potential</span>
          <strong>{money(forecast.upsidePotentialRevenue)}</strong>
          <small>Model high-case deal values, not booked revenue</small>
        </article>
        <article>
          <span>Average won deal</span>
          <strong>{money(period.averageDealSize)}</strong>
          <small>Closed Won only</small>
        </article>
        <article>
          <span>Average sales cycle</span>
          <strong>
            {period.averageSalesCycleDays === null
              ? "—"
              : `${Math.round(period.averageSalesCycleDays)} days`}
          </strong>
          <small>Closed outcomes with a recorded first contact</small>
        </article>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">01</span>
            <h2>Sales funnel</h2>
          </div>
          <p>
            Cohort view: companies first added during {rangeLabel.toLowerCase()}.
            A later stage is counted if that cohort company has ever reached it.
          </p>
        </div>

        <div className="m6-funnel">
          {funnel.map((stage) => (
            <article key={stage.key}>
              <div className="m6-funnel-label">
                <strong>{stage.label}</strong>
                <span>{stage.count}</span>
              </div>
              <div className="m6-bar-track">
                <div
                  className="m6-bar-fill"
                  style={{ width: `${(stage.count / maxFunnelCount) * 100}%` }}
                />
              </div>
              <div className="m6-funnel-rates">
                <span>From start {percent(stage.fromStartRate)}</span>
                <span>Step {percent(stage.fromPreviousRate)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">02</span>
            <h2>Prediction vs reality</h2>
          </div>
          <p>
            Closed outcomes are compared with the M3 prediction captured when
            the sales lifecycle began. RevenueScout does not rewrite the old
            prediction after seeing the result.
          </p>
        </div>

        <div className="m6-comparison-grid">
          <article>
            <span>Predicted expected revenue</span>
            <strong>{money(revenueComparison.predictedExpectedRevenue)}</strong>
          </article>
          <article>
            <span>Actual revenue</span>
            <strong>{money(revenueComparison.actualRevenue)}</strong>
          </article>
          <article>
            <span>Revenue delta</span>
            <strong>
              {revenueComparison.delta >= 0 ? "+" : ""}
              {money(revenueComparison.delta)}
            </strong>
          </article>
          <article>
            <span>Actual / predicted</span>
            <strong>{percent(revenueComparison.ratio)}</strong>
          </article>
        </div>

        <div className="m6-calibration-card">
          <div className="m6-calibration-heading">
            <div>
              <span className="field-label">Conversion-probability calibration</span>
              <strong>{formatCalibrationStatus(calibration.status)}</strong>
            </div>
            <div>
              <span>{calibration.sampleSize} usable closed predictions</span>
              <span>
                Predicted {percent(calibration.averagePredictedProbability)} vs
                actual {percent(calibration.actualWinRate)}
              </span>
              <span>
                Brier{" "}
                {calibration.brierScore === null
                  ? "—"
                  : calibration.brierScore.toFixed(3)}
              </span>
            </div>
          </div>

          {calibration.sampleSize < 50 ? (
            <div className="m6-caution">
              M3 probabilities are still pre-calibration. This panel measures
              error, but RevenueScout will not label the model calibrated from a
              small sample.
            </div>
          ) : null}

          <div className="m6-calibration-bins">
            {calibration.bins
              .filter((bin) => bin.count > 0)
              .map((bin) => (
                <article key={bin.label}>
                  <strong>{bin.label}</strong>
                  <span>{bin.count} outcomes</span>
                  <span>
                    Avg predicted {percent(bin.averagePredictedProbability)}
                  </span>
                  <span>Actual win rate {percent(bin.actualWinRate)}</span>
                </article>
              ))}
            {calibration.sampleSize === 0 ? (
              <p className="muted-copy">
                Close Won/Lost opportunities to create calibration ground truth.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">03</span>
            <h2>Signal performance</h2>
          </div>
          <p>
            Which evidence-backed buying signals are associated with meetings,
            wins and real contract revenue?
          </p>
        </div>
        <PerformanceTable
          rows={signalRows}
          maxRevenue={maxSignalRevenue}
          keyLabel="Signal"
        />
      </section>

      <section className="m6-two-column">
        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">04</span>
              <h2>ICP performance</h2>
            </div>
          </div>
          <PerformanceTable
            rows={icpRows}
            maxRevenue={maxIcpRevenue}
            keyLabel="ICP"
            compact
          />
        </section>

        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">05</span>
              <h2>Offering performance</h2>
            </div>
          </div>
          <PerformanceTable
            rows={offeringRows}
            maxRevenue={maxOfferingRevenue}
            keyLabel="Offering"
            compact
          />
        </section>
      </section>

      <section className="m6-two-column">
        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">06</span>
              <h2>Primary-contact role outcomes</h2>
            </div>
          </div>
          {roleRows.length === 0 ? (
            <EmptyAnalytics text="Close opportunities with a primary contact to compare roles." />
          ) : (
            <div className="m6-simple-table">
              <div className="m6-simple-head">
                <span>Role</span>
                <span>Closed</span>
                <span>Won</span>
                <span>Revenue</span>
              </div>
              {roleRows.map((row) => (
                <div key={row.key}>
                  <strong>{label(row.key)}</strong>
                  <span>{row.companies}</span>
                  <span>{row.wins}</span>
                  <span>{money(row.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">07</span>
              <h2>Lost reasons</h2>
            </div>
          </div>
          {lostReasons.length === 0 ? (
            <EmptyAnalytics text="No Lost outcomes in this window." />
          ) : (
            <div className="m6-reason-list">
              {lostReasons.map((row) => (
                <div key={row.reason}>
                  <strong>{label(row.reason)}</strong>
                  <span>{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">08</span>
            <h2>Revenue attribution & forecast</h2>
          </div>
          <p>
            Separate booked revenue from open probability-adjusted revenue.
            Attribution is descriptive: it shows the RevenueScout path attached
            to the closed outcome, not causal proof.
          </p>
        </div>

        <div className="m6-attribution-grid">
          <article>
            <span>Won revenue with an M3 prediction</span>
            <strong>{money(attributedRevenue)}</strong>
            <small>Coverage {percent(attributedCoverage)}</small>
          </article>
          <article>
            <span>Current open deal value</span>
            <strong>{money(forecast.openDealValue)}</strong>
            <small>Unadjusted expected deal values</small>
          </article>
          <article>
            <span>Current probability-adjusted forecast</span>
            <strong>{money(forecast.expectedRevenue)}</strong>
            <small>Open opportunities only</small>
          </article>
          <article>
            <span>Current upside potential</span>
            <strong>{money(forecast.upsidePotentialRevenue)}</strong>
            <small>High-case deal values, not a forecast promise</small>
          </article>
        </div>

        {attributionRows.length > 0 ? (
          <div className="m6-source-attribution">
            {attributionRows.map((row) => (
              <article key={row.sourceOrigin}>
                <strong>{label(row.sourceOrigin)}</strong>
                <span>{row.wins} won deals</span>
                <span>{money(row.revenue)}</span>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">09</span>
            <h2>Revenue trend</h2>
          </div>
          <p>Last 12 calendar months of closed outcomes.</p>
        </div>
        {monthlyRows.length === 0 ? (
          <EmptyAnalytics text="No closed outcomes yet." />
        ) : (
          <div className="m6-monthly-chart">
            {monthlyRows.map((row) => (
              <article key={new Date(row.month).toISOString()}>
                <span className="m6-month-label">
                  {new Date(row.month).toLocaleDateString("en-AU", {
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <div className="m6-month-bars">
                  <div
                    className="m6-month-predicted"
                    style={{
                      height: `${Math.max(
                        3,
                        (row.predictedExpectedRevenue / maxMonthlyRevenue) * 100,
                      )}%`,
                    }}
                    title={`Predicted ${money(row.predictedExpectedRevenue)}`}
                  />
                  <div
                    className="m6-month-actual"
                    style={{
                      height: `${Math.max(
                        3,
                        (row.actualRevenue / maxMonthlyRevenue) * 100,
                      )}%`,
                    }}
                    title={`Actual ${money(row.actualRevenue)}`}
                  />
                </div>
                <small>{row.wonDeals}W / {row.lostDeals}L</small>
              </article>
            ))}
          </div>
        )}
        <div className="m6-chart-legend">
          <span><i className="m6-legend-predicted" /> Predicted expected revenue</span>
          <span><i className="m6-legend-actual" /> Actual won revenue</span>
        </div>
      </section>

      <section className="m6-two-column">
        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">10</span>
              <h2>Recommendation feedback</h2>
            </div>
          </div>
          <div className="m6-feedback-summary">
            <article>
              <span>Useful</span>
              <strong>{feedback.useful}</strong>
            </article>
            <article>
              <span>Not useful</span>
              <strong>{feedback.notUseful}</strong>
            </article>
            <article>
              <span>Useful rate</span>
              <strong>{percent(safeRate(feedback.useful, feedbackTotal))}</strong>
            </article>
          </div>
          {feedbackReasons.length > 0 ? (
            <div className="m6-reason-list">
              {feedbackReasons.map((row) => (
                <div key={row.reason}>
                  <strong>{label(row.reason)}</strong>
                  <span>{row.count}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">11</span>
              <h2>What can the system learn now?</h2>
            </div>
          </div>
          <div className="m6-learning-readiness">
            <p>
              <strong>{calibration.sampleSize}</strong> closed predictions with
              usable probabilities.
            </p>
            <p>
              <strong>{signalRows.filter((row) => row.wins > 0).length}</strong>{" "}
              signal types have produced at least one Won deal.
            </p>
            <p>
              <strong>{icpRows.filter((row) => row.wins > 0).length}</strong> ICPs
              have produced at least one Won deal.
            </p>
            <p>
              <strong>{offeringRows.filter((row) => row.wins > 0).length}</strong>{" "}
              Offerings have produced at least one Won deal.
            </p>
            <p className="m6-learning-note">
              M6 analyses outcomes. It does not silently retrain M3. Weight or
              probability-model changes require an explicit later model version
              so historical predictions remain auditable.
            </p>
          </div>
        </section>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">12</span>
            <h2>Closed-deal audit</h2>
          </div>
          <p>Most recent Won/Lost outcomes and the prediction they started with.</p>
        </div>

        {closedDeals.length === 0 ? (
          <EmptyAnalytics text="No Won/Lost outcomes in this window." />
        ) : (
          <div className="m6-deal-table-wrap">
            <table className="m6-deal-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Outcome</th>
                  <th>ICP</th>
                  <th>Offering</th>
                  <th>Pred. probability</th>
                  <th>Pred. deal</th>
                  <th>Pred. expected</th>
                  <th>Actual</th>
                  <th>Cycle</th>
                </tr>
              </thead>
              <tbody>
                {closedDeals.map((deal) => (
                  <tr key={deal.companyId}>
                    <td>
                      <Link href={`/companies/${deal.companyId}`}>
                        {deal.companyName}
                      </Link>
                    </td>
                    <td>
                      <strong>{deal.outcome}</strong>
                      {deal.lostReason ? (
                        <small>{label(deal.lostReason)}</small>
                      ) : null}
                    </td>
                    <td>{deal.matchedIcpName ?? "—"}</td>
                    <td>{deal.offeringName ?? "—"}</td>
                    <td>{percent(deal.predictedProbability)}</td>
                    <td>{money(deal.predictedDealValue)}</td>
                    <td>{money(deal.predictedExpectedRevenue)}</td>
                    <td>
                      {deal.outcome === "WON"
                        ? money(deal.actualContractValue)
                        : "Lost"}
                    </td>
                    <td>
                      {deal.salesCycleDays === null
                        ? "—"
                        : `${deal.salesCycleDays}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function PerformanceTable({
  rows,
  maxRevenue,
  keyLabel,
  compact = false,
}: {
  rows: PerformanceRow[];
  maxRevenue: number;
  keyLabel: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyAnalytics text={`No ${keyLabel.toLowerCase()} performance data yet.`} />;
  }

  return (
    <div className={compact ? "m6-performance compact" : "m6-performance"}>
      <div className="m6-performance-head">
        <span>{keyLabel}</span>
        <span>Companies</span>
        <span>Contacted</span>
        <span>Meetings</span>
        <span>Won</span>
        <span>Win rate</span>
        <span>Revenue</span>
      </div>
      {rows.map((row) => (
        <article key={row.key}>
          <div className="m6-performance-row">
            <strong>{label(row.key)}</strong>
            <span>{row.companies}</span>
            <span>{row.contacted}</span>
            <span>{row.meetings}</span>
            <span>{row.wins}</span>
            <span>{percent(performanceWinRate(row))}</span>
            <span>{money(row.revenue)}</span>
          </div>
          <div className="m6-mini-track">
            <div
              className="m6-mini-fill"
              style={{ width: `${(row.revenue / maxRevenue) * 100}%` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyAnalytics({ text }: { text: string }) {
  return (
    <div className="empty-state compact-empty-state">
      <h3>Not enough ground truth yet.</h3>
      <p>{text}</p>
    </div>
  );
}
