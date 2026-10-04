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
          category: "GENERAL",
          status: "ACTIVE",
          entityCreationDate: "2018-05-01T00:00:00Z",
          registrationAuthority: {
            registrationAuthorityID: "RA000013",
            registrationAuthorityEntityID: "123456789",
          },
          legalForm: { id: "TXVC", other: "Proprietary company" },
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
    expect(result?.legalEntityCategory).toBe("GENERAL");
    expect(result?.entityStatus).toBe("ACTIVE");
    expect(result?.registrationStatus).toBe("ISSUED");
    expect(result?.foundedYear).toBe(2018);
    expect(result?.sourceUrl).toBe(
      "https://search.gleif.org/#/record/12345678901234567890",
    );
    expect(result?.rawSourceUrl).toBe(
      "https://api.gleif.org/api/v1/lei-records/12345678901234567890",
    );
  });
});
