import Link from "next/link";
import {
  IcpFields,
  OfferingFields,
  type IcpFormValue,
  type OfferingFormValue,
} from "@/components/gtm-fields";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageGtm, canManageWorkspace } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Organisation = {
  name: string;
  website: string | null;
  country: string | null;
  serviceRegions: string[];
  industry: string | null;
  companySize: string | null;
  description: string | null;
  configVersion: number;
};

type Offering = OfferingFormValue & { id: string };
type Icp = IcpFormValue & { id: string };
type LinkRow = {
  offeringId: string;
  offeringName: string;
  icpId: string;
  icpName: string;
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sql = db();
  const params = await searchParams;

  const [organisation] = await sql<Organisation[]>`
    SELECT
      name,
      website,
      country,
      service_regions AS "serviceRegions",
      industry,
      company_size AS "companySize",
      description,
      config_version AS "configVersion"
    FROM organizations
    WHERE id = ${user.organizationId}
  `;

  const offerings = await sql<Offering[]>`
    SELECT
      id,
      name,
      description,
      primary_problems AS "primaryProblems",
      typical_customers AS "typicalCustomers",
      min_contract_value::text AS "minContractValue",
      avg_contract_value::text AS "avgContractValue",
      ideal_contract_value::text AS "idealContractValue",
      sales_cycle_days AS "salesCycleDays",
      unsuitable_customers AS "unsuitableCustomers"
    FROM offerings
    WHERE organization_id = ${user.organizationId}
    ORDER BY created_at ASC
  `;

  const icps = await sql<Icp[]>`
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
    ORDER BY created_at ASC
  `;

  const links = await sql<LinkRow[]>`
    SELECT
      o.id AS "offeringId",
      o.name AS "offeringName",
      i.id AS "icpId",
      i.name AS "icpName"
    FROM offering_icps oi
    JOIN offerings o ON o.id = oi.offering_id
    JOIN icps i ON i.id = oi.icp_id
    WHERE o.organization_id = ${user.organizationId}
      AND i.organization_id = ${user.organizationId}
    ORDER BY o.name, i.name
  `;

  const canWorkspace = canManageWorkspace(user.role);
  const canGtm = canManageGtm(user.role);

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link className="nav-active" href="/setup">Market Setup</Link>
          <Link href="/workspace">Workspace</Link>
          <form action="/api/auth/logout" method="post">
            <button className="text-button" type="submit">Sign out</button>
          </form>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">Go-to-market configuration · v{organisation.configVersion}</div>
          <h1>Tell RevenueScout what to pursue.</h1>
          <p className="lede">
            These settings directly control ICP Fit, hard exclusions,
            Recommended Offering and Estimated Deal Value.
          </p>
        </div>
        <div className="workspace-chip">
          <span>{user.name}</span>
          <strong>{user.organizationName} · {user.role}</strong>
        </div>
      </header>

      {params.saved ? <div className="success-banner">Saved successfully.</div> : null}
      {params.error ? <div className="error-banner">{params.error}</div> : null}

      <section className="setup-section">
        <SectionHeading
          step="01"
          title="Company profile"
          copy="Defines who is selling and where the business can realistically serve customers."
        />
        {canWorkspace ? (
          <form className="config-card form-grid" action="/api/workspace" method="post">
            <input type="hidden" name="returnTo" value="/setup" />
            <label>
              Company name
              <input name="name" defaultValue={organisation.name} required />
            </label>
            <label>
              Website
              <input name="website" type="url" defaultValue={organisation.website ?? ""} />
            </label>
            <label>
              Country
              <input name="country" defaultValue={organisation.country ?? ""} />
            </label>
            <label>
              Industry
              <input name="industry" defaultValue={organisation.industry ?? ""} />
            </label>
            <label>
              Company size
              <input name="companySize" defaultValue={organisation.companySize ?? ""} />
            </label>
            <label>
              Service regions
              <input
                name="serviceRegions"
                defaultValue={organisation.serviceRegions.join(", ")}
              />
            </label>
            <label className="span-2">
              Company description
              <textarea name="description" rows={3} defaultValue={organisation.description ?? ""} />
            </label>
            <div className="span-2 form-actions">
              <button className="primary-button" type="submit">Save company profile</button>
            </div>
          </form>
        ) : (
          <ReadOnlyCard
            title={organisation.name}
            lines={[
              organisation.industry ?? "Industry not set",
              organisation.country ?? "Country not set",
              organisation.serviceRegions.join(", ") || "Service regions not set",
            ]}
          />
        )}
      </section>

      <section className="setup-section">
        <SectionHeading
          step="02"
          title="Offerings"
          copy="Contract economics and problem context let RevenueScout estimate deal value and decide what to sell."
        />
        <div className="config-list">
          {offerings.map((offering) => (
            <details className="config-card" key={offering.id}>
              <summary className="config-summary">
                <span>
                  <strong>{offering.name}</strong>
                  <small>
                    Avg contract {offering.avgContractValue
                      ? `A$ ${Number(offering.avgContractValue).toLocaleString("en-AU")}`
                      : "not set"}
                  </small>
                </span>
                <span>{canGtm ? "Edit" : "View"}</span>
              </summary>

              {canGtm ? (
                <>
                  <form className="form-grid edit-form" action="/api/offerings" method="post">
                    <input type="hidden" name="intent" value="update" />
                    <input type="hidden" name="id" value={offering.id} />
                    <input type="hidden" name="returnTo" value="/setup" />
                    <OfferingFields offering={offering} />
                    <div className="span-2 form-actions">
                      <button className="primary-button" type="submit">Save changes</button>
                    </div>
                  </form>
                  <form action="/api/offerings" method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={offering.id} />
                    <input type="hidden" name="returnTo" value="/setup" />
                    <button className="danger-button" type="submit">Delete Offering</button>
                  </form>
                </>
              ) : (
                <div className="readonly-details">
                  <p>{offering.description}</p>
                  <p><strong>Problems:</strong> {offering.primaryProblems}</p>
                  <p><strong>Typical customers:</strong> {offering.typicalCustomers}</p>
                </div>
              )}
            </details>
          ))}

          {canGtm ? (
            <details className="config-card create-card" open={offerings.length === 0}>
              <summary className="config-summary">
                <span>
                  <strong>Add an Offering</strong>
                  <small>What can the company actually sell?</small>
                </span>
                <span>New</span>
              </summary>
              <form className="form-grid edit-form" action="/api/offerings" method="post">
                <input type="hidden" name="intent" value="create" />
                <input type="hidden" name="returnTo" value="/setup" />
                <OfferingFields />
                <div className="span-2 form-actions">
                  <button className="primary-button" type="submit">Create Offering</button>
                </div>
              </form>
            </details>
          ) : null}
        </div>
      </section>

      <section className="setup-section">
        <SectionHeading
          step="03"
          title="Ideal Customer Profiles"
          copy="Positive conditions affect ICP Fit. Hard exclusions override the score and suppress the company."
        />
        <div className="config-list">
          {icps.map((icp) => (
            <details className="config-card" key={icp.id}>
              <summary className="config-summary">
                <span>
                  <strong>{icp.name}</strong>
                  <small>
                    {icp.industries.length ? icp.industries.join(", ") : "Any industry"} ·{" "}
                    {icp.employeeMin ?? "?"}–{icp.employeeMax ?? "?"} employees
                  </small>
                </span>
                <span>{canGtm ? "Edit" : "View"}</span>
              </summary>

              {canGtm ? (
                <>
                  <form className="form-grid edit-form" action="/api/icps" method="post">
                    <input type="hidden" name="intent" value="update" />
                    <input type="hidden" name="id" value={icp.id} />
                    <input type="hidden" name="returnTo" value="/setup" />
                    <IcpFields icp={icp} />
                    <div className="span-2 form-actions">
                      <button className="primary-button" type="submit">Save changes</button>
                    </div>
                  </form>
                  <form action="/api/icps" method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={icp.id} />
                    <input type="hidden" name="returnTo" value="/setup" />
                    <button className="danger-button" type="submit">Delete ICP</button>
                  </form>
                </>
              ) : (
                <div className="readonly-details">
                  <p><strong>Countries:</strong> {icp.countries.join(", ") || "Any"}</p>
                  <p><strong>Industries:</strong> {icp.industries.join(", ") || "Any"}</p>
                  <p><strong>Employee range:</strong> {icp.employeeMin ?? "?"}–{icp.employeeMax ?? "?"}</p>
                </div>
              )}
            </details>
          ))}

          {canGtm ? (
            <details className="config-card create-card" open={icps.length === 0}>
              <summary className="config-summary">
                <span>
                  <strong>Add an ICP</strong>
                  <small>Define who RevenueScout should actively pursue.</small>
                </span>
                <span>New</span>
              </summary>
              <form className="form-grid edit-form" action="/api/icps" method="post">
                <input type="hidden" name="intent" value="create" />
                <input type="hidden" name="returnTo" value="/setup" />
                <IcpFields />
                <div className="span-2 form-actions">
                  <button className="primary-button" type="submit">Create ICP</button>
                </div>
              </form>
            </details>
          ) : null}
        </div>
      </section>

      <section className="setup-section">
        <SectionHeading
          step="04"
          title="Offering ↔ ICP mapping"
          copy="This connection is the explicit reason RevenueScout is allowed to recommend an Offering to a matching company."
        />

        {links.length > 0 ? (
          <div className="mapping-list">
            {links.map((link) => (
              <div className="config-card mapping-row" key={`${link.offeringId}-${link.icpId}`}>
                <strong>{link.offeringName}</strong>
                <span>→</span>
                <strong>{link.icpName}</strong>
                {canGtm ? (
                  <form action="/api/offering-icps" method="post">
                    <input type="hidden" name="intent" value="unlink" />
                    <input type="hidden" name="offeringId" value={link.offeringId} />
                    <input type="hidden" name="icpId" value={link.icpId} />
                    <input type="hidden" name="returnTo" value="/setup" />
                    <button className="danger-button" type="submit">Unlink</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="config-card blocked-card">No Offering is linked to an ICP yet.</div>
        )}

        {canGtm && offerings.length > 0 && icps.length > 0 ? (
          <form className="config-card mapping-form" action="/api/offering-icps" method="post">
            <input type="hidden" name="intent" value="link" />
            <input type="hidden" name="returnTo" value="/setup" />
            <label>
              Offering
              <select name="offeringId">
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>{offering.name}</option>
                ))}
              </select>
            </label>
            <label>
              ICP
              <select name="icpId">
                {icps.map((icp) => (
                  <option key={icp.id} value={icp.id}>{icp.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">Link</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function SectionHeading({
  step,
  title,
  copy,
}: {
  step: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="setup-section-heading">
      <div>
        <span className="step-number">{step}</span>
        <h2>{title}</h2>
      </div>
      <p>{copy}</p>
    </div>
  );
}

function ReadOnlyCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <article className="config-card readonly-details">
      <strong>{title}</strong>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </article>
  );
}
