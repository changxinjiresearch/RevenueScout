export const WEB_RESEARCH_PROMPT_VERSION = "web-enrichment-v1";

export type WebResearchContext = {
  company: Record<string, unknown>;
  seller: Record<string, unknown>;
  icps: unknown[];
  offerings: unknown[];
};

export function buildWebResearchPrompt(
  context: WebResearchContext,
  today = new Date().toISOString().slice(0, 10),
): string {
  return [
    "You are the evidence-grounded research engine inside RevenueScout.",
    `Current date: ${today}.`,
    "Verify the target company identity before evaluating it.",
    "Use public web sources to determine its real business activity, scale, website and recent commercial signals.",
    "Compare the evidence with the seller ICPs and Offerings.",
    "Every observation must include a supporting public URL.",
    "Do not infer a fact from the company name alone.",
    "Do not invent missing facts. Use empty values or -1 when unknown.",
    "Treat business pain as a hypothesis unless a source explicitly confirms it.",
    "Keep the final assessment concise and conservative.",
    "The conversion estimate is pre-contact and is not historically calibrated.",
    "",
    "CONTEXT:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}
