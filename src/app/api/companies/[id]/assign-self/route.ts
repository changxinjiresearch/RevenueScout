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

  await sql`
    INSERT INTO company_sales_lifecycle (
      organization_id,
      company_id,
      stage,
      owner_user_id,
      qualified_at,
      stage_changed_at,
      updated_by,
      updated_at
    )
    VALUES (
      ${user.organizationId},
      ${companyId},
      'QUALIFIED',
      ${user.id},
      NOW(),
      NOW(),
      ${user.id},
      NOW()
    )
    ON CONFLICT (organization_id, company_id)
    DO UPDATE SET
      owner_user_id = ${user.id},
      stage = CASE
        WHEN company_sales_lifecycle.stage = 'DISCOVERED'
          THEN 'QUALIFIED'
        ELSE company_sales_lifecycle.stage
      END,
      qualified_at = COALESCE(
        company_sales_lifecycle.qualified_at,
        NOW()
      ),
      updated_by = ${user.id},
      updated_at = NOW()
  `;

  const url = publicUrl(request, returnTo);
  url.searchParams.set("assigned", "self");
  return NextResponse.redirect(url, 303);
}
