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
import {
  applyOpportunityOverride,
  createOrGetOpportunitySnapshot,
  type OpportunityOverride,
} from "@/lib/opportunities/service";
import {
  lifecycleStages,
  predictionRealityDelta,
  recommendContact,
  type ContactForRecommendation,
  type ContactabilityStatus,
  type DecisionRelevance,
  type LifecycleStage,
} from "@/lib/sales/lifecycle";

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

type AuditEvent = {
  id: string;
  eventType: "SNAPSHOT_CREATED" | "OVERRIDE_UPDATED" | "OVERRIDE_CLEARED";
  note: string;
  actorName: string | null;
  createdAt: Date;
};

type SnapshotHistory = {
  id: string;
  configVersion: number;
  opportunityScore: number;
  expectedRevenue: number;
  conversionProbability: number;
  offeringName: string | null;
  createdAt: Date;
};

type ContactView = ContactForRecommendation & {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  sourceUrl: string | null;
  sourceLabel: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

type SalesLifecycleView = {
  stage: LifecycleStage;
  ownerUserId: string | null;
  ownerName: string | null;
  primaryContactId: string | null;
  currentOfferingId: string | null;
  nextAction: string;
  nextActionAt: Date | null;
  notes: string;
  firstContactAt: Date | null;
  lastContactAt: Date | null;
  stageChangedAt: Date;
  updatedAt: Date;
};

type SalesActivityView = {
  id: string;
  contactId: string | null;
  contactName: string | null;
  activityType: string;
  channel: string;
  direction: string;
  subject: string;
  summary: string;
  activityStatus: string;
  followUpSequence: number;
  nextActionAt: Date | null;
  actorName: string | null;
  createdAt: Date;
};

type SalesOutcomeView = {
  outcome: "WON" | "LOST";
  opportunitySnapshotId: string | null;
  predictedOpportunityScore: number | null;
  predictedConversionProbability: number | null;
  predictedDealValue: number | null;
  predictedExpectedRevenue: number | null;
  actualContractValue: number | null;
  actualOfferingId: string | null;
  actualOfferingName: string | null;
  primaryContactName: string | null;
  lostReason: string | null;
  lostReasonNote: string;
  recommendationSource: string;
  salesCycleDays: number | null;
  closedAt: Date;
};

type WorkspaceMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
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

function priorityActionText(action: WebResearchResult["priorityAction"]) {
  if (action === "CONTACT_NOW") return "Contact now";
  if (action === "INVESTIGATE_URGENTLY") return "Investigate urgently";
  if (action === "REVIEW") return "Human review";
  if (action === "GATHER_MORE_DATA") return "Gather more data";
  if (action === "REJECT") return "Reject";
  return "Deprioritise research";
}

function claimStatusText(status: string) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CORROBORATED") return "Corroborated";
  if (status === "SINGLE_SOURCE") return "Single source";
  if (status === "CONFLICTED") return "Conflicted";
  if (status === "STALE") return "Stale";
  return "Unknown";
}

function lifecycleLabel(stage: LifecycleStage): string {
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function datetimeLocalValue(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function contactabilityLabel(status: ContactabilityStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decisionRelevanceLabel(status: DecisionRelevance): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
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
    override?: string;
    contact?: string;
    activity?: string;
    lifecycle?: string;
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
      AND engine = 'REVENUESCOUT_INTELLIGENCE_V2'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const engineResult =
    researchRun?.status === "COMPLETED"
      ? researchRun.structuredResult
      : null;

  const configured = buildConfiguredOpportunityFromCompany({
    company: company as CompanyRecord,
    evidence,
    signals,
    icps,
    offerings,
    links,
  });

  const opportunitySnapshot = await createOrGetOpportunitySnapshot({
    organizationId: user.organizationId,
    userId: user.id,
    configVersion: user.configVersion,
    company: company as CompanyRecord,
    evidence,
    signals,
    icps,
    offerings,
    links,
    m2SalesPriorityScore: engineResult?.salesPriorityScore ?? null,
  });

  const [opportunityOverrideRows, auditEvents, snapshotHistory] =
    opportunitySnapshot
      ? await Promise.all([
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
            AND company_id = ${id}
          LIMIT 1
        `,
        sql<AuditEvent[]>`
          SELECT
            a.id,
            a.event_type AS "eventType",
            a.note,
            u.name AS "actorName",
            a.created_at AS "createdAt"
          FROM opportunity_audit_events a
          LEFT JOIN users u ON u.id = a.actor_id
          WHERE a.organization_id = ${user.organizationId}
            AND a.company_id = ${id}
          ORDER BY a.created_at DESC
          LIMIT 8
        `,
        sql<SnapshotHistory[]>`
          SELECT
            id,
            config_version AS "configVersion",
            opportunity_score AS "opportunityScore",
            expected_revenue::float8 AS "expectedRevenue",
            conversion_probability::float8 AS "conversionProbability",
            offering_name AS "offeringName",
            created_at AS "createdAt"
          FROM opportunity_snapshots
          WHERE organization_id = ${user.organizationId}
            AND company_id = ${id}
          ORDER BY created_at DESC
          LIMIT 8
        `,
      ])
      : [
          [] as OpportunityOverride[],
          [] as AuditEvent[],
          [] as SnapshotHistory[],
        ];

  const opportunityOverride = opportunityOverrideRows[0] ?? null;

  const effectiveOpportunity = opportunitySnapshot
    ? applyOpportunityOverride({
        snapshot: opportunitySnapshot,
        override: opportunityOverride,
        offerings,
      })
    : null;

  const [contacts, lifecycleRows, salesActivities, outcomeRows, workspaceMembers] =
    await Promise.all([
      sql<ContactView[]>`
        SELECT
          id,
          name,
          position,
          email,
          phone,
          linkedin_url AS "linkedinUrl",
          location,
          decision_relevance AS "decisionRelevance",
          contact_status AS "contactStatus",
          contactability_status AS "contactabilityStatus",
          source_url AS "sourceUrl",
          source_label AS "sourceLabel",
          confidence::float8 AS confidence,
          verification_status AS "verificationStatus",
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM contacts
        WHERE organization_id = ${user.organizationId}
          AND company_id = ${id}
        ORDER BY
          CASE decision_relevance
            WHEN 'PRIMARY_DECISION_MAKER' THEN 1
            WHEN 'DECISION_MAKER' THEN 2
            WHEN 'CHAMPION' THEN 3
            WHEN 'PROCUREMENT' THEN 4
            ELSE 5
          END,
          updated_at DESC
      `,
      sql<SalesLifecycleView[]>`
        SELECT
          l.stage,
          l.owner_user_id AS "ownerUserId",
          owner.name AS "ownerName",
          l.primary_contact_id AS "primaryContactId",
          l.current_offering_id AS "currentOfferingId",
          l.next_action AS "nextAction",
          l.next_action_at AS "nextActionAt",
          l.notes,
          l.first_contact_at AS "firstContactAt",
          l.last_contact_at AS "lastContactAt",
          l.stage_changed_at AS "stageChangedAt",
          l.updated_at AS "updatedAt"
        FROM company_sales_lifecycle l
        LEFT JOIN users owner ON owner.id = l.owner_user_id
        WHERE l.organization_id = ${user.organizationId}
          AND l.company_id = ${id}
        LIMIT 1
      `,
      sql<SalesActivityView[]>`
        SELECT
          a.id,
          a.contact_id AS "contactId",
          c.name AS "contactName",
          a.activity_type AS "activityType",
          a.channel,
          a.direction,
          a.subject,
          a.summary,
          a.activity_status AS "activityStatus",
          a.follow_up_sequence AS "followUpSequence",
          a.next_action_at AS "nextActionAt",
          u.name AS "actorName",
          a.created_at AS "createdAt"
        FROM sales_activities a
        LEFT JOIN contacts c ON c.id = a.contact_id
        LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.organization_id = ${user.organizationId}
          AND a.company_id = ${id}
        ORDER BY a.created_at DESC
        LIMIT 30
      `,
      sql<SalesOutcomeView[]>`
        SELECT
          o.outcome,
          o.opportunity_snapshot_id AS "opportunitySnapshotId",
          o.predicted_opportunity_score AS "predictedOpportunityScore",
          o.predicted_conversion_probability::float8 AS "predictedConversionProbability",
          o.predicted_deal_value::float8 AS "predictedDealValue",
          o.predicted_expected_revenue::float8 AS "predictedExpectedRevenue",
          o.actual_contract_value::float8 AS "actualContractValue",
          o.actual_offering_id AS "actualOfferingId",
          offering.name AS "actualOfferingName",
          contact.name AS "primaryContactName",
          o.lost_reason AS "lostReason",
          o.lost_reason_note AS "lostReasonNote",
          o.recommendation_source AS "recommendationSource",
          o.sales_cycle_days AS "salesCycleDays",
          o.closed_at AS "closedAt"
        FROM sales_outcomes o
        LEFT JOIN offerings offering ON offering.id = o.actual_offering_id
        LEFT JOIN contacts contact ON contact.id = o.primary_contact_id
        WHERE o.organization_id = ${user.organizationId}
          AND o.company_id = ${id}
        LIMIT 1
      `,
      sql<WorkspaceMember[]>`
        SELECT
          m.user_id AS "userId",
          u.name,
          u.email,
          m.role
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ${user.organizationId}
        ORDER BY
          CASE m.role
            WHEN 'OWNER' THEN 1
            WHEN 'ADMIN' THEN 2
            WHEN 'MANAGER' THEN 3
            ELSE 4
          END,
          u.name
      `,
    ]);

  const lifecycle: SalesLifecycleView = lifecycleRows[0] ?? {
    stage: configured ? "QUALIFIED" : "DISCOVERED",
    ownerUserId: null,
    ownerName: null,
    primaryContactId: null,
    currentOfferingId: effectiveOpportunity?.effectiveOfferingId ?? null,
    nextAction: effectiveOpportunity?.effectiveNextBestAction ?? "",
    nextActionAt: null,
    notes: "",
    firstContactAt: null,
    lastContactAt: null,
    stageChangedAt: new Date(),
    updatedAt: new Date(),
  };
  const salesOutcome = outcomeRows[0] ?? null;
  const recommendedContact = recommendContact(
    contacts,
    effectiveOpportunity?.recommendedContact ??
      configured?.opportunity.recommendedContact ??
      "Decision maker",
  );
  const recommendedContactRecord =
    contacts.find((contact) => contact.id === recommendedContact.contactId) ?? null;
  const predictionDelta = salesOutcome
    ? predictionRealityDelta({
        predictedDealValue: salesOutcome.predictedDealValue,
        actualContractValue: salesOutcome.actualContractValue,
        predictedProbability: salesOutcome.predictedConversionProbability,
        outcome: salesOutcome.outcome,
      })
    : null;

  const triage = assessCompanyTriage({
    company,
    configured,
    icps,
    signals,
  });

  const primaryEvidence = evidence[0] ?? null;
  const lei = identifiers.find((item) => item.identifierType === "LEI");

  const displayTriageStatus = engineResult
    ? engineResult.priorityAction === "CONTACT_NOW"
      ? "HIGH_POTENTIAL"
      : engineResult.priorityAction === "REJECT"
        ? "LOW_POTENTIAL"
        : engineResult.priorityAction === "REVIEW"
          ? "MEDIUM_POTENTIAL"
          : "NEEDS_ENRICHMENT"
    : triage.status;

  const displayTriageScore =
    engineResult?.overallPotentialScore ?? triage.score;
  const displayTriageHeadline =
    engineResult?.assessmentSummary ?? triage.headline;
  const displayTriageReasons = engineResult
    ? [...engineResult.whyFit, ...engineResult.whyNow].slice(0, 4)
    : triage.reasons;
  const displayMissingFields =
    engineResult?.unknownDimensions ?? triage.missingFields;
  const hasMissing = displayMissingFields.length > 0;

  const displayRecommendation = engineResult
    ? engineResult.priorityAction === "CONTACT_NOW"
      ? "ADD_TO_PIPELINE"
      : engineResult.priorityAction === "REJECT"
        ? "REJECT"
        : "REVIEW"
    : triage.recommendation;

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
      {query.override === "saved" ? (
        <div className="success-banner">
          Human opportunity override saved and added to the audit trail.
        </div>
      ) : null}
      {query.override === "cleared" ? (
        <div className="success-banner">
          Human override cleared. Opportunity ranking now uses the model output again.
        </div>
      ) : null}
      {query.contact ? (
        <div className="success-banner">
          Contact {query.contact === "updated" ? "updated" : "created"}.
        </div>
      ) : null}
      {query.activity ? (
        <div className="success-banner">
          Sales activity recorded and lifecycle progress reassessed.
        </div>
      ) : null}
      {query.lifecycle === "saved" ? (
        <div className="success-banner">
          Sales lifecycle, owner and next action saved.
        </div>
      ) : null}
      {query.lifecycle === "closed" ? (
        <div className="success-banner">
          Final sales outcome saved with prediction-vs-reality data.
        </div>
      ) : null}

      <section className="ai-research-card">
        <div className="ai-research-heading">
          <div>
            <div className="eyebrow">RevenueScout Intelligence Engine</div>
            <h2>Zero-cost company analysis</h2>
            <p>
              RevenueScout collects public company pages, extracts company facts and buying signals, then scores them with the built-in RS Conversion Model v2. No paid AI API is used.
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
                <span>Potential</span>
                <strong>
                  {researchRun.structuredResult.overallPotentialScore}/100
                </strong>
              </div>
              <div>
                <span>Evidence confidence</span>
                <strong>
                  {researchRun.structuredResult.evidenceConfidence}%
                </strong>
              </div>
              <div>
                <span>Potential range</span>
                <strong>
                  {researchRun.structuredResult.potentialConservativeScore}–
                  {researchRun.structuredResult.potentialUpsideScore}
                </strong>
              </div>
              <div>
                <span>Recommended mode</span>
                <strong>
                  {priorityActionText(
                    researchRun.structuredResult.priorityAction,
                  )}
                </strong>
              </div>
            </div>

            <div className="ai-score-row secondary-score-row">
              <div>
                <span>Sales priority</span>
                <strong>
                  {researchRun.structuredResult.salesPriorityScore}/100
                </strong>
              </div>
              <div>
                <span>Research priority</span>
                <strong>
                  {researchRun.structuredResult.researchPriorityScore}/100
                </strong>
              </div>
              <div>
                <span>Value of information</span>
                <strong>
                  {researchRun.structuredResult.valueOfInformationScore}/100
                </strong>
              </div>
              <div>
                <span>Conversion estimate</span>
                <strong>
                  {researchRun.structuredResult.estimatedConversionPercent}%
                </strong>
              </div>
            </div>

            <div className="ai-summary">
              <strong>
                {researchRun.structuredResult.assessmentSummary}
              </strong>
              <p>
                Unknown is not treated as negative. Potential is calculated
                from known dimensions; confidence and the conservative/upside
                range describe how uncertain that estimate still is.
              </p>
            </div>

            <div className="claim-validation-summary">
              <span>
                <strong>{researchRun.structuredResult.claimValidation.confirmedCount}</strong>
                Confirmed
              </span>
              <span>
                <strong>{researchRun.structuredResult.claimValidation.corroboratedCount}</strong>
                Corroborated
              </span>
              <span>
                <strong>{researchRun.structuredResult.claimValidation.singleSourceCount}</strong>
                Single-source
              </span>
              <span>
                <strong>{researchRun.structuredResult.claimValidation.conflictedCount}</strong>
                Conflicted
              </span>
              <span>
                <strong>{researchRun.structuredResult.claimValidation.independentFamilyCount}</strong>
                Independent families
              </span>
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

            {researchRun.structuredResult.researchTargets.length > 0 ? (
              <section className="research-targets-panel">
                <div className="field-label">Highest-value evidence to collect next</div>
                <div className="research-target-list">
                  {researchRun.structuredResult.researchTargets
                    .slice(0, 5)
                    .map((target) => (
                      <div className="research-target-item" key={target.target}>
                        <div>
                          <strong>{target.target}</strong>
                          <span>{target.status.replaceAll("_", " ")}</span>
                        </div>
                        <p>{target.reason}</p>
                        <b>VOI {target.valueScore}/100</b>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            <details className="claim-validation-details" open>
              <summary>
                Cross-validated claims (
                {researchRun.structuredResult.validatedClaims.length})
              </summary>
              <div className="claim-list">
                {researchRun.structuredResult.validatedClaims
                  .slice(0, 12)
                  .map((claim) => (
                    <article
                      className="claim-item"
                      key={`${claim.claimType}:${claim.claimKey}`}
                    >
                      <div className="claim-item-top">
                        <strong>{claim.claimType.replaceAll("_", " ")}</strong>
                        <span className={`claim-status claim-${claim.status.toLowerCase().replaceAll("_", "-")}`}>
                          {claimStatusText(claim.status)}
                        </span>
                      </div>
                      <p>{claim.explanation}</p>
                      <div className="claim-meta">
                        <span>Confidence {Math.round(claim.confidence * 100)}%</span>
                        <span>
                          {claim.supportingFamilyCount} supporting independent
                          family/families
                        </span>
                        {claim.conflictingFamilyCount > 0 ? (
                          <span>
                            {claim.conflictingFamilyCount} conflicting
                            family/families
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
              </div>
            </details>

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

      {effectiveOpportunity ? (
        <section className="m3-opportunity-card">
          <div className="m3-opportunity-heading">
            <div>
              <div className="eyebrow">M3 · Opportunity Intelligence</div>
              <h2>Revenue opportunity</h2>
              <p>
                Persisted score snapshot #{effectiveOpportunity.snapshotId.slice(0, 8)} ·
                Config v{effectiveOpportunity.configVersion} ·
                {effectiveOpportunity.hasHumanOverride
                  ? " human override active"
                  : " model output"}
              </p>
            </div>
            <div className="m3-rank-score">
              <span>Opportunity score</span>
              <strong>{effectiveOpportunity.opportunityScore}</strong>
              <small>/100</small>
            </div>
          </div>

          <div className="m3-metric-grid">
            <div>
              <span>Expected revenue</span>
              <strong>{money(effectiveOpportunity.effectiveExpectedRevenue)}</strong>
              <small>
                {Math.round(effectiveOpportunity.effectiveConversionProbability * 1000) / 10}% ×{" "}
                {money(effectiveOpportunity.effectiveDealValue)}
              </small>
              <small>
                Model range {money(effectiveOpportunity.expectedRevenueLow)} –{" "}
                {money(effectiveOpportunity.expectedRevenueHigh)}
              </small>
            </div>
            <div>
              <span>Estimated deal value</span>
              <strong>{money(effectiveOpportunity.effectiveDealValue)}</strong>
              <small>
                Model range {money(effectiveOpportunity.dealValueLow)} –{" "}
                {money(effectiveOpportunity.dealValueHigh)}
              </small>
            </div>
            <div>
              <span>Conversion probability</span>
              <strong>
                {Math.round(effectiveOpportunity.effectiveConversionProbability * 1000) / 10}%
              </strong>
              <small>
                {effectiveOpportunity.calibrationState.replaceAll("_", " ")} ·{" "}
                {effectiveOpportunity.conversionConfidence.toLowerCase()} confidence
              </small>
            </div>
            <div>
              <span>Revenue efficiency</span>
              <strong>{money(effectiveOpportunity.revenueEfficiency)}</strong>
              <small>{effectiveOpportunity.salesEffort.toLowerCase()} estimated sales effort</small>
            </div>
          </div>

          <div className="m3-explanation-grid">
            <div>
              <span className="field-label">Why this company</span>
              <p>{effectiveOpportunity.whyThisCompany}</p>
            </div>
            <div>
              <span className="field-label">Why now</span>
              <p>{effectiveOpportunity.whyNow}</p>
            </div>
            <div>
              <span className="field-label">Problem hypothesis</span>
              <p>
                <strong>Hypothesis — not confirmed fact.</strong>{" "}
                {effectiveOpportunity.problemHypothesis}
              </p>
            </div>
            <div>
              <span className="field-label">Recommended Offering</span>
              <p><strong>{effectiveOpportunity.effectiveOfferingName}</strong></p>
              <small>{effectiveOpportunity.effectiveOfferingReason}</small>
            </div>
          </div>

          <div className="m3-next-action">
            <span className="field-label">Next best action</span>
            <strong>{effectiveOpportunity.effectiveNextBestAction}</strong>
            <span>Recommended contact: {effectiveOpportunity.recommendedContact}</span>
          </div>

          <details className="m3-score-details">
            <summary>Why this probability and score?</summary>
            <div className="m3-score-detail-grid">
              <dl className="score-breakdown">
                {Object.entries(effectiveOpportunity.scoreBreakdown).map(
                  ([label, score]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{Math.round(score)}</dd>
                    </div>
                  ),
                )}
              </dl>
              <ul>
                {effectiveOpportunity.conversionFactors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
          </details>

          <details className="m3-override-panel" open={effectiveOpportunity.hasHumanOverride}>
            <summary>
              Human override {effectiveOpportunity.hasHumanOverride ? "· active" : ""}
            </summary>
            <p>
              Overrides never erase the model snapshot. They change the effective
              sales decision and are recorded in the audit trail.
            </p>
            <form
              className="m3-override-form"
              action={`/api/opportunities/${id}/override`}
              method="post"
            >
              <label>
                Priority
                <select
                  name="priorityOverride"
                  defaultValue={effectiveOpportunity.override?.priorityOverride ?? "AUTO"}
                >
                  <option value="AUTO">Automatic</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="HOLD">Hold</option>
                </select>
              </label>
              <label>
                Conversion probability %
                <input
                  name="conversionPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={
                    effectiveOpportunity.override?.conversionProbabilityOverride !== null &&
                    effectiveOpportunity.override?.conversionProbabilityOverride !== undefined
                      ? effectiveOpportunity.override.conversionProbabilityOverride * 100
                      : ""
                  }
                  placeholder={String(
                    Math.round(effectiveOpportunity.conversionProbability * 1000) / 10,
                  )}
                />
              </label>
              <label>
                Expected deal value
                <input
                  name="expectedDealValue"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={
                    effectiveOpportunity.override?.expectedDealValueOverride ?? ""
                  }
                  placeholder={String(effectiveOpportunity.dealValueExpected)}
                />
              </label>
              <label>
                Offering
                <select
                  name="offeringId"
                  defaultValue={effectiveOpportunity.override?.offeringIdOverride ?? ""}
                >
                  <option value="">Use model recommendation</option>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offering.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Next best action
                <input
                  name="nextBestAction"
                  defaultValue={
                    effectiveOpportunity.override?.nextBestActionOverride ?? ""
                  }
                  placeholder={effectiveOpportunity.nextBestAction}
                />
              </label>
              <label className="span-2">
                Override note
                <textarea
                  name="note"
                  defaultValue={effectiveOpportunity.override?.note ?? ""}
                  placeholder="Why are you overriding the model?"
                />
              </label>
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit" name="action" value="save">
                  Save override
                </button>
                {effectiveOpportunity.hasHumanOverride ? (
                  <button className="secondary-button" type="submit" name="action" value="clear">
                    Clear override
                  </button>
                ) : null}
              </div>
            </form>
          </details>

          <details className="m3-audit-panel">
            <summary>Score snapshot history ({snapshotHistory.length})</summary>
            {snapshotHistory.length === 0 ? (
              <p>No historical snapshots yet.</p>
            ) : (
              <div className="m3-audit-list">
                {snapshotHistory.map((snapshot) => (
                  <div key={snapshot.id}>
                    <strong>
                      Score {snapshot.opportunityScore} ·{" "}
                      {money(snapshot.expectedRevenue)} expected revenue
                    </strong>
                    <span>
                      {Math.round(snapshot.conversionProbability * 1000) / 10}%
                      conversion · Config v{snapshot.configVersion} ·{" "}
                      {new Date(snapshot.createdAt).toLocaleString("en-AU")}
                    </span>
                    <p>{snapshot.offeringName ?? "No linked Offering"}</p>
                  </div>
                ))}
              </div>
            )}
          </details>

          <details className="m3-audit-panel">
            <summary>Decision audit trail ({auditEvents.length})</summary>
            {auditEvents.length === 0 ? (
              <p>No opportunity audit events yet.</p>
            ) : (
              <div className="m3-audit-list">
                {auditEvents.map((event) => (
                  <div key={event.id}>
                    <strong>{event.eventType.replaceAll("_", " ")}</strong>
                    <span>
                      {event.actorName ?? "System"} ·{" "}
                      {new Date(event.createdAt).toLocaleString("en-AU")}
                    </span>
                    <p>{event.note}</p>
                  </div>
                ))}
              </div>
            )}
          </details>
        </section>
      ) : (
        <section className="m3-opportunity-card m3-opportunity-empty">
          <div className="eyebrow">M3 · Opportunity Intelligence</div>
          <h2>No qualified opportunity snapshot yet</h2>
          <p>
            This company currently has no eligible ICP match. Missing fields remain
            unknown rather than negative; resolve the relevant evidence or adjust
            Market Setup before RevenueScout creates a revenue opportunity.
          </p>
        </section>
      )}

      <section className="m4-sales-card">
        <div className="m4-sales-heading">
          <div>
            <div className="eyebrow">M4 · Contacts & Sales Lifecycle</div>
            <h2>Real sales execution</h2>
            <p>
              Follow the M3 recommendation through a named contact, real sales
              activity and a Won/Lost outcome. These records become ground truth
              for future probability calibration.
            </p>
          </div>
          <span className="m4-stage-pill">{lifecycleLabel(lifecycle.stage)}</span>
        </div>

        <div className="m4-summary-grid">
          <div>
            <span>Opportunity owner</span>
            <strong>{lifecycle.ownerName ?? "Unassigned"}</strong>
          </div>
          <div>
            <span>Recommended contact</span>
            <strong>
              {recommendedContactRecord?.name ??
                recommendedContact.roleTarget}
            </strong>
          </div>
          <div>
            <span>Last contact</span>
            <strong>
              {lifecycle.lastContactAt
                ? new Date(lifecycle.lastContactAt).toLocaleDateString("en-AU")
                : "No contact yet"}
            </strong>
          </div>
          <div>
            <span>Next action</span>
            <strong>
              {lifecycle.nextAction ||
                effectiveOpportunity?.effectiveNextBestAction ||
                "Not scheduled"}
            </strong>
          </div>
        </div>

        <div className="m4-recommended-contact">
          <div>
            <span className="field-label">Why this person?</span>
            <strong>
              {recommendedContactRecord
                ? `${recommendedContactRecord.name} · ${recommendedContactRecord.position || "Position unknown"}`
                : `Find: ${recommendedContact.roleTarget}`}
            </strong>
            <p>{recommendedContact.reason}</p>
          </div>
          {recommendedContactRecord ? (
            <div className="m4-contactability">
              <span>
                {contactabilityLabel(
                  recommendedContactRecord.contactabilityStatus,
                )}
              </span>
              <small>
                {decisionRelevanceLabel(
                  recommendedContactRecord.decisionRelevance,
                )}{" "}
                · {Math.round(recommendedContactRecord.confidence * 100)}%
                confidence
              </small>
            </div>
          ) : null}
        </div>

        <details className="m4-panel" open>
          <summary>Lifecycle, owner and outcome</summary>
          <form
            className="m4-form"
            action={`/api/companies/${id}/lifecycle`}
            method="post"
          >
            <label>
              Lifecycle stage
              <select name="stage" defaultValue={lifecycle.stage}>
                {lifecycleStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {lifecycleLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner
              <select
                name="ownerUserId"
                defaultValue={lifecycle.ownerUserId ?? ""}
              >
                <option value="">Unassigned</option>
                {workspaceMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {member.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Primary contact
              <select
                name="primaryContactId"
                defaultValue={lifecycle.primaryContactId ?? ""}
              >
                <option value="">No primary contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                    {contact.position ? ` · ${contact.position}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Current Offering
              <select
                name="currentOfferingId"
                defaultValue={
                  lifecycle.currentOfferingId ??
                  effectiveOpportunity?.effectiveOfferingId ??
                  ""
                }
              >
                <option value="">No Offering selected</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Next action
              <input
                name="nextAction"
                defaultValue={
                  lifecycle.nextAction ||
                  effectiveOpportunity?.effectiveNextBestAction ||
                  ""
                }
                placeholder="e.g. Research operations director before outreach"
              />
            </label>
            <label>
              Next action date
              <input
                name="nextActionAt"
                type="datetime-local"
                defaultValue={datetimeLocalValue(lifecycle.nextActionAt)}
              />
            </label>
            <label>
              Actual Offering if Won/Lost
              <select
                name="actualOfferingId"
                defaultValue={salesOutcome?.actualOfferingId ?? ""}
              >
                <option value="">Use current/model Offering</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Actual contract value · required for Won
              <input
                name="actualContractValue"
                type="number"
                min="0"
                step="1"
                defaultValue={salesOutcome?.actualContractValue ?? ""}
                placeholder="e.g. 28500"
              />
            </label>
            <label>
              Lost reason · required for Lost
              <select
                name="lostReason"
                defaultValue={salesOutcome?.lostReason ?? ""}
              >
                <option value="">Select only when Lost</option>
                <option value="NO_BUDGET">No budget</option>
                <option value="NO_NEED">No need</option>
                <option value="TIMING">Timing</option>
                <option value="COMPETITOR">Competitor</option>
                <option value="PRICE">Price</option>
                <option value="WRONG_CONTACT">Wrong contact</option>
                <option value="COMPANY_TOO_SMALL">Company too small</option>
                <option value="EXISTING_SUPPLIER">Existing supplier</option>
                <option value="NO_RESPONSE">No response</option>
                <option value="INTERNAL_SOLUTION">Internal solution</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="span-2">
              Lost reason note
              <input
                name="lostReasonNote"
                defaultValue={salesOutcome?.lostReasonNote ?? ""}
                placeholder="Optional context for future learning"
              />
            </label>
            <label className="span-2">
              Shared sales notes
              <textarea
                name="notes"
                defaultValue={lifecycle.notes}
                placeholder="Context the team should know"
              />
            </label>
            <div className="span-2 form-actions">
              <button className="primary-button" type="submit">
                Save lifecycle
              </button>
            </div>
          </form>
        </details>

        <details className="m4-panel" open={contacts.length === 0}>
          <summary>Contacts ({contacts.length})</summary>
          {contacts.length > 0 ? (
            <div className="m4-contact-list">
              {contacts.map((contact) => (
                <article
                  className={
                    contact.id === recommendedContact.contactId
                      ? "m4-contact-card m4-contact-recommended"
                      : "m4-contact-card"
                  }
                  key={contact.id}
                >
                  <div className="m4-contact-card-head">
                    <div>
                      <strong>{contact.name}</strong>
                      <span>{contact.position || "Position unknown"}</span>
                    </div>
                    <span>
                      {contact.id === recommendedContact.contactId
                        ? "Recommended"
                        : decisionRelevanceLabel(contact.decisionRelevance)}
                    </span>
                  </div>
                  <div className="m4-contact-meta">
                    <span>{contact.email ?? "No email"}</span>
                    <span>{contact.phone ?? "No phone"}</span>
                    <span>
                      {contactabilityLabel(contact.contactabilityStatus)}
                    </span>
                    <span>
                      {contact.verificationStatus.toLowerCase()} ·{" "}
                      {Math.round(contact.confidence * 100)}%
                    </span>
                  </div>
                  {contact.linkedinUrl ? (
                    <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  ) : null}
                  {contact.sourceUrl ? (
                    <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                      Contact source
                    </a>
                  ) : null}

                  <details className="m4-contact-edit">
                    <summary>Edit contact</summary>
                    <form
                      className="m4-form compact"
                      action={`/api/companies/${id}/contacts`}
                      method="post"
                    >
                      <input type="hidden" name="contactId" value={contact.id} />
                      <label>
                        Name
                        <input name="name" defaultValue={contact.name} required />
                      </label>
                      <label>
                        Position
                        <input name="position" defaultValue={contact.position} />
                      </label>
                      <label>
                        Email
                        <input name="email" type="email" defaultValue={contact.email ?? ""} />
                      </label>
                      <label>
                        Phone
                        <input name="phone" defaultValue={contact.phone ?? ""} />
                      </label>
                      <label>
                        LinkedIn
                        <input name="linkedinUrl" defaultValue={contact.linkedinUrl ?? ""} />
                      </label>
                      <label>
                        Location
                        <input name="location" defaultValue={contact.location ?? ""} />
                      </label>
                      <label>
                        Decision relevance
                        <select
                          name="decisionRelevance"
                          defaultValue={contact.decisionRelevance}
                        >
                          <option value="PRIMARY_DECISION_MAKER">Primary decision maker</option>
                          <option value="DECISION_MAKER">Decision maker</option>
                          <option value="INFLUENCER">Influencer</option>
                          <option value="CHAMPION">Champion</option>
                          <option value="PROCUREMENT">Procurement</option>
                          <option value="TECHNICAL">Technical</option>
                          <option value="GATEKEEPER">Gatekeeper</option>
                          <option value="UNKNOWN">Unknown</option>
                        </select>
                      </label>
                      <label>
                        Contactability
                        <select
                          name="contactabilityStatus"
                          defaultValue={contact.contactabilityStatus}
                        >
                          <option value="CONTACT_PERMITTED">Contact permitted</option>
                          <option value="EXISTING_RELATIONSHIP">Existing relationship</option>
                          <option value="USER_CONFIRMED_CONSENT">User-confirmed consent</option>
                          <option value="PUBLIC_BUSINESS_CONTACT">Public business contact</option>
                          <option value="UNCERTAIN">Uncertain</option>
                          <option value="DO_NOT_CONTACT">Do not contact</option>
                          <option value="UNSUBSCRIBED">Unsubscribed</option>
                        </select>
                      </label>
                      <label>
                        Contact status
                        <select name="contactStatus" defaultValue={contact.contactStatus}>
                          <option value="ACTIVE">Active</option>
                          <option value="UNKNOWN">Unknown</option>
                          <option value="INVALID">Invalid</option>
                          <option value="LEFT_COMPANY">Left company</option>
                        </select>
                      </label>
                      <label>
                        Verification
                        <select
                          name="verificationStatus"
                          defaultValue={contact.verificationStatus}
                        >
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="LIKELY">Likely</option>
                          <option value="UNVERIFIED">Unverified</option>
                          <option value="OUTDATED">Outdated</option>
                        </select>
                      </label>
                      <label>
                        Confidence %
                        <input
                          name="confidence"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={Math.round(contact.confidence * 100)}
                        />
                      </label>
                      <label>
                        Source label
                        <input name="sourceLabel" defaultValue={contact.sourceLabel} />
                      </label>
                      <label className="span-2">
                        Source URL
                        <input name="sourceUrl" defaultValue={contact.sourceUrl ?? ""} />
                      </label>
                      <label className="span-2">
                        Notes
                        <textarea name="notes" defaultValue={contact.notes} />
                      </label>
                      <button className="secondary-button" type="submit">
                        Update contact
                      </button>
                    </form>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              No named contacts are stored yet. RevenueScout recommends finding{" "}
              <strong>{recommendedContact.roleTarget}</strong>.
            </p>
          )}

          <div className="m4-new-contact">
            <h3>Add contact</h3>
            <form
              className="m4-form"
              action={`/api/companies/${id}/contacts`}
              method="post"
            >
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Position
                <input name="position" placeholder="e.g. Head of Operations" />
              </label>
              <label>
                Email
                <input name="email" type="email" />
              </label>
              <label>
                Phone
                <input name="phone" />
              </label>
              <label>
                LinkedIn
                <input name="linkedinUrl" type="url" />
              </label>
              <label>
                Location
                <input name="location" />
              </label>
              <label>
                Decision relevance
                <select name="decisionRelevance" defaultValue="UNKNOWN">
                  <option value="PRIMARY_DECISION_MAKER">Primary decision maker</option>
                  <option value="DECISION_MAKER">Decision maker</option>
                  <option value="INFLUENCER">Influencer</option>
                  <option value="CHAMPION">Champion</option>
                  <option value="PROCUREMENT">Procurement</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="GATEKEEPER">Gatekeeper</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </label>
              <label>
                Contactability / compliance
                <select name="contactabilityStatus" defaultValue="UNCERTAIN">
                  <option value="UNCERTAIN">Uncertain</option>
                  <option value="CONTACT_PERMITTED">Contact permitted</option>
                  <option value="PUBLIC_BUSINESS_CONTACT">Public business contact</option>
                  <option value="EXISTING_RELATIONSHIP">Existing relationship</option>
                  <option value="USER_CONFIRMED_CONSENT">User-confirmed consent</option>
                  <option value="DO_NOT_CONTACT">Do not contact</option>
                  <option value="UNSUBSCRIBED">Unsubscribed</option>
                </select>
              </label>
              <input type="hidden" name="contactStatus" value="ACTIVE" />
              <label>
                Verification
                <select name="verificationStatus" defaultValue="UNVERIFIED">
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="LIKELY">Likely</option>
                  <option value="UNVERIFIED">Unverified</option>
                </select>
              </label>
              <label>
                Confidence %
                <input name="confidence" type="number" min="0" max="100" defaultValue="50" />
              </label>
              <label>
                Source label
                <input name="sourceLabel" defaultValue="Manual" />
              </label>
              <label>
                Source URL
                <input name="sourceUrl" type="url" />
              </label>
              <label className="span-2">
                Notes
                <textarea name="notes" />
              </label>
              <button className="primary-button" type="submit">
                Add contact
              </button>
            </form>
          </div>
        </details>

        <details className="m4-panel" open={salesActivities.length === 0}>
          <summary>Sales activity ({salesActivities.length})</summary>
          <div className="m4-activity-form-wrap">
            <form
              className="m4-form"
              action={`/api/companies/${id}/activities`}
              method="post"
            >
              <label>
                Contact
                <select name="contactId" defaultValue={lifecycle.primaryContactId ?? ""}>
                  <option value="">No contact / internal note</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.position ? ` · ${contact.position}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Activity
                <select name="activityType" defaultValue="OUTREACH">
                  <option value="OUTREACH">Initial outreach</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="REPLY">Reply received</option>
                  <option value="MEETING">Meeting</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="NOTE">Internal note</option>
                </select>
              </label>
              <label>
                Channel
                <select name="channel" defaultValue="EMAIL">
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="MEETING">Meeting</option>
                  <option value="OTHER">Other</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </label>
              <label>
                Direction
                <select name="direction" defaultValue="OUTBOUND">
                  <option value="OUTBOUND">Outbound</option>
                  <option value="INBOUND">Inbound</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </label>
              <label>
                Status
                <select name="activityStatus" defaultValue="COMPLETED">
                  <option value="PLANNED">Planned</option>
                  <option value="SENT">Sent</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REPLIED">Replied</option>
                  <option value="NO_RESPONSE">No response</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label>
                Follow-up number
                <select name="followUpSequence" defaultValue="0">
                  <option value="0">Not a follow-up</option>
                  <option value="1">Follow-up 1</option>
                  <option value="2">Follow-up 2</option>
                  <option value="3">Final follow-up</option>
                </select>
              </label>
              <label className="span-2">
                Subject
                <input name="subject" />
              </label>
              <label className="span-2">
                Summary
                <textarea
                  name="summary"
                  placeholder="What happened? Keep this factual."
                />
              </label>
              <label>
                Next action date
                <input name="nextActionAt" type="datetime-local" />
              </label>
              <div className="m4-compliance-note">
                Outbound activity is blocked for contacts marked Uncertain,
                Do Not Contact or Unsubscribed.
              </div>
              <button className="primary-button" type="submit">
                Record activity
              </button>
            </form>
          </div>

          {salesActivities.length > 0 ? (
            <div className="m4-activity-list">
              {salesActivities.map((activity) => (
                <article key={activity.id}>
                  <div>
                    <strong>
                      {activity.activityType.replaceAll("_", " ")}
                      {activity.contactName ? ` · ${activity.contactName}` : ""}
                    </strong>
                    <span>
                      {activity.channel} · {activity.direction} ·{" "}
                      {activity.actorName ?? "System"} ·{" "}
                      {new Date(activity.createdAt).toLocaleString("en-AU")}
                    </span>
                  </div>
                  <p>{activity.summary || activity.subject || "No summary"}</p>
                  {activity.followUpSequence > 0 ? (
                    <small>
                      Follow-up {activity.followUpSequence}
                      {activity.followUpSequence === 3 ? " · final follow-up" : ""}
                    </small>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </details>

        {salesOutcome ? (
          <section className="m4-reality-card">
            <div>
              <div className="eyebrow">Prediction vs reality</div>
              <h3>
                {salesOutcome.outcome === "WON"
                  ? "Won deal"
                  : "Lost opportunity"}
              </h3>
              <p>
                Closed {new Date(salesOutcome.closedAt).toLocaleDateString("en-AU")}
                {salesOutcome.salesCycleDays !== null
                  ? ` · ${salesOutcome.salesCycleDays} day sales cycle`
                  : ""}
              </p>
            </div>
            <div className="m4-reality-grid">
              <div>
                <span>Originally predicted deal</span>
                <strong>
                  {salesOutcome.predictedDealValue !== null
                    ? money(salesOutcome.predictedDealValue)
                    : "Unknown"}
                </strong>
              </div>
              <div>
                <span>Originally predicted probability</span>
                <strong>
                  {salesOutcome.predictedConversionProbability !== null
                    ? `${Math.round(
                        salesOutcome.predictedConversionProbability * 1000,
                      ) / 10}%`
                    : "Unknown"}
                </strong>
              </div>
              <div>
                <span>Originally expected revenue</span>
                <strong>
                  {salesOutcome.predictedExpectedRevenue !== null
                    ? money(salesOutcome.predictedExpectedRevenue)
                    : "Unknown"}
                </strong>
              </div>
              <div>
                <span>Actual contract</span>
                <strong>
                  {salesOutcome.outcome === "WON" &&
                  salesOutcome.actualContractValue !== null
                    ? money(salesOutcome.actualContractValue)
                    : salesOutcome.outcome}
                </strong>
              </div>
            </div>
            <div className="m4-reality-notes">
              {predictionDelta?.dealDelta !== null &&
              predictionDelta?.dealDelta !== undefined ? (
                <p>
                  Deal-value delta:{" "}
                  <strong>
                    {predictionDelta.dealDelta >= 0 ? "+" : ""}
                    {money(predictionDelta.dealDelta)}
                  </strong>
                </p>
              ) : null}
              {salesOutcome.outcome === "LOST" ? (
                <p>
                  Lost reason:{" "}
                  <strong>
                    {salesOutcome.lostReason?.replaceAll("_", " ") ?? "Unknown"}
                  </strong>
                  {salesOutcome.lostReasonNote
                    ? ` · ${salesOutcome.lostReasonNote}`
                    : ""}
                </p>
              ) : (
                <p>
                  Actual Offering:{" "}
                  <strong>{salesOutcome.actualOfferingName ?? "Unknown"}</strong>
                  {salesOutcome.primaryContactName
                    ? ` · Primary contact: ${salesOutcome.primaryContactName}`
                    : ""}
                </p>
              )}
              <p>{salesOutcome.recommendationSource}</p>
            </div>
          </section>
        ) : null}
      </section>

      <section className="triage-hero">
        <div className="triage-main">
          <div className="triage-label-row">
            <span className={`triage-pill ${triageClass(displayTriageStatus)}`}>
              {triageText(displayTriageStatus)}
            </span>
            {displayTriageScore !== null ? (
              <span className="triage-score">{displayTriageScore}/100</span>
            ) : null}
          </div>
          <h2>{displayTriageHeadline}</h2>
          <ul className="triage-reasons">
            {displayTriageReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          {hasMissing ? (
            <div className="missing-strip">
              <strong>
                {engineResult
                  ? "Unknown dimensions worth researching:"
                  : "Only these fields still block a confident ICP decision:"}
              </strong>
              <div>
                {displayMissingFields.map((field) => (
                  <span key={field}>{field}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="triage-action-panel">
          <span className="field-label">Recommended action</span>
          <strong>
            {displayRecommendation === "ADD_TO_PIPELINE"
              ? "Add to pipeline"
              : displayRecommendation === "REJECT"
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
