import {
  matchedIndustrySemantics,
} from "./semantic";
import type {
  DiscoveryCandidate,
  DiscoveryEvidenceSource,
  DiscoveryProvider,
  DiscoveryQuery,
} from "./types";

const API = "https://www.wikidata.org/w/api.php";

type SearchHit = {
  id?: string;
  label?: string;
  description?: string;
  concepturi?: string;
};

type SearchResponse = {
  search?: SearchHit[];
  "search-continue"?: number;
};

type ClaimValue = {
  mainsnak?: {
    datavalue?: {
      value?: unknown;
    };
  };
};

type Entity = {
  id?: string;
  labels?: Record<string, { language?: string; value?: string }>;
  descriptions?: Record<string, { language?: string; value?: string }>;
  claims?: Record<string, ClaimValue[]>;
};

type EntityResponse = {
  entities?: Record<string, Entity>;
};

const COUNTRY_QIDS: Record<string, string> = {
  AU: "Q408",
  NZ: "Q664",
  US: "Q30",
  GB: "Q145",
  CA: "Q16",
  SG: "Q334",
  DE: "Q183",
  FR: "Q142",
  IN: "Q668",
  JP: "Q17",
};

const COUNTRY_DEMONYMS: Record<string, string[]> = {
  AU: ["australia", "australian"],
  NZ: ["new zealand"],
  US: ["united states", "american", "u.s."],
  GB: ["united kingdom", "british", "uk"],
  CA: ["canada", "canadian"],
  SG: ["singapore", "singaporean"],
  DE: ["germany", "german"],
  FR: ["france", "french"],
  IN: ["india", "indian"],
  JP: ["japan", "japanese"],
};

function stringClaim(entity: Entity, property: string): string | null {
  const value = entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function entityIdClaim(entity: Entity, property: string): string | null {
  const value = entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function countryMatches(
  entity: Entity,
  description: string,
  country: string | null,
): boolean {
  if (!country) return true;
  const qid = COUNTRY_QIDS[country];
  const entityCountry = entityIdClaim(entity, "P17");
  if (qid && entityCountry) return qid === entityCountry;

  const lower = description.toLowerCase();
  return (COUNTRY_DEMONYMS[country] ?? [country.toLowerCase()]).some((term) =>
    lower.includes(term),
  );
}

function looksLikeOrganisation(label: string, description: string): boolean {
  const text = `${label} ${description}`.toLowerCase();
  return [
    "company",
    "business",
    "corporation",
    "operator",
    "enterprise",
    "firm",
    "group",
    "organisation",
    "organization",
    "logistics",
    "freight",
    "transport",
    "shipping",
    "courier",
    "warehouse",
    "distribution",
  ].some((term) => text.includes(term));
}

async function searchAll(search: string): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  let cursor: number | null = 0;

  while (cursor !== null) {
    const url = new URL(API);
    url.searchParams.set("action", "wbsearchentities");
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "en");
    url.searchParams.set("type", "item");
    url.searchParams.set("limit", "50");
    url.searchParams.set("search", search);
    if (cursor > 0) url.searchParams.set("continue", String(cursor));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "RevenueScout/0.3 (+https://revenuescout-web-production.up.railway.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Wikidata search failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as SearchResponse;
    hits.push(...(payload.search ?? []));
    cursor =
      typeof payload["search-continue"] === "number"
        ? payload["search-continue"]
        : null;
  }

  return hits;
}

async function fetchEntities(ids: string[]): Promise<Map<string, Entity>> {
  const entities = new Map<string, Entity>();

  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    const url = new URL(API);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("format", "json");
    url.searchParams.set("languages", "en");
    url.searchParams.set("props", "labels|descriptions|claims");
    url.searchParams.set("ids", batch.join("|"));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "RevenueScout/0.3 (+https://revenuescout-web-production.up.railway.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Wikidata entity fetch failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as EntityResponse;
    for (const [id, entity] of Object.entries(payload.entities ?? {})) {
      entities.set(id, entity);
    }
  }

  return entities;
}

export async function searchWikidata(
  query: DiscoveryQuery & { semantics?: string[] },
): Promise<DiscoveryCandidate[]> {
  const semantics =
    query.semantics?.length ? query.semantics : [query.query.trim()];
  const country = query.country?.trim().toUpperCase() || null;

  const searchPhrases = [
    ...new Set(
      semantics.flatMap((term) => {
        const suffix = country === "AU" ? " Australia" : "";
        return [
          `${term} company${suffix}`,
          `${term} services${suffix}`,
        ];
      }),
    ),
  ];

  const hitGroups = await Promise.all(
    searchPhrases.map((phrase) => searchAll(phrase)),
  );

  const hitsById = new Map<string, SearchHit>();
  for (const hit of hitGroups.flat()) {
    if (hit.id && !hitsById.has(hit.id)) hitsById.set(hit.id, hit);
  }

  const entities = await fetchEntities([...hitsById.keys()]);
  const observedAt = new Date().toISOString();
  const results: DiscoveryCandidate[] = [];

  for (const [id, hit] of hitsById) {
    const entity = entities.get(id);
    if (!entity) continue;

    const label =
      entity.labels?.en?.value?.trim() || hit.label?.trim() || id;
    const description =
      entity.descriptions?.en?.value?.trim() ||
      hit.description?.trim() ||
      "";

    if (!looksLikeOrganisation(label, description)) continue;
    if (!countryMatches(entity, description, country)) continue;

    const matched = matchedIndustrySemantics(
      `${label} ${description}`,
      semantics,
    );
    if (matched.length === 0) continue;

    const website = stringClaim(entity, "P856");
    const sourceUrl = `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`;
    const evidence: DiscoveryEvidenceSource = {
      provider: "WIKIDATA",
      providerRecordId: id,
      sourceUrl,
      sourceLabel: "Wikidata entity",
      excerpt: description || label,
      observedAt,
      confidence: 0.72,
      verificationStatus: "LIKELY",
      sourceFamily: "wikidata.org",
      matchedSemantics: matched,
      supportsIndustry: true,
    };

    results.push({
      provider: "WIKIDATA",
      providerRecordId: id,
      displayName: label,
      legalName: label,
      website,
      domain: website ? new URL(website).hostname.replace(/^www\./, "") : null,
      description: description || null,
      country,
      state: null,
      city: null,
      address: null,
      industry: null,
      subindustry: null,
      employeeCount: null,
      employeeRange: null,
      foundedYear: null,
      companyType: null,
      legalEntityCategory: null,
      legalEntitySubcategory: null,
      entityStatus: null,
      registrationStatus: null,
      jurisdiction: country,
      legalFormCode: null,
      registrationAuthority: null,
      registeredAs: null,
      providerLastUpdatedAt: null,
      rawSourceUrl: sourceUrl,
      serviceRegions: [],
      entityType: "UNKNOWN",
      sourceUrl,
      sourceLabel: "Wikidata entity",
      observedAt,
      sourceConfidence: 0.72,
      verificationStatus: "LIKELY",
      sourceEvidence: [evidence],
      matchedSemantics: matched,
      providerIdentifiers: [
        {
          provider: "WIKIDATA",
          identifierType: "WIKIDATA",
          identifierValue: id,
        },
      ],
    });
  }

  return results;
}

export const wikidataProvider: DiscoveryProvider = {
  id: "WIKIDATA",
  label: "Wikidata organisations",
  coverageNote:
    "Semantic public-knowledge discovery. Used as one independent source family; it is not accepted alone as sufficient industry validation.",
  search: (query) => searchWikidata(query),
};
