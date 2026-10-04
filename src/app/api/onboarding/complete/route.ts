import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getOnboardingState } from "@/lib/onboarding";
import { canManageGtm } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const user = await requireUser();

  if (!canManageGtm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = await getOnboardingState(user.organizationId);
  if (!state.complete) {
    const url = new URL("/onboarding", request.url);
    url.searchParams.set("error", "Complete all four setup steps first.");
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  await sql`
    UPDATE organizations
    SET onboarding_completed_at = NOW(), updated_at = NOW()
    WHERE id = ${user.organizationId}
  `;

  return NextResponse.redirect(new URL("/", request.url), 303);
}
