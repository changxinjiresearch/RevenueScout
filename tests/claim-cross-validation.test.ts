import { describe, expect, it } from "vitest";
import { validateClaims } from "../src/lib/intelligence/cross-validation";
import type { ClaimCandidate } from "../src/lib/intelligence/claims";

function candidate(input: {
  claimType?: ClaimCandidate["claimType"];
  claimKey?: string;
  value?: unknown;
  sourceType?: string;
  url: string;
  excerpt: string;
  observedAt?: string;
  confidence?: number;
}): ClaimCandidate {
  return {
    claimType: input.claimType ?? "INDUSTRY",
    claimKey: input.claimKey ?? "logistics",
    value: input.value ?? { industry: "Logistics" },
    evidence: {
      sourceType: input.sourceType ?? "COMPANY_WEBSITE",
      sourceUrl: input.url,
      sourceTitle: input.url,
      excerpt: input.excerpt,
      observedAt: input.observedAt ?? "2026-10-01T00:00:00.000Z",
      extractionConfidence: input.confidence ?? 0.9,
      verificationStatus: "LIKELY",
    },
  };
}

describe("claim cross-validation", () => {
  it("corroborates the same claim across independent source families", () => {
    const result = validateClaims(
      [
        candidate({
          url: "https://examplelogistics.com.au/about",
          excerpt: "Example Logistics provides freight and warehousing services.",
        }),
        candidate({
          url: "https://industrydirectory.example/profile/example-logistics",
          excerpt: "Example Logistics is an Australian freight and warehousing operator.",
          sourceType: "OTHER",
        }),
      ],
      new Date("2026-10-04T00:00:00.000Z"),
    );

    const claim = result.claims[0];
    expect(claim.supportingFamilyCount).toBe(2);
    expect(["CORROBORATED", "CONFIRMED"]).toContain(claim.status);
  });

  it("does not count syndicated near-duplicate text as independent evidence", () => {
    const excerpt =
      "Example Logistics opened a new distribution centre in Melbourne to support national freight operations.";

    const result = validateClaims(
      [
        candidate({
          claimType: "EXPANSION",
          claimKey: "present",
          value: { present: true },
          url: "https://news-one.example/story",
          excerpt,
          sourceType: "NEWS",
        }),
        candidate({
          claimType: "EXPANSION",
          claimKey: "present",
          value: { present: true },
          url: "https://news-two.example/repost",
          excerpt,
          sourceType: "NEWS",
        }),
      ],
      new Date("2026-10-04T00:00:00.000Z"),
    );

    const claim = result.claims[0];
    expect(claim.supportingFamilyCount).toBe(1);
    expect(claim.status).toBe("SINGLE_SOURCE");
  });

  it("marks mutually exclusive industry claims as conflicted", () => {
    const result = validateClaims(
      [
        candidate({
          claimKey: "logistics",
          value: { industry: "Logistics" },
          url: "https://company.example/about",
          excerpt: "We provide logistics and freight services.",
        }),
        candidate({
          claimKey: "healthcare",
          value: { industry: "Healthcare" },
          url: "https://directory.example/company",
          excerpt: "The company is classified as a healthcare services provider.",
          sourceType: "OTHER",
        }),
      ],
      new Date("2026-10-04T00:00:00.000Z"),
    );

    expect(result.claims.every((claim) => claim.status === "CONFLICTED")).toBe(
      true,
    );
    expect(result.conflictedCount).toBe(2);
  });

  it("caps a non-authoritative single-source commercial fact", () => {
    const result = validateClaims(
      [
        candidate({
          url: "https://company.example/about",
          excerpt: "We provide logistics and freight services.",
        }),
      ],
      new Date("2026-10-04T00:00:00.000Z"),
    );

    const claim = result.claims[0];
    expect(claim.status).toBe("SINGLE_SOURCE");
    expect(claim.confidence).toBeLessThanOrEqual(0.68);
  });

  it("marks old dynamic signals stale", () => {
    const result = validateClaims(
      [
        candidate({
          claimType: "EXPANSION",
          claimKey: "present",
          value: { present: true },
          url: "https://company.example/news/old-expansion",
          excerpt: "We opened a new warehouse.",
          sourceType: "NEWS",
          observedAt: "2024-01-01T00:00:00.000Z",
        }),
      ],
      new Date("2026-10-04T00:00:00.000Z"),
    );

    expect(result.claims[0].status).toBe("STALE");
  });
});
