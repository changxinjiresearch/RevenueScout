import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canManageGtm } from "@/lib/permissions";

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
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
        DELETE FROM offerings
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
    url.searchParams.set("saved", "offering-deleted");
    return NextResponse.redirect(url, 303);
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const primaryProblems = String(formData.get("primaryProblems") ?? "").trim();
  const typicalCustomers = String(formData.get("typicalCustomers") ?? "").trim();
  const minContractValue = numberOrNull(formData.get("minContractValue"));
  const avgContractValue = numberOrNull(formData.get("avgContractValue"));
  const idealContractValue = numberOrNull(formData.get("idealContractValue"));
  const salesCycleDays = numberOrNull(formData.get("salesCycleDays"));
  const unsuitableCustomers = String(formData.get("unsuitableCustomers") ?? "").trim();

  if (!name) {
    return errorRedirect(request, target, "Offering name is required.");
  }

  if (
    minContractValue !== null &&
    avgContractValue !== null &&
    minContractValue > avgContractValue
  ) {
    return errorRedirect(
      request,
      target,
      "Minimum contract value cannot exceed average contract value.",
    );
  }

  if (
    avgContractValue !== null &&
    idealContractValue !== null &&
    avgContractValue > idealContractValue
  ) {
    return errorRedirect(
      request,
      target,
      "Average contract value cannot exceed ideal contract value.",
    );
  }

  if (
    target === "/onboarding" &&
    (!description ||
      !primaryProblems ||
      !typicalCustomers ||
      minContractValue === null ||
      avgContractValue === null ||
      idealContractValue === null ||
      salesCycleDays === null ||
      !unsuitableCustomers)
  ) {
    return errorRedirect(
      request,
      target,
      "Complete every Offering field before continuing onboarding.",
    );
  }

  await sql.begin(async (tx) => {
    if (intent === "update" && id) {
      await tx`
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
      await tx`
        INSERT INTO offerings (
          organization_id,
          name,
          description,
          primary_problems,
          typical_customers,
          min_contract_value,
          avg_contract_value,
          ideal_contract_value,
          sales_cycle_days,
          unsuitable_customers
        )
        VALUES (
          ${user.organizationId},
          ${name},
          ${description},
          ${primaryProblems},
          ${typicalCustomers},
          ${minContractValue},
          ${avgContractValue},
          ${idealContractValue},
          ${salesCycleDays},
          ${unsuitableCustomers}
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
  url.searchParams.set("saved", "offering");
  return NextResponse.redirect(url, 303);
}
