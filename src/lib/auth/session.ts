import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const SESSION_COOKIE = "revenuescout_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const sql = db();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const sql = db();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }

  cookieStore.delete(SESSION_COOKIE);
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "REP";
  onboardingCompletedAt: Date | null;
  configVersion: number;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const sql = db();
  const [row] = await sql<CurrentUser[]>`
    SELECT
      u.id,
      u.email,
      u.name,
      m.organization_id AS "organizationId",
      o.name AS "organizationName",
      m.role,
      o.onboarding_completed_at AS "onboardingCompletedAt",
      o.config_version AS "configVersion"
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN memberships m
      ON m.user_id = u.id
     AND m.organization_id = u.active_organization_id
    JOIN organizations o ON o.id = m.organization_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > NOW()
    LIMIT 1
  `;

  return row ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
