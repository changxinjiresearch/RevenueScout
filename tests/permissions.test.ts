import { describe, expect, it } from "vitest";
import {
  canChangeMemberRole,
  canInviteRole,
  canManageGtm,
  canManageWorkspace,
} from "../src/lib/permissions";

describe("workspace permissions", () => {
  it("keeps workspace administration with owners and admins", () => {
    expect(canManageWorkspace("OWNER")).toBe(true);
    expect(canManageWorkspace("ADMIN")).toBe(true);
    expect(canManageWorkspace("MANAGER")).toBe(false);
    expect(canManageWorkspace("REP")).toBe(false);
  });

  it("lets managers configure go-to-market rules but not membership", () => {
    expect(canManageGtm("MANAGER")).toBe(true);
    expect(canInviteRole("MANAGER", "REP")).toBe(false);
  });

  it("prevents admins from changing owner/admin authority", () => {
    expect(canChangeMemberRole("ADMIN", "ADMIN", "REP")).toBe(false);
    expect(canChangeMemberRole("ADMIN", "MANAGER", "REP")).toBe(true);
    expect(canChangeMemberRole("OWNER", "ADMIN", "MANAGER")).toBe(true);
  });
});
