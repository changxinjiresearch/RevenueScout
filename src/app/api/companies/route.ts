import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
  findCompanyDuplicate,
  normaliseCompanyName,
  normaliseDomain,
} from "@/lib/companies/dedupe";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const ENTITY_TYPES = new Set([
  "PRIVATE",
  "GOVERNMENT",
  "NONPROFIT",
  "UNKNOWN",
]);

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;

  if (!displayName) {
    const url = publicUrl(request, "/companies");
    url.searchParams.set("error", "Company name is required.");
    return NextResponse.redirect(url, 303);
  }

  const domain = normaliseDomain(website);
  const duplicate = await findCompanyDuplicate({
    organizationId: user.organizationId,
    displayName,
    country,
    domain,
  });

  if (duplicate) {
    const url = publicUrl(request, `/companies/${duplicate.id}`);
    url.searchParams.set("duplicate", duplicate.reason);
    return NextResponse.redirect(url, 303);
  }

  const entityType = String(formData.get("entityType") ?? "UNKNOWN");
  const safeEntityType = ENTITY_TYPES.has(entityType) ? entityType : "UNKNOWN";
  const employeeCountRaw = String(formData.get("employeeCount") ?? "").trim();
  const foundedYearRaw = String(formData.get("foundedYear") ?? "").trim();
  const employeeCount = employeeCountRaw
    ? Number.parseInt(employeeCountRaw, 10)
    : null;
  const foundedYear = foundedYearRaw
    ? Number.parseInt(foundedYearRaw, 10)
    : null;

  const sql = db();
  const [company] = await sql<{ id: string }[]>`
    INSERT INTO companies (
      organization_id,
      display_name,
      legal_name,
      name_key,
      website,
      domain,
      description,
      country,
      state,
      city,
      address,
      industry,
      subindustry,
      employee_count,
      employee_range,
      founded_year,
      company_type,
      service_regions,
      products_services,
      roles_observed,
      business_models,
      technologies,
      fast_growth,
      multi_location,
      currently_hiring,
      recent_funding,
      digital_need,
      entity_type,
      relationship_status,
      source_origin,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${displayName},
      ${String(formData.get("legalName") ?? "").trim() || null},
      ${normaliseCompanyName(displayName)},
      ${website},
      ${domain},
      ${String(formData.get("description") ?? "").trim() || null},
      ${country},
      ${String(formData.get("state") ?? "").trim() || null},
      ${String(formData.get("city") ?? "").trim() || null},
      ${String(formData.get("address") ?? "").trim() || null},
      ${String(formData.get("industry") ?? "").trim() || null},
      ${String(formData.get("subindustry") ?? "").trim() || null},
      ${Number.isFinite(employeeCount) ? employeeCount : null},
      ${String(formData.get("employeeRange") ?? "").trim() || null},
      ${Number.isFinite(foundedYear) ? foundedYear : null},
      ${String(formData.get("companyType") ?? "").trim() || null},
      ${csv(formData.get("serviceRegions"))},
      ${String(formData.get("productsServices") ?? "").trim() || null},
      ${csv(formData.get("rolesObserved"))},
      ${csv(formData.get("businessModels"))},
      ${csv(formData.get("technologies"))},
      ${formData.get("fastGrowth") === "on"},
      ${formData.get("multiLocation") === "on"},
      ${formData.get("currentlyHiring") === "on"},
      ${formData.get("recentFunding") === "on"},
      ${formData.get("digitalNeed") === "on"},
      ${safeEntityType},
      'NONE',
      'MANUAL',
      ${user.id}
    )
    RETURNING id
  `;

  return NextResponse.redirect(
    publicUrl(request, `/companies/${company.id}?created=1`),
    303,
  );
}
