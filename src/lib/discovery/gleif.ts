import type {
  DiscoveryCandidate,
  DiscoveryProvider,
  DiscoveryQuery,
} from "./types";

const GLEIF_API = "https://api.gleif.org/api/v1";

type GleifAddress = {
  addressLines?: string[];
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

type GleifRecord = {
  id?: string;
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string | null };
      legalAddress?: GleifAddress;
      headquartersAddress?: GleifAddress;
      jurisdiction?: string | null;
      category?: string | null;
      subCategory?: string | null;
      status?: string | null;
      entityCreationDate?: string | null;
      registrationAuthority?: {
        registrationAuthorityID?: string | null;
        registrationAuthorityEntityID?: string | null;
      };
      legalForm?: {
        id?: string | null;
        other?: string | null;
      };
    };
    registration?: {
      status?: string | null;
      initialRegistrationDate?: string | null;
      lastUpdateDate?: string | null;
      nextRenewalDate?: string | null;
    };
  };
};

function cleanSearchTerm(value: string): string {
  return value
    .replace(/[;,|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function addressText(address?: GleifAddress): string | null {
  if (!address) return null;
  return [
    ...(address.addressLines ?? []),
    address.city ?? "",
    address.region ?? "",
    address.postalCode ?? "",
    address.country ?? "",
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ") || null;
}

export function mapGleifRecord(record: GleifRecord): DiscoveryCandidate | null {
  const attributes = record.attributes;
  const entity = attributes?.entity;
  const registration = attributes?.registration;
  const legalName = entity?.legalName?.name?.trim();
  const lei = (attributes?.lei || record.id || "").trim();

  if (!legalName || !lei) return null;

  const address = entity?.legalAddress ?? entity?.headquartersAddress;
  const legalFormCode = entity?.legalForm?.id?.trim() || null;
  const legalFormLabel = entity?.legalForm?.other?.trim() || null;
  const category = entity?.category?.trim() || null;
  const companyType =
    legalFormLabel ||
    (/\bpty\.?\s+ltd\.?\b/i.test(legalName) ? "Private" : null);

  const registrationStatus = registration?.status?.trim() || "unknown";
  const entityStatus = entity?.status?.trim() || "unknown";
  const observedAt =
    registration?.lastUpdateDate ||
    registration?.initialRegistrationDate ||
    new Date().toISOString();

  return {
    provider: "GLEIF",
    providerRecordId: lei,
    displayName: legalName,
    legalName,
    website: null,
    domain: null,
    description:
      `GLEIF legal-entity record. Entity status: ${entityStatus}; LEI registration status: ${registrationStatus}.`,
    country: address?.country?.trim() || entity?.jurisdiction?.trim() || null,
    state: address?.region?.trim() || null,
    city: address?.city?.trim() || null,
    address: addressText(address),
    industry: null,
    subindustry: null,
    employeeCount: null,
    employeeRange: null,
    foundedYear: entity?.entityCreationDate
      ? new Date(entity.entityCreationDate).getUTCFullYear()
      : null,
    companyType,
    legalEntityCategory: category,
    legalEntitySubcategory: entity?.subCategory?.trim() || null,
    entityStatus,
    registrationStatus,
    jurisdiction: entity?.jurisdiction?.trim() || null,
    legalFormCode,
    registrationAuthority:
      entity?.registrationAuthority?.registrationAuthorityID?.trim() || null,
    registeredAs:
      entity?.registrationAuthority?.registrationAuthorityEntityID?.trim() || null,
    providerLastUpdatedAt: registration?.lastUpdateDate || null,
    rawSourceUrl: `${GLEIF_API}/lei-records/${encodeURIComponent(lei)}`,
    serviceRegions: [],
    entityType:
      category === "FUND"
        ? "UNKNOWN"
        : companyType === "Private"
          ? "PRIVATE"
          : "UNKNOWN",
    sourceUrl: `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`,
    sourceLabel: "GLEIF LEI record",
    observedAt,
    sourceConfidence: 0.98,
    verificationStatus: "CONFIRMED",
    providerIdentifiers: [
      {
        provider: "GLEIF",
        identifierType: "LEI",
        identifierValue: lei,
      },
    ],
  };
}

export async function searchGleif(
  query: DiscoveryQuery,
): Promise<DiscoveryCandidate[]> {
  const term = cleanSearchTerm(query.query);
  if (term.length < 2) {
    throw new Error("Enter at least 2 characters to search.");
  }

  const firstUrl = new URL(`${GLEIF_API}/lei-records`);
  firstUrl.searchParams.set("filter[entity.legalName]", term);

  // page[size] is a transport batch size, not a product result limit.
  // Follow the provider's next link until the result set is exhausted.
  firstUrl.searchParams.set("page[size]", "100");

  const country = query.country?.trim().toUpperCase();
  if (country) {
    firstUrl.searchParams.set("filter[entity.legalAddress.country]", country);
  }

  const records: GleifRecord[] = [];
  const seenPages = new Set<string>();
  let nextUrl: string | null = firstUrl.toString();

  while (nextUrl && !seenPages.has(nextUrl)) {
    seenPages.add(nextUrl);
    const response = await fetch(nextUrl, {
      headers: {
        Accept: "application/vnd.api+json",
        "User-Agent":
          "RevenueScout/0.3 (+https://revenuescout-web-production.up.railway.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`GLEIF request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      data?: GleifRecord[];
      links?: { next?: string | null };
    };
    records.push(...(payload.data ?? []));
    nextUrl = payload.links?.next ?? null;
  }

  const candidates = records
    .map(mapGleifRecord)
    .filter((candidate): candidate is DiscoveryCandidate => candidate !== null);

  const region = query.region?.trim().toLowerCase();

  return candidates.filter((candidate) => {
    const countryMatches =
      !country || candidate.country?.toUpperCase() === country;
    const regionMatches =
      !region ||
      candidate.state?.toLowerCase() === region ||
      candidate.state?.toLowerCase().includes(region) ||
      candidate.city?.toLowerCase().includes(region);

    return countryMatches && regionMatches;
  });
}


export async function getGleifCandidateByLei(
  lei: string,
): Promise<DiscoveryCandidate | null> {
  const trimmed = lei.trim().toUpperCase();
  if (!/^[A-Z0-9]{20}$/.test(trimmed)) return null;

  const response = await fetch(
    `${GLEIF_API}/lei-records/${encodeURIComponent(trimmed)}`,
    {
      headers: {
        Accept: "application/vnd.api+json",
        "User-Agent":
          "RevenueScout/0.2 (+https://revenuescout-web-production.up.railway.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`GLEIF lookup failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { data?: GleifRecord };
  return payload.data ? mapGleifRecord(payload.data) : null;
}

export const gleifProvider: DiscoveryProvider = {
  id: "GLEIF",
  label: "GLEIF Legal Entity Identifier data",
  coverageNote:
    "Real legal-entity registry data for organisations with LEIs. It is authoritative for LEI reference data but is not a comprehensive directory of Australian SMEs and usually does not provide industry or employee count.",
  search: searchGleif,
};
