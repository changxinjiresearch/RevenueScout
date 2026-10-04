import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IcpFields,
  OfferingFields,
  type IcpFormValue,
  type OfferingFormValue,
} from "@/components/gtm-fields";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getOnboardingState } from "@/lib/onboarding";
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
};

type Named = { id: string; name: string };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const state = await getOnboardingState(user.organizationId);
  const params = await searchParams;

  if (state.complete && user.onboardingCompletedAt) {
    redirect("/");
  }

  const sql = db();
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

  const offerings = await sql<Named[]>`
    SELECT id, name
    FROM offerings
    WHERE organization_id = ${user.organizationId}
    ORDER BY created_at ASC
  `;

  const icps = await sql<Named[]>`
    SELECT id, name
    FROM icps
    WHERE organization_id = ${user.organizationId}
    ORDER BY created_at ASC
  `;

  const canCompany = canManageWorkspace(user.role);
  const canGtm = canManageGtm(user.role);

  return (
    <main className="onboarding-shell">
      <header className="onboarding-top">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <span>{user.organizationName}</span>
      </header>

      <section className="onboarding-progress-card">
        <div>
          <div className="eyebrow">First-time setup</div>
          <h1>What customers should RevenueScout look for?</h1>
          <p>
            Complete four gates. RevenueScout will use these settings directly
            when it calculates ICP Fit, recommends an Offering and estimates
            deal value.
          </p>
        </div>
        <div className="progress-count">
          <strong>{state.completedSteps}/4</strong>
          <span>complete</span>
        </div>
      </section>

      <div className="progress-track" aria-label="Onboarding progress">
        <span style={{ width: `${state.completedSteps * 25}%` }} />
      </div>

      {params.error ? <div className="error-banner">{params.error}</div> : null}
      {params.saved ? <div className="success-banner">Saved. Continue below.</div> : null}

      {state.currentStep === "company" ? (
        <section className="onboarding-step">
          <StepHeader number="1" title="Describe your company" />
          {!canCompany ? (
            <Blocked message="An Owner or Admin must complete the company profile." />
          ) : (
            <form className="config-card form-grid" action="/api/workspace" method="post">
              <input type="hidden" name="returnTo" value="/onboarding" />
              <label>
                Company name
                <input name="name" defaultValue={organisation.name} required />
              </label>
              <label>
                Website
                <input
                  name="website"
                  type="url"
                  placeholder="https://example.com"
                  defaultValue={organisation.website ?? ""}
                />
              </label>
              <label>
                Country
                <input name="country" defaultValue={organisation.country ?? ""} required />
              </label>
              <label>
                Industry
                <input name="industry" defaultValue={organisation.industry ?? ""} required />
              </label>
              <label>
                Company size
                <input
                  name="companySize"
                  placeholder="e.g. 10–50 employees"
                  defaultValue={organisation.companySize ?? ""}
                  required
                />
              </label>
              <label>
                Service regions
                <input
                  name="serviceRegions"
                  placeholder="Sydney, Melbourne, Australia"
                  defaultValue={organisation.serviceRegions.join(", ")}
                  required
                />
              </label>
              <label className="span-2">
                Company description
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={organisation.description ?? ""}
                  required
                />
              </label>
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">
                  Save and continue
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {state.currentStep === "offering" ? (
        <section className="onboarding-step">
          <StepHeader number="2" title="Define what you sell" />
          {!canGtm ? (
            <Blocked message="An Owner, Admin or Manager must create the Offering." />
          ) : (
            <form className="config-card form-grid" action="/api/offerings" method="post">
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="returnTo" value="/onboarding" />
              <OfferingFields />
              <div className="span-2 helper-box">
                RevenueScout uses your contract range for Estimated Deal Value.
                Write “None” in unsuitable customers if there are no special exclusions.
              </div>
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">
                  Create Offering and continue
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {state.currentStep === "icp" ? (
        <section className="onboarding-step">
          <StepHeader number="3" title="Define the customers you want" />
          {!canGtm ? (
            <Blocked message="An Owner, Admin or Manager must create the ICP." />
          ) : (
            <form className="config-card form-grid" action="/api/icps" method="post">
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="returnTo" value="/onboarding" />
              <IcpFields />
              <div className="span-2 helper-box">
                Hard exclusions override scoring. An excluded company will not
                enter the Today recommendation queue even if other signals are strong.
              </div>
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">
                  Create ICP and continue
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {state.currentStep === "mapping" ? (
        <section className="onboarding-step">
          <StepHeader number="4" title="Connect an Offering to an ICP" />
          {!canGtm ? (
            <Blocked message="An Owner, Admin or Manager must connect the go-to-market configuration." />
          ) : (
            <form className="config-card form-grid" action="/api/offering-icps" method="post">
              <input type="hidden" name="intent" value="link" />
              <input type="hidden" name="returnTo" value="/onboarding" />
              <label>
                Offering
                <select name="offeringId" required>
                  {offerings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offering.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ICP
                <select name="icpId" required>
                  {icps.map((icp) => (
                    <option key={icp.id} value={icp.id}>
                      {icp.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="span-2 helper-box">
                This mapping tells RevenueScout which service to recommend when
                a company matches this ICP. If several Offerings are linked,
                the current MVP selects the one with the highest expected deal value.
              </div>
              <div className="span-2 form-actions">
                <button className="primary-button" type="submit">
                  Link and continue
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {state.currentStep === "complete" ? (
        <section className="onboarding-step completion-card">
          <span className="completion-mark">✓</span>
          <div>
            <div className="eyebrow">Configuration ready</div>
            <h2>RevenueScout now has enough context to make configured decisions.</h2>
            <p>
              Your Today page will calculate ICP Fit from your rules and take
              deal value from the Offering linked to the best matching ICP.
            </p>
            <form action="/api/onboarding/complete" method="post">
              <button className="primary-button" type="submit">
                Finish setup and open Today
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <footer className="onboarding-footer">
        <Link href="/setup">Open full Market Setup</Link>
        <form action="/api/auth/logout" method="post">
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </footer>
    </main>
  );
}

function StepHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="step-heading">
      <span className="step-number">{number}</span>
      <div>
        <div className="eyebrow">Setup step {number} of 4</div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function Blocked({ message }: { message: string }) {
  return <div className="config-card blocked-card">{message}</div>;
}

// Keep imported form types part of the build contract for shared fields.
const _offeringShape: OfferingFormValue | null = null;
const _icpShape: IcpFormValue | null = null;
void _offeringShape;
void _icpShape;
