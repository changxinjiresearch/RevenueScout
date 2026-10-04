import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { hashInvitationToken } from "@/lib/auth/invitations";
import { db } from "@/lib/db";
import { canInviteRole } from "@/lib/permissions";

const VALID_ROLES = new Set(["ADMIN", "MANAGER", "REP"]);

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "REP") as "ADMIN" | "MANAGER" | "REP";

  if (!email.includes("@") || !VALID_ROLES.has(role)) {
    return NextResponse.redirect(
      new URL("/workspace?error=Enter+a+valid+email+and+role", request.url),
      303,
    );
  }

  if (!canInviteRole(user.role, role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sql = db();

  await sql`
    INSERT INTO workspace_invitations (
      organization_id,
      email,
      role,
      token_hash,
      invited_by,
      expires_at
    )
    VALUES (
      ${user.organizationId},
      ${email},
      ${role},
      ${tokenHash},
      ${user.id},
      ${expiresAt}
    )
  `;

  const url = new URL("/workspace", request.url);
  url.searchParams.set("invite", token);
  return NextResponse.redirect(url, 303);
}
