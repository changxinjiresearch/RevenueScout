import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Organisation = {
  name: string;
  website: string | null;
  country: string | null;
  serviceRegions: string[];
  industry: string | null;
  companySize: string | null;
  description: string | null;
};

type Offering = {
  id: string;
  name: string;
  description: string;
  primaryProblems: string;
  typicalCustomers: string;
  minContractValue: string | null;
  avgContractValue: string | null;
  idealContractValue: string | null;
  salesCycleDays: number | null;
  unsuitableCustomers: string;
};

type Icp = {
  id: string;
  name: string;
  countries: string[];
  states: string[];
  cities: string[];
  industries: string[];
  subindustries: string[];
  employeeMin: number | null;
  employeeMax: number | null;
  companyAgeMin: number | null;
  companyAgeMax: number | null;
  companyTypes: string[];
  serviceRegions: string[];
  fastGrowth: boolean;
  multiLocation: boolean;
  hiring: boolean;
  recentFunding: boolean;
  requiredRoles: string[];
  businessModels: string[];
  technologies: string[];
  digitalNeed: boolean;
  exclusions: string;
};

function csv(values: string[]) {
  return values.join(", ");
}

function value(value: string | number | null | undefined) {
  return value ?? "";
}

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
      description
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
      exclusions
    FROM icps
    WHERE organization_id = ${user.organizationId}
    ORDER BY created_at ASC
  `;

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link className="nav-active" href="/setup">Market Setup</Link>
          <form action="/api/auth/logout" method="post">
            <button className="text-button" type="submit">Sign out</button>
          </form>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">M1 · Go-to-market configuration</div>
          <h1>Tell RevenueScout what to pursue.</h1>
          <p className="lede">
            These settings become the input layer for company discovery,
            opportunity scoring and expected revenue.
          </p>
        </div>
        <div className="workspace-chip">
          <span>{user.name}</span>
          <strong>{user.organizationName}</strong>
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
        <form className="config-card form-grid" action="/api/workspace" method="post">
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
            <input
              name="companySize"
              placeholder="e.g. 10–50 employees"
              defaultValue={organisation.companySize ?? ""}
            />
          </label>
          <label>
            Service regions
            <input
              name="serviceRegions"
              placeholder="Sydney, Melbourne, Australia"
              defaultValue={csv(organisation.serviceRegions)}
            />
          </label>
          <label className="span-2">
            Company description
            <textarea
              name="description"
              rows={3}
              defaultValue={organisation.description ?? ""}
            />
          </label>
          <div className="span-2 form-actions">
            <button className="primary-button" type="submit">Save company profile</button>
          </div>
        </form>
      </section>

      <section className="setup-section">
        <SectionHeading
          step="02"
          title="Offerings"
          copy="Contract economics and problem context let RevenueScout estimate deal value and choose what to sell."
        />
        <div className="config-list">
          {offerings.map((offering) => (
            <details className="config-card" key={offering.id}>
              <summary className="config-summary">
                <span>
                  <strong>{offering.name}</strong>
                  <small>
                    Avg contract{" "}
                    {offering.avgContractValue
                      ? `A$ ${Number(offering.avgContractValue).toLocaleString("en-AU")}`
                      : "not set"}
                  </small>
                </span>
                <span>Edit</span>
              </summary>
              <form className="form-grid edit-form" action="/api/offerings" method="post">
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={offering.id} />
                <OfferingFields offering={offering} />
                <div className="span-2 form-actions">
                  <button className="primary-button" type="submit">Save changes</button>
                </div>
              </form>
              <form action="/api/offerings" method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={offering.id} />
                <button className="danger-button" type="submit">Delete offering</button>
              </form>
            </details>
          ))}

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
              <OfferingFields />
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">Create Offering</button>
              </div>
            </form>
          </details>
        </div>
      </section>

      <section className="setup-section">
        <SectionHeading
          step="03"
          title="Ideal Customer Profiles"
          copy="Market boundaries, business conditions and exclusions determine which companies RevenueScout should spend effort discovering."
        />
        <div className="config-list">
          {icps.map((icp) => (
            <details className="config-card" key={icp.id}>
              <summary className="config-summary">
                <span>
                  <strong>{icp.name}</strong>
                  <small>
                    {icp.industries.length ? csv(icp.industries) : "Any industry"} ·{" "}
                    {icp.employeeMin ?? "?"}–{icp.employeeMax ?? "?"} employees
                  </small>
                </span>
                <span>Edit</span>
              </summary>
              <form className="form-grid edit-form" action="/api/icps" method="post">
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={icp.id} />
                <IcpFields icp={icp} />
                <div className="span-2 form-actions">
                  <button className="primary-button" type="submit">Save changes</button>
                </div>
              </form>
              <form action="/api/icps" method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={icp.id} />
                <button className="danger-button" type="submit">Delete ICP</button>
              </form>
            </details>
          ))}

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
              <IcpFields />
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">Create ICP</button>
              </div>
            </form>
          </details>
        </div>
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

function OfferingFields({ offering }: { offering?: Offering }) {
  return (
    <>
      <label>
        Offering name
        <input name="name" defaultValue={offering?.name ?? ""} required />
      </label>
      <label>
        Typical sales cycle (days)
        <input
          name="salesCycleDays"
          type="number"
          min="0"
          defaultValue={value(offering?.salesCycleDays)}
        />
      </label>
      <label className="span-2">
        Description
        <textarea name="description" rows={2} defaultValue={offering?.description ?? ""} />
      </label>
      <label className="span-2">
        Main problems solved
        <textarea
          name="primaryProblems"
          rows={2}
          defaultValue={offering?.primaryProblems ?? ""}
        />
      </label>
      <label className="span-2">
        Typical customers
        <textarea
          name="typicalCustomers"
          rows={2}
          defaultValue={offering?.typicalCustomers ?? ""}
        />
      </label>
      <label>
        Minimum contract (AUD)
        <input
          name="minContractValue"
          type="number"
          min="0"
          step="100"
          defaultValue={value(offering?.minContractValue)}
        />
      </label>
      <label>
        Average contract (AUD)
        <input
          name="avgContractValue"
          type="number"
          min="0"
          step="100"
          defaultValue={value(offering?.avgContractValue)}
        />
      </label>
      <label>
        Ideal contract (AUD)
        <input
          name="idealContractValue"
          type="number"
          min="0"
          step="100"
          defaultValue={value(offering?.idealContractValue)}
        />
      </label>
      <label>
        Unsuitable customers
        <input
          name="unsuitableCustomers"
          defaultValue={offering?.unsuitableCustomers ?? ""}
        />
      </label>
    </>
  );
}

function IcpFields({ icp }: { icp?: Icp }) {
  return (
    <>
      <label className="span-2">
        ICP name
        <input
          name="name"
          placeholder="Australian Logistics SME"
          defaultValue={icp?.name ?? ""}
          required
        />
      </label>
      <label>
        Countries
        <input name="countries" defaultValue={csv(icp?.countries ?? [])} />
      </label>
      <label>
        States / regions
        <input name="states" defaultValue={csv(icp?.states ?? [])} />
      </label>
      <label>
        Cities
        <input name="cities" defaultValue={csv(icp?.cities ?? [])} />
      </label>
      <label>
        Service regions
        <input name="serviceRegions" defaultValue={csv(icp?.serviceRegions ?? [])} />
      </label>
      <label>
        Industries
        <input name="industries" defaultValue={csv(icp?.industries ?? [])} />
      </label>
      <label>
        Subindustries
        <input name="subindustries" defaultValue={csv(icp?.subindustries ?? [])} />
      </label>
      <label>
        Minimum employees
        <input name="employeeMin" type="number" min="0" defaultValue={value(icp?.employeeMin)} />
      </label>
      <label>
        Maximum employees
        <input name="employeeMax" type="number" min="0" defaultValue={value(icp?.employeeMax)} />
      </label>
      <label>
        Minimum company age
        <input name="companyAgeMin" type="number" min="0" defaultValue={value(icp?.companyAgeMin)} />
      </label>
      <label>
        Maximum company age
        <input name="companyAgeMax" type="number" min="0" defaultValue={value(icp?.companyAgeMax)} />
      </label>
      <label>
        Company types
        <input name="companyTypes" defaultValue={csv(icp?.companyTypes ?? [])} />
      </label>
      <label>
        Required roles
        <input name="requiredRoles" defaultValue={csv(icp?.requiredRoles ?? [])} />
      </label>
      <label>
        Business models
        <input name="businessModels" defaultValue={csv(icp?.businessModels ?? [])} />
      </label>
      <label>
        Technologies
        <input name="technologies" defaultValue={csv(icp?.technologies ?? [])} />
      </label>

      <fieldset className="span-2 checkbox-fieldset">
        <legend>Business conditions</legend>
        <label className="check-label">
          <input name="fastGrowth" type="checkbox" defaultChecked={icp?.fastGrowth ?? false} />
          Rapid growth
        </label>
        <label className="check-label">
          <input name="multiLocation" type="checkbox" defaultChecked={icp?.multiLocation ?? false} />
          Multiple locations
        </label>
        <label className="check-label">
          <input name="hiring" type="checkbox" defaultChecked={icp?.hiring ?? false} />
          Currently hiring
        </label>
        <label className="check-label">
          <input name="recentFunding" type="checkbox" defaultChecked={icp?.recentFunding ?? false} />
          Recently funded
        </label>
        <label className="check-label">
          <input name="digitalNeed" type="checkbox" defaultChecked={icp?.digitalNeed ?? false} />
          Visible digitalisation need
        </label>
      </fieldset>

      <label className="span-2">
        Exclusions
        <textarea
          name="exclusions"
          rows={3}
          placeholder="government agencies, nonprofits, existing customers, <5 employees"
          defaultValue={icp?.exclusions ?? ""}
        />
      </label>
    </>
  );
}
