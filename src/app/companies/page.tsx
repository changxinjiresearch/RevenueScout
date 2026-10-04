import Link from "next/link";
import { CompanyFields } from "@/components/company-fields";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CompanyListItem = {
  id: string;
  displayName: string;
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
  updatedAt: Date;
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const companies = await sql<CompanyListItem[]>`
    SELECT
      c.id,
      c.display_name AS "displayName",
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
      COUNT(DISTINCT e.id)::int AS "evidenceCount",
      COUNT(DISTINCT s.id)::int AS "signalCount",
      c.updated_at AS "updatedAt"
    FROM companies c
    LEFT JOIN company_evidence e ON e.company_id = c.id
    LEFT JOIN buying_signals s ON s.company_id = c.id
    WHERE c.organization_id = ${user.organizationId}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `;

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link className="nav-active" href="/companies">Companies</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M2 · Company intelligence</div>
          <h1>Company database</h1>
          <p className="lede">
            Companies in this workspace are persistent records with provenance,
            evidence and buying-signal history.
          </p>
        </div>
        <div className="workspace-chip">
          <span>Total companies</span>
          <strong>{companies.length}</strong>
        </div>
      </header>

      {params.error ? <div className="error-banner">{params.error}</div> : null}

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">01</span>
            <h2>Stored companies</h2>
          </div>
          <p>
            Use Discover for external legal-entity data or add a company
            manually when you already know the lead.
          </p>
        </div>

        <div className="company-toolbar">
          <Link className="primary-link" href="/discover">Discover companies</Link>
          <span>{companies.length} stored</span>
        </div>

        {companies.length === 0 ? (
          <div className="empty-state">
            <h3>No real company records yet.</h3>
            <p>
              The old synthetic Today fixtures are no longer your signed-in
              company database. Discover or add a company to begin M2.
            </p>
            <Link className="primary-link" href="/discover">Open discovery</Link>
          </div>
        ) : (
          <div className="company-list">
            {companies.map((company) => (
              <Link
                href={`/companies/${company.id}`}
                className="company-list-card"
                key={company.id}
              >
                <div>
                  <strong>{company.displayName}</strong>
                  <p>
                    {company.industry ?? "Industry not enriched"} ·{" "}
                    {[company.city, company.state, company.country]
                      .filter(Boolean)
                      .join(", ") || "Location not enriched"}
                  </p>
                </div>
                <div className="company-list-meta">
                  <span>{company.sourceOrigin}</span>
                  <span>{company.evidenceCount} evidence</span>
                  <span>{company.signalCount} signals</span>
                  <span>{company.relationshipStatus}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">02</span>
            <h2>Add a company manually</h2>
          </div>
          <p>
            Manual creation is useful for a known lead. RevenueScout checks
            domain and normalised name/country before creating a duplicate.
          </p>
        </div>
        <details className="config-card create-card">
          <summary className="config-summary">
            <span>
              <strong>New manual company</strong>
              <small>Add a known lead, then attach evidence and signals.</small>
            </span>
            <span>Open</span>
          </summary>
          <form className="form-grid edit-form" action="/api/companies" method="post">
            <CompanyFields />
            <div className="span-2 form-actions">
              <button className="primary-button" type="submit">
                Create company
              </button>
            </div>
          </form>
        </details>
      </section>
    </main>
  );
}
