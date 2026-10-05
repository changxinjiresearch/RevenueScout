import {
  matchedIndustrySemantics,
} from "./semantic";
import type {
  DiscoveryCandidate,
  DiscoveryEvidenceSource,
  DiscoveryProvider,
  DiscoveryProviderIdentifier,
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
  const seenCursors = new Set<number>();
  let cursor: number | null = 0;

  while (cursor !== null && !seenCursors.has(cursor)) {
    seenCursors.add(cursor);
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

function safeDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await fn(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      () => worker(),
    ),
  );
  return output;
}

function normaliseCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pty|ltd|limited|inc|llc|plc|corp|corporation|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyNameSimilarity(a: string, b: string): number {
  const left = new Set(normaliseCompanyName(a).split(" ").filter(Boolean));
  const right = new Set(normaliseCompanyName(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export async function findWikidataCompanyEvidence(input: {
  displayName: string;
  legalName?: string | null;
  country?: string | null;
  semantics: string[];
}): Promise<{
  evidence: DiscoveryEvidenceSource;
  identifier: DiscoveryProviderIdentifier;
  website: string | null;
  domain: string | null;
} | null> {
  const names = [
    ...new Set(
      [input.legalName, input.displayName]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  ];

  const hitGroups = await mapWithConcurrency(
    names,
    2,
    (name) => searchAll(name),
  );

  const hitsById = new Map<string, SearchHit>();
  for (const hit of hitGroups.flat()) {
    if (hit.id && !hitsById.has(hit.id)) hitsById.set(hit.id, hit);
  }

  const ids = [...hitsById.keys()].slice(0, 40);
  if (ids.length === 0) return null;
  const entities = await fetchEntities(ids);
  const country = input.country?.trim().toUpperCase() || null;

  let best:
    | {
        score: number;
        id: string;
        label: string;
        description: string;
        entity: Entity;
        matched: string[];
      }
    | null = null;

  for (const id of ids) {
    const entity = entities.get(id);
    const hit = hitsById.get(id);
    if (!entity || !hit) continue;

    const label =
      entity.labels?.en?.value?.trim() || hit.label?.trim() || id;
    const description =
      entity.descriptions?.en?.value?.trim() ||
      hit.description?.trim() ||
      "";

    if (!description || !looksLikeOrganisation(label, description)) continue;
    if (!countryMatches(entity, description, country)) continue;

    const similarity = Math.max(
      ...names.map((name) => companyNameSimilarity(name, label)),
    );
    if (similarity < 0.6) continue;

    // Only the descriptive text is allowed to support industry here. A keyword
    // in the company name alone is not treated as direct industry evidence.
    const matched = matchedIndustrySemantics(
      description,
      input.semantics,
    );
    if (matched.length === 0) continue;

    const score = similarity + Math.min(0.25, matched.length * 0.03);
    if (!best || score > best.score) {
      best = { score, id, label, description, entity, matched };
    }
  }

  if (!best) return null;

  const website = stringClaim(best.entity, "P856");
  const sourceUrl = `https://www.wikidata.org/wiki/${encodeURIComponent(best.id)}`;
  const observedAt = new Date().toISOString();

  return {
    evidence: {
      provider: "WIKIDATA",
      providerRecordId: best.id,
      sourceUrl,
      sourceLabel: "Wikidata entity",
      excerpt: best.description,
      observedAt,
      confidence: Math.min(0.88, 0.7 + Math.max(0, best.score - 0.6) * 0.2),
      verificationStatus: "LIKELY",
      sourceFamily: "wikidata.org",
      matchedSemantics: best.matched,
      supportsIndustry: true,
    },
    identifier: {
      provider: "WIKIDATA",
      identifierType: "WIKIDATA",
      identifierValue: best.id,
    },
    website,
    domain: safeDomain(website),
  };
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

  const hitGroups = await mapWithConcurrency(
    searchPhrases,
    4,
    (phrase) => searchAll(phrase),
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
      domain: safeDomain(website),
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
