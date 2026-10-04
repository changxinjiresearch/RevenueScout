import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageGtm } from "@/lib/permissions";

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function integerOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function returnTo(formData: FormData): string {
  const candidate = String(formData.get("returnTo") ?? "/setup");
  return candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/setup";
}

function errorRedirect(request: NextRequest, path: string, message: string) {
  const url = publicUrl(request, path);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const target = returnTo(formData);

  if (!canManageGtm(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const intent = String(formData.get("intent") ?? "create");
  const sql = db();

  if (intent === "delete") {
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM icps
        WHERE id = ${String(formData.get("id") ?? "")}
          AND organization_id = ${user.organizationId}
      `;
      await tx`
        UPDATE organizations
        SET config_version = config_version + 1, updated_at = NOW()
        WHERE id = ${user.organizationId}
      `;
    });

    const url = publicUrl(request, target);
    url.searchParams.set("saved", "icp-deleted");
    return NextResponse.redirect(url, 303);
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const countries = csv(formData.get("countries"));
  const states = csv(formData.get("states"));
  const cities = csv(formData.get("cities"));
  const industries = csv(formData.get("industries"));
  const subindustries = csv(formData.get("subindustries"));
  const employeeMin = integerOrNull(formData.get("employeeMin"));
  const employeeMax = integerOrNull(formData.get("employeeMax"));
  const companyAgeMin = integerOrNull(formData.get("companyAgeMin"));
  const companyAgeMax = integerOrNull(formData.get("companyAgeMax"));
  const companyTypes = csv(formData.get("companyTypes"));
  const serviceRegions = csv(formData.get("serviceRegions"));
  const requiredRoles = csv(formData.get("requiredRoles"));
  const businessModels = csv(formData.get("businessModels"));
  const technologies = csv(formData.get("technologies"));
  const exclusions = String(formData.get("exclusions") ?? "").trim();
  const excludedIndustries = csv(formData.get("excludedIndustries"));
  const employeeExcludeBelow = integerOrNull(
    formData.get("employeeExcludeBelow"),
  );
  const employeeExcludeAbove = integerOrNull(
    formData.get("employeeExcludeAbove"),
  );

  if (!name) {
    return errorRedirect(request, target, "ICP name is required.");
  }

  if (
    employeeMin !== null &&
    employeeMax !== null &&
    employeeMin > employeeMax
  ) {
    return errorRedirect(
      request,
      target,
      "Minimum employee count cannot exceed maximum employee count.",
    );
  }

  if (
    target === "/onboarding" &&
    countries.length === 0 &&
    states.length === 0 &&
    cities.length === 0 &&
    industries.length === 0
  ) {
    return errorRedirect(
      request,
      target,
      "Set at least one geography or industry condition.",
    );
  }

  if (
    target === "/onboarding" &&
    (employeeMin === null || employeeMax === null)
  ) {
    return errorRedirect(
      request,
      target,
      "Set both minimum and maximum employee counts.",
    );
  }

  const fastGrowth = checked(formData, "fastGrowth");
  const multiLocation = checked(formData, "multiLocation");
  const hiring = checked(formData, "hiring");
  const recentFunding = checked(formData, "recentFunding");
  const digitalNeed = checked(formData, "digitalNeed");
  const excludeGovernment = checked(formData, "excludeGovernment");
  const excludeNonprofit = checked(formData, "excludeNonprofit");
  const excludeExistingCustomer = checked(
    formData,
    "excludeExistingCustomer",
  );
  const excludeRejected = checked(formData, "excludeRejected");
  const excludeUnsubscribed = checked(formData, "excludeUnsubscribed");

  await sql.begin(async (tx) => {
    if (intent === "update" && id) {
      await tx`
        UPDATE icps
        SET
          name = ${name},
          countries = ${countries},
          states = ${states},
          cities = ${cities},
          industries = ${industries},
          subindustries = ${subindustries},
          employee_min = ${employeeMin},
          employee_max = ${employeeMax},
          company_age_min = ${companyAgeMin},
          company_age_max = ${companyAgeMax},
          company_types = ${companyTypes},
          service_regions = ${serviceRegions},
          fast_growth = ${fastGrowth},
          multi_location = ${multiLocation},
          hiring = ${hiring},
          recent_funding = ${recentFunding},
          required_roles = ${requiredRoles},
          business_models = ${businessModels},
          technologies = ${technologies},
          digital_need = ${digitalNeed},
          exclusions = ${exclusions},
          excluded_industries = ${excludedIndustries},
          exclude_government = ${excludeGovernment},
          exclude_nonprofit = ${excludeNonprofit},
          exclude_existing_customer = ${excludeExistingCustomer},
          exclude_rejected = ${excludeRejected},
          exclude_unsubscribed = ${excludeUnsubscribed},
          employee_exclude_below = ${employeeExcludeBelow},
          employee_exclude_above = ${employeeExcludeAbove},
          updated_at = NOW()
        WHERE id = ${id}
          AND organization_id = ${user.organizationId}
      `;
    } else {
      await tx`
        INSERT INTO icps (
          organization_id,
          name,
          countries,
          states,
          cities,
          industries,
          subindustries,
          employee_min,
          employee_max,
          company_age_min,
          company_age_max,
          company_types,
          service_regions,
          fast_growth,
          multi_location,
          hiring,
          recent_funding,
          required_roles,
          business_models,
          technologies,
          digital_need,
          exclusions,
          excluded_industries,
          exclude_government,
          exclude_nonprofit,
          exclude_existing_customer,
          exclude_rejected,
          exclude_unsubscribed,
          employee_exclude_below,
          employee_exclude_above
        )
        VALUES (
          ${user.organizationId},
          ${name},
          ${countries},
          ${states},
          ${cities},
          ${industries},
          ${subindustries},
          ${employeeMin},
          ${employeeMax},
          ${companyAgeMin},
          ${companyAgeMax},
          ${companyTypes},
          ${serviceRegions},
          ${fastGrowth},
          ${multiLocation},
          ${hiring},
          ${recentFunding},
          ${requiredRoles},
          ${businessModels},
          ${technologies},
          ${digitalNeed},
          ${exclusions},
          ${excludedIndustries},
          ${excludeGovernment},
          ${excludeNonprofit},
          ${excludeExistingCustomer},
          ${excludeRejected},
          ${excludeUnsubscribed},
          ${employeeExcludeBelow},
          ${employeeExcludeAbove}
        )
      `;
    }

    await tx`
      UPDATE organizations
      SET config_version = config_version + 1, updated_at = NOW()
      WHERE id = ${user.organizationId}
    `;
  });

  const url = publicUrl(request, target);
  url.searchParams.set("saved", "icp");
  return NextResponse.redirect(url, 303);
}
