import { RESPONSES_ENDPOINT } from "./openai-endpoint";

export async function createResearchResponse(
  apiKey: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(75_000),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Responses API request failed with HTTP ${response.status}`);
  }

  return payload;
}
