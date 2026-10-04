import type { OpportunityInput } from "@/lib/domain/types";

export interface CandidateCompanyFacts {
  country: string;
  state: string;
  city: string;
  industry: string;
  subindustry: string;
  employeeCount: number;
  companyAgeYears: number;
  companyType: string;
  serviceRegions: string[];
  fastGrowth: boolean;
  multiLocation: boolean;
  hiring: boolean;
  recentFunding: boolean;
  roles: string[];
  businessModels: string[];
  technologies: string[];
  digitalNeed: boolean;
  entityType: "PRIVATE" | "GOVERNMENT" | "NONPROFIT" | "UNKNOWN";
  existingCustomer: boolean;
  rejected: boolean;
  unsubscribed: boolean;
}

export interface IcpRule {
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
  excludedIndustries: string[];
  excludeGovernment: boolean;
  excludeNonprofit: boolean;
  excludeExistingCustomer: boolean;
  excludeRejected: boolean;
  excludeUnsubscribed: boolean;
  employeeExcludeBelow: number | null;
  employeeExcludeAbove: number | null;
}

export interface OfferingConfig {
  id: string;
  name: string;
  minContractValue: number | null;
  avgContractValue: number | null;
  idealContractValue: number | null;
}

export interface OfferingIcpLink {
  offeringId: string;
  icpId: string;
}

export interface IcpMatch {
  icpId: string;
  icpName: string;
  score: number;
  qualified: boolean;
  excluded: boolean;
  reasons: string[];
  mismatches: string[];
  qualificationFailures: string[];
  exclusionReasons: string[];
}

export interface ConfiguredOpportunity {
  opportunity: OpportunityInput;
  matchedIcp: IcpMatch;
  offeringId: string | null;
  offeringReason: string;
  dealValueBasis: "minimum" | "average" | "ideal" | "none";
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function includesValue(values: string[], candidate: string): boolean {
  const target = normalise(candidate);
  return values.some((value) => normalise(value) === target);
}

function intersects(a: string[], b: string[]): boolean {
  const set = new Set(a.map(normalise));
  return b.some((value) => set.has(normalise(value)));
}

export function evaluateIcp(
  company: CandidateCompanyFacts,
  icp: IcpRule,
): IcpMatch {
  const exclusionReasons: string[] = [];
  const qualificationFailures: string[] = [];

  if (icp.excludeGovernment && company.entityType === "GOVERNMENT") {
    exclusionReasons.push("Government organisations are excluded");
  }
  if (icp.excludeNonprofit && company.entityType === "NONPROFIT") {
    exclusionReasons.push("Nonprofit organisations are excluded");
  }
  if (icp.excludeExistingCustomer && company.existingCustomer) {
    exclusionReasons.push("Existing customers are excluded");
  }
  if (icp.excludeRejected && company.rejected) {
    exclusionReasons.push("Previously rejected companies are excluded");
  }
  if (icp.excludeUnsubscribed && company.unsubscribed) {
    exclusionReasons.push("Unsubscribed companies are excluded");
  }
  if (
    icp.employeeExcludeBelow !== null &&
    company.employeeCount < icp.employeeExcludeBelow
  ) {
    exclusionReasons.push(
      `Companies below ${icp.employeeExcludeBelow} employees are excluded`,
    );
  }
  if (
    icp.employeeExcludeAbove !== null &&
    company.employeeCount > icp.employeeExcludeAbove
  ) {
    exclusionReasons.push(
      `Companies above ${icp.employeeExcludeAbove} employees are excluded`,
    );
  }
  if (
    icp.excludedIndustries.length > 0 &&
    includesValue(icp.excludedIndustries, company.industry)
  ) {
    exclusionReasons.push(`${company.industry} is an excluded industry`);
  }

  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const mismatches: string[] = [];

  const qualificationGate = (
    configured: boolean,
    passed: boolean,
    weight: number,
    success: string,
    failure: string,
  ) => {
    if (!configured) return;
    possible += weight;

    if (passed) {
      earned += weight;
      reasons.push(success);
    } else {
      qualificationFailures.push(failure);
    }
  };

  const preferenceCriterion = (
    configured: boolean,
    passed: boolean,
    weight: number,
    success: string,
    failure: string,
  ) => {
    if (!configured) return;
    possible += weight;

    if (passed) {
      earned += weight;
      reasons.push(success);
    } else {
      mismatches.push(failure);
    }
  };

  // Base company profile is a qualification gate. A company that misses one
  // of these explicitly configured boundaries cannot compensate with softer
  // signals such as hiring, growth or technology.
  qualificationGate(
    icp.countries.length > 0,
    includesValue(icp.countries, company.country),
    15,
    `Country matches: ${company.country}`,
    "Country does not match target countries",
  );
  qualificationGate(
    icp.states.length > 0,
    includesValue(icp.states, company.state),
    8,
    `State matches: ${company.state}`,
    "State does not match target regions",
  );
  qualificationGate(
    icp.cities.length > 0,
    includesValue(icp.cities, company.city),
    5,
    `City matches: ${company.city}`,
    "City does not match target cities",
  );
  qualificationGate(
    icp.industries.length > 0,
    includesValue(icp.industries, company.industry),
    18,
    `Industry matches: ${company.industry}`,
    "Industry does not match target industries",
  );
  qualificationGate(
    icp.subindustries.length > 0,
    includesValue(icp.subindustries, company.subindustry),
    7,
    `Subindustry matches: ${company.subindustry}`,
    "Subindustry does not match target subindustries",
  );
  qualificationGate(
    icp.employeeMin !== null || icp.employeeMax !== null,
    (icp.employeeMin === null || company.employeeCount >= icp.employeeMin) &&
      (icp.employeeMax === null || company.employeeCount <= icp.employeeMax),
    14,
    `Employee count ${company.employeeCount} is in range`,
    "Employee count is outside the target range",
  );
  qualificationGate(
    icp.companyAgeMin !== null || icp.companyAgeMax !== null,
    (icp.companyAgeMin === null || company.companyAgeYears >= icp.companyAgeMin) &&
      (icp.companyAgeMax === null || company.companyAgeYears <= icp.companyAgeMax),
    5,
    "Company age is in range",
    "Company age is outside the target range",
  );
  qualificationGate(
    icp.companyTypes.length > 0,
    includesValue(icp.companyTypes, company.companyType),
    6,
    `Company type matches: ${company.companyType}`,
    "Company type does not match",
  );
  qualificationGate(
    icp.serviceRegions.length > 0,
    intersects(icp.serviceRegions, company.serviceRegions),
    6,
    "Service region overlaps the ICP",
    "Service region does not overlap the ICP",
  );

  // Dynamic / preference conditions improve fit but never rescue a company
  // that failed the base qualification gate above.
  preferenceCriterion(
    icp.fastGrowth,
    company.fastGrowth,
    4,
    "Rapid growth matches",
    "Rapid growth not observed",
  );
  preferenceCriterion(
    icp.multiLocation,
    company.multiLocation,
    4,
    "Multi-location operation matches",
    "Multi-location operation not observed",
  );
  preferenceCriterion(
    icp.hiring,
    company.hiring,
    4,
    "Active hiring matches",
    "Active hiring not observed",
  );
  preferenceCriterion(
    icp.recentFunding,
    company.recentFunding,
    4,
    "Recent funding matches",
    "Recent funding not observed",
  );
  preferenceCriterion(
    icp.digitalNeed,
    company.digitalNeed,
    4,
    "Digitalisation need matches",
    "Digitalisation need not observed",
  );
  preferenceCriterion(
    icp.requiredRoles.length > 0,
    intersects(icp.requiredRoles, company.roles),
    5,
    "Relevant decision-making role exists",
    "Required role not observed",
  );
  preferenceCriterion(
    icp.businessModels.length > 0,
    intersects(icp.businessModels, company.businessModels),
    5,
    "Business model matches",
    "Business model does not match",
  );
  preferenceCriterion(
    icp.technologies.length > 0,
    intersects(icp.technologies, company.technologies),
    5,
    "Technology condition matches",
    "Technology condition does not match",
  );

  if (icp.exclusions.trim()) {
    reasons.push("Manual exclusion notes exist and remain visible for human review");
  }

  const qualified = qualificationFailures.length === 0;
  const excluded = exclusionReasons.length > 0;

  return {
    icpId: icp.id,
    icpName: icp.name,
    score:
      excluded || !qualified || possible === 0
        ? 0
        : Math.round((earned / possible) * 100),
    qualified,
    excluded,
    reasons,
    mismatches,
    qualificationFailures,
    exclusionReasons,
  };
}
export function findBestIcp(
  company: CandidateCompanyFacts,
  icps: IcpRule[],
): IcpMatch | null {
  const matches = icps.map((icp) => evaluateIcp(company, icp));
  const eligible = matches.filter(
    (match) => match.qualified && !match.excluded,
  );

  return eligible.sort((a, b) => b.score - a.score)[0] ?? null;
}

function chooseDealValue(
  company: CandidateCompanyFacts,
  offering: OfferingConfig,
): { value: number; basis: "minimum" | "average" | "ideal"; dealPotential: number } {
  if (
    company.fastGrowth &&
    company.multiLocation &&
    offering.idealContractValue !== null
  ) {
    return { value: offering.idealContractValue, basis: "ideal", dealPotential: 85 };
  }
  if (offering.avgContractValue !== null) {
    return { value: offering.avgContractValue, basis: "average", dealPotential: 70 };
  }
  return {
    value: offering.minContractValue ?? 0,
    basis: "minimum",
    dealPotential: offering.minContractValue === null ? 0 : 50,
  };
}

export function configureOpportunity(
  base: OpportunityInput,
  company: CandidateCompanyFacts,
  icps: IcpRule[],
  offerings: OfferingConfig[],
  links: OfferingIcpLink[],
): ConfiguredOpportunity | null {
  const matchedIcp = findBestIcp(company, icps);
  if (!matchedIcp || !matchedIcp.qualified || matchedIcp.excluded) return null;

  const linkedOfferingIds = new Set(
    links
      .filter((link) => link.icpId === matchedIcp.icpId)
      .map((link) => link.offeringId),
  );

  const linkedOfferings = offerings.filter((offering) =>
    linkedOfferingIds.has(offering.id),
  );

  const ranked = linkedOfferings
    .map((offering) => ({
      offering,
      deal: chooseDealValue(company, offering),
    }))
    .sort((a, b) => b.deal.value - a.deal.value);

  const selected = ranked[0] ?? null;
  const whyThisCompany =
    matchedIcp.reasons.length > 0
      ? `Best ICP match: ${matchedIcp.icpName}. ${matchedIcp.reasons.slice(0, 3).join(". ")}.`
      : `Best ICP match: ${matchedIcp.icpName}.`;

  if (!selected) {
    return {
      matchedIcp,
      offeringId: null,
      offeringReason: `No Offering is linked to ${matchedIcp.icpName}.`,
      dealValueBasis: "none",
      opportunity: {
        ...base,
        icpFit: matchedIcp.score,
        dealPotential: 0,
        expectedDealValue: 0,
        recommendedOffering: "No linked Offering",
        whyThisCompany,
      },
    };
  }

  return {
    matchedIcp,
    offeringId: selected.offering.id,
    offeringReason:
      linkedOfferings.length === 1
        ? `${selected.offering.name} is linked to ${matchedIcp.icpName}.`
        : `${selected.offering.name} has the highest expected deal value among Offerings linked to ${matchedIcp.icpName}.`,
    dealValueBasis: selected.deal.basis,
    opportunity: {
      ...base,
      icpFit: matchedIcp.score,
      dealPotential: selected.deal.dealPotential,
      expectedDealValue: selected.deal.value,
      recommendedOffering: selected.offering.name,
      whyThisCompany,
    },
  };
}
