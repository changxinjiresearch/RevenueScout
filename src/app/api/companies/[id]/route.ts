import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
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

const RELATIONSHIP_STATUSES = new Set([
  "NONE",
  "EXISTING_CUSTOMER",
  "PIPELINE",
  "CONTACTED",
  "REJECTED",
  "UNSUBSCRIBED",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("error", "Company name is required.");
    return NextResponse.redirect(url, 303);
  }

  const website = String(formData.get("website") ?? "").trim() || null;
  const entityType = String(formData.get("entityType") ?? "UNKNOWN");
  const relationshipStatus = String(
    formData.get("relationshipStatus") ?? "NONE",
  );
  const employeeCountRaw = String(formData.get("employeeCount") ?? "").trim();
  const foundedYearRaw = String(formData.get("foundedYear") ?? "").trim();
  const employeeCount = employeeCountRaw
    ? Number.parseInt(employeeCountRaw, 10)
    : null;
  const foundedYear = foundedYearRaw
    ? Number.parseInt(foundedYearRaw, 10)
    : null;
  const sql = db();

  await sql`
    UPDATE companies
    SET
      display_name = ${displayName},
      legal_name = ${String(formData.get("legalName") ?? "").trim() || null},
      name_key = ${normaliseCompanyName(displayName)},
      website = ${website},
      domain = ${normaliseDomain(website)},
      description = ${String(formData.get("description") ?? "").trim() || null},
      country = ${String(formData.get("country") ?? "").trim() || null},
      state = ${String(formData.get("state") ?? "").trim() || null},
      city = ${String(formData.get("city") ?? "").trim() || null},
      address = ${String(formData.get("address") ?? "").trim() || null},
      industry = ${String(formData.get("industry") ?? "").trim() || null},
      subindustry = ${String(formData.get("subindustry") ?? "").trim() || null},
      employee_count = ${Number.isFinite(employeeCount) ? employeeCount : null},
      employee_range = ${String(formData.get("employeeRange") ?? "").trim() || null},
      founded_year = ${Number.isFinite(foundedYear) ? foundedYear : null},
      company_type = ${String(formData.get("companyType") ?? "").trim() || null},
      service_regions = ${csv(formData.get("serviceRegions"))},
      products_services = ${String(formData.get("productsServices") ?? "").trim() || null},
      roles_observed = ${csv(formData.get("rolesObserved"))},
      business_models = ${csv(formData.get("businessModels"))},
      technologies = ${csv(formData.get("technologies"))},
      fast_growth = ${formData.get("fastGrowth") === "on"},
      multi_location = ${formData.get("multiLocation") === "on"},
      currently_hiring = ${formData.get("currentlyHiring") === "on"},
      recent_funding = ${formData.get("recentFunding") === "on"},
      digital_need = ${formData.get("digitalNeed") === "on"},
      entity_type = ${ENTITY_TYPES.has(entityType) ? entityType : "UNKNOWN"},
      relationship_status = ${RELATIONSHIP_STATUSES.has(relationshipStatus)
        ? relationshipStatus
        : "NONE"},
      updated_at = NOW()
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
  `;

  return NextResponse.redirect(
    publicUrl(request, `/companies/${id}?saved=company`),
    303,
  );
}
