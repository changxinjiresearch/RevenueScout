import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CollectedPage, CollectorResult } from "./types";

const MAX_PAGE_BYTES = 1_250_000;
const USER_AGENT =
  "RevenueScout/1.0 (+https://revenuescout-web-production.up.railway.app)";

const COMPANY_SUFFIXES = new Set([
  "pty",
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "plc",
  "trust",
  "fund",
  "company",
  "co",
  "corporation",
  "corp",
]);

const PRIORITY_TERMS = [
  "careers",
  "career",
  "jobs",
  "join",
  "news",
  "media",
  "press",
  "about",
  "services",
  "solutions",
  "locations",
  "contact",
];

function cleanText(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIXES.has(token));
}

export function candidateDomainsFromName(name: string): string[] {
  const tokens = companyNameTokens(name);
  if (tokens.length === 0) return [];

  const compact = tokens.join("");
  const dashed = tokens.join("-");

  return [...new Set([
    `${compact}.com.au`,
    `${compact}.com`,
    `${dashed}.com.au`,
    `${dashed}.com`,
  ])];
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

async function assertPublicHost(hostname: string) {
  const lower = hostname.toLowerCase();

  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    throw new Error("Refusing non-public host.");
  }

  if (isIP(lower)) {
    if (isPrivateIpv4(lower) || isPrivateIpv6(lower)) {
      throw new Error("Refusing private network address.");
    }
    return;
  }

  const records = await lookup(lower, { all: true });
  if (records.length === 0) throw new Error("Host did not resolve.");

  for (const record of records) {
    if (
      isPrivateIpv4(record.address) ||
      isPrivateIpv6(record.address)
    ) {
      throw new Error("Host resolves to a private network address.");
    }
  }
}

function validPublicUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function extractAttribute(html: string, pattern: RegExp): string {
  return cleanText(pattern.exec(html)?.[1] ?? "");
}

export function htmlToText(html: string): string {
  return cleanText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function pageKind(url: URL): CollectedPage["pageKind"] {
  const path = url.pathname.toLowerCase();
  if (path === "/" || path === "") return "HOME";
  if (/career|jobs|join-us|work-with/.test(path)) return "CAREERS";
  if (/news|media|press|insight|blog/.test(path)) return "NEWS";
  if (/about|company|who-we-are/.test(path)) return "ABOUT";
  if (/service|solution|capabilit/.test(path)) return "SERVICES";
  if (/location|office|branch|depot/.test(path)) return "LOCATIONS";
  if (/contact/.test(path)) return "CONTACT";
  return "OTHER";
}

function extractLinks(html: string, base: URL): string[] {
  const links: string[] = [];
  const regex = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    try {
      const url = new URL(match[1], base);
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.hostname === base.hostname
      ) {
        url.hash = "";
        links.push(url.toString());
      }
    } catch {
      // Ignore malformed links.
    }
  }

  return [...new Set(links)];
}

function prioritizeLinks(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const aScore = PRIORITY_TERMS.some((term) => a.toLowerCase().includes(term))
      ? 1
      : 0;
    const bScore = PRIORITY_TERMS.some((term) => b.toLowerCase().includes(term))
      ? 1
      : 0;
    return bScore - aScore;
  });
}

async function fetchWithSafeRedirects(initial: URL): Promise<Response> {
  let current = new URL(initial.toString());

  for (let hop = 0; hop < 5; hop += 1) {
    await assertPublicHost(current.hostname);

    const response = await fetch(current, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(7_000),
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Redirect response did not include a location.");
    }

    const next = validPublicUrl(new URL(location, current).toString());
    if (!next) {
      throw new Error("Redirect target is not a valid public URL.");
    }

    current = next;
  }

  throw new Error("Too many redirects.");
}

async function fetchHtml(urlValue: string): Promise<{
  finalUrl: URL;
  html: string;
  title: string;
  description: string;
  links: string[];
} | null> {
  const requested = validPublicUrl(urlValue);
  if (!requested) return null;

  const response = await fetchWithSafeRedirects(requested);

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return null;

  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_PAGE_BYTES) return null;

  const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
  const finalUrl = validPublicUrl(response.url);
  if (!finalUrl) return null;

  await assertPublicHost(finalUrl.hostname);

  const title = extractAttribute(
    html,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  );
  const description =
    extractAttribute(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    ) ||
    extractAttribute(
      html,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    );

  return {
    finalUrl,
    html,
    title,
    description,
    links: extractLinks(html, finalUrl),
  };
}

function websiteLooksLikeCompany(
  page: { title: string; html: string },
  companyName: string,
  hostname: string,
): boolean {
  const tokens = companyNameTokens(companyName).filter((token) => token.length >= 3);
  if (tokens.length === 0) return false;

  const haystack = `${page.title} ${htmlToText(page.html.slice(0, 40_000))}`
    .toLowerCase();
  const domain = hostname.toLowerCase().replace(/^www\./, "");
  const matched = tokens.filter(
    (token) => haystack.includes(token) || domain.includes(token),
  ).length;

  const required = tokens.length === 1 ? 1 : Math.ceil(tokens.length * 0.6);
  return matched >= required;
}

async function resolveWebsite(input: {
  displayName: string;
  legalName?: string | null;
  website?: string | null;
  domain?: string | null;
  allowDomainGuess?: boolean;
}): Promise<{
  url: string;
  confidence: number;
  attempted: string[];
} | null> {
  const attempted: string[] = [];
  const directCandidates: string[] = [];

  if (input.website) directCandidates.push(input.website);
  if (input.domain) {
    directCandidates.push(
      input.domain.startsWith("http")
        ? input.domain
        : `https://${input.domain}`,
    );
  }

  for (const candidate of directCandidates) {
    attempted.push(candidate);
    try {
      const page = await fetchHtml(candidate);
      if (page) {
        return {
          url: page.finalUrl.origin,
          confidence: 0.98,
          attempted,
        };
      }
    } catch {
      // Continue to zero-cost resolution candidates.
    }
  }

  if (input.allowDomainGuess === false) return null;

  const names = [...new Set(
    [input.legalName, input.displayName].filter(Boolean) as string[],
  )];

  const domainCandidates = [
    ...new Set(names.flatMap(candidateDomainsFromName)),
  ].slice(0, 6);

  for (const domain of domainCandidates) {
    const candidate = `https://${domain}`;
    attempted.push(candidate);

    try {
      const page = await fetchHtml(candidate);
      if (
        page &&
        names.some((name) =>
          websiteLooksLikeCompany(page, name, page.finalUrl.hostname),
        )
      ) {
        return {
          url: page.finalUrl.origin,
          confidence: 0.82,
          attempted,
        };
      }
    } catch {
      // Candidate failed DNS, TLS, SSRF validation or timeout.
    }
  }

  return null;
}

export async function collectPublicPages(input: {
  displayName: string;
  legalName?: string | null;
  website?: string | null;
  domain?: string | null;
  evidenceUrls?: string[];
  maxPages?: number;
  allowDomainGuess?: boolean;
}): Promise<CollectorResult> {
  const maxPages = Math.max(1, Math.min(input.maxPages ?? 7, 10));
  const warnings: string[] = [];
  const resolved = await resolveWebsite(input);
  const attemptedUrls = resolved?.attempted ?? [];

  const seeds: string[] = [];
  if (resolved?.url) seeds.push(resolved.url);

  for (const value of input.evidenceUrls ?? []) {
    const url = validPublicUrl(value);
    if (!url) continue;
    seeds.push(url.toString());
  }

  const officialHostname = resolved?.url
    ? new URL(resolved.url).hostname
    : null;

  if (!resolved?.url) {
    warnings.push(
      input.allowDomainGuess === false
        ? "Official website was not available from a trusted source; speculative domain guessing was skipped in fast discovery."
        : "Official website could not be verified from stored data or zero-cost domain candidates.",
    );
  }

  const pages: CollectedPage[] = [];
  const queue = [...new Set(seeds)];
  const seen = new Set<string>();

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    try {
      const page = await fetchHtml(current);
      if (!page) continue;

      const text = htmlToText(page.html);
      if (text.length < 80) continue;

      pages.push({
        url: page.finalUrl.toString(),
        title: page.title,
        description: page.description,
        text: text.slice(0, 80_000),
        fetchedAt: new Date().toISOString(),
        pageKind: pageKind(page.finalUrl),
      });

      if (
        officialHostname &&
        page.finalUrl.hostname === officialHostname
      ) {
        for (const link of prioritizeLinks(page.links).slice(0, 16)) {
          if (!seen.has(link) && queue.length < 30) queue.push(link);
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Could not collect ${current}: ${error.message}`
          : `Could not collect ${current}`,
      );
    }
  }

  return {
    officialWebsite: resolved?.url ?? "",
    websiteConfidence: resolved?.confidence ?? 0,
    pages,
    attemptedUrls,
    warnings,
  };
}
