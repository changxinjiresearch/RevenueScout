import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const ACTION_TO_STATUS = {
  pipeline: "PIPELINE",
  reject: "REJECTED",
  review: "NONE",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "");
  const status = ACTION_TO_STATUS[action as keyof typeof ACTION_TO_STATUS];

  if (!status) {
    return NextResponse.json({ error: "Invalid triage action." }, { status: 400 });
  }

  const sql = db();
  await sql`
    UPDATE companies
    SET relationship_status = ${status}, updated_at = NOW()
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
  `;

  const url = publicUrl(request, `/companies/${id}`);
  url.searchParams.set("triaged", action);
  return NextResponse.redirect(url, 303);
}
