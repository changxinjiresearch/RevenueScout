import type { OpportunityInput } from "@/lib/domain/types";
import { geographyMatches } from "@/lib/discovery/geography";

export interface CandidateCompanyFacts {
  country: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  subindustry: string | null;
  employeeCount: number | null;
  companyAgeYears: number | null;
  companyType: string | null;
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
  description?: string;
  primaryProblems?: string;
  typicalCustomers?: string;
  minContractValue: number | null;
  avgContractValue: number | null;
  idealContractValue: number | null;
  salesCycleDays?: number | null;
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
  unknowns: string[];
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

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function includesValue(
  values: string[],
  candidate: string | null | undefined,
): boolean {
  const target = normalise(candidate);
  return Boolean(target) && values.some((value) => normalise(value) === target);
}

function intersects(a: string[], b: string[]): boolean {
  const set = new Set(a.map(normalise));
  return b.some((value) => set.has(normalise(value)));
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function evaluateIcp(
  company: CandidateCompanyFacts,
  icp: IcpRule,
): IcpMatch {
  const exclusionReasons: string[] = [];
  const qualificationFailures: string[] = [];
  const unknowns: string[] = [];

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
    company.employeeCount !== null &&
    icp.employeeExcludeBelow !== null &&
    company.employeeCount < icp.employeeExcludeBelow
  ) {
    exclusionReasons.push(
      `Companies below ${icp.employeeExcludeBelow} employees are excluded`,
    );
  }
  if (
    company.employeeCount !== null &&
    icp.employeeExcludeAbove !== null &&
    company.employeeCount > icp.employeeExcludeAbove
  ) {
    exclusionReasons.push(
      `Companies above ${icp.employeeExcludeAbove} employees are excluded`,
    );
  }
  if (
    hasText(company.industry) &&
    icp.excludedIndustries.length > 0 &&
    includesValue(icp.excludedIndustries, company.industry)
  ) {
    exclusionReasons.push(`${company.industry} is an excluded industry`);
  }

  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  const mismatches: string[] = [];

  const qualificationGate = (input: {
    configured: boolean;
    known: boolean;
    passed: boolean;
    weight: number;
    success: string;
    failure: string;
    unknown: string;
  }) => {
    if (!input.configured) return;
    if (!input.known) {
      unknowns.push(input.unknown);
      return;
    }

    possible += input.weight;
    if (input.passed) {
      earned += input.weight;
      reasons.push(input.success);
    } else {
      qualificationFailures.push(input.failure);
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

  qualificationGate({
    configured: icp.countries.length > 0,
    known: hasText(company.country),
    passed: geographyMatches(
      icp.countries,
      company.country,
      "country",
    ),
    weight: 15,
    success: `Country matches: ${company.country ?? "unknown"}`,
    failure: "Country does not match target countries",
    unknown: "Country",
  });

  qualificationGate({
    configured: icp.states.length > 0,
    known: hasText(company.state),
    passed: geographyMatches(
      icp.states,
      company.state,
      "region",
      company.country,
    ),
    weight: 8,
    success: `State matches: ${company.state ?? "unknown"}`,
    failure: "State does not match target regions",
    unknown: "State / region",
  });

  qualificationGate({
    configured: icp.cities.length > 0,
    known: hasText(company.city),
    passed: includesValue(icp.cities, company.city),
    weight: 5,
    success: `City matches: ${company.city ?? "unknown"}`,
    failure: "City does not match target cities",
    unknown: "City",
  });

  qualificationGate({
    configured: icp.industries.length > 0,
    known: hasText(company.industry),
    passed: includesValue(icp.industries, company.industry),
    weight: 18,
    success: `Industry matches: ${company.industry ?? "unknown"}`,
    failure: "Industry does not match target industries",
    unknown: "Industry",
  });

  qualificationGate({
    configured: icp.subindustries.length > 0,
    known: hasText(company.subindustry),
    passed: includesValue(icp.subindustries, company.subindustry),
    weight: 7,
    success: `Subindustry matches: ${company.subindustry ?? "unknown"}`,
    failure: "Subindustry does not match target subindustries",
    unknown: "Subindustry",
  });

  qualificationGate({
    configured: icp.employeeMin !== null || icp.employeeMax !== null,
    known: company.employeeCount !== null,
    passed:
      company.employeeCount !== null &&
      (icp.employeeMin === null || company.employeeCount >= icp.employeeMin) &&
      (icp.employeeMax === null || company.employeeCount <= icp.employeeMax),
    weight: 14,
    success: `Employee count ${company.employeeCount ?? "unknown"} is in range`,
    failure: "Employee count is outside the target range",
    unknown: "Employee count",
  });

  qualificationGate({
    configured: icp.companyAgeMin !== null || icp.companyAgeMax !== null,
    known: company.companyAgeYears !== null,
    passed:
      company.companyAgeYears !== null &&
      (icp.companyAgeMin === null ||
        company.companyAgeYears >= icp.companyAgeMin) &&
      (icp.companyAgeMax === null ||
        company.companyAgeYears <= icp.companyAgeMax),
    weight: 5,
    success: "Company age is in range",
    failure: "Company age is outside the target range",
    unknown: "Company age",
  });

  qualificationGate({
    configured: icp.companyTypes.length > 0,
    known: hasText(company.companyType),
    passed: includesValue(icp.companyTypes, company.companyType),
    weight: 6,
    success: `Company type matches: ${company.companyType ?? "unknown"}`,
    failure: "Company type does not match",
    unknown: "Company type",
  });

  qualificationGate({
    configured: icp.serviceRegions.length > 0,
    known: company.serviceRegions.length > 0,
    passed: intersects(icp.serviceRegions, company.serviceRegions),
    weight: 6,
    success: "Service region overlaps the ICP",
    failure: "Service region does not overlap the ICP",
    unknown: "Service regions",
  });

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
    reasons.push(
      "Manual exclusion notes exist and remain visible for human review",
    );
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
    unknowns,
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

  return eligible.sort(
    (a, b) =>
      b.score - a.score ||
      a.unknowns.length - b.unknowns.length,
  )[0] ?? null;
}

function chooseDealValue(
  company: CandidateCompanyFacts,
  offering: OfferingConfig,
): {
  value: number;
  basis: "minimum" | "average" | "ideal";
  dealPotential: number;
} {
  if (
    company.fastGrowth &&
    company.multiLocation &&
    offering.idealContractValue !== null
  ) {
    return {
      value: offering.idealContractValue,
      basis: "ideal",
      dealPotential: 85,
    };
  }

  if (offering.avgContractValue !== null) {
    return {
      value: offering.avgContractValue,
      basis: "average",
      dealPotential: 70,
    };
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
  if (!matchedIcp || !matchedIcp.qualified || matchedIcp.excluded) {
    return null;
  }

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
  const reasonParts = matchedIcp.reasons.slice(0, 3);
  if (matchedIcp.unknowns.length > 0) {
    reasonParts.push(
      `Still unknown: ${matchedIcp.unknowns.slice(0, 3).join(", ")}`,
    );
  }

  const whyThisCompany =
    reasonParts.length > 0
      ? `Best ICP match: ${matchedIcp.icpName}. ${reasonParts.join(". ")}.`
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
        ? `${selected.offering.name} is explicitly linked to ${matchedIcp.icpName}.`
        : `${selected.offering.name} has the strongest configured deal-value basis among Offerings linked to ${matchedIcp.icpName}.`,
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
