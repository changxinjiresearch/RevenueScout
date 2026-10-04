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

type OpenAIErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
    param?: string | null;
  };
};

export type OpenAIResearchError = {
  status: number;
  code: string;
  type: string;
  message: string;
  retryable: boolean;
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

const NON_RETRYABLE_429_CODES = new Set([
  "credit_balance_exhausted",
  "organization_usage_limit_exceeded",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
]);

export function classifyOpenAIResearchError(
  status: number,
  payload: OpenAIErrorPayload,
): OpenAIResearchError {
  const code = String(payload.error?.code ?? "unknown");
  const type = String(payload.error?.type ?? "unknown");
  const providerMessage = String(payload.error?.message ?? "").trim();

  if (status === 429 && code === "credit_balance_exhausted") {
    return {
      status,
      code,
      type,
      retryable: false,
      message:
        "OpenAI API credit balance is exhausted. Add API credits in Platform billing, then try again.",
    };
  }

  if (status === 429 && code === "project_spend_limit_exceeded") {
    return {
      status,
      code,
      type,
      retryable: false,
      message:
        "OpenAI project spend limit has been reached. Raise the project spend limit, then try again.",
    };
  }

  if (status === 429 && code === "organization_spend_limit_exceeded") {
    return {
      status,
      code,
      type,
      retryable: false,
      message:
        "OpenAI organization spend limit has been reached. Raise the organization spend limit, then try again.",
    };
  }

  if (status === 429 && code === "organization_usage_limit_exceeded") {
    return {
      status,
      code,
      type,
      retryable: false,
      message:
        "OpenAI organization usage limit has been reached. Review the organization usage limit, then try again.",
    };
  }

  const retryable =
    status === 429 &&
    !NON_RETRYABLE_429_CODES.has(code) &&
    (code.includes("rate_limit") ||
      type.includes("rate_limit") ||
      code === "unknown");

  const detail = providerMessage
    ? providerMessage.slice(0, 280)
    : `HTTP ${status}`;

  return {
    status,
    code,
    type,
    retryable,
    message: `OpenAI API error [${code}]: ${detail}`,
  };
}

function retryDelayMs(response: Response): number {
  const raw = response.headers.get("retry-after");
  if (!raw) return 1200;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(5000, Math.max(500, seconds * 1000));
  }
  return 1200;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCompanyEnrichment(
  context: unknown,
): Promise<{
  result: WebResearchResult;
  sourceUrls: string[];
  rawResponse: ResearchResponsePayload;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Company enrichment is not configured.");
  }

  const model =
    process.env.OPENAI_ENRICHMENT_MODEL?.trim() || "gpt-6-luna";

  const requestBody = JSON.stringify({
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
  });

  let lastError: OpenAIResearchError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
      signal: AbortSignal.timeout(75_000),
    });

    const payload = (await response.json()) as
      | ResearchResponsePayload
      | OpenAIErrorPayload;

    if (!response.ok) {
      lastError = classifyOpenAIResearchError(
        response.status,
        payload as OpenAIErrorPayload,
      );

      if (lastError.retryable && attempt === 0) {
        await sleep(retryDelayMs(response));
        continue;
      }

      throw new Error(lastError.message);
    }

    const researchPayload = payload as ResearchResponsePayload;
    const text = outputText(researchPayload);
    if (!text) throw new Error("Research returned no structured output.");

    return {
      result: JSON.parse(text) as WebResearchResult,
      sourceUrls: extractResearchSourceUrls(researchPayload),
      rawResponse: researchPayload,
      model,
    };
  }

  throw new Error(
    lastError?.message ?? "OpenAI API request failed after retry.",
  );
}
