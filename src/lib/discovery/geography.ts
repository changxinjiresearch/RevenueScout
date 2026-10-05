const COUNTRY_ALIASES: Record<string, string> = {
  au: "AU",
  aus: "AU",
  australia: "AU",
  australian: "AU",
  nz: "NZ",
  "new zealand": "NZ",
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  ca: "CA",
  canada: "CA",
  sg: "SG",
  singapore: "SG",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  in: "IN",
  india: "IN",
  jp: "JP",
  japan: "JP",
};

const AU_STATE_ALIASES: Record<string, string> = {
  nsw: "NSW",
  "au nsw": "NSW",
  "new south wales": "NSW",
  vic: "VIC",
  "au vic": "VIC",
  victoria: "VIC",
  qld: "QLD",
  "au qld": "QLD",
  queensland: "QLD",
  sa: "SA",
  "au sa": "SA",
  "south australia": "SA",
  wa: "WA",
  "au wa": "WA",
  "western australia": "WA",
  tas: "TAS",
  "au tas": "TAS",
  tasmania: "TAS",
  nt: "NT",
  "au nt": "NT",
  "northern territory": "NT",
  act: "ACT",
  "au act": "ACT",
  "australian capital territory": "ACT",
};

function clean(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

export function canonicalCountry(
  value: string | null | undefined,
): string | null {
  const key = clean(value);
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? key.toUpperCase();
}

export function canonicalRegion(
  value: string | null | undefined,
  country?: string | null,
): string | null {
  const key = clean(value);
  if (!key) return null;

  const canonicalCountryCode = canonicalCountry(country);
  if (canonicalCountryCode === "AU" || key.startsWith("au ")) {
    return AU_STATE_ALIASES[key] ?? key.replace(/^au\s+/, "").toUpperCase();
  }

  return key.toUpperCase();
}

export function geographyMatches(
  values: string[],
  value: string | null | undefined,
  kind: "country" | "region",
  country?: string | null,
): boolean {
  const target =
    kind === "country"
      ? canonicalCountry(value)
      : canonicalRegion(value, country);

  if (!target) return false;

  return values.some((item) => {
    const candidate =
      kind === "country"
        ? canonicalCountry(item)
        : canonicalRegion(item, country);
    return candidate === target;
  });
}
