import { describe, expect, it } from "vitest";
import {
  canonicalCountry,
  canonicalRegion,
  geographyMatches,
} from "../src/lib/discovery/geography";

describe("discovery geography normalization", () => {
  it("matches Australia names to AU codes", () => {
    expect(canonicalCountry("Australia")).toBe("AU");
    expect(canonicalCountry("AU")).toBe("AU");
    expect(geographyMatches(["Australia"], "AU", "country")).toBe(true);
  });

  it("matches Australian state names and AU-prefixed provider regions", () => {
    expect(canonicalRegion("AU-VIC", "AU")).toBe("VIC");
    expect(canonicalRegion("Victoria", "Australia")).toBe("VIC");
    expect(
      geographyMatches(["VIC"], "AU-VIC", "region", "AU"),
    ).toBe(true);
    expect(
      geographyMatches(["New South Wales"], "NSW", "region", "Australia"),
    ).toBe(true);
  });

  it("does not match a genuinely different country", () => {
    expect(geographyMatches(["Australia"], "US", "country")).toBe(false);
  });
});
