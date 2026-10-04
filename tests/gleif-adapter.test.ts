import { describe, expect, it } from "vitest";
import { mapGleifRecord } from "../src/lib/discovery/gleif";

describe("GLEIF discovery adapter", () => {
  it("maps provider data without inventing industry or employee count", () => {
    const result = mapGleifRecord({
      id: "12345678901234567890",
      attributes: {
        lei: "12345678901234567890",
        entity: {
          legalName: { name: "Example Logistics Pty Ltd" },
          legalAddress: {
            addressLines: ["1 Example Road"],
            city: "Sydney",
            region: "NSW",
            country: "AU",
            postalCode: "2000",
          },
          jurisdiction: "AU",
          status: "ACTIVE",
          legalForm: { other: "Proprietary company" },
        },
        registration: {
          status: "ISSUED",
          initialRegistrationDate: "2020-01-01T00:00:00Z",
          lastUpdateDate: "2026-09-30T00:00:00Z",
        },
      },
    });

    expect(result?.displayName).toBe("Example Logistics Pty Ltd");
    expect(result?.country).toBe("AU");
    expect(result?.state).toBe("NSW");
    expect(result?.provider).toBe("GLEIF");
    expect(result?.industry).toBeNull();
    expect(result?.employeeCount).toBeNull();
    expect(result?.verificationStatus).toBe("CONFIRMED");
  });
});
