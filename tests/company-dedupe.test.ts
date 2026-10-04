import { describe, expect, it } from "vitest";
import {
  normaliseCompanyName,
  normaliseDomain,
} from "../src/lib/companies/dedupe";

describe("company dedupe normalisation", () => {
  it("normalises common company suffixes", () => {
    expect(normaliseCompanyName("ABC Logistics Pty Ltd")).toBe("abc logistics");
    expect(normaliseCompanyName("ABC Logistics Limited")).toBe("abc logistics");
    expect(normaliseCompanyName("ABC LOGISTICS")).toBe("abc logistics");
  });

  it("normalises website variants to the same domain", () => {
    expect(normaliseDomain("https://www.example.com/path")).toBe("example.com");
    expect(normaliseDomain("example.com")).toBe("example.com");
    expect(normaliseDomain("http://EXAMPLE.com")).toBe("example.com");
  });
});
