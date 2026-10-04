import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/setup?error=Company+name+is+required", request.url), 303);
  }

  const sql = db();
  await sql`
    UPDATE organizations
    SET
      name = ${name},
      website = ${String(formData.get("website") ?? "").trim() || null},
      country = ${String(formData.get("country") ?? "").trim() || null},
      service_regions = ${csv(formData.get("serviceRegions"))},
      industry = ${String(formData.get("industry") ?? "").trim() || null},
      company_size = ${String(formData.get("companySize") ?? "").trim() || null},
      description = ${String(formData.get("description") ?? "").trim() || null},
      updated_at = NOW()
    WHERE id = ${user.organizationId}
  `;

  return NextResponse.redirect(new URL("/setup?saved=workspace", request.url), 303);
}
