import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: companyId } = await context.params;
  const formData = await request.formData();
  const action = clean(formData.get("action")) || "add";
  const reason = clean(formData.get("reason")).slice(0, 1000);
  const returnTo = clean(formData.get("returnTo")) || "/companies/" + companyId;
  const sql = db();

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

  if (action === "remove") {
    await sql`
      DELETE FROM watchlist_entries
      WHERE organization_id = ${user.organizationId}
        AND company_id = ${companyId}
    `;
  } else {
    await sql`
      INSERT INTO watchlist_entries (
        organization_id,
        company_id,
        reason,
        created_by
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${reason},
        ${user.id}
      )
      ON CONFLICT (organization_id, company_id)
      DO UPDATE SET
        reason = EXCLUDED.reason
    `;
  }

  const url = publicUrl(request, returnTo);
  url.searchParams.set("watchlist", action === "remove" ? "removed" : "added");
  return NextResponse.redirect(url, 303);
}
