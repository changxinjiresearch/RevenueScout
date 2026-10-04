export type CompanyFormValue = {
  displayName: string;
  legalName: string | null;
  website: string | null;
  description: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  foundedYear: number | null;
  companyType: string | null;
  serviceRegions: string[];
  productsServices: string | null;
  rolesObserved: string[];
  businessModels: string[];
  technologies: string[];
  fastGrowth: boolean;
  multiLocation: boolean;
  currentlyHiring: boolean;
  recentFunding: boolean;
  digitalNeed: boolean;
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
  relationshipStatus?:
    | "NONE"
    | "EXISTING_CUSTOMER"
    | "PIPELINE"
    | "CONTACTED"
    | "REJECTED"
    | "UNSUBSCRIBED";
};

function csv(values: string[]) {
  return values.join(", ");
}

function value(input: string | number | null | undefined) {
  return input ?? "";
}

export function CompanyFields({
  company,
  includeRelationship = false,
}: {
  company?: CompanyFormValue;
  includeRelationship?: boolean;
}) {
  return (
    <>
      <label>
        Display name
        <input name="displayName" defaultValue={company?.displayName ?? ""} required />
      </label>
      <label>
        Legal name
        <input name="legalName" defaultValue={company?.legalName ?? ""} />
      </label>
      <label>
        Website
        <input
          name="website"
          type="url"
          placeholder="https://example.com"
          defaultValue={company?.website ?? ""}
        />
      </label>
      <label>
        Entity type
        <select name="entityType" defaultValue={company?.entityType ?? "UNKNOWN"}>
          <option value="UNKNOWN">Unknown</option>
          <option value="PRIVATE">Private / commercial</option>
          <option value="GOVERNMENT">Government</option>
          <option value="NONPROFIT">Nonprofit</option>
        </select>
      </label>

      {includeRelationship ? (
        <label>
          Relationship status
          <select
            name="relationshipStatus"
            defaultValue={company?.relationshipStatus ?? "NONE"}
          >
            <option value="NONE">No known relationship</option>
            <option value="EXISTING_CUSTOMER">Existing customer</option>
            <option value="PIPELINE">Already in pipeline</option>
            <option value="CONTACTED">Already contacted</option>
            <option value="REJECTED">Previously rejected</option>
            <option value="UNSUBSCRIBED">Unsubscribed / opted out</option>
          </select>
        </label>
      ) : null}

      <label>
        Country
        <input name="country" defaultValue={company?.country ?? ""} />
      </label>
      <label>
        State / region
        <input name="state" defaultValue={company?.state ?? ""} />
      </label>
      <label>
        City
        <input name="city" defaultValue={company?.city ?? ""} />
      </label>
      <label>
        Address
        <input name="address" defaultValue={company?.address ?? ""} />
      </label>

      <label>
        Industry
        <input name="industry" defaultValue={company?.industry ?? ""} />
      </label>
      <label>
        Subindustry
        <input name="subindustry" defaultValue={company?.subindustry ?? ""} />
      </label>
      <label>
        Employee count
        <input
          name="employeeCount"
          type="number"
          min="0"
          defaultValue={value(company?.employeeCount)}
        />
      </label>
      <label>
        Employee range
        <input
          name="employeeRange"
          placeholder="e.g. 50–200"
          defaultValue={company?.employeeRange ?? ""}
        />
      </label>
      <label>
        Founded year
        <input
          name="foundedYear"
          type="number"
          min="1800"
          max="2100"
          defaultValue={value(company?.foundedYear)}
        />
      </label>
      <label>
        Company type
        <input
          name="companyType"
          placeholder="Private"
          defaultValue={company?.companyType ?? ""}
        />
      </label>
      <label>
        Service regions
        <input
          name="serviceRegions"
          placeholder="NSW, VIC, Australia"
          defaultValue={csv(company?.serviceRegions ?? [])}
        />
      </label>
      <label>
        Observed decision roles
        <input
          name="rolesObserved"
          placeholder="COO, Head of Operations"
          defaultValue={csv(company?.rolesObserved ?? [])}
        />
      </label>
      <label>
        Business models
        <input
          name="businessModels"
          placeholder="B2B, multi-site"
          defaultValue={csv(company?.businessModels ?? [])}
        />
      </label>
      <label>
        Technologies
        <input
          name="technologies"
          placeholder="Xero, Salesforce"
          defaultValue={csv(company?.technologies ?? [])}
        />
      </label>

      <fieldset className="span-2 checkbox-fieldset">
        <legend>Observed business conditions</legend>
        <label className="check-label">
          <input
            name="fastGrowth"
            type="checkbox"
            defaultChecked={company?.fastGrowth ?? false}
          />
          Rapid growth
        </label>
        <label className="check-label">
          <input
            name="multiLocation"
            type="checkbox"
            defaultChecked={company?.multiLocation ?? false}
          />
          Multiple locations
        </label>
        <label className="check-label">
          <input
            name="currentlyHiring"
            type="checkbox"
            defaultChecked={company?.currentlyHiring ?? false}
          />
          Currently hiring
        </label>
        <label className="check-label">
          <input
            name="recentFunding"
            type="checkbox"
            defaultChecked={company?.recentFunding ?? false}
          />
          Recent funding
        </label>
        <label className="check-label">
          <input
            name="digitalNeed"
            type="checkbox"
            defaultChecked={company?.digitalNeed ?? false}
          />
          Visible digitalisation need
        </label>
      </fieldset>

      <label className="span-2">
        Company description
        <textarea
          name="description"
          rows={3}
          defaultValue={company?.description ?? ""}
        />
      </label>
      <label className="span-2">
        Products / services
        <textarea
          name="productsServices"
          rows={2}
          defaultValue={company?.productsServices ?? ""}
        />
      </label>
    </>
  );
}
