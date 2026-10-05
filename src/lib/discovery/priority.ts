import { matchedIndustrySemantics } from "./semantic";
import { geographyMatches } from "./geography";
import type {
  DiscoveryCandidate,
  DiscoveryPriority,
} from "./types";

export type DiscoveryIcpContext = {
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
};

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function exactMatch(values: string[], value: string | null | undefined): boolean {
  const target = normalise(value);
  return Boolean(target) && values.some((item) => normalise(item) === target);
}

function industryMatches(values: string[], candidate: DiscoveryCandidate): boolean {
  if (values.length === 0) return true;
  const text = [
    candidate.industry,
    candidate.subindustry,
    candidate.description,
    ...(candidate.matchedSemantics ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  return values.some((industry) => {
    if (normalise(industry) === normalise(candidate.industry)) return true;
    return matchedIndustrySemantics(text, [industry]).length > 0;
  });
}

function distinctSourceFamilyCount(candidate: DiscoveryCandidate): number {
  return new Set(
    (candidate.sourceEvidence ?? []).map((item) => item.sourceFamily),
  ).size;
}

function hasOfficialWebsiteEvidence(candidate: DiscoveryCandidate): boolean {
  return (candidate.sourceEvidence ?? []).some(
    (item) => item.provider === "OFFICIAL_WEBSITE",
  );
}

function companyAgeYears(candidate: DiscoveryCandidate, year = new Date().getUTCFullYear()): number | null {
  if (!candidate.foundedYear || candidate.foundedYear > year) return null;
  return year - candidate.foundedYear;
}

type BaseAssessment = Omit<DiscoveryPriority, "band" | "relativePercentile">;

function assessBase(
  candidate: DiscoveryCandidate,
  icp: DiscoveryIcpContext | null,
): BaseAssessment {
  const matchedFields: string[] = [];
  const missingFields: string[] = [];
  const failedFields: string[] = [];
  const rationale: string[] = [];

  const industryConfidence = candidate.industryValidation?.confidence ?? 0;
  let score = industryConfidence * 45;

  const totalSources = distinctSourceFamilyCount(candidate);
  score += Math.min(15, totalSources * 5);

  if (hasOfficialWebsiteEvidence(candidate)) {
    score += 12;
    matchedFields.push("Verified official website");
  }

  if (normalise(candidate.entityStatus) === "active") {
    score += 5;
    matchedFields.push("Active legal entity");
  }

  if (candidate.industryValidation) {
    matchedFields.push(
      `${candidate.industryValidation.independentSupportingFamilyCount} independent industry sources`,
    );
  }

  if (icp) {
    if (icp.countries.length > 0) {
      if (!candidate.country) {
        missingFields.push("Country");
      } else if (
        geographyMatches(icp.countries, candidate.country, "country")
      ) {
        score += 8;
        matchedFields.push("Target country");
      } else {
        failedFields.push("Country outside ICP");
      }
    }

    if (icp.states.length > 0) {
      if (!candidate.state) {
        missingFields.push("State / region");
      } else if (
        geographyMatches(
          icp.states,
          candidate.state,
          "region",
          candidate.country,
        )
      ) {
        score += 4;
        matchedFields.push("Target state / region");
      } else {
        failedFields.push("State / region outside ICP");
      }
    }

    if (icp.cities.length > 0) {
      if (!candidate.city) {
        missingFields.push("City");
      } else if (exactMatch(icp.cities, candidate.city)) {
        score += 3;
        matchedFields.push("Target city");
      } else {
        failedFields.push("City outside ICP");
      }
    }

    if (icp.industries.length > 0) {
      if (!candidate.industry) {
        missingFields.push("Industry");
      } else if (industryMatches(icp.industries, candidate)) {
        score += 10;
        matchedFields.push("Target industry");
      } else {
        failedFields.push("Industry outside ICP");
      }
    }

    if (icp.subindustries.length > 0) {
      if (!candidate.subindustry) {
        missingFields.push("Subindustry");
      } else if (exactMatch(icp.subindustries, candidate.subindustry)) {
        score += 4;
        matchedFields.push("Target subindustry");
      } else {
        failedFields.push("Subindustry outside ICP");
      }
    }

    if (icp.employeeMin !== null || icp.employeeMax !== null) {
      if (candidate.employeeCount === null) {
        missingFields.push("Employee count");
      } else if (
        (icp.employeeMin === null || candidate.employeeCount >= icp.employeeMin) &&
        (icp.employeeMax === null || candidate.employeeCount <= icp.employeeMax)
      ) {
        score += 8;
        matchedFields.push("Employee count in ICP range");
      } else {
        failedFields.push("Employee count outside ICP");
      }
    }

    const age = companyAgeYears(candidate);
    if (icp.companyAgeMin !== null || icp.companyAgeMax !== null) {
      if (age === null) {
        missingFields.push("Company age");
      } else if (
        (icp.companyAgeMin === null || age >= icp.companyAgeMin) &&
        (icp.companyAgeMax === null || age <= icp.companyAgeMax)
      ) {
        score += 4;
        matchedFields.push("Company age in ICP range");
      } else {
        failedFields.push("Company age outside ICP");
      }
    }

    if (icp.companyTypes.length > 0) {
      if (!candidate.companyType) {
        missingFields.push("Company type");
      } else if (exactMatch(icp.companyTypes, candidate.companyType)) {
        score += 5;
        matchedFields.push("Company type matches ICP");
      } else {
        failedFields.push("Company type outside ICP");
      }
    }
  }

  if (failedFields.length > 0) {
    score = Math.min(score, 49);
  }

  const qualificationStatus =
    failedFields.length > 0
      ? "NOT_QUALIFIED"
      : missingFields.length > 0
        ? "PARTIALLY_QUALIFIED"
        : "QUALIFIED";

  rationale.push(
    `Industry evidence confidence: ${Math.round(industryConfidence * 100)}%.`,
  );
  rationale.push(
    `${totalSources} independent evidence source ${totalSources === 1 ? "family" : "families"} retained.`,
  );

  if (qualificationStatus === "PARTIALLY_QUALIFIED") {
    rationale.push(
      "Known ICP fields fit; missing fields remain unknown rather than counting as negative evidence.",
    );
  } else if (qualificationStatus === "QUALIFIED") {
    rationale.push("All configured ICP fields available at discovery time are satisfied.");
  } else {
    rationale.push("At least one known ICP field conflicts with the target profile.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    rationale,
    qualificationStatus,
    matchedFields: [...new Set(matchedFields)],
    missingFields: [...new Set(missingFields)],
    failedFields: [...new Set(failedFields)],
  };
}

export function rankDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
  icp: DiscoveryIcpContext | null,
): DiscoveryCandidate[] {
  if (candidates.length === 0) return [];

  const assessed = candidates.map((candidate) => ({
    candidate,
    base: assessBase(candidate, icp),
  }));

  const eligible = assessed
    .filter((item) => item.base.qualificationStatus !== "NOT_QUALIFIED")
    .sort((a, b) => b.base.score - a.base.score);

  const highCount = eligible.length > 0 ? Math.max(1, Math.ceil(eligible.length * 0.2)) : 0;
  const mediumCutoff = Math.ceil(eligible.length * 0.65);

  const rankByRecord = new Map<string, { band: DiscoveryPriority["band"]; percentile: number }>();
  eligible.forEach((item, index) => {
    const percentile =
      eligible.length <= 1
        ? 100
        : Math.round(((eligible.length - index) / eligible.length) * 100);
    const band =
      index < highCount
        ? "HIGH"
        : index < mediumCutoff
          ? "MEDIUM"
          : "RESEARCH";

    rankByRecord.set(item.candidate.providerRecordId, { band, percentile });
  });

  return assessed
    .map(({ candidate, base }) => {
      const relative = rankByRecord.get(candidate.providerRecordId);
      const priority: DiscoveryPriority = {
        ...base,
        band:
          base.qualificationStatus === "NOT_QUALIFIED"
            ? "RESEARCH"
            : relative?.band ?? "RESEARCH",
        relativePercentile: relative?.percentile ?? 0,
        rationale: [
          ...base.rationale,
          ...(relative?.band === "HIGH"
            ? ["Ranks in the top priority tier of this validated discovery result set."]
            : []),
        ],
      };

      return {
        ...candidate,
        discoveryPriority: priority,
      };
    })
    .sort((a, b) => {
      const scoreDelta =
        (b.discoveryPriority?.score ?? 0) -
        (a.discoveryPriority?.score ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return a.displayName.localeCompare(b.displayName);
    });
}
