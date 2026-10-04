import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listDiscoveryProviders } from "@/lib/discovery/providers";
import type { DiscoveryCandidate } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

type Named = { id: string; name: string };

type DiscoveryRun = {
  id: string;
  provider: string;
  query: string;
  country: string | null;
  region: string | null;
  status: string;
  resultCount: number;
  importedCount: number;
  results: DiscoveryCandidate[];
  errorMessage: string | null;
  createdAt: Date;
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const [offerings, icps] = await Promise.all([
    sql<Named[]>`
      SELECT id, name FROM offerings
      WHERE organization_id = ${user.organizationId}
      ORDER BY name
    `,
    sql<Named[]>`
      SELECT id, name FROM icps
      WHERE organization_id = ${user.organizationId}
      ORDER BY name
    `,
  ]);

  let run: DiscoveryRun | null = null;

  if (params.run) {
    const [found] = await sql<DiscoveryRun[]>`
      SELECT
        id,
        provider,
        query,
        country,
        region,
        status,
        result_count AS "resultCount",
        imported_count AS "importedCount",
        results,
        error_message AS "errorMessage",
        created_at AS "createdAt"
      FROM discovery_runs
      WHERE id = ${params.run}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    run = found ?? null;
  }

  const providers = listDiscoveryProviders();

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link className="nav-active" href="/discover">Discover</Link>
          <Link href="/companies">Companies</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M2 · Real external source</div>
          <h1>Discover companies</h1>
          <p className="lede">
            Search an external provider, inspect provenance, then import only
            the companies worth enriching.
          </p>
        </div>
      </header>

      {params.error ? <div className="error-banner">{params.error}</div> : null}

      <section className="discovery-source-note">
        <strong>Current live source: GLEIF.</strong>
        <p>
          GLEIF provides real Legal Entity Identifier reference data. It is
          useful for legal-entity discovery and verification, but it is not a
          comprehensive Australian SME directory and usually does not provide
          employee count or industry. RevenueScout therefore marks those fields
          as needing enrichment instead of inventing them.
        </p>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">01</span>
            <h2>Search</h2>
          </div>
          <p>
            The selected ICP and Offering are stored with the discovery run for
            traceability. This first adapter searches legal names.
          </p>
        </div>

        <form className="config-card discovery-form" action="/api/discovery/search" method="post">
          <label>
            Provider
            <select name="provider">
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company name / keyword
            <input name="query" placeholder="e.g. logistics" required minLength={2} />
          </label>
          <label>
            Country code
            <input name="country" defaultValue="AU" maxLength={2} />
          </label>
          <label>
            Region
            <input name="region" placeholder="Optional, stored with run" />
          </label>
          <label>
            ICP context
            <select name="icpId" defaultValue={icps[0]?.id ?? ""}>
              <option value="">No ICP context</option>
              {icps.map((icp) => (
                <option key={icp.id} value={icp.id}>{icp.name}</option>
              ))}
            </select>
          </label>
          <label>
            Offering context
            <select name="offeringId" defaultValue={offerings[0]?.id ?? ""}>
              <option value="">No Offering context</option>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>{offering.name}</option>
              ))}
            </select>
          </label>
          <div className="span-2 form-actions">
            <button className="primary-button" type="submit">
              Discover opportunities
            </button>
          </div>
        </form>
      </section>

      {run ? (
        <section className="setup-section">
          <div className="setup-section-heading">
            <div>
              <span className="step-number">02</span>
              <h2>Discovery results</h2>
            </div>
            <p>
              {run.provider} · query “{run.query}” · {run.resultCount} returned ·{" "}
              {run.importedCount} imported
            </p>
          </div>

          {run.results.length === 0 ? (
            <div className="empty-state">
              <h3>No entities returned.</h3>
              <p>Try a broader legal-name keyword or remove the country filter.</p>
            </div>
          ) : (
            <div className="discovery-results">
              {run.results.map((candidate, index) => (
                <article className="discovery-result-card" key={candidate.providerRecordId}>
                  <div>
                    <span className="source-badge">{candidate.provider}</span>
                    <h3>{candidate.displayName}</h3>
                    <p>
                      {[candidate.city, candidate.state, candidate.country]
                        .filter(Boolean)
                        .join(", ") || "Location unavailable"}
                    </p>
                    <p className="discovery-description">
                      {candidate.description ?? "No provider description."}
                    </p>
                  </div>
                  <div className="discovery-data-grid">
                    <span>
                      <small>LEI / provider ID</small>
                      <strong>{candidate.providerRecordId}</strong>
                    </span>
                    <span>
                      <small>Industry</small>
                      <strong>{candidate.industry ?? "Needs enrichment"}</strong>
                    </span>
                    <span>
                      <small>Employees</small>
                      <strong>{candidate.employeeCount ?? "Needs enrichment"}</strong>
                    </span>
                    <span>
                      <small>ICP Fit</small>
                      <strong>Pending enrichment</strong>
                    </span>
                  </div>
                  <div className="discovery-result-actions">
                    <a
                      href={candidate.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-link"
                    >
                      View source
                    </a>
                    <form action="/api/discovery/import" method="post">
                      <input type="hidden" name="runId" value={run.id} />
                      <input type="hidden" name="candidateIndex" value={index} />
                      <button className="primary-button" type="submit">
                        Import company
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
