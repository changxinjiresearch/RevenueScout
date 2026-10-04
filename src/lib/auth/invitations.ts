import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitationRecord = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "REP";
  expiresAt: Date;
  acceptedAt: Date | null;
};

export async function getInvitationByToken(
  token: string,
): Promise<InvitationRecord | null> {
  if (!token) return null;

  const sql = db();
  const [invitation] = await sql<InvitationRecord[]>`
    SELECT
      wi.id,
      wi.organization_id AS "organizationId",
      o.name AS "organizationName",
      wi.email,
      wi.role,
      wi.expires_at AS "expiresAt",
      wi.accepted_at AS "acceptedAt"
    FROM workspace_invitations wi
    JOIN organizations o ON o.id = wi.organization_id
    WHERE wi.token_hash = ${hashInvitationToken(token)}
    LIMIT 1
  `;

  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return null;

  return invitation;
}
