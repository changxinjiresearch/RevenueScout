import OpenAI from "openai";
import { COMPANY_RESEARCH_SCHEMA } from "./research-schema";
import {
  buildCompanyResearchPrompt,
  type CompanyResearchContext,
} from "./prompt";
import type { WebResearchResult } from "./result-types";

type SourceCarrier = {
  type?: string;
  action?: {
    sources?: Array<{ url?: string }>;
  };
  content?: Array<{
    type?: string;
    text?: string;
    annotations?: Array<{
      type?: string;
      url?: string;
    }>;
  }>;
};

function extractSourceUrls(output: unknown[]): string[] {
  const urls = new Set<string>();

  for (const item of output as SourceCarrier[]) {
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

function host(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function sourceWasRetrieved(
  sourceUrl: string,
  retrievedUrls: string[],
): boolean {
  if (retrievedUrls.includes(sourceUrl)) return true;

  const sourceHost = host(sourceUrl);
  if (!sourceHost) return false;

  return retrievedUrls.some((url) => host(url) === sourceHost);
}

export async function runCompanyWebResearch(
  context: CompanyResearchContext,
): Promise<{
  result: WebResearchResult;
  sourceUrls: string[];
  model: string;
  rawResponse: unknown;
}> {
  const client = new OpenAI();
  const model =
    process.env.OPENAI_ENRICHMENT_MODEL?.trim() || "gpt-6-luna";

  const response = await client.responses.create({
    model,
    store: false,
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    input: buildCompanyResearchPrompt(context),
    text: {
      format: {
        type: "json_schema",
        name: "revenuescout_company_research",
        strict: true,
        schema: COMPANY_RESEARCH_SCHEMA,
      },
    },
  } as never);

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error("AI research returned no structured output.");
  }

  const result = JSON.parse(outputText) as WebResearchResult;
  const sourceUrls = extractSourceUrls(response.output as unknown[]);

  return {
    result,
    sourceUrls,
    model,
    rawResponse: response,
  };
}
