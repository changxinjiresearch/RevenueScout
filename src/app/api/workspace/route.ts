import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageWorkspace } from "@/lib/permissions";

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function returnTo(formData: FormData): string {
  const candidate = String(formData.get("returnTo") ?? "/setup");
  return candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/setup";
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();

  if (!canManageWorkspace(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = returnTo(formData);
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const companySize = String(formData.get("companySize") ?? "").trim();
  const serviceRegions = csv(formData.get("serviceRegions"));
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    const url = publicUrl(request, target);
    url.searchParams.set("error", "Company name is required.");
    return NextResponse.redirect(url, 303);
  }

  if (
    target === "/onboarding" &&
    (!country ||
      !industry ||
      !companySize ||
      serviceRegions.length === 0 ||
      !description)
  ) {
    const url = publicUrl(request, "/onboarding");
    url.searchParams.set(
      "error",
      "Country, service region, industry, company size and description are required to finish this step.",
    );
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  await sql`
    UPDATE organizations
    SET
      name = ${name},
      website = ${String(formData.get("website") ?? "").trim() || null},
      country = ${country || null},
      service_regions = ${serviceRegions},
      industry = ${industry || null},
      company_size = ${companySize || null},
      description = ${description || null},
      config_version = config_version + 1,
      updated_at = NOW()
    WHERE id = ${user.organizationId}
  `;

  const url = publicUrl(request, target);
  url.searchParams.set("saved", "workspace");
  return NextResponse.redirect(url, 303);
}
