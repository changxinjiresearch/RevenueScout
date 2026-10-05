import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jsonArrayValue } from "@/lib/db/json-value";
import { listDiscoveryProviders } from "@/lib/discovery/providers";
import type { DiscoveryCandidate } from "@/lib/discovery/types";
import { assessDiscoveryCandidate } from "@/lib/companies/triage";
import type { ProgressiveDiscoveryProgress } from "@/lib/discovery/progressive";
import { DiscoveryProgress } from "./DiscoveryProgress";

export const dynamic = "force-dynamic";

function sourcePageUrl(candidate: DiscoveryCandidate): string {
  if (candidate.provider === "GLEIF") {
    return `https://search.gleif.org/#/record/${encodeURIComponent(
      candidate.providerRecordId,
    )}`;
  }

  return candidate.sourceUrl;
}

function triageLabel(status: string): string {
  if (status === "HIGH_POTENTIAL") return "High potential";
  if (status === "MEDIUM_POTENTIAL") return "Medium potential";
  if (status === "LOW_POTENTIAL") return "Low potential";
  return "Needs enrichment";
}

function candidatePriorityLabel(candidate: DiscoveryCandidate): string {
  const priority = candidate.discoveryPriority;
  if (!priority) return triageLabel(assessDiscoveryCandidate(candidate).status);
  if (priority.qualificationStatus === "NOT_QUALIFIED") return "Not qualified";
  if (priority.band === "HIGH") return "High priority";
  if (priority.band === "MEDIUM") return "Medium priority";
  return "Research priority";
}

function candidatePriorityHeadline(candidate: DiscoveryCandidate): string {
  const priority = candidate.discoveryPriority;
  if (!priority) return assessDiscoveryCandidate(candidate).headline;
  if (priority.qualificationStatus === "QUALIFIED") {
    return "ICP qualified with independently validated industry evidence";
  }
  if (priority.qualificationStatus === "PARTIALLY_QUALIFIED") {
    return "Strong partial ICP match; missing fields remain unknown";
  }
  return "Known ICP mismatch; keep only for research if useful";
}

function totalSourceFamilies(candidate: DiscoveryCandidate): number {
  return new Set(
    (candidate.sourceEvidence ?? []).map((item) => item.sourceFamily),
  ).size;
}

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
  progress: ProgressiveDiscoveryProgress | null;
  createdAt: Date;
};

type DiscoveryRunRow = Omit<DiscoveryRun, "results"> & {
  results: unknown;
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
    const [found] = await sql<DiscoveryRunRow[]>`
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
        progress,
        created_at AS "createdAt"
      FROM discovery_runs
      WHERE id = ${params.run}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    run = found
      ? { ...found, results: jsonArrayValue<DiscoveryCandidate>(found.results) }
      : null;
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
        <strong>Multi-source semantic discovery is active.</strong>
        <p>
          RevenueScout expands the industry keyword into related business
          semantics, searches independent public sources, merges duplicate
          entities, and only returns companies whose industry relevance is
          supported by at least two independent source families. There is no
          fixed product-level result cap; provider pagination is exhausted and
          all unique validated matches are retained.
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
            traceability. Industry discovery uses multiple semantic variants
            rather than relying on a legal-name keyword alone.
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

          {run.status === "RUNNING" ? (
            <DiscoveryProgress
              runId={run.id}
              initialStatus={run.status}
              initialProgress={run.progress}
            />
          ) : null}

          {run.status === "FAILED" ? (
            <div className="error-banner">
              Discovery failed: {run.errorMessage ?? "Unknown discovery error."}
            </div>
          ) : null}

          {run.results.length === 0 ? (
            <div className="empty-state">
              <h3>
                {run.status === "RUNNING"
                  ? "Searching and validating companies…"
                  : "No companies passed multi-source validation."}
              </h3>
              <p>
                {run.status === "RUNNING"
                  ? "Validated companies will appear here progressively; you do not need to wait for the entire market search to finish."
                  : "Try a broader market concept or a different geography."}
              </p>
            </div>
          ) : (
            <div className="discovery-results">
              {run.results.map((candidate, index) => {
                const precheck = assessDiscoveryCandidate(candidate);
                const priority = candidate.discoveryPriority;
                const lowPotential =
                  priority?.qualificationStatus === "NOT_QUALIFIED" ||
                  precheck.status === "LOW_POTENTIAL";
                const sourceFamilies = totalSourceFamilies(candidate);
                const industrySources =
                  candidate.industryValidation?.independentSupportingFamilyCount ?? 0;

                return (
                  <article
                    className="discovery-result-card"
                    key={candidate.providerRecordId}
                  >
                    <div className="discovery-result-head">
                      <div>
                        <span className="source-badge">
                          {candidate.industryValidation
                            ? `${sourceFamilies} sources · ${industrySources} industry`
                            : candidate.provider}
                        </span>
                        <h3>{candidate.displayName}</h3>
                        <p>
                          {[candidate.city, candidate.state, candidate.country]
                            .filter(Boolean)
                            .join(", ") || "Location unavailable"}
                        </p>
                      </div>
                      <span
                        className={
                          lowPotential
                            ? "triage-pill triage-low"
                            : priority?.band === "HIGH"
                              ? "triage-pill"
                              : "triage-pill triage-review"
                        }
                      >
                        {candidatePriorityLabel(candidate)}
                      </span>
                    </div>

                    <div className="discovery-precheck">
                      <strong>{candidatePriorityHeadline(candidate)}</strong>
                      <p>
                        {priority?.rationale[priority.rationale.length - 1] ??
                          precheck.reasons[0]}
                      </p>
                      {priority?.missingFields.length ? (
                        <p>
                          Still unknown: {priority.missingFields.join(", ")}.
                          Unknown fields are not scored as negative.
                        </p>
                      ) : null}
                      {candidate.industryValidation ? (
                        <p>
                          Industry {candidate.industryValidation.status.toLowerCase()} ·{" "}
                          {Math.round(candidate.industryValidation.confidence * 100)}%
                          confidence · matched semantics:{" "}
                          {candidate.industryValidation.matchedSemantics.join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="discovery-data-grid">
                      <span>
                        <small>Entity category</small>
                        <strong>
                          {candidate.legalEntityCategory ?? "Not provided"}
                        </strong>
                      </span>
                      <span>
                        <small>Entity status</small>
                        <strong>{candidate.entityStatus ?? "Not provided"}</strong>
                      </span>
                      <span>
                        <small>Industry</small>
                        <strong>{candidate.industry ?? "Needs enrichment"}</strong>
                      </span>
                      <span>
                        <small>Employees</small>
                        <strong>{candidate.employeeCount ?? "Unknown"}</strong>
                      </span>
                    </div>

                    <div className="discovery-result-actions">
                      <a
                        href={sourcePageUrl(candidate)}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-link"
                      >
                        View source
                      </a>
                      <form action="/api/discovery/import" method="post">
                        <input type="hidden" name="runId" value={run.id} />
                        <input type="hidden" name="candidateIndex" value={index} />
                        <input
                          type="hidden"
                          name="candidateKey"
                          value={candidate.providerRecordId}
                        />
                        <button
                          className={lowPotential ? "secondary-button" : "primary-button"}
                          type="submit"
                        >
                          {lowPotential ? "Import anyway" : "Import & review"}
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
