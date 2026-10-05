import { matchedIndustrySemantics } from "./semantic";
import type {
  DiscoveryCandidate,
  DiscoveryEvidenceSource,
} from "./types";

type DirectoryDefinition = {
  provider: DiscoveryEvidenceSource["provider"];
  sourceFamily: string;
  sourceLabel: string;
  url: string;
  categorySemantics: string[];
  categoryIsDirectIndustryEvidence: boolean;
  confidence: number;
};

const LOGISTICS_DIRECTORIES: DirectoryDefinition[] = [
  {
    provider: "FTA_APSA",
    sourceFamily: "ftalliance.com.au",
    sourceLabel: "Freight & Trade Alliance / APSA member directory",
    url: "https://www.ftalliance.com.au/members/freight-forwarding-customs-broker",
    categorySemantics: ["logistics", "freight", "freight forwarding", "forwarding"],
    categoryIsDirectIndustryEvidence: true,
    confidence: 0.93,
  },
  {
    provider: "FTA_APSA",
    sourceFamily: "ftalliance.com.au",
    sourceLabel: "Freight & Trade Alliance / APSA depots and intermodals directory",
    url: "https://www.ftalliance.com.au/members/depots-and-intermodals",
    categorySemantics: [
      "logistics",
      "transport",
      "warehousing",
      "distribution",
      "supply chain",
    ],
    categoryIsDirectIndustryEvidence: true,
    confidence: 0.91,
  },
  {
    provider: "FTA_APSA",
    sourceFamily: "ftalliance.com.au",
    sourceLabel: "Freight & Trade Alliance / APSA shipping-line directory",
    url: "https://www.ftalliance.com.au/members/shipping-line",
    categorySemantics: ["shipping", "transport", "logistics"],
    categoryIsDirectIndustryEvidence: true,
    confidence: 0.92,
  },
  {
    provider: "FTA_APSA",
    sourceFamily: "ftalliance.com.au",
    sourceLabel: "Freight & Trade Alliance / APSA customs-broker directory",
    url: "https://www.ftalliance.com.au/members/wholesale-and-locum-customs-brokers",
    categorySemantics: [
      "freight",
      "freight forwarding",
      "forwarding",
      "logistics",
    ],
    categoryIsDirectIndustryEvidence: true,
    confidence: 0.9,
  },
  {
    provider: "ATA",
    sourceFamily: "truck.net.au",
    sourceLabel: "Australian Trucking Association corporate members",
    url: "https://truck.net.au/public/members/members",
    categorySemantics: [
      "transport",
      "trucking",
      "freight",
      "logistics",
      "supply chain",
      "warehousing",
    ],
    categoryIsDirectIndustryEvidence: false,
    confidence: 0.9,
  },
  {
    provider: "AFRA",
    sourceFamily: "afra.com.au",
    sourceLabel: "Australian Furniture Removers Association directory",
    url: "https://afra.com.au/moving/find-a-removalist/",
    categorySemantics: [
      "transport",
      "delivery",
      "storage",
      "logistics",
      "warehousing",
    ],
    categoryIsDirectIndustryEvidence: true,
    confidence: 0.88,
  },
  {
    provider: "ALC",
    sourceFamily: "austlogistics.com.au",
    sourceLabel: "Australian Logistics Council member directory",
    url: "https://austlogistics.com.au/our-members/",
    categorySemantics: ["logistics", "supply chain", "transport", "freight"],
    // ALC also has retailers, infrastructure owners and technology suppliers,
    // so membership alone is sector evidence, not direct proof that a company
    // is itself a logistics operator.
    categoryIsDirectIndustryEvidence: false,
    confidence: 0.84,
  },
];

const pagePromiseCache = new Map<string, Promise<string | null>>();

export function resetIndustryDirectoryPageCacheForTests(): void {
  pagePromiseCache.clear();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(
      /\b(pty|proprietary|ltd|limited|inc|incorporated|llc|plc|corp|corporation|company|co|group|holdings)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] || null;
  }
}

async function fetchDirectoryPage(url: string): Promise<string | null> {
  const existing = pagePromiseCache.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "RevenueScout/0.4 (+https://revenuescout-web-production.up.railway.app)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  })();

  pagePromiseCache.set(url, promise);
  return promise;
}

function candidateMatch(input: {
  candidate: DiscoveryCandidate;
  html: string;
  text: string;
}): { matched: boolean; context: string } {
  const domain = normaliseDomain(
    input.candidate.domain ?? input.candidate.website,
  );
  const lowerHtml = input.html.toLowerCase();

  if (domain && lowerHtml.includes(domain)) {
    const text = input.text;
    const index = text.toLowerCase().indexOf(domain.toLowerCase());
    const context =
      index >= 0
        ? text.slice(Math.max(0, index - 500), index + 900)
        : text.slice(0, 1200);
    return { matched: true, context };
  }

  const names = [
    input.candidate.legalName,
    input.candidate.displayName,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normaliseName)
    .filter((value) => value.length >= 5);

  const normalisedText = normaliseName(input.text);

  for (const name of [...new Set(names)]) {
    const tokens = name.split(" ").filter(Boolean);
    // Avoid matching very generic one-token names solely by text.
    if (tokens.length === 1 && name.length < 10) continue;

    const index = normalisedText.indexOf(name);
    if (index < 0) continue;

    return {
      matched: true,
      context: normalisedText.slice(
        Math.max(0, index - 450),
        Math.min(normalisedText.length, index + name.length + 900),
      ),
    };
  }

  return { matched: false, context: "" };
}

function relevantCategorySemantics(
  directory: DirectoryDefinition,
  searchSemantics: string[],
): string[] {
  const normalisedSearch = new Set(
    searchSemantics.map((item) => item.toLowerCase().trim()),
  );

  const direct = directory.categorySemantics.filter((item) =>
    normalisedSearch.has(item.toLowerCase()),
  );

  return direct.length > 0
    ? direct
    : matchedIndustrySemantics(
        directory.categorySemantics.join(" "),
        searchSemantics,
      );
}

function mergeEvidence(
  existing: DiscoveryEvidenceSource[] | undefined,
  additions: DiscoveryEvidenceSource[],
): DiscoveryEvidenceSource[] {
  const out: DiscoveryEvidenceSource[] = [];
  const seen = new Set<string>();

  for (const item of [...(existing ?? []), ...additions]) {
    const key = `${item.sourceFamily}|${item.sourceUrl}|${item.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export async function addAustralianIndustryDirectoryEvidence(
  candidate: DiscoveryCandidate,
  semantics: string[],
): Promise<DiscoveryCandidate> {
  if (candidate.country?.toUpperCase() !== "AU") return candidate;

  const pages = await Promise.all(
    LOGISTICS_DIRECTORIES.map(async (directory) => ({
      directory,
      html: await fetchDirectoryPage(directory.url),
    })),
  );

  const observedAt = new Date().toISOString();
  const additions: DiscoveryEvidenceSource[] = [];

  for (const { directory, html } of pages) {
    if (!html) continue;

    const text = htmlToText(html);
    const match = candidateMatch({ candidate, html, text });
    if (!match.matched) continue;

    const categoryMatched = relevantCategorySemantics(directory, semantics);
    const contextWithoutCompanyNames = [
      candidate.displayName,
      candidate.legalName,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normaliseName)
      .reduce(
        (text, name) => text.replaceAll(name, " "),
        normaliseName(match.context),
      );
    const contextualMatched = matchedIndustrySemantics(
      contextWithoutCompanyNames,
      semantics,
    );

    const matchedSemantics = [
      ...new Set([...categoryMatched, ...contextualMatched]),
    ];

    const supportsIndustry =
      directory.categoryIsDirectIndustryEvidence
        ? matchedSemantics.length > 0
        : contextualMatched.length > 0;

    additions.push({
      provider: directory.provider,
      providerRecordId: null,
      sourceUrl: directory.url,
      sourceLabel: directory.sourceLabel,
      excerpt:
        match.context.slice(0, 700) ||
        `${candidate.displayName} appears in ${directory.sourceLabel}.`,
      observedAt,
      confidence: directory.confidence,
      verificationStatus: "CONFIRMED",
      sourceFamily: directory.sourceFamily,
      matchedSemantics,
      supportsIndustry,
    });
  }

  if (additions.length === 0) return candidate;

  return {
    ...candidate,
    sourceEvidence: mergeEvidence(candidate.sourceEvidence, additions),
    matchedSemantics: [
      ...new Set([
        ...(candidate.matchedSemantics ?? []),
        ...additions.flatMap((item) => item.matchedSemantics),
      ]),
    ],
  };
}

export const australianLogisticsDirectorySources = LOGISTICS_DIRECTORIES.map(
  (directory) => ({
    provider: directory.provider,
    sourceFamily: directory.sourceFamily,
    sourceLabel: directory.sourceLabel,
    url: directory.url,
  }),
);
