export type CompanyResearchContext = {
  company: {
    displayName: string;
    legalName: string | null;
    website: string | null;
    domain: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    address: string | null;
    legalEntityCategory: string | null;
    entityStatus: string | null;
    lei: string | null;
  };
  seller: {
    name: string;
    description: string | null;
    website: string | null;
  };
  icps: unknown[];
  offerings: unknown[];
};

export const RESEARCH_PROMPT_VERSION = "web-research-v1";

export function buildCompanyResearchPrompt(
  input: CompanyResearchContext,
  currentDate = new Date().toISOString().slice(0, 10),
): string {
  return [
    "You are the research engine inside RevenueScout, a B2B customer-acquisition decision system.",
    `Today is ${currentDate}.`,
    "",
    "Research the TARGET COMPANY on the public web and assess whether it is a credible prospective paying customer for the SELLER and its configured Offerings / ICPs.",
    "",
    "TARGET COMPANY:",
    JSON.stringify(input.company, null, 2),
    "",
    "SELLER:",
    JSON.stringify(input.seller, null, 2),
    "",
    "ICPS:",
    JSON.stringify(input.icps, null, 2),
    "",
    "OFFERINGS:",
    JSON.stringify(input.offerings, null, 2),
    "",
    "Research requirements:",
    "1. Verify company identity first using legal name, location, LEI and known website. Do not mix similarly named entities.",
    "2. Find the official website when possible.",
    "3. Determine what the company actually does and its industry/subindustry.",
    "4. Estimate employee range only when credible public evidence supports it. Use -1 when unknown.",
    "5. Look for recent public buying signals: hiring, expansion, funding, leadership changes, technology changes, procurement/tenders, growth, or potential operational pain.",
    "6. Prefer company websites, official job pages, government/registry sources, reputable news, and primary announcements.",
    "7. Do not treat a search snippet or the company name alone as proof of industry or a business problem.",
    "8. Operational pain must remain a hypothesis unless a source explicitly states the problem.",
    "9. Every observation must include the exact public source URL that supports it.",
    "10. Score commercial fit, buying intent, budget fit, timing, need and evidence confidence from 0 to 100. Be conservative when evidence is thin.",
    "11. assessmentSummary, whyFit, whyNow, risks and nextAction must be concise enough for a salesperson to review in seconds.",
    "12. Never invent a missing fact. Empty string or -1 is better than fabrication.",
  ].join("\n");
}
