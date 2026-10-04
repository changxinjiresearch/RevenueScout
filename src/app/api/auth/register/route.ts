import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/register", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "").trim();

  if (!name || !email || !organizationName) {
    return redirectWithError(request, "Please complete all required fields.");
  }

  if (!email.includes("@")) {
    return redirectWithError(request, "Enter a valid email address.");
  }

  if (password.length < 10) {
    return redirectWithError(request, "Password must contain at least 10 characters.");
  }

  const sql = db();
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

  if (existing.length > 0) {
    return redirectWithError(request, "An account with that email already exists.");
  }

  const passwordHash = await hashPassword(password);
  let userId = "";

  await sql.begin(async (tx) => {
    const [user] = await tx<{ id: string }[]>`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id
    `;

    const [organization] = await tx<{ id: string }[]>`
      INSERT INTO organizations (name)
      VALUES (${organizationName})
      RETURNING id
    `;

    userId = user.id;

    await tx`
      INSERT INTO memberships (user_id, organization_id, role)
      VALUES (${user.id}, ${organization.id}, 'OWNER')
    `;
  });

  await createSession(userId);
  return NextResponse.redirect(new URL("/setup", request.url), 303);
}
