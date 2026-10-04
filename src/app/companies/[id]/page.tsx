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
import {
  assessCompanyTriage,
  type TriageCompany,
} from "@/lib/companies/triage";
import type {
  IcpRule,
  OfferingConfig,
  OfferingIcpLink,
} from "@/lib/domain/configured-opportunity";
import { db } from "@/lib/db";
import {
  evidenceAgeDays,
  evidenceFreshness,
} from "@/lib/evidence/freshness";
import type { WebResearchResult } from "@/lib/enrichment/result-types";

export const dynamic = "force-dynamic";

type CompanyView = TriageCompany &
  CompanyFormValue & {
    legalName: string | null;
    address: string | null;
    productsServices: string | null;
    sourceOrigin: string;
    providerLastUpdatedAt: Date | null;
    registrationAuthority: string | null;
    registeredAs: string | null;
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

type ResearchRun = {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  sourceUrls: string[];
  sourceCount: number;
  structuredResult: WebResearchResult | null;
  errorMessage: string | null;
  completedAt: Date | null;
};

function triageText(status: string) {
  if (status === "HIGH_POTENTIAL") return "High potential";
  if (status === "MEDIUM_POTENTIAL") return "Medium potential";
  if (status === "LOW_POTENTIAL") return "Low potential";
  return "Needs enrichment";
}

function triageClass(status: string) {
  if (status === "HIGH_POTENTIAL") return "triage-high";
  if (status === "MEDIUM_POTENTIAL") return "triage-medium";
  if (status === "LOW_POTENTIAL") return "triage-low";
  return "triage-review";
}

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
    triaged?: string;
    research?: string;
    research_error?: string;
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
      legal_entity_category AS "legalEntityCategory",
      legal_entity_subcategory AS "legalEntitySubcategory",
      entity_status AS "entityStatus",
      registration_status AS "registrationStatus",
      jurisdiction,
      legal_form_code AS "legalFormCode",
      registration_authority AS "registrationAuthority",
      registered_as AS "registeredAs",
      provider_last_updated_at AS "providerLastUpdatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM companies
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) notFound();

  const [evidence, signals, identifiers, icps, offerings, links] =
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

  const [researchRun] = await sql<ResearchRun[]>`
    SELECT
      id,
      status,
      source_urls AS "sourceUrls",
      source_count AS "sourceCount",
      structured_result AS "structuredResult",
      error_message AS "errorMessage",
      completed_at AS "completedAt"
    FROM web_enrichment_runs
    WHERE company_id = ${id}
      AND organization_id = ${user.organizationId}
      AND engine = 'REVENUESCOUT_INTELLIGENCE_V1'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const configured = buildConfiguredOpportunityFromCompany({
    company: company as CompanyRecord,
    evidence,
    signals,
    icps,
    offerings,
    links,
  });

  const triage = assessCompanyTriage({
    company,
    configured,
    icps,
    signals,
  });

  const primaryEvidence = evidence[0] ?? null;
  const lei = identifiers.find((item) => item.identifierType === "LEI");
  const hasMissing = triage.missingFields.length > 0;

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

      <header className="fast-review-header">
        <div>
          <div className="eyebrow">Fast company review</div>
          <h1>{company.displayName}</h1>
          <p>
            {[company.city, company.state, company.country]
              .filter(Boolean)
              .join(", ") || "Location not available"}
          </p>
        </div>
        {primaryEvidence?.sourceUrl ? (
          <a
            className="secondary-link"
            href={primaryEvidence.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        ) : null}
      </header>

      {query.imported ? (
        <div className="success-banner">
          Imported. RevenueScout has already filled every field available from
          the source and assessed the company below.
        </div>
      ) : null}
      {query.duplicate ? (
        <div className="warning-banner">
          This matched an existing company, so the new source evidence was
          attached instead of creating a duplicate.
        </div>
      ) : null}
      {query.saved ? <div className="success-banner">Updated.</div> : null}
      {query.triaged ? (
        <div className="success-banner">Review decision saved.</div>
      ) : null}
      {query.error ? <div className="error-banner">{query.error}</div> : null}
      {query.research ? (
        <div className="success-banner">
          RevenueScout Intelligence Engine completed the analysis and reassessed the company.
        </div>
      ) : null}
      {query.research_error ? (
        <div className="error-banner">
          RevenueScout Intelligence Engine failed. Open the analysis card below for the latest status.
        </div>
      ) : null}

      <section className="ai-research-card">
        <div className="ai-research-heading">
          <div>
            <div className="eyebrow">RevenueScout Intelligence Engine</div>
            <h2>Zero-cost company analysis</h2>
            <p>
              RevenueScout collects public company pages, extracts company facts and buying signals, then scores them with the built-in RS Conversion Model v1. No paid AI API is used.
            </p>
          </div>
          <form action={`/api/companies/${id}/research`} method="post">
            <button className="primary-button" type="submit">
              {researchRun?.status === "COMPLETED"
                ? "Re-run analysis"
                : "Analyze company"}
            </button>
          </form>
        </div>

        {!researchRun ? (
          <div className="ai-research-empty">
            No RevenueScout Intelligence Engine analysis has been run yet.
          </div>
        ) : null}

        {researchRun?.status === "RUNNING" ? (
          <div className="ai-research-empty">
            Analysis is running. Reload this page shortly.
          </div>
        ) : null}

        {researchRun?.status === "FAILED" ? (
          <div className="error-banner">
            Analysis failed: {researchRun.errorMessage ?? "Unknown error"}
          </div>
        ) : null}

        {researchRun?.status === "COMPLETED" &&
        researchRun.structuredResult ? (
          <>
            <div className="ai-score-row">
              <div>
                <span>Commercial potential</span>
                <strong>
                  {researchRun.structuredResult.overallPotentialScore}/100
                </strong>
              </div>
              <div>
                <span>Estimated conversion likelihood</span>
                <strong>
                  {researchRun.structuredResult.estimatedConversionPercent}%
                </strong>
              </div>
              <div>
                <span>Evidence confidence</span>
                <strong>
                  {researchRun.structuredResult.evidenceConfidence}%
                </strong>
              </div>
              <div>
                <span>Sources checked</span>
                <strong>{researchRun.sourceCount}</strong>
              </div>
            </div>

            <div className="ai-summary">
              <strong>
                {researchRun.structuredResult.assessmentSummary}
              </strong>
              <p>
                Pre-contact estimate from RS Conversion Model v1. It is deterministic and not yet calibrated against historical Won/Lost outcomes.
              </p>
            </div>

            <div className="ai-insight-grid">
              <div>
                <span className="field-label">Why this company</span>
                <ul>
                  {researchRun.structuredResult.whyFit
                    .slice(0, 4)
                    .map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <span className="field-label">Why now</span>
                <ul>
                  {researchRun.structuredResult.whyNow
                    .slice(0, 4)
                    .map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <span className="field-label">Risks / uncertainty</span>
                <ul>
                  {researchRun.structuredResult.risks
                    .slice(0, 4)
                    .map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div className="ai-auto-fill">
              <div>
                <span>Official website</span>
                <strong>
                  {researchRun.structuredResult.officialWebsite ||
                    "Not verified"}
                </strong>
              </div>
              <div>
                <span>Industry</span>
                <strong>
                  {researchRun.structuredResult.industry || "Not verified"}
                </strong>
              </div>
              <div>
                <span>Employee estimate</span>
                <strong>
                  {researchRun.structuredResult.employeeLow >= 0 &&
                  researchRun.structuredResult.employeeHigh >= 0
                    ? `${researchRun.structuredResult.employeeLow}–${researchRun.structuredResult.employeeHigh}`
                    : "Not verified"}
                </strong>
              </div>
              <div>
                <span>Recommended contact</span>
                <strong>
                  {researchRun.structuredResult.recommendedContactRole ||
                    "Not identified"}
                </strong>
              </div>
            </div>

            <div className="ai-next-action">
              <span className="field-label">Recommended next action</span>
              <strong>{researchRun.structuredResult.nextAction}</strong>
            </div>

            {researchRun.sourceUrls.length > 0 ? (
              <details className="ai-sources">
                <summary>
                  View public sources ({researchRun.sourceCount})
                </summary>
                <div>
                  {researchRun.sourceUrls.slice(0, 8).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="triage-hero">
        <div className="triage-main">
          <div className="triage-label-row">
            <span className={`triage-pill ${triageClass(triage.status)}`}>
              {triageText(triage.status)}
            </span>
            {triage.score !== null ? (
              <span className="triage-score">{triage.score}/100</span>
            ) : null}
          </div>
          <h2>{triage.headline}</h2>
          <ul className="triage-reasons">
            {triage.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          {hasMissing ? (
            <div className="missing-strip">
              <strong>Only these fields still block a confident ICP decision:</strong>
              <div>
                {triage.missingFields.map((field) => (
                  <span key={field}>{field}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="triage-action-panel">
          <span className="field-label">Recommended action</span>
          <strong>
            {triage.recommendation === "ADD_TO_PIPELINE"
              ? "Add to pipeline"
              : triage.recommendation === "REJECT"
                ? "Reject"
                : "Review"}
          </strong>
          <p>
            Human confirmation stays final. One click is enough; you do not
            need to maintain the full company record manually.
          </p>

          <div className="triage-actions">
            <form action={`/api/companies/${id}/triage`} method="post">
              <input type="hidden" name="action" value="pipeline" />
              <button className="primary-button" type="submit">
                Add to pipeline
              </button>
            </form>
            <form action={`/api/companies/${id}/triage`} method="post">
              <input type="hidden" name="action" value="review" />
              <button className="secondary-button" type="submit">
                Keep for review
              </button>
            </form>
            <form action={`/api/companies/${id}/triage`} method="post">
              <input type="hidden" name="action" value="reject" />
              <button className="danger-button" type="submit">
                Reject
              </button>
            </form>
          </div>
        </aside>
      </section>

      <section className="fast-facts-grid">
        <article className="fast-panel">
          <div className="eyebrow">Auto-filled from source</div>
          <h2>Key facts</h2>
          <dl className="company-facts fast-facts">
            <div><dt>Legal name</dt><dd>{company.legalName ?? "—"}</dd></div>
            <div><dt>Entity category</dt><dd>{company.legalEntityCategory ?? "—"}</dd></div>
            <div><dt>Entity status</dt><dd>{company.entityStatus ?? "—"}</dd></div>
            <div><dt>Registration</dt><dd>{company.registrationStatus ?? "—"}</dd></div>
            <div><dt>Legal form</dt><dd>{company.companyType ?? company.legalFormCode ?? "—"}</dd></div>
            <div><dt>Jurisdiction</dt><dd>{company.jurisdiction ?? "—"}</dd></div>
            <div><dt>Industry</dt><dd>{company.industry ?? "Not available from source"}</dd></div>
            <div><dt>Employees</dt><dd>{company.employeeCount ?? "Not available from source"}</dd></div>
          </dl>

          {lei ? (
            <div className="identifier-list">
              <span>LEI: {lei.identifierValue}</span>
              {company.registeredAs ? (
                <span>Registered as: {company.registeredAs}</span>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="fast-panel">
          <div className="eyebrow">Buying timing</div>
          <h2>{signals.length > 0 ? "Why now" : "No current buying signal"}</h2>
          {signals.length > 0 ? (
            <>
              <strong className="why-now-lead">
                {configured?.opportunity.whyNow ?? signals[0].summary}
              </strong>
              <p>
                {configured?.opportunity.problemHypothesis ??
                  "Review the evidence before forming a business-problem hypothesis."}
              </p>
            </>
          ) : (
            <p className="muted-copy">
              The source verifies the company exists, but it does not prove that
              the company is buying now. RevenueScout will keep identity and
              buying intent separate.
            </p>
          )}
        </article>
      </section>

      {hasMissing && triage.status === "NEEDS_ENRICHMENT" ? (
        <section className="essential-enrichment">
          <div>
            <div className="eyebrow">Minimal enrichment</div>
            <h2>Fill only what changes the decision</h2>
            <p>
              Everything else stays auto-filled. These are the only missing
              ICP fields currently preventing RevenueScout from judging fit.
            </p>
          </div>

          <form
            className="essential-form"
            action={`/api/companies/${id}/essentials`}
            method="post"
          >
            {triage.missingFields.includes("Industry") ? (
              <label>
                Industry
                <input name="industry" placeholder="e.g. Logistics" required />
              </label>
            ) : null}
            {triage.missingFields.includes("Subindustry") ? (
              <label>
                Subindustry
                <input name="subindustry" placeholder="e.g. Freight" required />
              </label>
            ) : null}
            {triage.missingFields.includes("Employee count") ? (
              <label>
                Employee count
                <input name="employeeCount" type="number" min="1" required />
              </label>
            ) : null}
            {triage.missingFields.includes("Founded year") ? (
              <label>
                Founded year
                <input name="foundedYear" type="number" min="1800" max="2100" required />
              </label>
            ) : null}
            {triage.missingFields.includes("Company type") ? (
              <label>
                Company type
                <select name="companyType" defaultValue="Private">
                  <option value="Private">Private</option>
                  <option value="Public">Public</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            ) : null}
            {triage.missingFields.includes("Country") ? (
              <label>
                Country
                <input name="country" required />
              </label>
            ) : null}
            {triage.missingFields.includes("State / region") ? (
              <label>
                State / region
                <input name="state" required />
              </label>
            ) : null}
            {triage.missingFields.includes("City") ? (
              <label>
                City
                <input name="city" required />
              </label>
            ) : null}
            {triage.missingFields.includes("Service regions") ? (
              <label>
                Service regions
                <input
                  name="serviceRegions"
                  placeholder="NSW, VIC, Australia"
                  required
                />
              </label>
            ) : null}
            <button className="primary-button" type="submit">
              Save & reassess
            </button>
          </form>
        </section>
      ) : null}

      <details className="advanced-review">
        <summary>
          <span>
            <strong>Advanced details</strong>
            <small>Evidence, signals and full company editing</small>
          </span>
          <span>Open only if needed</span>
        </summary>

        <div className="advanced-review-body">
          <section>
            <h3>Evidence</h3>
            {evidence.length === 0 ? (
              <p className="muted-copy">No evidence recorded.</p>
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
                        <span>
                          Observed {age === null ? "unknown" : `${age} days ago`}
                        </span>
                        <span>Confidence {Math.round(item.confidence * 100)}%</span>
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View source
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3>Signal timeline</h3>
            {signals.length === 0 ? (
              <p className="muted-copy">No evidence-backed buying signal yet.</p>
            ) : (
              <div className="timeline">
                {signals.map((signal) => (
                  <article className="timeline-item" key={signal.id}>
                    <div className="timeline-date">
                      {new Date(signal.observedAt).toLocaleDateString("en-AU")}
                    </div>
                    <div>
                      <strong>{signal.label}</strong>
                      <p>{signal.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <details className="nested-advanced">
            <summary>Full company editor</summary>
            <form
              className="form-grid edit-form"
              action={`/api/companies/${id}`}
              method="post"
            >
              <CompanyFields company={company} includeRelationship />
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">
                  Save full record
                </button>
              </div>
            </form>
          </details>
        </div>
      </details>
    </main>
  );
}
