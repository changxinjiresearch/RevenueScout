import { db } from "@/lib/db";

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
]);

export function normaliseCompanyName(value: string): string {
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

export function normaliseDomain(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim() || null;
  }
}

export type DuplicateCandidate = {
  id: string;
  displayName: string;
  reason: "IDENTIFIER" | "DOMAIN" | "NAME_COUNTRY";
};

export async function findCompanyDuplicate(input: {
  organizationId: string;
  displayName: string;
  country?: string | null;
  domain?: string | null;
  identifierType?: string | null;
  identifierValue?: string | null;
}): Promise<DuplicateCandidate | null> {
  const sql = db();

  if (input.identifierType && input.identifierValue) {
    const [match] = await sql<{ id: string; displayName: string }[]>`
      SELECT c.id, c.display_name AS "displayName"
      FROM company_identifiers ci
      JOIN companies c ON c.id = ci.company_id
      WHERE ci.organization_id = ${input.organizationId}
        AND ci.identifier_type = ${input.identifierType}
        AND ci.identifier_value = ${input.identifierValue}
      LIMIT 1
    `;

    if (match) return { ...match, reason: "IDENTIFIER" };
  }

  const domain = normaliseDomain(input.domain);
  if (domain) {
    const [match] = await sql<{ id: string; displayName: string }[]>`
      SELECT id, display_name AS "displayName"
      FROM companies
      WHERE organization_id = ${input.organizationId}
        AND LOWER(domain) = ${domain}
      LIMIT 1
    `;

    if (match) return { ...match, reason: "DOMAIN" };
  }

  const nameKey = normaliseCompanyName(input.displayName);
  if (nameKey) {
    const country = input.country?.trim() || null;
    const [match] = await sql<{ id: string; displayName: string }[]>`
      SELECT id, display_name AS "displayName"
      FROM companies
      WHERE organization_id = ${input.organizationId}
        AND name_key = ${nameKey}
        AND (
          ${country}::text IS NULL
          OR country IS NULL
          OR LOWER(country) = LOWER(${country}::text)
        )
      LIMIT 1
    `;

    if (match) return { ...match, reason: "NAME_COUNTRY" };
  }

  return null;
}
