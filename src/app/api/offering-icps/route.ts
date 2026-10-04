import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageGtm } from "@/lib/permissions";

function target(formData: FormData): string {
  const path = String(formData.get("returnTo") ?? "/setup");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/setup";
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();

  if (!canManageGtm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const offeringId = String(formData.get("offeringId") ?? "");
  const icpId = String(formData.get("icpId") ?? "");
  const intent = String(formData.get("intent") ?? "link");
  const sql = db();

  const [valid] = await sql`
    SELECT 1
    FROM offerings o
    JOIN icps i ON i.organization_id = o.organization_id
    WHERE o.id = ${offeringId}
      AND i.id = ${icpId}
      AND o.organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!valid) {
    const url = new URL(target(formData), request.url);
    url.searchParams.set("error", "Offering and ICP must belong to this workspace.");
    return NextResponse.redirect(url, 303);
  }

  await sql.begin(async (tx) => {
    if (intent === "unlink") {
      await tx`
        DELETE FROM offering_icps
        WHERE offering_id = ${offeringId}
          AND icp_id = ${icpId}
      `;
    } else {
      await tx`
        INSERT INTO offering_icps (offering_id, icp_id)
        VALUES (${offeringId}, ${icpId})
        ON CONFLICT DO NOTHING
      `;
    }

    await tx`
      UPDATE organizations
      SET config_version = config_version + 1, updated_at = NOW()
      WHERE id = ${user.organizationId}
    `;
  });

  const url = new URL(target(formData), request.url);
  url.searchParams.set("saved", "mapping");
  return NextResponse.redirect(url, 303);
}
