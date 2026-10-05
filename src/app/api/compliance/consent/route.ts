import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const TYPES = new Set([
  "CONTACT_PERMITTED",
  "EXISTING_RELATIONSHIP",
  "USER_CONFIRMED_CONSENT",
  "WITHDRAWN",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const contactId = clean(formData.get("contactId"));
  const consentType = clean(formData.get("consentType")).toUpperCase();
  const source = clean(formData.get("source")) || "USER";
  const note = clean(formData.get("note")).slice(0, 2000);
  const returnTo = clean(formData.get("returnTo")) || "/compliance";
  const sql = db();

  if (!contactId) {
    return NextResponse.json({ error: "Contact is required." }, { status: 400 });
  }
  if (!TYPES.has(consentType)) {
    return NextResponse.json({ error: "Invalid consent record type." }, { status: 400 });
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

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO consent_records (
        organization_id,
        contact_id,
        consent_type,
        source,
        note,
        recorded_by
      )
      VALUES (
        ${user.organizationId},
        ${contactId},
        ${consentType},
        ${source},
        ${note},
        ${user.id}
      )
    `;

    if (consentType === "WITHDRAWN") {
      await tx`
        UPDATE contacts
        SET
          contactability_status = 'DO_NOT_CONTACT',
          updated_by = ${user.id},
          updated_at = NOW()
        WHERE id = ${contactId}
          AND organization_id = ${user.organizationId}
      `;

      await tx`
        INSERT INTO suppression_entries (
          organization_id,
          contact_id,
          scope,
          reason,
          source,
          note,
          active,
          created_by
        )
        VALUES (
          ${user.organizationId},
          ${contactId},
          'CONTACT',
          'REQUESTED_STOP',
          'CONSENT_RECORD',
          ${note},
          TRUE,
          ${user.id}
        )
        ON CONFLICT DO NOTHING
      `;
    } else {
      await tx`
        UPDATE contacts
        SET
          contactability_status = ${consentType},
          updated_by = ${user.id},
          updated_at = NOW()
        WHERE id = ${contactId}
          AND organization_id = ${user.organizationId}
      `;

      await tx`
        UPDATE suppression_entries
        SET
          active = FALSE,
          cleared_by = ${user.id},
          cleared_at = NOW()
        WHERE organization_id = ${user.organizationId}
          AND contact_id = ${contactId}
          AND scope = 'CONTACT'
          AND active = TRUE
          AND reason IN ('DO_NOT_CONTACT','REQUESTED_STOP')
      `;
    }
  });

  const url = publicUrl(request, returnTo);
  url.searchParams.set("consent", "saved");
  return NextResponse.redirect(url, 303);
}
