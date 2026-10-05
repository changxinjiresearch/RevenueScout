import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGleif } from "../src/lib/discovery/gleif";

function record(lei: string, name: string) {
  return {
    id: lei,
    attributes: {
      lei,
      entity: {
        legalName: { name },
        legalAddress: {
          city: "Sydney",
          region: "NSW",
          country: "AU",
        },
        jurisdiction: "AU",
        category: "GENERAL",
        status: "ACTIVE",
      },
      registration: {
        status: "ISSUED",
        lastUpdateDate: "2026-10-01T00:00:00.000Z",
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GLEIF exhaustive pagination", () => {
  it("follows provider pagination instead of applying a product result cap", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [record("11111111111111111111", "One Logistics Ltd")],
            links: { next: "https://api.gleif.org/api/v1/lei-records?page[number]=2" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [record("22222222222222222222", "Two Logistics Ltd")],
            links: { next: null },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGleif({
      query: "logistics",
      country: "AU",
      limit: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results.map((item) => item.displayName)).toEqual([
      "One Logistics Ltd",
      "Two Logistics Ltd",
    ]);
  });
});
