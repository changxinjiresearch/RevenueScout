import type { DiscoveryCandidate } from "../discovery/types";
import type {
  ConfiguredOpportunity,
  IcpRule,
} from "../domain/configured-opportunity";
import { assessOpportunity } from "../domain/opportunity-score";
import type { CompanyRecord, SignalRecord } from "./opportunity";

export type TriageStatus =
  | "HIGH_POTENTIAL"
  | "MEDIUM_POTENTIAL"
  | "LOW_POTENTIAL"
  | "NEEDS_ENRICHMENT";

export type TriageRecommendation =
  | "ADD_TO_PIPELINE"
  | "REVIEW"
  | "REJECT";

export type TriageAssessment = {
  status: TriageStatus;
  recommendation: TriageRecommendation;
  score: number | null;
  headline: string;
  reasons: string[];
  missingFields: string[];
};

export type TriageCompany = CompanyRecord & {
  legalEntityCategory?: string | null;
  legalEntitySubcategory?: string | null;
  entityStatus?: string | null;
  registrationStatus?: string | null;
  jurisdiction?: string | null;
  legalFormCode?: string | null;
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function missingQualificationFields(
  company: TriageCompany,
  icps: IcpRule[],
): string[] {
  const missing: string[] = [];

  if (icps.some((icp) => icp.countries.length > 0) && !company.country) {
    missing.push("Country");
  }
  if (icps.some((icp) => icp.states.length > 0) && !company.state) {
    missing.push("State / region");
  }
  if (icps.some((icp) => icp.cities.length > 0) && !company.city) {
    missing.push("City");
  }
  if (icps.some((icp) => icp.industries.length > 0) && !company.industry) {
    missing.push("Industry");
  }
  if (
    icps.some((icp) => icp.subindustries.length > 0) &&
    !company.subindustry
  ) {
    missing.push("Subindustry");
  }
  if (
    icps.some((icp) => icp.employeeMin !== null || icp.employeeMax !== null) &&
    company.employeeCount === null
  ) {
    missing.push("Employee count");
  }
  if (
    icps.some((icp) => icp.companyAgeMin !== null || icp.companyAgeMax !== null) &&
    company.foundedYear === null
  ) {
    missing.push("Founded year");
  }
  if (
    icps.some((icp) => icp.companyTypes.length > 0) &&
    !company.companyType
  ) {
    missing.push("Company type");
  }
  if (
    icps.some((icp) => icp.serviceRegions.length > 0) &&
    company.serviceRegions.length === 0
  ) {
    missing.push("Service regions");
  }

  return unique(missing);
}

export function assessDiscoveryCandidate(
  candidate: DiscoveryCandidate,
): TriageAssessment {
  const category = candidate.legalEntityCategory?.toUpperCase() ?? "";
  const status = candidate.entityStatus?.toUpperCase() ?? "";

  if (category === "FUND") {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Likely poor fit for normal B2B outreach",
      reasons: [
        "GLEIF classifies this legal entity as a FUND.",
        "A fund or investment vehicle is usually not the operating company RevenueScout is trying to sell workflow automation to.",
      ],
      missingFields: [],
    };
  }

  if (status && status !== "ACTIVE") {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Entity is not currently active",
      reasons: [`GLEIF entity status is ${candidate.entityStatus}.`],
      missingFields: [],
    };
  }

  return {
    status: "NEEDS_ENRICHMENT",
    recommendation: "REVIEW",
    score: null,
    headline: "Real entity found; commercial fit still needs enrichment",
    reasons: [
      "Legal identity and location are verified from GLEIF.",
      "GLEIF usually does not provide industry, employee count or current buying signals.",
    ],
    missingFields: [
      ...(candidate.industry ? [] : ["Industry"]),
      ...(candidate.employeeCount === null ? ["Employee count"] : []),
    ],
  };
}

export function assessCompanyTriage(input: {
  company: TriageCompany;
  configured: ConfiguredOpportunity | null;
  icps: IcpRule[];
  signals: SignalRecord[];
}): TriageAssessment {
  const { company, configured, icps, signals } = input;
  const category = company.legalEntityCategory?.toUpperCase() ?? "";
  const entityStatus = company.entityStatus?.toUpperCase() ?? "";

  if (
    company.relationshipStatus === "REJECTED" ||
    company.relationshipStatus === "UNSUBSCRIBED"
  ) {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Do not pursue",
      reasons: [
        company.relationshipStatus === "UNSUBSCRIBED"
          ? "This company is marked unsubscribed / opted out."
          : "This company was previously rejected.",
      ],
      missingFields: [],
    };
  }

  if (company.relationshipStatus === "EXISTING_CUSTOMER") {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Not a new-customer acquisition target",
      reasons: ["This company is already marked as an existing customer."],
      missingFields: [],
    };
  }

  if (category === "FUND") {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Low potential for this acquisition motion",
      reasons: [
        "GLEIF classifies the legal entity as a FUND.",
        "This is likely an investment vehicle rather than the operating logistics company targeted by the current ICP.",
      ],
      missingFields: [],
    };
  }

  if (entityStatus && entityStatus !== "ACTIVE") {
    return {
      status: "LOW_POTENTIAL",
      recommendation: "REJECT",
      score: null,
      headline: "Low potential: inactive legal entity",
      reasons: [`External registry status is ${company.entityStatus}.`],
      missingFields: [],
    };
  }

  if (configured) {
    const assessment = assessOpportunity(configured.opportunity);
    const reasons = [
      `Qualified for ICP “${configured.matchedIcp.icpName}”.`,
      `Recommended Offering: ${configured.opportunity.recommendedOffering}.`,
    ];

    if (signals.length > 0) {
      reasons.push(
        `${signals.length} evidence-backed buying signal${signals.length === 1 ? "" : "s"} recorded.`,
      );
    } else {
      reasons.push("No current buying signal has been recorded yet.");
    }

    if (assessment.opportunityScore >= 80) {
      return {
        status: "HIGH_POTENTIAL",
        recommendation: "ADD_TO_PIPELINE",
        score: assessment.opportunityScore,
        headline: "Strong candidate for sales review",
        reasons,
        missingFields: [],
      };
    }

    return {
      status: "MEDIUM_POTENTIAL",
      recommendation: "REVIEW",
      score: assessment.opportunityScore,
      headline: "Potential fit; human review recommended",
      reasons,
      missingFields: [],
    };
  }

  const missingFields = missingQualificationFields(company, icps);
  if (missingFields.length > 0) {
    return {
      status: "NEEDS_ENRICHMENT",
      recommendation: "REVIEW",
      score: null,
      headline: "Potential cannot be judged yet",
      reasons: [
        "The company has a verified identity, but key ICP qualification fields are missing.",
        "Only the missing fields below need to be completed; the rest of the imported record is already stored.",
      ],
      missingFields,
    };
  }

  return {
    status: "LOW_POTENTIAL",
    recommendation: "REJECT",
    score: null,
    headline: "Does not match the current ICP",
    reasons: [
      "Enough qualification data is present, but the company does not pass any configured ICP.",
    ],
    missingFields: [],
  };
}
