const INDUSTRY_SEMANTIC_GROUPS: Record<string, string[]> = {
  logistics: [
    "logistics",
    "freight",
    "freight forwarding",
    "transport",
    "transportation",
    "warehousing",
    "warehouse",
    "distribution",
    "supply chain",
    "3pl",
    "third party logistics",
    "third-party logistics",
    "fulfilment",
    "fulfillment",
    "shipping",
    "courier",
    "haulage",
    "forwarding",
    "last mile",
    "last-mile",
    "delivery",
    "trucking",
  ],
  software: [
    "software",
    "saas",
    "software as a service",
    "cloud software",
    "enterprise software",
    "application development",
    "digital platform",
  ],
  healthcare: [
    "healthcare",
    "health care",
    "medical",
    "clinical",
    "hospital",
    "health services",
    "allied health",
  ],
  construction: [
    "construction",
    "builder",
    "building contractor",
    "civil engineering",
    "infrastructure construction",
    "commercial construction",
  ],
  manufacturing: [
    "manufacturing",
    "manufacturer",
    "factory",
    "industrial production",
    "fabrication",
    "production facility",
  ],
  retail: [
    "retail",
    "retailer",
    "ecommerce",
    "e-commerce",
    "online store",
    "consumer retail",
  ],
};

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandIndustrySemantics(query: string): string[] {
  const cleaned = normalise(query);
  if (!cleaned) return [];

  const matchedGroups = Object.entries(INDUSTRY_SEMANTIC_GROUPS)
    .filter(([key, values]) => {
      const normalisedValues = values.map(normalise);
      return (
        cleaned === normalise(key) ||
        normalisedValues.includes(cleaned) ||
        normalisedValues.some(
          (value) => cleaned.includes(value) || value.includes(cleaned),
        )
      );
    })
    .flatMap(([, values]) => values);

  return [
    ...new Set(
      [query.trim(), ...matchedGroups]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function matchedIndustrySemantics(
  text: string | null | undefined,
  semantics: string[],
): string[] {
  const haystack = ` ${normalise(text ?? "")} `;
  if (!haystack.trim()) return [];

  return semantics.filter((term) => {
    const needle = normalise(term);
    if (!needle) return false;
    return haystack.includes(` ${needle} `) || haystack.includes(needle);
  });
}

export function canonicalIndustryLabel(query: string): string {
  const cleaned = normalise(query);
  const group = Object.entries(INDUSTRY_SEMANTIC_GROUPS).find(
    ([key, values]) =>
      cleaned === normalise(key) ||
      values.map(normalise).includes(cleaned),
  );
  if (group) {
    return group[0]
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return query
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
