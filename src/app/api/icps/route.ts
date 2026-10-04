import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

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

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");
  const sql = db();

  if (intent === "delete") {
    await sql`
      DELETE FROM icps
      WHERE id = ${String(formData.get("id") ?? "")}
        AND organization_id = ${user.organizationId}
    `;
    return NextResponse.redirect(new URL("/setup?saved=icp-deleted", request.url), 303);
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/setup?error=ICP+name+is+required", request.url), 303);
  }

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
  const fastGrowth = checked(formData, "fastGrowth");
  const multiLocation = checked(formData, "multiLocation");
  const hiring = checked(formData, "hiring");
  const recentFunding = checked(formData, "recentFunding");
  const requiredRoles = csv(formData.get("requiredRoles"));
  const businessModels = csv(formData.get("businessModels"));
  const technologies = csv(formData.get("technologies"));
  const digitalNeed = checked(formData, "digitalNeed");
  const exclusions = String(formData.get("exclusions") ?? "").trim();

  if (intent === "update" && id) {
    await sql`
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
        updated_at = NOW()
      WHERE id = ${id}
        AND organization_id = ${user.organizationId}
    `;
  } else {
    await sql`
      INSERT INTO icps (
        organization_id, name, countries, states, cities, industries,
        subindustries, employee_min, employee_max, company_age_min,
        company_age_max, company_types, service_regions, fast_growth,
        multi_location, hiring, recent_funding, required_roles, business_models,
        technologies, digital_need, exclusions
      )
      VALUES (
        ${user.organizationId}, ${name}, ${countries}, ${states}, ${cities},
        ${industries}, ${subindustries}, ${employeeMin}, ${employeeMax},
        ${companyAgeMin}, ${companyAgeMax}, ${companyTypes}, ${serviceRegions},
        ${fastGrowth}, ${multiLocation}, ${hiring}, ${recentFunding},
        ${requiredRoles}, ${businessModels}, ${technologies}, ${digitalNeed},
        ${exclusions}
      )
    `;
  }

  return NextResponse.redirect(new URL("/setup?saved=icp", request.url), 303);
}
