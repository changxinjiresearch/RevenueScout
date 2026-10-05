import { collectPublicPages } from "../intelligence/collector";
import { searchGleif } from "./gleif";
import {
  canonicalIndustryLabel,
  expandIndustrySemantics,
  matchedIndustrySemantics,
} from "./semantic";
import { searchWikidata } from "./wikidata";
import type {
  DiscoveryCandidate,
  DiscoveryEvidenceSource,
  DiscoveryIndustryValidation,
  DiscoveryProvider,
  DiscoveryProviderIdentifier,
  DiscoveryQuery,
} from "./types";

const COMPANY_SUFFIXES = new Set([
  "pty",
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "plc",
  "corp",
  "corporation",
  "company",
  "co",
  "holdings",
  "group",
]);

function normaliseName(value: string): string {
  const tokens = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function normaliseDomain(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim() || null;
  }
}

function countryKey(candidate: DiscoveryCandidate): string {
  return candidate.country?.trim().toUpperCase() || "";
}

function nameCountryKey(candidate: DiscoveryCandidate): string {
  return `${normaliseName(candidate.displayName)}|${countryKey(candidate)}`;
}

function jaccardNameSimilarity(a: string, b: string): number {
  const left = new Set(normaliseName(a).split(/\s+/).filter(Boolean));
  const right = new Set(normaliseName(b).split(/\s+/).filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union > 0 ? intersection / union : 0;
}

function mergeStringArrays(...groups: Array<string[] | undefined>): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []).filter(Boolean))];
}

function mergeIdentifiers(
  a: DiscoveryProviderIdentifier[] = [],
  b: DiscoveryProviderIdentifier[] = [],
): DiscoveryProviderIdentifier[] {
  const seen = new Set<string>();
  const merged: DiscoveryProviderIdentifier[] = [];
  for (const item of [...a, ...b]) {
    const key = `${item.provider}|${item.identifierType}|${item.identifierValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mergeEvidence(
  a: DiscoveryEvidenceSource[] = [],
  b: DiscoveryEvidenceSource[] = [],
): DiscoveryEvidenceSource[] {
  const seen = new Set<string>();
  const merged: DiscoveryEvidenceSource[] = [];
  for (const item of [...a, ...b]) {
    const key = `${item.provider}|${item.sourceFamily}|${item.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function providerEvidence(
  candidate: DiscoveryCandidate,
  semantics: string[],
): DiscoveryEvidenceSource {
  const evidenceText = [
    candidate.displayName,
    candidate.legalName,
    candidate.description,
  ]
    .filter(Boolean)
    .join(" ");
  const matched = matchedIndustrySemantics(evidenceText, semantics);

  return {
    provider:
      candidate.provider === "WIKIDATA" ? "WIKIDATA" : "GLEIF",
    providerRecordId: candidate.providerRecordId,
    sourceUrl: candidate.sourceUrl,
    sourceLabel: candidate.sourceLabel,
    excerpt:
      candidate.description ||
      candidate.legalName ||
      candidate.displayName,
    observedAt: candidate.observedAt,
    confidence: candidate.sourceConfidence,
    verificationStatus: candidate.verificationStatus,
    sourceFamily:
      candidate.provider === "WIKIDATA" ? "wikidata.org" : "gleif.org",
    matchedSemantics: matched,
    supportsIndustry: matched.length > 0,
  };
}

function candidateWithEvidence(
  candidate: DiscoveryCandidate,
  semantics: string[],
): DiscoveryCandidate {
  const baseEvidence =
    candidate.sourceEvidence?.length
      ? candidate.sourceEvidence
      : [providerEvidence(candidate, semantics)];

  return {
    ...candidate,
    domain: normaliseDomain(candidate.domain ?? candidate.website),
    sourceEvidence: baseEvidence,
    matchedSemantics: mergeStringArrays(
      candidate.matchedSemantics,
      baseEvidence.flatMap((item) => item.matchedSemantics),
    ),
    providerIdentifiers:
      candidate.providerIdentifiers?.length
        ? candidate.providerIdentifiers
        : candidate.provider === "GLEIF"
          ? [
              {
                provider: "GLEIF",
                identifierType: "LEI",
                identifierValue: candidate.providerRecordId,
              },
            ]
          : candidate.provider === "WIKIDATA"
            ? [
                {
                  provider: "WIKIDATA",
                  identifierType: "WIKIDATA",
                  identifierValue: candidate.providerRecordId,
                },
              ]
            : [],
  };
}

function mergeCandidates(
  existing: DiscoveryCandidate,
  incoming: DiscoveryCandidate,
): DiscoveryCandidate {
  const preferIncomingLegal =
    incoming.provider === "GLEIF" && existing.provider !== "GLEIF";

  return {
    ...existing,
    displayName:
      preferIncomingLegal ? incoming.displayName : existing.displayName,
    legalName:
      preferIncomingLegal ? incoming.legalName : existing.legalName,
    website: existing.website ?? incoming.website,
    domain:
      normaliseDomain(existing.domain ?? existing.website) ??
      normaliseDomain(incoming.domain ?? incoming.website),
    description: existing.description ?? incoming.description,
    country: existing.country ?? incoming.country,
    state: existing.state ?? incoming.state,
    city: existing.city ?? incoming.city,
    address: existing.address ?? incoming.address,
    foundedYear: existing.foundedYear ?? incoming.foundedYear,
    companyType: existing.companyType ?? incoming.companyType,
    legalEntityCategory:
      existing.legalEntityCategory ?? incoming.legalEntityCategory,
    legalEntitySubcategory:
      existing.legalEntitySubcategory ?? incoming.legalEntitySubcategory,
    entityStatus: existing.entityStatus ?? incoming.entityStatus,
    registrationStatus:
      existing.registrationStatus ?? incoming.registrationStatus,
    jurisdiction: existing.jurisdiction ?? incoming.jurisdiction,
    legalFormCode: existing.legalFormCode ?? incoming.legalFormCode,
    registrationAuthority:
      existing.registrationAuthority ?? incoming.registrationAuthority,
    registeredAs: existing.registeredAs ?? incoming.registeredAs,
    providerLastUpdatedAt:
      existing.providerLastUpdatedAt ?? incoming.providerLastUpdatedAt,
    sourceEvidence: mergeEvidence(
      existing.sourceEvidence,
      incoming.sourceEvidence,
    ),
    matchedSemantics: mergeStringArrays(
      existing.matchedSemantics,
      incoming.matchedSemantics,
    ),
    providerIdentifiers: mergeIdentifiers(
      existing.providerIdentifiers,
      incoming.providerIdentifiers,
    ),
  };
}

export function dedupeDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
): DiscoveryCandidate[] {
  const merged: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const domain = normaliseDomain(candidate.domain ?? candidate.website);
    const exactNameKey = nameCountryKey(candidate);

    let index = merged.findIndex((existing) => {
      const existingDomain = normaliseDomain(
        existing.domain ?? existing.website,
      );
      if (domain && existingDomain && domain === existingDomain) return true;
      if (nameCountryKey(existing) === exactNameKey) return true;

      const sameCountry =
        !countryKey(candidate) ||
        !countryKey(existing) ||
        countryKey(candidate) === countryKey(existing);
      return (
        sameCountry &&
        jaccardNameSimilarity(existing.displayName, candidate.displayName) >=
          0.86
      );
    });

    if (index < 0) {
      merged.push(candidate);
      continue;
    }

    merged[index] = mergeCandidates(merged[index], candidate);
  }

  return merged;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await fn(values[index], index);
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

async function addOfficialWebsiteEvidence(
  candidate: DiscoveryCandidate,
  semantics: string[],
): Promise<DiscoveryCandidate> {
  const existingFamilies = new Set(
    (candidate.sourceEvidence ?? [])
      .filter((item) => item.supportsIndustry)
      .map((item) => item.sourceFamily),
  );
  if (existingFamilies.size >= 2) return candidate;

  try {
    const collected = await collectPublicPages({
      displayName: candidate.displayName,
      legalName: candidate.legalName,
      website: candidate.website,
      domain: candidate.domain,
      maxPages: 3,
    });

    if (!collected.officialWebsite || collected.pages.length === 0) {
      return candidate;
    }

    const matchedPages = collected.pages
      .map((page) => ({
        page,
        matched: matchedIndustrySemantics(
          `${page.title} ${page.description} ${page.text}`,
          semantics,
        ),
      }))
      .filter((item) => item.matched.length > 0);

    if (matchedPages.length === 0) return candidate;

    const official = new URL(collected.officialWebsite);
    const sourceFamily = `official:${official.hostname
      .toLowerCase()
      .replace(/^www\./, "")}`;
    const best = matchedPages[0];
    const evidence: DiscoveryEvidenceSource = {
      provider: "OFFICIAL_WEBSITE",
      providerRecordId: null,
      sourceUrl: best.page.url,
      sourceLabel: "Verified official company website",
      excerpt: best.page.text.slice(0, 600),
      observedAt: best.page.fetchedAt,
      confidence: Math.max(0.82, collected.websiteConfidence),
      verificationStatus: "CONFIRMED",
      sourceFamily,
      matchedSemantics: mergeStringArrays(
        ...matchedPages.map((item) => item.matched),
      ),
      supportsIndustry: true,
    };

    return {
      ...candidate,
      website: collected.officialWebsite,
      domain: normaliseDomain(collected.officialWebsite),
      sourceEvidence: mergeEvidence(candidate.sourceEvidence, [evidence]),
      matchedSemantics: mergeStringArrays(
        candidate.matchedSemantics,
        evidence.matchedSemantics,
      ),
    };
  } catch {
    return candidate;
  }
}

function validationFor(
  candidate: DiscoveryCandidate,
  query: string,
): DiscoveryIndustryValidation | null {
  const supporting = (candidate.sourceEvidence ?? []).filter(
    (item) => item.supportsIndustry,
  );
  const families = new Set(supporting.map((item) => item.sourceFamily));
  if (families.size < 2) return null;

  const matched = mergeStringArrays(
    candidate.matchedSemantics,
    supporting.flatMap((item) => item.matchedSemantics),
  );

  const avgConfidence =
    supporting.reduce((sum, item) => sum + item.confidence, 0) /
    Math.max(1, supporting.length);
  const confidence = Math.min(
    0.97,
    Math.max(
      0.7,
      avgConfidence * 0.78 +
        Math.min(0.14, families.size * 0.04) +
        Math.min(0.08, matched.length * 0.015),
    ),
  );

  return {
    query,
    status: families.size >= 3 ? "CONFIRMED" : "CORROBORATED",
    confidence,
    independentSupportingFamilyCount: families.size,
    matchedSemantics: matched,
  };
}

function canonicalRecordId(candidate: DiscoveryCandidate): string {
  const identifiers = candidate.providerIdentifiers ?? [];
  if (identifiers.length > 0) {
    return identifiers
      .map((item) => `${item.provider}:${item.identifierValue}`)
      .sort()
      .join("|");
  }

  return (
    normaliseDomain(candidate.domain ?? candidate.website) ||
    nameCountryKey(candidate)
  );
}

export async function searchMultiSource(
  query: DiscoveryQuery,
): Promise<DiscoveryCandidate[]> {
  const semantics = expandIndustrySemantics(query.query);
  if (semantics.length === 0) {
    throw new Error("Enter a meaningful industry or market keyword.");
  }

  // Search every semantic variant. There is intentionally no product-level
  // candidate cap: each provider adapter paginates until its own result set is
  // exhausted.
  const gleifGroups = await mapWithConcurrency(
    semantics,
    4,
    (term) =>
      searchGleif({
        ...query,
        query: term,
        limit: undefined,
      }),
  );

  const wikidata = await searchWikidata({
    ...query,
    semantics,
    limit: undefined,
  });

  const raw = [
    ...gleifGroups.flat(),
    ...wikidata,
  ].map((candidate) => candidateWithEvidence(candidate, semantics));

  const deduped = dedupeDiscoveryCandidates(raw);
  const enriched = await mapWithConcurrency(
    deduped,
    6,
    (candidate) => addOfficialWebsiteEvidence(candidate, semantics),
  );

  const validated: DiscoveryCandidate[] = [];

  for (const candidate of enriched) {
    const validation = validationFor(candidate, query.query);
    if (!validation) continue;

    const sourceEvidence = candidate.sourceEvidence ?? [];
    const primarySource =
      sourceEvidence.find((item) => item.provider === "GLEIF") ??
      sourceEvidence.find((item) => item.provider === "WIKIDATA") ??
      sourceEvidence[0];

    const verificationStatus: DiscoveryCandidate["verificationStatus"] =
      validation.status === "CONFIRMED" ? "CONFIRMED" : "LIKELY";

    validated.push({
      ...candidate,
      provider: "MULTI_SOURCE",
      providerRecordId: canonicalRecordId(candidate),
      industry: canonicalIndustryLabel(query.query),
      sourceUrl: primarySource?.sourceUrl ?? candidate.sourceUrl,
      sourceLabel: "Multi-source semantic validation",
      sourceConfidence: validation.confidence,
      verificationStatus,
      industryValidation: validation,
      matchedSemantics: validation.matchedSemantics,
    });
  }

  return validated.sort((a, b) => {
    const confidenceDelta =
      (b.industryValidation?.confidence ?? 0) -
      (a.industryValidation?.confidence ?? 0);
    if (confidenceDelta !== 0) return confidenceDelta;
    return a.displayName.localeCompare(b.displayName);
  });
}

export const multiSourceProvider: DiscoveryProvider = {
  id: "MULTI_SOURCE",
  label: "Multi-source semantic discovery",
  coverageNote:
    "Searches multiple semantic variants, merges independent public sources, removes duplicates, and only returns companies whose requested industry is corroborated by at least two independent source families. No fixed product-level result cap is applied.",
  search: searchMultiSource,
};
