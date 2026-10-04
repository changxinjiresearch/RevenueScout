import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const organizationId = String(formData.get("organizationId") ?? "");
  const sql = db();

  const [membership] = await sql`
    SELECT 1
    FROM memberships
    WHERE user_id = ${user.id}
      AND organization_id = ${organizationId}
    LIMIT 1
  `;

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sql`
    UPDATE users
    SET active_organization_id = ${organizationId}
    WHERE id = ${user.id}
  `;

  return NextResponse.redirect(new URL("/onboarding", request.url), 303);
}
