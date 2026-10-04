import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

function csv(value: FormDataEntryValue | null): string[] | null {
  if (value === null) return null;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function integer(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const formData = await request.formData();
  const sql = db();

  const [company] = await sql`
    SELECT 1
    FROM companies
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const industry = formData.has("industry") ? String(formData.get("industry") ?? "").trim() || null : undefined;
  const subindustry = formData.has("subindustry") ? String(formData.get("subindustry") ?? "").trim() || null : undefined;
  const companyType = formData.has("companyType") ? String(formData.get("companyType") ?? "").trim() || null : undefined;
  const country = formData.has("country") ? String(formData.get("country") ?? "").trim() || null : undefined;
  const state = formData.has("state") ? String(formData.get("state") ?? "").trim() || null : undefined;
  const city = formData.has("city") ? String(formData.get("city") ?? "").trim() || null : undefined;
  const employeeCount = integer(formData.get("employeeCount"));
  const foundedYear = integer(formData.get("foundedYear"));
  const serviceRegions = csv(formData.get("serviceRegions"));

  await sql`
    UPDATE companies
    SET
      industry = COALESCE(${industry ?? null}, industry),
      subindustry = COALESCE(${subindustry ?? null}, subindustry),
      company_type = COALESCE(${companyType ?? null}, company_type),
      country = COALESCE(${country ?? null}, country),
      state = COALESCE(${state ?? null}, state),
      city = COALESCE(${city ?? null}, city),
      employee_count = COALESCE(${employeeCount ?? null}, employee_count),
      founded_year = COALESCE(${foundedYear ?? null}, founded_year),
      service_regions = CASE WHEN ${serviceRegions !== null} THEN ${serviceRegions ?? []} ELSE service_regions END,
      updated_at = NOW()
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
  `;

  return NextResponse.redirect(
    publicUrl(request, `/companies/${id}?saved=essentials`),
    303,
  );
}
