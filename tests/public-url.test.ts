import { afterEach, describe, expect, it } from "vitest";
import { publicUrl } from "../src/lib/http/public-url";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
});

function requestWith(headers: Record<string, string>) {
  return {
    url: "http://localhost:8080/onboarding",
    headers: new Headers(headers),
  } as never;
}

describe("publicUrl", () => {
  it("prefers configured public APP_URL over container localhost", () => {
    process.env.APP_URL =
      "https://revenuescout-web-production.up.railway.app";

    expect(publicUrl(requestWith({}), "/onboarding").toString()).toBe(
      "https://revenuescout-web-production.up.railway.app/onboarding",
    );
  });

  it("uses forwarded proxy host when APP_URL is unavailable", () => {
    delete process.env.APP_URL;

    const request = requestWith({
      "x-forwarded-host": "example.com",
      "x-forwarded-proto": "https",
    });

    expect(publicUrl(request, "/workspace").toString()).toBe(
      "https://example.com/workspace",
    );
  });
});
