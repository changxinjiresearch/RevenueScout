import { describe, expect, it } from "vitest";
import {
  candidateDomainsFromName,
  companyNameTokens,
  htmlToText,
} from "../src/lib/intelligence/collector";

describe("RevenueScout public-web collector helpers", () => {
  it("normalises legal company suffixes before generating domain candidates", () => {
    expect(companyNameTokens("Northstar Logistics Pty Ltd")).toEqual([
      "northstar",
      "logistics",
    ]);

    expect(candidateDomainsFromName("Northstar Logistics Pty Ltd")).toContain(
      "northstarlogistics.com.au",
    );
  });

  it("removes scripts and markup before analysis", () => {
    const text = htmlToText(
      "<html><style>.x{}</style><script>ignore()</script><body>We are hiring warehouse operators.</body></html>",
    );

    expect(text).toBe("We are hiring warehouse operators.");
  });
});
