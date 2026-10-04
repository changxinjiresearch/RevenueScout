import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

function invalidLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "Invalid email or password.");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const sql = db();
  const [user] = await sql<{ id: string; passwordHash: string }[]>`
    SELECT id, password_hash AS "passwordHash"
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return invalidLogin(request);
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/setup", request.url), 303);
}
