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
  await sql.begin(async (tx) => {
    await tx`
      UPDATE companies
      SET relationship_status = ${status}, updated_at = NOW()
      WHERE id = ${id}
        AND organization_id = ${user.organizationId}
    `;

    if (action === "pipeline") {
      await tx`
        INSERT INTO company_sales_lifecycle (
          organization_id,
          company_id,
          stage,
          qualified_at,
          stage_changed_at,
          updated_by,
          updated_at
        )
        VALUES (
          ${user.organizationId},
          ${id},
          'QUALIFIED',
          NOW(),
          NOW(),
          ${user.id},
          NOW()
        )
        ON CONFLICT (organization_id, company_id)
        DO UPDATE SET
          stage = CASE
            WHEN company_sales_lifecycle.stage = 'DISCOVERED'
              THEN 'QUALIFIED'
            ELSE company_sales_lifecycle.stage
          END,
          qualified_at = COALESCE(
            company_sales_lifecycle.qualified_at,
            NOW()
          ),
          stage_changed_at = CASE
            WHEN company_sales_lifecycle.stage = 'DISCOVERED'
              THEN NOW()
            ELSE company_sales_lifecycle.stage_changed_at
          END,
          updated_by = ${user.id},
          updated_at = NOW()
      `;
    }

    if (action === "reject") {
      await tx`
        INSERT INTO company_sales_lifecycle (
          organization_id,
          company_id,
          stage,
          closed_at,
          stage_changed_at,
          updated_by,
          updated_at
        )
        VALUES (
          ${user.organizationId},
          ${id},
          'NOT_FIT',
          NOW(),
          NOW(),
          ${user.id},
          NOW()
        )
        ON CONFLICT (organization_id, company_id)
        DO UPDATE SET
          stage = 'NOT_FIT',
          closed_at = NOW(),
          stage_changed_at = NOW(),
          updated_by = ${user.id},
          updated_at = NOW()
      `;
    }
  });

  const url = publicUrl(request, `/companies/${id}`);
  url.searchParams.set("triaged", action);
  return NextResponse.redirect(url, 303);
}
