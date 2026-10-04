export const WEB_RESEARCH_PROMPT_VERSION = "web-enrichment-v1";

export function buildWebResearchPrompt(context: unknown): string {
  return [
    "Research this company using public web sources.",
    "Verify the company identity before drawing conclusions.",
    "Return only facts supported by sources and clearly label uncertainty.",
    JSON.stringify(context),
  ].join("\n");
}
