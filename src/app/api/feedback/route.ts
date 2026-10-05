import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const REASONS = new Set([
  "WRONG_COMPANY",
  "WRONG_TIMING",
  "WRONG_SIGNAL",
  "WRONG_OFFERING",
  "TOO_SMALL",
  "TOO_LARGE",
  "ALREADY_CONTACTED",
  "OTHER",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const companyId = clean(formData.get("companyId"));
  const useful = clean(formData.get("useful")) === "true";
  const reason = clean(formData.get("reason")).toUpperCase() || null;
  const note = clean(formData.get("note")).slice(0, 2000);
  const returnTo = clean(formData.get("returnTo")) || "/";
  const sql = db();

  if (!companyId) {
    return NextResponse.json({ error: "Company is required." }, { status: 400 });
  }
  if (!useful && (!reason || !REASONS.has(reason))) {
    return NextResponse.json(
      { error: "Negative feedback requires a reason." },
      { status: 400 },
    );
  }

  const [company] = await sql<{ id: string }[]>`
    SELECT id
    FROM companies
    WHERE id = ${companyId}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const [snapshot] = await sql<{ id: string }[]>`
    SELECT id
    FROM opportunity_snapshots
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  await sql`
    INSERT INTO recommendation_feedback (
      organization_id,
      company_id,
      opportunity_snapshot_id,
      useful,
      reason,
      note,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${companyId},
      ${snapshot?.id ?? null},
      ${useful},
      ${useful ? null : reason},
      ${note},
      ${user.id}
    )
  `;

  const url = publicUrl(request, returnTo);
  url.searchParams.set("feedback", useful ? "useful" : "not-useful");
  return NextResponse.redirect(url, 303);
}
