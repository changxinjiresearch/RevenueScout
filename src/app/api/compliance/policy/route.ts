import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";
import { canManageGtm } from "@/lib/permissions";

function intValue(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return null;
  const integer = Math.floor(parsed);
  if (integer < min || integer > max) return null;
  return integer;
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!canManageGtm(user.role)) {
    return NextResponse.json(
      { error: "Manager-level permission is required." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const contactWindowDays = intValue(formData.get("contactWindowDays"), 1, 365);
  const maxContactOutbound = intValue(formData.get("maxContactOutbound"), 1, 100);
  const companyWindowDays = intValue(formData.get("companyWindowDays"), 1, 365);
  const maxCompanyOutbound = intValue(formData.get("maxCompanyOutbound"), 1, 200);
  const duplicateWarningHours = intValue(
    formData.get("duplicateWarningHours"),
    1,
    720,
  );

  if (
    contactWindowDays === null ||
    maxContactOutbound === null ||
    companyWindowDays === null ||
    maxCompanyOutbound === null ||
    duplicateWarningHours === null
  ) {
    return NextResponse.json({ error: "Invalid frequency policy." }, { status: 400 });
  }

  const sql = db();
  await sql`
    INSERT INTO contact_frequency_policies (
      organization_id,
      contact_window_days,
      max_contact_outbound,
      company_window_days,
      max_company_outbound,
      duplicate_warning_hours,
      updated_by,
      updated_at
    )
    VALUES (
      ${user.organizationId},
      ${contactWindowDays},
      ${maxContactOutbound},
      ${companyWindowDays},
      ${maxCompanyOutbound},
      ${duplicateWarningHours},
      ${user.id},
      NOW()
    )
    ON CONFLICT (organization_id)
    DO UPDATE SET
      contact_window_days = EXCLUDED.contact_window_days,
      max_contact_outbound = EXCLUDED.max_contact_outbound,
      company_window_days = EXCLUDED.company_window_days,
      max_company_outbound = EXCLUDED.max_company_outbound,
      duplicate_warning_hours = EXCLUDED.duplicate_warning_hours,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;

  const url = publicUrl(request, "/compliance");
  url.searchParams.set("policy", "saved");
  return NextResponse.redirect(url, 303);
}
