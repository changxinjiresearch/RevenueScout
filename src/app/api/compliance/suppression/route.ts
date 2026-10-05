import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const REASONS = new Set([
  "DO_NOT_CONTACT",
  "UNSUBSCRIBED",
  "REQUESTED_STOP",
  "LEGAL_OR_POLICY",
  "DUPLICATE_OR_CONFLICT",
  "OTHER",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const action = clean(formData.get("action")) || "add";
  const scope = clean(formData.get("scope")).toUpperCase();
  const companyId = clean(formData.get("companyId")) || null;
  const contactId = clean(formData.get("contactId")) || null;
  const reason = clean(formData.get("reason")).toUpperCase() || "DO_NOT_CONTACT";
  const note = clean(formData.get("note")).slice(0, 2000);
  const returnTo = clean(formData.get("returnTo")) || "/compliance";
  const sql = db();

  if (scope !== "COMPANY" && scope !== "CONTACT") {
    return NextResponse.json({ error: "Invalid suppression scope." }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid suppression reason." }, { status: 400 });
  }

  if (scope === "COMPANY") {
    if (!companyId) {
      return NextResponse.json({ error: "Company is required." }, { status: 400 });
    }

    const [company] = await sql<{ id: string }[]>`
      SELECT id
      FROM companies
      WHERE id = ${companyId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
  }

  if (scope === "CONTACT") {
    if (!contactId) {
      return NextResponse.json({ error: "Contact is required." }, { status: 400 });
    }
    const [contact] = await sql<{ id: string; companyId: string }[]>`
      SELECT id, company_id AS "companyId"
      FROM contacts
      WHERE id = ${contactId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
  }

  await sql.begin(async (tx) => {
    if (action === "clear") {
      const [activeSuppression] = await tx<
        { previousLifecycleStage: string | null }[]
      >`
        SELECT previous_lifecycle_stage AS "previousLifecycleStage"
        FROM suppression_entries
        WHERE organization_id = ${user.organizationId}
          AND active = TRUE
          AND (
            (${scope} = 'COMPANY' AND company_id = ${companyId}) OR
            (${scope} = 'CONTACT' AND contact_id = ${contactId})
          )
        ORDER BY created_at DESC
        LIMIT 1
      `;

      await tx`
        UPDATE suppression_entries
        SET
          active = FALSE,
          cleared_by = ${user.id},
          cleared_at = NOW()
        WHERE organization_id = ${user.organizationId}
          AND active = TRUE
          AND (
            (${scope} = 'COMPANY' AND company_id = ${companyId}) OR
            (${scope} = 'CONTACT' AND contact_id = ${contactId})
          )
      `;

      if (scope === "CONTACT" && contactId) {
        await tx`
          UPDATE contacts
          SET
            contactability_status = 'UNCERTAIN',
            updated_by = ${user.id},
            updated_at = NOW()
          WHERE id = ${contactId}
            AND organization_id = ${user.organizationId}
            AND contactability_status IN ('DO_NOT_CONTACT','UNSUBSCRIBED')
        `;
      }

      if (scope === "COMPANY" && companyId) {
        await tx`
          UPDATE company_sales_lifecycle
          SET
            stage = COALESCE(
              ${activeSuppression?.previousLifecycleStage ?? null},
              'DISCOVERED'
            ),
            stage_changed_at = NOW(),
            updated_by = ${user.id},
            updated_at = NOW()
          WHERE organization_id = ${user.organizationId}
            AND company_id = ${companyId}
            AND stage IN ('DO_NOT_CONTACT','SUPPRESSED')
        `;

        await tx`
          UPDATE companies
          SET relationship_status = 'NONE', updated_at = NOW()
          WHERE id = ${companyId}
            AND organization_id = ${user.organizationId}
            AND relationship_status = 'UNSUBSCRIBED'
        `;
      }
    } else {
      await tx`
        INSERT INTO suppression_entries (
          organization_id,
          company_id,
          contact_id,
          scope,
          reason,
          source,
          note,
          previous_lifecycle_stage,
          active,
          created_by
        )
        VALUES (
          ${user.organizationId},
          ${scope === "COMPANY" ? companyId : null},
          ${scope === "CONTACT" ? contactId : null},
          ${scope},
          ${reason},
          'USER',
          ${note},
          ${scope === "COMPANY"
            ? sql`
                (SELECT stage
                 FROM company_sales_lifecycle
                 WHERE organization_id = ${user.organizationId}
                   AND company_id = ${companyId}
                 LIMIT 1)
              `
            : null},
          TRUE,
          ${user.id}
        )
        ON CONFLICT DO NOTHING
      `;

      if (scope === "CONTACT" && contactId) {
        await tx`
          UPDATE contacts
          SET
            contactability_status = ${reason === "UNSUBSCRIBED" ? "UNSUBSCRIBED" : "DO_NOT_CONTACT"},
            updated_by = ${user.id},
            updated_at = NOW()
          WHERE id = ${contactId}
            AND organization_id = ${user.organizationId}
        `;
      }

      if (scope === "COMPANY" && companyId) {
        await tx`
          INSERT INTO company_sales_lifecycle (
            organization_id,
            company_id,
            stage,
            stage_changed_at,
            updated_by,
            updated_at
          )
          VALUES (
            ${user.organizationId},
            ${companyId},
            'SUPPRESSED',
            NOW(),
            ${user.id},
            NOW()
          )
          ON CONFLICT (organization_id, company_id)
          DO UPDATE SET
            stage = 'SUPPRESSED',
            stage_changed_at = NOW(),
            updated_by = ${user.id},
            updated_at = NOW()
        `;

        await tx`
          UPDATE companies
          SET relationship_status = 'UNSUBSCRIBED', updated_at = NOW()
          WHERE id = ${companyId}
            AND organization_id = ${user.organizationId}
        `;
      }
    }
  });

  const url = publicUrl(request, returnTo);
  url.searchParams.set(
    "suppression",
    action === "clear" ? "cleared" : "added",
  );
  return NextResponse.redirect(url, 303);
}
