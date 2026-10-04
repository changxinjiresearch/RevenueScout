import type { CurrentUser } from "@/lib/auth/session";

export type WorkspaceRole = CurrentUser["role"];

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageGtm(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export function canInviteRole(
  actorRole: WorkspaceRole,
  targetRole: Exclude<WorkspaceRole, "OWNER">,
): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") {
    return targetRole === "MANAGER" || targetRole === "REP";
  }
  return false;
}

export function canChangeMemberRole(
  actorRole: WorkspaceRole,
  currentRole: WorkspaceRole,
  nextRole: WorkspaceRole,
): boolean {
  if (currentRole === "OWNER" || nextRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") {
    return (
      currentRole !== "ADMIN" &&
      nextRole !== "ADMIN" &&
      (nextRole === "MANAGER" || nextRole === "REP")
    );
  }
  return false;
}
