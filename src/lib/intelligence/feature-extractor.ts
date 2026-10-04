import type { IcpRule } from "../domain/configured-opportunity";
import type {
  CollectedPage,
  CollectorResult,
  ExtractedCompanyFeatures,
} from "./types";

const AU_REGIONS: Record<string, string[]> = {
  NSW: ["new south wales", "sydney", "newcastle", "wollongong"],
  VIC: ["victoria", "melbourne", "geelong", "ballarat"],
  QLD: ["queensland", "brisbane", "gold coast", "townsville", "cairns"],
  SA: ["south australia", "adelaide", "mount gambier"],
  WA: ["western australia", "perth", "fremantle"],
  TAS: ["tasmania", "hobart", "launceston"],
  ACT: ["australian capital territory", "canberra"],
  NT: ["northern territory", "darwin"],
};

const INDUSTRY_DICTIONARY: Record<string, string[]> = {
  Logistics: [
    "logistics",
    "freight",
    "warehousing",
    "warehouse",
    "distribution",
    "transport",
    "supply chain",
    "3pl",
    "third party logistics",
  ],
  Construction: [
    "construction",
    "civil works",
    "building contractor",
    "infrastructure construction",
  ],
  Healthcare: [
    "healthcare",
    "health care",
    "clinic",
    "hospital",
    "medical services",
  ],
  Manufacturing: [
    "manufacturing",
    "manufacturer",
    "factory",
    "production facility",
  ],
  Technology: [
    "software",
    "technology",
    "saas",
    "cloud platform",
    "digital platform",
  ],
  "Professional Services": [
    "consulting",
    "professional services",
    "advisory",
  ],
};

const TECHNOLOGY_TERMS = [
  "SAP",
  "Salesforce",
  "Microsoft Dynamics",
  "Dynamics 365",
  "Oracle",
  "NetSuite",
  "AWS",
  "Azure",
  "Power BI",
  "Tableau",
  "ServiceNow",
  "HubSpot",
  "Xero",
  "MYOB",
  "SharePoint",
];

const ROLE_TERMS = [
  "Chief Operating Officer",
  "COO",
  "Head of Operations",
  "Operations Manager",
  "Chief Information Officer",
  "CIO",
  "Chief Technology Officer",
  "CTO",
  "Procurement Manager",
  "General Manager",
  "Managing Director",
  "CEO",
];

function corpus(pages: CollectedPage[]): string {
  return pages
    .map((page) => `${page.title} ${page.description} ${page.text}`)
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function firstUsefulDescription(pages: CollectedPage[]): string {
  const preferred =
    pages.find((page) => page.pageKind === "HOME" && page.description) ??
    pages.find((page) => page.pageKind === "ABOUT" && page.description) ??
    pages.find((page) => page.description);

  if (preferred?.description) return preferred.description.slice(0, 500);

  const about =
    pages.find((page) => page.pageKind === "ABOUT") ??
    pages.find((page) => page.pageKind === "HOME") ??
    pages[0];

  if (!about) return "";

  const sentences = about.text
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 40 && value.length <= 320);

  return (sentences[0] ?? about.text.slice(0, 320)).trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function configuredIndustryTerms(icps: IcpRule[]): Array<{
  label: string;
  terms: string[];
}> {
  const configured = new Map<string, Set<string>>();

  for (const icp of icps) {
    for (const industry of icp.industries) {
      const set = configured.get(industry) ?? new Set<string>();
      set.add(industry.toLowerCase());
      for (const term of INDUSTRY_DICTIONARY[industry] ?? []) {
        set.add(term.toLowerCase());
      }
      configured.set(industry, set);
    }
  }

  const configuredRows = [...configured.entries()].map(([label, terms]) => ({
    label,
    terms: [...terms],
  }));

  const defaults = Object.entries(INDUSTRY_DICTIONARY)
    .filter(([label]) => !configured.has(label))
    .map(([label, terms]) => ({ label, terms }));

  return [...configuredRows, ...defaults];
}

function industryFromText(
  text: string,
  icps: IcpRule[],
): { industry: string; confidence: number } {
  const candidates = configuredIndustryTerms(icps)
    .map(({ label, terms }) => {
      const matches = terms.reduce((count, term) => {
        const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
        return count + (text.match(pattern)?.length ?? 0);
      }, 0);

      return { label, matches };
    })
    .filter((candidate) => candidate.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  const best = candidates[0];
  if (!best) return { industry: "", confidence: 0 };

  return {
    industry: best.label,
    confidence: Math.min(0.95, 0.55 + best.matches * 0.08),
  };
}

export function extractEmployeeEstimate(text: string): {
  low: number;
  high: number;
  confidence: number;
} {
  const normalized = text.replace(/,/g, "");

  const patterns: Array<{
    regex: RegExp;
    confidence: number;
    range: (value: number, match: string) => [number, number];
  }> = [
    {
      regex: /\bemploys?\s+(?:approximately\s+|about\s+|over\s+|more than\s+)?(\d{1,6})\b/i,
      confidence: 0.85,
      range: (value, match) =>
        /over|more than/i.test(match)
          ? [value, Math.round(value * 1.35)]
          : [Math.round(value * 0.9), Math.round(value * 1.1)],
    },
    {
      regex:
        /\b(?:team|workforce|staff)\s+of\s+(?:approximately\s+|about\s+|over\s+|more than\s+)?(\d{1,6})\b/i,
      confidence: 0.82,
      range: (value, match) =>
        /over|more than/i.test(match)
          ? [value, Math.round(value * 1.35)]
          : [Math.round(value * 0.9), Math.round(value * 1.1)],
    },
    {
      regex:
        /\b(?:approximately\s+|about\s+|over\s+|more than\s+)?(\d{1,6})\+?\s+(?:employees|staff|people|team members)\b/i,
      confidence: 0.8,
      range: (value, match) =>
        /\+|over|more than/i.test(match)
          ? [value, Math.round(value * 1.35)]
          : [Math.round(value * 0.9), Math.round(value * 1.1)],
    },
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(normalized);
    if (!match) continue;

    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 2 || value > 1_000_000) continue;

    const [low, high] = pattern.range(value, match[0]);
    return { low, high, confidence: pattern.confidence };
  }

  return { low: -1, high: -1, confidence: 0 };
}

function serviceRegionsFromText(text: string): string[] {
  const regions: string[] = [];

  for (const [code, terms] of Object.entries(AU_REGIONS)) {
    if (terms.some((term) => text.includes(term))) regions.push(code);
  }

  return regions;
}

function technologiesFromText(text: string): string[] {
  return TECHNOLOGY_TERMS.filter((term) =>
    text.includes(term.toLowerCase()),
  );
}

function rolesFromText(text: string): string[] {
  return ROLE_TERMS.filter((term) =>
    text.includes(term.toLowerCase()),
  );
}

function businessModelsFromText(text: string): string[] {
  const models: Array<[string, string[]]> = [
    ["B2B", ["business-to-business", "b2b", "commercial customers", "enterprise clients"]],
    ["B2C", ["business-to-consumer", "b2c", "consumer customers", "retail customers"]],
    ["Services", ["managed services", "professional services", "service provider"]],
    ["Contracting", ["contractor", "contract services", "project delivery"]],
    ["Marketplace", ["marketplace", "platform connecting"]],
  ];

  return models
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([label]) => label);
}

function configuredSubindustry(text: string, icps: IcpRule[]): string {
  const values = [...new Set(icps.flatMap((icp) => icp.subindustries))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return values.find((value) => text.includes(value.toLowerCase())) ?? "";
}

export function extractCompanyFeatures(input: {
  collector: CollectorResult;
  icps: IcpRule[];
}): ExtractedCompanyFeatures {
  const text = corpus(input.collector.pages);
  const employee = extractEmployeeEstimate(text);
  const industry = industryFromText(text, input.icps);

  return {
    businessSummary: firstUsefulDescription(input.collector.pages),
    industry: industry.industry,
    subindustry: configuredSubindustry(text, input.icps),
    industryConfidence: industry.confidence,
    employeeLow: employee.low,
    employeeHigh: employee.high,
    employeeConfidence: employee.confidence,
    serviceRegions: serviceRegionsFromText(text),
    businessModels: businessModelsFromText(text),
    technologies: technologiesFromText(text),
    decisionRoles: rolesFromText(text),
  };
}
