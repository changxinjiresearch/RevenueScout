export type OfferingFormValue = {
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

export type IcpFormValue = {
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
  excludedIndustries: string[];
  excludeGovernment: boolean;
  excludeNonprofit: boolean;
  excludeExistingCustomer: boolean;
  excludeRejected: boolean;
  excludeUnsubscribed: boolean;
  employeeExcludeBelow: number | null;
  employeeExcludeAbove: number | null;
};

function csv(values: string[]) {
  return values.join(", ");
}

function value(input: string | number | null | undefined) {
  return input ?? "";
}

export function OfferingFields({
  offering,
}: {
  offering?: OfferingFormValue;
}) {
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
        <textarea
          name="description"
          rows={2}
          defaultValue={offering?.description ?? ""}
        />
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
          placeholder="e.g. microbusinesses with no internal ops team"
          defaultValue={offering?.unsuitableCustomers ?? ""}
        />
      </label>
    </>
  );
}

export function IcpFields({ icp }: { icp?: IcpFormValue }) {
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
        <input
          name="countries"
          placeholder="Australia"
          defaultValue={csv(icp?.countries ?? [])}
        />
      </label>
      <label>
        States / regions
        <input
          name="states"
          placeholder="NSW, VIC"
          defaultValue={csv(icp?.states ?? [])}
        />
      </label>
      <label>
        Cities
        <input name="cities" defaultValue={csv(icp?.cities ?? [])} />
      </label>
      <label>
        Service regions
        <input
          name="serviceRegions"
          defaultValue={csv(icp?.serviceRegions ?? [])}
        />
      </label>
      <label>
        Industries
        <input
          name="industries"
          placeholder="Logistics"
          defaultValue={csv(icp?.industries ?? [])}
        />
      </label>
      <label>
        Subindustries
        <input
          name="subindustries"
          defaultValue={csv(icp?.subindustries ?? [])}
        />
      </label>
      <label>
        Minimum employees
        <input
          name="employeeMin"
          type="number"
          min="0"
          defaultValue={value(icp?.employeeMin)}
        />
      </label>
      <label>
        Maximum employees
        <input
          name="employeeMax"
          type="number"
          min="0"
          defaultValue={value(icp?.employeeMax)}
        />
      </label>
      <label>
        Minimum company age
        <input
          name="companyAgeMin"
          type="number"
          min="0"
          defaultValue={value(icp?.companyAgeMin)}
        />
      </label>
      <label>
        Maximum company age
        <input
          name="companyAgeMax"
          type="number"
          min="0"
          defaultValue={value(icp?.companyAgeMax)}
        />
      </label>
      <label>
        Company types
        <input
          name="companyTypes"
          placeholder="Private"
          defaultValue={csv(icp?.companyTypes ?? [])}
        />
      </label>
      <label>
        Required roles
        <input
          name="requiredRoles"
          placeholder="COO, Head of Operations"
          defaultValue={csv(icp?.requiredRoles ?? [])}
        />
      </label>
      <label>
        Business models
        <input
          name="businessModels"
          placeholder="B2B, multi-site"
          defaultValue={csv(icp?.businessModels ?? [])}
        />
      </label>
      <label>
        Technologies
        <input
          name="technologies"
          placeholder="Xero, Salesforce"
          defaultValue={csv(icp?.technologies ?? [])}
        />
      </label>

      <fieldset className="span-2 checkbox-fieldset">
        <legend>Positive business conditions</legend>
        <label className="check-label">
          <input
            name="fastGrowth"
            type="checkbox"
            defaultChecked={icp?.fastGrowth ?? false}
          />
          Rapid growth
        </label>
        <label className="check-label">
          <input
            name="multiLocation"
            type="checkbox"
            defaultChecked={icp?.multiLocation ?? false}
          />
          Multiple locations
        </label>
        <label className="check-label">
          <input
            name="hiring"
            type="checkbox"
            defaultChecked={icp?.hiring ?? false}
          />
          Currently hiring
        </label>
        <label className="check-label">
          <input
            name="recentFunding"
            type="checkbox"
            defaultChecked={icp?.recentFunding ?? false}
          />
          Recently funded
        </label>
        <label className="check-label">
          <input
            name="digitalNeed"
            type="checkbox"
            defaultChecked={icp?.digitalNeed ?? false}
          />
          Visible digitalisation need
        </label>
      </fieldset>

      <fieldset className="span-2 checkbox-fieldset exclusion-fieldset">
        <legend>Hard exclusions</legend>
        <label className="check-label">
          <input
            name="excludeGovernment"
            type="checkbox"
            defaultChecked={icp?.excludeGovernment ?? false}
          />
          Government organisations
        </label>
        <label className="check-label">
          <input
            name="excludeNonprofit"
            type="checkbox"
            defaultChecked={icp?.excludeNonprofit ?? false}
          />
          Nonprofits
        </label>
        <label className="check-label">
          <input
            name="excludeExistingCustomer"
            type="checkbox"
            defaultChecked={icp?.excludeExistingCustomer ?? true}
          />
          Existing customers
        </label>
        <label className="check-label">
          <input
            name="excludeRejected"
            type="checkbox"
            defaultChecked={icp?.excludeRejected ?? true}
          />
          Previously rejected
        </label>
        <label className="check-label">
          <input
            name="excludeUnsubscribed"
            type="checkbox"
            defaultChecked={icp?.excludeUnsubscribed ?? true}
          />
          Unsubscribed / opted out
        </label>
      </fieldset>

      <label>
        Exclude below employee count
        <input
          name="employeeExcludeBelow"
          type="number"
          min="0"
          defaultValue={value(icp?.employeeExcludeBelow)}
        />
      </label>
      <label>
        Exclude above employee count
        <input
          name="employeeExcludeAbove"
          type="number"
          min="0"
          defaultValue={value(icp?.employeeExcludeAbove)}
        />
      </label>
      <label className="span-2">
        Excluded industries
        <input
          name="excludedIndustries"
          placeholder="Government, Gambling"
          defaultValue={csv(icp?.excludedIndustries ?? [])}
        />
      </label>
      <label className="span-2">
        Additional exclusion notes
        <textarea
          name="exclusions"
          rows={3}
          placeholder="Human-review notes for exclusions that are not yet machine-readable"
          defaultValue={icp?.exclusions ?? ""}
        />
      </label>
    </>
  );
}
