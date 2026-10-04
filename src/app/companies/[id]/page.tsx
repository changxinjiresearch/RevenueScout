import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CompanyFields,
  type CompanyFormValue,
} from "@/components/company-fields";
import { requireUser } from "@/lib/auth/session";
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
import {
  evidenceAgeDays,
  evidenceFreshness,
} from "@/lib/evidence/freshness";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CompanyView = CompanyRecord &
  CompanyFormValue & {
    legalName: string | null;
    address: string | null;
    productsServices: string | null;
    sourceOrigin: string;
    createdAt: Date;
    updatedAt: Date;
  };

type EvidenceView = EvidenceRecord & {
  sourceType: string;
  sourceUrl: string | null;
  title: string;
  excerpt: string;
  capturedAt: Date;
  providerRecordId: string | null;
};

type SignalView = SignalRecord & {
  evidenceTitle: string;
  sourceUrl: string | null;
};

type Identifier = {
  identifierType: string;
  identifierValue: string;
  provider: string | null;
};

type ImportOrigin = {
  provider: string;
  query: string;
  duplicateDetected: boolean;
  duplicateReason: string | null;
  createdAt: Date;
};

export default async function CompanyIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
    imported?: string;
    duplicate?: string;
    created?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const sql = db();

  const [company] = await sql<CompanyView[]>`
    SELECT
      id,
      display_name AS "displayName",
      legal_name AS "legalName",
      website,
      domain,
      logo_url AS "logoUrl",
      description,
      country,
      state,
      city,
      address,
      industry,
      subindustry,
      employee_count AS "employeeCount",
      employee_range AS "employeeRange",
      founded_year AS "foundedYear",
      company_type AS "companyType",
      service_regions AS "serviceRegions",
      products_services AS "productsServices",
      roles_observed AS "rolesObserved",
      business_models AS "businessModels",
      technologies,
      fast_growth AS "fastGrowth",
      multi_location AS "multiLocation",
      currently_hiring AS "currentlyHiring",
      recent_funding AS "recentFunding",
      digital_need AS "digitalNeed",
      entity_type AS "entityType",
      relationship_status AS "relationshipStatus",
      source_origin AS "sourceOrigin",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM companies
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) notFound();

  const [evidence, signals, identifiers, imports, icps, offerings, links] =
    await Promise.all([
      sql<EvidenceView[]>`
        SELECT
          id,
          company_id AS "companyId",
          source_type AS "sourceType",
          source_url AS "sourceUrl",
          source_label AS "sourceLabel",
          title,
          excerpt,
          observed_at AS "observedAt",
          captured_at AS "capturedAt",
          confidence::float8 AS confidence,
          verification_status AS "verificationStatus",
          stale_after_days AS "staleAfterDays",
          provider_record_id AS "providerRecordId"
        FROM company_evidence
        WHERE company_id = ${id}
          AND organization_id = ${user.organizationId}
        ORDER BY observed_at DESC, created_at DESC
      `,
      sql<SignalView[]>`
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
          e.source_label AS "sourceLabel",
          e.title AS "evidenceTitle",
          e.source_url AS "sourceUrl"
        FROM buying_signals s
        JOIN company_evidence e ON e.id = s.evidence_id
        WHERE s.company_id = ${id}
          AND s.organization_id = ${user.organizationId}
        ORDER BY s.observed_at DESC, s.created_at DESC
      `,
      sql<Identifier[]>`
        SELECT
          identifier_type AS "identifierType",
          identifier_value AS "identifierValue",
          provider
        FROM company_identifiers
        WHERE company_id = ${id}
        ORDER BY identifier_type
      `,
      sql<ImportOrigin[]>`
        SELECT
          dr.provider,
          dr.query,
          di.duplicate_detected AS "duplicateDetected",
          di.duplicate_reason AS "duplicateReason",
          di.created_at AS "createdAt"
        FROM discovery_imports di
        JOIN discovery_runs dr ON dr.id = di.discovery_run_id
        WHERE di.company_id = ${id}
        ORDER BY di.created_at DESC
      `,
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
          min_contract_value::float8 AS "minContractValue",
          avg_contract_value::float8 AS "avgContractValue",
          ideal_contract_value::float8 AS "idealContractValue"
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
    ]);

  const configured = buildConfiguredOpportunityFromCompany({
    company,
    evidence,
    signals,
    icps,
    offerings,
    links,
  });
  const assessment = configured
    ? assessOpportunity(configured.opportunity)
    : null;

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

      <header className="company-intel-header">
        <div>
          <div className="eyebrow">Company Intelligence</div>
          <h1>{company.displayName}</h1>
          <p>
            {company.industry ?? "Industry not yet enriched"} ·{" "}
            {[company.city, company.state, company.country].filter(Boolean).join(", ") ||
              "Location not yet enriched"}
          </p>
          <div className="company-badges">
            <span>{company.sourceOrigin}</span>
            <span>{company.relationshipStatus}</span>
            <span>{evidence.length} evidence</span>
            <span>{signals.length} signals</span>
          </div>
        </div>

        <aside className="company-decision-card">
          {configured && assessment ? (
            <>
              <span>Current decision view</span>
              <strong>{assessment.opportunityScore}/100</strong>
              <small>
                ICP: {configured.matchedIcp.icpName} ·{" "}
                {configured.opportunity.recommendedOffering}
              </small>
            </>
          ) : (
            <>
              <span>Current decision view</span>
              <strong>Not qualified</strong>
              <small>
                Complete missing company intelligence or review ICP qualification gates.
              </small>
            </>
          )}
        </aside>
      </header>

      {query.saved ? <div className="success-banner">Saved successfully.</div> : null}
      {query.created ? <div className="success-banner">Company created.</div> : null}
      {query.imported ? (
        <div className="success-banner">
          Imported from a real external discovery source. Enrich missing ICP fields below.
        </div>
      ) : null}
      {query.duplicate ? (
        <div className="warning-banner">
          Duplicate prevention matched this existing company. The external evidence
          was attached here instead of creating another company record.
        </div>
      ) : null}
      {query.error ? <div className="error-banner">{query.error}</div> : null}

      <section className="intel-grid">
        <article className="intel-panel">
          <div className="intel-panel-heading">
            <div>
              <div className="eyebrow">Qualification</div>
              <h2>Company profile</h2>
            </div>
            <span className={configured ? "qualified-pill" : "pending-pill"}>
              {configured ? "Qualified" : "Needs enrichment / not qualified"}
            </span>
          </div>

          <dl className="company-facts">
            <div><dt>Legal name</dt><dd>{company.legalName ?? "—"}</dd></div>
            <div><dt>Website</dt><dd>{company.website ?? "—"}</dd></div>
            <div><dt>Industry</dt><dd>{company.industry ?? "—"}</dd></div>
            <div><dt>Employees</dt><dd>{company.employeeCount ?? company.employeeRange ?? "—"}</dd></div>
            <div><dt>Founded</dt><dd>{company.foundedYear ?? "—"}</dd></div>
            <div><dt>Company type</dt><dd>{company.companyType ?? company.entityType}</dd></div>
          </dl>

          {identifiers.length > 0 ? (
            <div className="identifier-list">
              {identifiers.map((identifier) => (
                <span key={`${identifier.identifierType}-${identifier.identifierValue}`}>
                  {identifier.identifierType}: {identifier.identifierValue}
                </span>
              ))}
            </div>
          ) : null}

          {imports.length > 0 ? (
            <div className="source-origin-box">
              <strong>Discovery provenance</strong>
              {imports.map((origin, index) => (
                <p key={index}>
                  {origin.provider} search “{origin.query}”
                  {origin.duplicateDetected
                    ? ` · deduplicated by ${origin.duplicateReason}`
                    : " · imported as new company"}
                </p>
              ))}
            </div>
          ) : null}
        </article>

        <article className="intel-panel">
          <div className="eyebrow">Why now</div>
          <h2>Buying-signal summary</h2>
          {signals.length === 0 ? (
            <div className="intel-empty">
              No buying signal yet. A company can be a good ICP match without
              having evidence that now is the right time to contact it.
            </div>
          ) : (
            <>
              <strong className="why-now-lead">
                {configured?.opportunity.whyNow ?? signals[0].summary}
              </strong>
              <p>
                {configured?.opportunity.problemHypothesis ??
                  "Review evidence before forming a problem hypothesis."}
              </p>
            </>
          )}
        </article>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div><span className="step-number">01</span><h2>Signal timeline</h2></div>
          <p>
            Signals are events, not facts invented by the model. Every signal
            below must point to a stored evidence item.
          </p>
        </div>

        {signals.length === 0 ? (
          <div className="config-card blocked-card">No signals recorded yet.</div>
        ) : (
          <div className="timeline">
            {signals.map((signal) => (
              <article className="timeline-item" key={signal.id}>
                <div className="timeline-date">
                  {new Date(signal.observedAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div>
                  <div className="signal-title-row">
                    <span className="signal-chip">
                      {signal.signalType.replaceAll("_", " ")}
                    </span>
                    <strong>{signal.label}</strong>
                  </div>
                  <p>{signal.summary}</p>
                  <small>
                    {signal.verificationStatus} · confidence{" "}
                    {Math.round(signal.confidence * 100)}% · source:{" "}
                    {signal.sourceUrl ? (
                      <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
                        {signal.sourceLabel}
                      </a>
                    ) : (
                      signal.sourceLabel
                    )}
                  </small>
                  <details>
                    <summary>Why this may matter</summary>
                    <p>{signal.rationale}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div><span className="step-number">02</span><h2>Evidence</h2></div>
          <p>
            Evidence preserves source, observation date, verification,
            confidence and freshness. Stale evidence remains visible instead of
            silently disappearing.
          </p>
        </div>

        {evidence.length === 0 ? (
          <div className="config-card blocked-card">No evidence recorded yet.</div>
        ) : (
          <div className="evidence-list">
            {evidence.map((item) => {
              const freshness = evidenceFreshness(
                item.observedAt,
                item.staleAfterDays,
              );
              const age = evidenceAgeDays(item.observedAt);

              return (
                <article className="evidence-card" key={item.id}>
                  <div className="evidence-card-top">
                    <div>
                      <span className="source-badge">{item.sourceType}</span>
                      <h3>{item.title}</h3>
                    </div>
                    <div className="evidence-status">
                      <span>{item.verificationStatus}</span>
                      <span>{freshness}</span>
                    </div>
                  </div>
                  <p>{item.excerpt}</p>
                  <div className="evidence-meta">
                    <span>Observed {age === null ? "unknown" : `${age} days ago`}</span>
                    <span>Confidence {Math.round(item.confidence * 100)}%</span>
                    <span>Stale after {item.staleAfterDays} days</span>
                    {item.sourceUrl ? (
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        Open source
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div><span className="step-number">03</span><h2>Enrich company</h2></div>
          <p>
            External registries often lack industry and headcount. RevenueScout
            leaves missing fields blank instead of guessing; enrich them here
            before ICP qualification.
          </p>
        </div>
        <details className="config-card">
          <summary className="config-summary">
            <span>
              <strong>Edit company intelligence</strong>
              <small>These fields feed directly into ICP qualification.</small>
            </span>
            <span>Open</span>
          </summary>
          <form className="form-grid edit-form" action={`/api/companies/${id}`} method="post">
            <CompanyFields company={company} includeRelationship />
            <div className="span-2 form-actions">
              <button className="primary-button" type="submit">
                Save company intelligence
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="two-form-grid">
        <article className="setup-section">
          <div className="setup-section-heading compact-heading">
            <div><span className="step-number">04</span><h2>Add evidence</h2></div>
          </div>
          <form
            className="config-card stack-form"
            action={`/api/companies/${id}/evidence`}
            method="post"
          >
            <label>
              Source type
              <select name="sourceType" defaultValue="COMPANY_WEBSITE">
                <option value="COMPANY_WEBSITE">Company website</option>
                <option value="NEWS">News</option>
                <option value="JOB_BOARD">Job board</option>
                <option value="TENDER">Tender / procurement</option>
                <option value="REGISTRY">Registry</option>
                <option value="MANUAL">Manual observation</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Source label
              <input name="sourceLabel" placeholder="Company careers page" required />
            </label>
            <label>
              Source URL
              <input name="sourceUrl" type="url" placeholder="https://…" />
            </label>
            <label>
              Evidence title
              <input name="title" placeholder="12 operations roles advertised" required />
            </label>
            <label>
              Evidence excerpt / observation
              <textarea
                name="excerpt"
                rows={4}
                placeholder="Record only what the source actually supports."
                required
              />
            </label>
            <label>
              Observed date
              <input
                name="observedAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Verification
              <select name="verificationStatus" defaultValue="LIKELY">
                <option value="CONFIRMED">Confirmed</option>
                <option value="LIKELY">Likely</option>
                <option value="UNVERIFIED">Unverified</option>
                <option value="OUTDATED">Outdated</option>
              </select>
            </label>
            <label>
              Confidence
              <select name="confidence" defaultValue="0.8">
                <option value="0.98">98% · high</option>
                <option value="0.8">80% · medium-high</option>
                <option value="0.6">60% · medium</option>
                <option value="0.4">40% · low</option>
              </select>
            </label>
            <label>
              Stale after days
              <input name="staleAfterDays" type="number" min="1" defaultValue="90" />
            </label>
            <button className="primary-button" type="submit">Save evidence</button>
          </form>
        </article>

        <article className="setup-section">
          <div className="setup-section-heading compact-heading">
            <div><span className="step-number">05</span><h2>Create signal</h2></div>
          </div>
          {evidence.length === 0 ? (
            <div className="config-card blocked-card">
              Add evidence first. RevenueScout does not allow an evidence-free
              buying signal.
            </div>
          ) : (
            <form
              className="config-card stack-form"
              action={`/api/companies/${id}/signals`}
              method="post"
            >
              <label>
                Evidence
                <select name="evidenceId">
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Signal type
                <select name="signalType">
                  <option value="HIRING">Hiring</option>
                  <option value="EXPANSION">Expansion</option>
                  <option value="FUNDING">Funding</option>
                  <option value="LEADERSHIP">Leadership</option>
                  <option value="TECHNOLOGY">Technology</option>
                  <option value="OPERATIONAL_PAIN">Potential operational pain</option>
                  <option value="GROWTH">Growth</option>
                  <option value="PROCUREMENT">Procurement / tender</option>
                </select>
              </label>
              <label>
                Signal label
                <input name="label" placeholder="Operations hiring increase" required />
              </label>
              <label>
                What was observed?
                <textarea
                  name="summary"
                  rows={3}
                  placeholder="Describe the event without adding unsupported conclusions."
                  required
                />
              </label>
              <label>
                Why might this affect buying timing?
                <textarea
                  name="rationale"
                  rows={3}
                  placeholder="Explain the commercial hypothesis."
                  required
                />
              </label>
              <label>
                Strength
                <input name="strength" type="number" min="0" max="100" defaultValue="70" />
              </label>
              <label>
                Confidence
                <select name="confidence" defaultValue="0.8">
                  <option value="0.95">95%</option>
                  <option value="0.8">80%</option>
                  <option value="0.6">60%</option>
                  <option value="0.4">40%</option>
                </select>
              </label>
              <label>
                Verification
                <select name="verificationStatus" defaultValue="LIKELY">
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="LIKELY">Likely</option>
                  <option value="UNVERIFIED">Unverified</option>
                  <option value="OUTDATED">Outdated</option>
                </select>
              </label>
              <button className="primary-button" type="submit">Create signal</button>
            </form>
          )}
        </article>
      </section>
    </main>
  );
}
