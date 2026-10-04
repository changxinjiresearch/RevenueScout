import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  getInvitationByToken,
  hashInvitationToken,
} from "@/lib/auth/invitations";

function redirectWithError(
  request: NextRequest,
  message: string,
  inviteToken?: string,
) {
  const url = publicUrl(request, "/register");
  url.searchParams.set("error", message);
  if (inviteToken) url.searchParams.set("invite", inviteToken);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();
  const invitation = inviteToken
    ? await getInvitationByToken(inviteToken)
    : null;

  if (!name || !email) {
    return redirectWithError(request, "Please complete all required fields.", inviteToken);
  }
  if (!email.includes("@")) {
    return redirectWithError(request, "Enter a valid email address.", inviteToken);
  }
  if (password.length < 10) {
    return redirectWithError(request, "Password must contain at least 10 characters.", inviteToken);
  }
  if (inviteToken && !invitation) {
    return redirectWithError(request, "This invitation is invalid or expired.");
  }
  if (invitation && invitation.email.trim().toLowerCase() !== email) {
    return redirectWithError(
      request,
      "Use the email address that received the invitation.",
      inviteToken,
    );
  }
  if (!invitation && !organizationName) {
    return redirectWithError(request, "Organisation name is required.");
  }

  const sql = db();
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return redirectWithError(
      request,
      "An account with that email already exists. Sign in to accept the invitation.",
      inviteToken,
    );
  }

  const passwordHash = await hashPassword(password);
  let userId = "";

  await sql.begin(async (tx) => {
    if (invitation) {
      const [user] = await tx<{ id: string }[]>`
        INSERT INTO users (email, password_hash, name, active_organization_id)
        VALUES (
          ${email},
          ${passwordHash},
          ${name},
          ${invitation.organizationId}
        )
        RETURNING id
      `;
      userId = user.id;

      await tx`
        INSERT INTO memberships (user_id, organization_id, role)
        VALUES (${user.id}, ${invitation.organizationId}, ${invitation.role})
      `;
      await tx`
        UPDATE workspace_invitations
        SET accepted_at = NOW()
        WHERE token_hash = ${hashInvitationToken(inviteToken)}
      `;
    } else {
      const [organization] = await tx<{ id: string }[]>`
        INSERT INTO organizations (name)
        VALUES (${organizationName})
        RETURNING id
      `;
      const [user] = await tx<{ id: string }[]>`
        INSERT INTO users (email, password_hash, name, active_organization_id)
        VALUES (${email}, ${passwordHash}, ${name}, ${organization.id})
        RETURNING id
      `;
      userId = user.id;
      await tx`
        INSERT INTO memberships (user_id, organization_id, role)
        VALUES (${user.id}, ${organization.id}, 'OWNER')
      `;
    }
  });

  await createSession(userId);
  return NextResponse.redirect(
    publicUrl(request, invitation ? "/" : "/onboarding"),
    303,
  );
}
