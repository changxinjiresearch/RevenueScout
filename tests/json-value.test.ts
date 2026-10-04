import { describe, expect, it } from "vitest";
import { jsonArrayValue } from "../src/lib/db/json-value";

describe("jsonArrayValue", () => {
  it("returns arrays unchanged", () => {
    expect(jsonArrayValue([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it("parses a JSON array stored as a string", () => {
    expect(jsonArrayValue('[{"id":1}]')).toEqual([{ id: 1 }]);
  });

  it("parses a double-encoded JSON array defensively", () => {
    const encoded = JSON.stringify(JSON.stringify([{ id: 1 }]));
    expect(jsonArrayValue(encoded)).toEqual([{ id: 1 }]);
  });

  it("returns an empty array for invalid values", () => {
    expect(jsonArrayValue("not-json")).toEqual([]);
    expect(jsonArrayValue({ id: 1 })).toEqual([]);
  });
});
