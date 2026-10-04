import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
  getInvitationByToken,
  hashInvitationToken,
} from "@/lib/auth/invitations";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return NextResponse.redirect(
      new URL("/workspace?error=Invitation+is+invalid+or+expired", request.url),
      303,
    );
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.redirect(
      new URL("/workspace?error=Invitation+email+does+not+match+your+account", request.url),
      303,
    );
  }

  const sql = db();
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO memberships (user_id, organization_id, role)
      VALUES (${user.id}, ${invitation.organizationId}, ${invitation.role})
      ON CONFLICT (user_id, organization_id)
      DO UPDATE SET role = EXCLUDED.role
    `;

    await tx`
      UPDATE users
      SET active_organization_id = ${invitation.organizationId}
      WHERE id = ${user.id}
    `;

    await tx`
      UPDATE workspace_invitations
      SET accepted_at = NOW()
      WHERE token_hash = ${hashInvitationToken(token)}
    `;
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}
