import { RESPONSES_ENDPOINT } from "./openai-endpoint";
import { COMPANY_RESEARCH_SCHEMA } from "./research-schema";
import { buildWebResearchPrompt } from "./prompt";
import type { WebResearchResult } from "./result-types";

type ResponsePart = {
  type?: string;
  text?: string;
  annotations?: Array<{ type?: string; url?: string }>;
};

type ResponseItem = {
  type?: string;
  action?: { sources?: Array<{ url?: string }> };
  content?: ResponsePart[];
};

export type ResearchResponsePayload = {
  output_text?: string;
  output?: ResponseItem[];
};

function outputText(payload: ResearchResponsePayload): string {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }

  return "";
}

export function extractResearchSourceUrls(
  payload: ResearchResponsePayload,
): string[] {
  const urls = new Set<string>();

  for (const item of payload.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      if (source.url) urls.add(source.url);
    }

    for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          urls.add(annotation.url);
        }
      }
    }
  }

  return [...urls];
}

export async function runCompanyEnrichment(
  apiKey: string,
  context: unknown,
): Promise<{
  result: WebResearchResult;
  sourceUrls: string[];
  rawResponse: ResearchResponsePayload;
  model: string;
}> {
  const model =
    process.env.OPENAI_ENRICHMENT_MODEL?.trim() || "gpt-6-luna";

  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: buildWebResearchPrompt(context),
      text: {
        format: {
          type: "json_schema",
          name: "revenuescout_company_enrichment",
          strict: true,
          schema: COMPANY_RESEARCH_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(75_000),
  });

  const payload = (await response.json()) as ResearchResponsePayload;

  if (!response.ok) {
    throw new Error(
      `Research request failed with HTTP ${response.status}.`,
    );
  }

  const text = outputText(payload);
  if (!text) throw new Error("Research returned no structured output.");

  return {
    result: JSON.parse(text) as WebResearchResult,
    sourceUrls: extractResearchSourceUrls(payload),
    rawResponse: payload,
    model,
  };
}
