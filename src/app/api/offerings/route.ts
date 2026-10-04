import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");
  const sql = db();

  if (intent === "delete") {
    await sql`
      DELETE FROM offerings
      WHERE id = ${String(formData.get("id") ?? "")}
        AND organization_id = ${user.organizationId}
    `;
    return NextResponse.redirect(new URL("/setup?saved=offering-deleted", request.url), 303);
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return NextResponse.redirect(new URL("/setup?error=Offering+name+is+required", request.url), 303);
  }

  const description = String(formData.get("description") ?? "").trim();
  const primaryProblems = String(formData.get("primaryProblems") ?? "").trim();
  const typicalCustomers = String(formData.get("typicalCustomers") ?? "").trim();
  const minContractValue = numberOrNull(formData.get("minContractValue"));
  const avgContractValue = numberOrNull(formData.get("avgContractValue"));
  const idealContractValue = numberOrNull(formData.get("idealContractValue"));
  const salesCycleDays = numberOrNull(formData.get("salesCycleDays"));
  const unsuitableCustomers = String(formData.get("unsuitableCustomers") ?? "").trim();

  if (intent === "update" && id) {
    await sql`
      UPDATE offerings
      SET
        name = ${name},
        description = ${description},
        primary_problems = ${primaryProblems},
        typical_customers = ${typicalCustomers},
        min_contract_value = ${minContractValue},
        avg_contract_value = ${avgContractValue},
        ideal_contract_value = ${idealContractValue},
        sales_cycle_days = ${salesCycleDays},
        unsuitable_customers = ${unsuitableCustomers},
        updated_at = NOW()
      WHERE id = ${id}
        AND organization_id = ${user.organizationId}
    `;
  } else {
    await sql`
      INSERT INTO offerings (
        organization_id, name, description, primary_problems, typical_customers,
        min_contract_value, avg_contract_value, ideal_contract_value,
        sales_cycle_days, unsuitable_customers
      )
      VALUES (
        ${user.organizationId}, ${name}, ${description}, ${primaryProblems},
        ${typicalCustomers}, ${minContractValue}, ${avgContractValue},
        ${idealContractValue}, ${salesCycleDays}, ${unsuitableCustomers}
      )
    `;
  }

  return NextResponse.redirect(new URL("/setup?saved=offering", request.url), 303);
}
