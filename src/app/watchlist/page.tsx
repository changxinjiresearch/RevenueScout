import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type WatchItem = {
  companyId: string;
  companyName: string;
  industry: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  reason: string;
  watchedAt: Date;
  opportunityScore: number | null;
  expectedRevenue: number | null;
  conversionProbability: number | null;
  stage: string | null;
  ownerName: string | null;
  latestSignalAt: Date | null;
  latestSignalLabel: string | null;
  nextAction: string | null;
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
  if (!value) return "Discovered";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ watchlist?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const items = await sql<WatchItem[]>`
    SELECT
      c.id AS "companyId",
      c.display_name AS "companyName",
      c.industry,
      c.country,
      c.state,
      c.city,
      w.reason,
      w.created_at AS "watchedAt",
      opp.opportunity_score AS "opportunityScore",
      opp.expected_revenue::float8 AS "expectedRevenue",
      opp.conversion_probability::float8 AS "conversionProbability",
      l.stage,
      owner.name AS "ownerName",
      sig."latestSignalAt",
      sig."latestSignalLabel",
      COALESCE(l.next_action, opp.next_best_action) AS "nextAction"
    FROM watchlist_entries w
    JOIN companies c
      ON c.id = w.company_id
     AND c.organization_id = w.organization_id
    LEFT JOIN company_sales_lifecycle l
      ON l.organization_id = c.organization_id
     AND l.company_id = c.id
    LEFT JOIN users owner ON owner.id = l.owner_user_id
    LEFT JOIN LATERAL (
      SELECT
        os.opportunity_score,
        os.expected_revenue,
        os.conversion_probability,
        os.next_best_action
      FROM opportunity_snapshots os
      WHERE os.organization_id = c.organization_id
        AND os.company_id = c.id
      ORDER BY os.created_at DESC
      LIMIT 1
    ) opp ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        s.observed_at AS "latestSignalAt",
        s.label AS "latestSignalLabel"
      FROM buying_signals s
      WHERE s.organization_id = c.organization_id
        AND s.company_id = c.id
        AND s.verification_status <> 'OUTDATED'
      ORDER BY s.observed_at DESC, s.created_at DESC
      LIMIT 1
    ) sig ON TRUE
    WHERE w.organization_id = ${user.organizationId}
    ORDER BY
      sig."latestSignalAt" DESC NULLS LAST,
      opp.expected_revenue DESC NULLS LAST,
      w.created_at DESC
  `;

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/companies">Search</Link>
          <Link className="nav-active" href="/watchlist">Watchlist</Link>
          <Link href="/compliance">Compliance</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M5 · Watchlist</div>
          <h1>Watch, don’t chase.</h1>
          <p className="lede">
            Keep strong-fit companies visible when timing is weak. Watchlist
            companies stay separate from active outreach until a real trigger
            appears.
          </p>
        </div>
        <div className="workspace-chip">
          <span>Watching</span>
          <strong>{items.length}</strong>
        </div>
      </header>

      {params.watchlist ? (
        <div className="success-banner">
          Watchlist updated.
        </div>
      ) : null}

      {items.length === 0 ? (
        <section className="empty-state">
          <h3>Your watchlist is empty.</h3>
          <p>
            Add a company when it is a strong fit but the timing is not yet
            good enough for sales effort.
          </p>
          <Link className="primary-link" href="/companies">
            Search companies
          </Link>
        </section>
      ) : (
        <section className="m5-watch-list">
          {items.map((item) => (
            <article className="m5-watch-card" key={item.companyId}>
              <div className="m5-watch-heading">
                <div>
                  <Link href={`/companies/${item.companyId}`}>
                    <h3>{item.companyName}</h3>
                  </Link>
                  <p>
                    {item.industry ?? "Industry unknown"} ·{" "}
                    {[item.city, item.state, item.country]
                      .filter(Boolean)
                      .join(", ") || "Location unknown"}
                  </p>
                </div>
                <span>{label(item.stage)}</span>
              </div>

              <div className="m5-watch-metrics">
                <div>
                  <span>Opportunity score</span>
                  <strong>{item.opportunityScore ?? "—"}</strong>
                </div>
                <div>
                  <span>Expected revenue</span>
                  <strong>{money(item.expectedRevenue)}</strong>
                </div>
                <div>
                  <span>Conversion</span>
                  <strong>
                    {item.conversionProbability === null
                      ? "—"
                      : `${Math.round(item.conversionProbability * 1000) / 10}%`}
                  </strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{item.ownerName ?? "Unassigned"}</strong>
                </div>
              </div>

              <div className="m5-watch-context">
                <div>
                  <span>Latest signal</span>
                  <strong>{item.latestSignalLabel ?? "No current signal"}</strong>
                  <small>
                    {item.latestSignalAt
                      ? new Date(item.latestSignalAt).toLocaleDateString("en-AU")
                      : "Waiting for a meaningful trigger"}
                  </small>
                </div>
                <div>
                  <span>Next action</span>
                  <strong>{item.nextAction ?? "Continue monitoring"}</strong>
                </div>
                {item.reason ? (
                  <div>
                    <span>Why watch?</span>
                    <strong>{item.reason}</strong>
                  </div>
                ) : null}
              </div>

              <div className="m5-watch-actions">
                <Link className="secondary-link" href={`/companies/${item.companyId}`}>
                  Open company
                </Link>
                <form
                  action={`/api/companies/${item.companyId}/watchlist`}
                  method="post"
                >
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="returnTo" value="/watchlist" />
                  <button className="text-button" type="submit">
                    Remove from watchlist
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
