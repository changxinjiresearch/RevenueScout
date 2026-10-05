import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageGtm } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type SuppressionRow = {
  id: string;
  scope: "COMPANY" | "CONTACT";
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPosition: string | null;
  reason: string;
  source: string;
  note: string;
  createdAt: Date;
  createdByName: string | null;
};

type Policy = {
  contactWindowDays: number;
  maxContactOutbound: number;
  companyWindowDays: number;
  maxCompanyOutbound: number;
  duplicateWarningHours: number;
  updatedAt: Date;
};

type ConsentRow = {
  id: string;
  companyId: string;
  companyName: string;
  contactId: string;
  contactName: string;
  consentType: string;
  source: string;
  note: string;
  recordedAt: Date;
  recordedByName: string | null;
};

function label(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{
    suppression?: string;
    consent?: string;
    policy?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const [suppressions, policyRows, consents] = await Promise.all([
    sql<SuppressionRow[]>`
      SELECT
        s.id,
        s.scope,
        s.company_id AS "companyId",
        company.display_name AS "companyName",
        s.contact_id AS "contactId",
        contact.name AS "contactName",
        contact.position AS "contactPosition",
        s.reason,
        s.source,
        s.note,
        s.created_at AS "createdAt",
        creator.name AS "createdByName"
      FROM suppression_entries s
      LEFT JOIN companies company ON company.id = s.company_id
      LEFT JOIN contacts contact ON contact.id = s.contact_id
      LEFT JOIN users creator ON creator.id = s.created_by
      WHERE s.organization_id = ${user.organizationId}
        AND s.active = TRUE
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ORDER BY s.created_at DESC
    `,
    sql<Policy[]>`
      SELECT
        contact_window_days AS "contactWindowDays",
        max_contact_outbound AS "maxContactOutbound",
        company_window_days AS "companyWindowDays",
        max_company_outbound AS "maxCompanyOutbound",
        duplicate_warning_hours AS "duplicateWarningHours",
        updated_at AS "updatedAt"
      FROM contact_frequency_policies
      WHERE organization_id = ${user.organizationId}
      LIMIT 1
    `,
    sql<ConsentRow[]>`
      SELECT
        cr.id,
        c.company_id AS "companyId",
        company.display_name AS "companyName",
        c.id AS "contactId",
        c.name AS "contactName",
        cr.consent_type AS "consentType",
        cr.source,
        cr.note,
        cr.recorded_at AS "recordedAt",
        u.name AS "recordedByName"
      FROM consent_records cr
      JOIN contacts c ON c.id = cr.contact_id
      JOIN companies company ON company.id = c.company_id
      LEFT JOIN users u ON u.id = cr.recorded_by
      WHERE cr.organization_id = ${user.organizationId}
      ORDER BY cr.recorded_at DESC
      LIMIT 40
    `,
  ]);

  const policy: Policy = policyRows[0] ?? {
    contactWindowDays: 7,
    maxContactOutbound: 2,
    companyWindowDays: 14,
    maxCompanyOutbound: 4,
    duplicateWarningHours: 48,
    updatedAt: new Date(),
  };

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/companies">Search</Link>
          <Link href="/watchlist">Watchlist</Link>
          <Link href="/analytics">Analytics</Link>
          <Link className="nav-active" href="/compliance">Compliance</Link>
          <Link href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M5 · Compliance & outreach safety</div>
          <h1>Contact safely.</h1>
          <p className="lede">
            Suppression, permission records and frequency controls are shared
            across the whole workspace. One salesperson cannot silently bypass
            another salesperson’s do-not-contact state.
          </p>
        </div>
        <div className="workspace-chip">
          <span>Active suppressions</span>
          <strong>{suppressions.length}</strong>
        </div>
      </header>

      {params.suppression ? (
        <div className="success-banner">Suppression list updated.</div>
      ) : null}
      {params.consent ? (
        <div className="success-banner">Contact permission record saved.</div>
      ) : null}
      {params.policy ? (
        <div className="success-banner">Contact-frequency policy saved.</div>
      ) : null}

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">01</span>
            <h2>Organisation suppression list</h2>
          </div>
          <p>
            Active entries block outbound activity across the workspace.
            Clearing a suppression does not automatically claim consent; the
            contact returns to an uncertain state unless a separate permission
            record exists.
          </p>
        </div>

        {suppressions.length === 0 ? (
          <div className="empty-state compact-empty-state">
            <h3>No active suppressions.</h3>
            <p>
              Do Not Contact and unsubscribe actions from company/contact pages
              will appear here.
            </p>
          </div>
        ) : (
          <div className="m5-suppression-list">
            {suppressions.map((item) => (
              <article className="m5-suppression-card" key={item.id}>
                <div>
                  <strong>
                    {item.scope === "COMPANY"
                      ? item.companyName ?? "Company"
                      : item.contactName ?? "Contact"}
                  </strong>
                  <span>
                    {item.scope}
                    {item.contactPosition ? ` · ${item.contactPosition}` : ""}
                  </span>
                </div>
                <div>
                  <span>{label(item.reason)}</span>
                  <small>
                    {item.createdByName ?? "User"} ·{" "}
                    {new Date(item.createdAt).toLocaleString("en-AU")}
                  </small>
                  {item.note ? <p>{item.note}</p> : null}
                </div>
                <form action="/api/compliance/suppression" method="post">
                  <input type="hidden" name="action" value="clear" />
                  <input type="hidden" name="scope" value={item.scope} />
                  <input
                    type="hidden"
                    name="companyId"
                    value={item.companyId ?? ""}
                  />
                  <input
                    type="hidden"
                    name="contactId"
                    value={item.contactId ?? ""}
                  />
                  <input type="hidden" name="returnTo" value="/compliance" />
                  <input type="hidden" name="reason" value={item.reason} />
                  <button className="secondary-button" type="submit">
                    Clear suppression
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">02</span>
            <h2>Contact-frequency policy</h2>
          </div>
          <p>
            These limits are enforced when an outbound activity is recorded.
            Duplicate outreach by another team member inside the warning window
            is surfaced before/after the action rather than hidden.
          </p>
        </div>

        <div className="config-card">
          <div className="m5-policy-summary">
            <span>
              Max <strong>{policy.maxContactOutbound}</strong> outbound touches
              per contact in <strong>{policy.contactWindowDays}</strong> days
            </span>
            <span>
              Max <strong>{policy.maxCompanyOutbound}</strong> outbound touches
              per company in <strong>{policy.companyWindowDays}</strong> days
            </span>
            <span>
              Duplicate team-contact warning:{" "}
              <strong>{policy.duplicateWarningHours}h</strong>
            </span>
          </div>

          {canManageGtm(user.role) ? (
            <details className="m5-policy-edit">
              <summary>Edit policy</summary>
              <form
                className="m5-form-grid"
                action="/api/compliance/policy"
                method="post"
              >
                <label>
                  Contact window days
                  <input
                    name="contactWindowDays"
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={policy.contactWindowDays}
                  />
                </label>
                <label>
                  Max outbound per contact
                  <input
                    name="maxContactOutbound"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={policy.maxContactOutbound}
                  />
                </label>
                <label>
                  Company window days
                  <input
                    name="companyWindowDays"
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={policy.companyWindowDays}
                  />
                </label>
                <label>
                  Max outbound per company
                  <input
                    name="maxCompanyOutbound"
                    type="number"
                    min="1"
                    max="200"
                    defaultValue={policy.maxCompanyOutbound}
                  />
                </label>
                <label>
                  Duplicate warning hours
                  <input
                    name="duplicateWarningHours"
                    type="number"
                    min="1"
                    max="720"
                    defaultValue={policy.duplicateWarningHours}
                  />
                </label>
                <button className="primary-button" type="submit">
                  Save policy
                </button>
              </form>
            </details>
          ) : null}
        </div>
      </section>

      <section className="setup-section">
        <div className="setup-section-heading">
          <div>
            <span className="step-number">03</span>
            <h2>Recent permission records</h2>
          </div>
          <p>
            These records describe what a user recorded and where it came from;
            RevenueScout does not infer legal permission from a public email
            address alone.
          </p>
        </div>

        {consents.length === 0 ? (
          <div className="empty-state compact-empty-state">
            <h3>No permission records yet.</h3>
            <p>
              Confirm a relationship or permission from the relevant contact
              page when you have a real basis to do so.
            </p>
          </div>
        ) : (
          <div className="m5-consent-list">
            {consents.map((record) => (
              <article key={record.id}>
                <div>
                  <Link href={`/companies/${record.companyId}`}>
                    <strong>{record.contactName}</strong>
                  </Link>
                  <span>{record.companyName}</span>
                </div>
                <div>
                  <strong>{label(record.consentType)}</strong>
                  <small>
                    {record.source} · {record.recordedByName ?? "User"} ·{" "}
                    {new Date(record.recordedAt).toLocaleString("en-AU")}
                  </small>
                  {record.note ? <p>{record.note}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
