import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const RELEVANCE = new Set([
  "PRIMARY_DECISION_MAKER",
  "DECISION_MAKER",
  "INFLUENCER",
  "CHAMPION",
  "PROCUREMENT",
  "TECHNICAL",
  "GATEKEEPER",
  "UNKNOWN",
]);

const CONTACT_STATUS = new Set([
  "ACTIVE",
  "UNKNOWN",
  "INVALID",
  "LEFT_COMPANY",
]);

const CONTACTABILITY = new Set([
  "CONTACT_PERMITTED",
  "EXISTING_RELATIONSHIP",
  "USER_CONFIRMED_CONSENT",
  "PUBLIC_BUSINESS_CONTACT",
  "UNCERTAIN",
  "DO_NOT_CONTACT",
  "UNSUBSCRIBED",
]);

const VERIFICATION = new Set([
  "CONFIRMED",
  "LIKELY",
  "UNVERIFIED",
  "OUTDATED",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: companyId } = await context.params;
  const formData = await request.formData();
  const sql = db();

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

  const contactId = clean(formData.get("contactId")) || null;
  const name = clean(formData.get("name"));
  const position = clean(formData.get("position"));
  const email = clean(formData.get("email")) || null;
  const phone = clean(formData.get("phone")) || null;
  const linkedinUrl = clean(formData.get("linkedinUrl")) || null;
  const location = clean(formData.get("location")) || null;
  const decisionRelevance = clean(formData.get("decisionRelevance")).toUpperCase() || "UNKNOWN";
  const contactStatus = clean(formData.get("contactStatus")).toUpperCase() || "ACTIVE";
  const contactabilityStatus =
    clean(formData.get("contactabilityStatus")).toUpperCase() || "UNCERTAIN";
  const verificationStatus =
    clean(formData.get("verificationStatus")).toUpperCase() || "UNVERIFIED";
  const sourceUrl = clean(formData.get("sourceUrl")) || null;
  const sourceLabel = clean(formData.get("sourceLabel")) || "Manual";
  const notes = clean(formData.get("notes")).slice(0, 4000);
  const confidenceRaw = Number(clean(formData.get("confidence")) || "50");
  const confidence = Math.max(0, Math.min(100, Number.isFinite(confidenceRaw) ? confidenceRaw : 50)) / 100;

  if (!name) {
    return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
  }
  if (!RELEVANCE.has(decisionRelevance)) {
    return NextResponse.json({ error: "Invalid decision relevance." }, { status: 400 });
  }
  if (!CONTACT_STATUS.has(contactStatus)) {
    return NextResponse.json({ error: "Invalid contact status." }, { status: 400 });
  }
  if (!CONTACTABILITY.has(contactabilityStatus)) {
    return NextResponse.json({ error: "Invalid contactability status." }, { status: 400 });
  }
  if (!VERIFICATION.has(verificationStatus)) {
    return NextResponse.json({ error: "Invalid verification status." }, { status: 400 });
  }

  if (contactId) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id
      FROM contacts
      WHERE id = ${contactId}
        AND company_id = ${companyId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;

    if (!existing) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    await sql`
      UPDATE contacts
      SET
        name = ${name},
        position = ${position},
        email = ${email},
        phone = ${phone},
        linkedin_url = ${linkedinUrl},
        location = ${location},
        decision_relevance = ${decisionRelevance},
        contact_status = ${contactStatus},
        contactability_status = ${contactabilityStatus},
        source_url = ${sourceUrl},
        source_label = ${sourceLabel},
        confidence = ${confidence},
        verification_status = ${verificationStatus},
        notes = ${notes},
        updated_by = ${user.id},
        updated_at = NOW()
      WHERE id = ${contactId}
        AND company_id = ${companyId}
        AND organization_id = ${user.organizationId}
    `;
  } else {
    await sql`
      INSERT INTO contacts (
        organization_id,
        company_id,
        name,
        position,
        email,
        phone,
        linkedin_url,
        location,
        decision_relevance,
        contact_status,
        contactability_status,
        source_url,
        source_label,
        confidence,
        verification_status,
        notes,
        created_by,
        updated_by
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${name},
        ${position},
        ${email},
        ${phone},
        ${linkedinUrl},
        ${location},
        ${decisionRelevance},
        ${contactStatus},
        ${contactabilityStatus},
        ${sourceUrl},
        ${sourceLabel},
        ${confidence},
        ${verificationStatus},
        ${notes},
        ${user.id},
        ${user.id}
      )
    `;
  }

  const url = publicUrl(request, "/companies/" + companyId);
  url.searchParams.set("contact", contactId ? "updated" : "created");
  return NextResponse.redirect(url, 303);
}
