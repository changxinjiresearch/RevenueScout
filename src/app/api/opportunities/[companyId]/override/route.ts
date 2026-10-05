import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const PRIORITIES = new Set(["AUTO", "HIGH", "MEDIUM", "LOW", "HOLD"]);

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> },
) {
  const user = await requireUser();
  const { companyId } = await context.params;
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "save");
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

  const [before] = await sql<Record<string, unknown>[]>`
    SELECT
      priority_override AS "priorityOverride",
      conversion_probability_override::float8 AS "conversionProbabilityOverride",
      expected_deal_value_override::float8 AS "expectedDealValueOverride",
      offering_id_override AS "offeringIdOverride",
      next_best_action_override AS "nextBestActionOverride",
      note,
      updated_at AS "updatedAt"
    FROM opportunity_overrides
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    LIMIT 1
  `;

  const [latestSnapshot] = await sql<{ id: string }[]>`
    SELECT id
    FROM opportunity_snapshots
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (action === "clear") {
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM opportunity_overrides
        WHERE organization_id = ${user.organizationId}
          AND company_id = ${companyId}
      `;

      if (before) {
        await tx`
          INSERT INTO opportunity_audit_events (
            organization_id, company_id, snapshot_id, event_type,
            before_json, after_json, note, actor_id
          )
          VALUES (
            ${user.organizationId}, ${companyId}, ${latestSnapshot?.id ?? null},
            'OVERRIDE_CLEARED',
            ${JSON.stringify(before)}::text::jsonb,
            NULL,
            'Human override cleared; ranking returns to model output.',
            ${user.id}
          )
        `;
      }
    });

    const url = publicUrl(request, "/companies/" + companyId);
    url.searchParams.set("override", "cleared");
    return NextResponse.redirect(url, 303);
  }

  const priorityOverride = String(
    formData.get("priorityOverride") ?? "AUTO",
  ).toUpperCase();
  if (!PRIORITIES.has(priorityOverride)) {
    return NextResponse.json({ error: "Invalid priority override." }, { status: 400 });
  }

  const conversionPercent = optionalNumber(formData.get("conversionPercent"));
  if (
    conversionPercent !== null &&
    (conversionPercent < 0 || conversionPercent > 100)
  ) {
    return NextResponse.json(
      { error: "Conversion probability must be between 0 and 100." },
      { status: 400 },
    );
  }

  const expectedDealValue = optionalNumber(formData.get("expectedDealValue"));
  if (expectedDealValue !== null && expectedDealValue < 0) {
    return NextResponse.json(
      { error: "Expected deal value cannot be negative." },
      { status: 400 },
    );
  }

  const offeringId = String(formData.get("offeringId") ?? "").trim() || null;
  if (offeringId) {
    const [offering] = await sql<{ id: string }[]>`
      SELECT id
      FROM offerings
      WHERE id = ${offeringId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    if (!offering) {
      return NextResponse.json({ error: "Offering not found." }, { status: 400 });
    }
  }

  const nextBestAction =
    String(formData.get("nextBestAction") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  const conversionProbability =
    conversionPercent === null ? null : conversionPercent / 100;

  const after = {
    priorityOverride,
    conversionProbabilityOverride: conversionProbability,
    expectedDealValueOverride: expectedDealValue,
    offeringIdOverride: offeringId,
    nextBestActionOverride: nextBestAction,
    note,
  };

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO opportunity_overrides (
        organization_id,
        company_id,
        priority_override,
        conversion_probability_override,
        expected_deal_value_override,
        offering_id_override,
        next_best_action_override,
        note,
        updated_by,
        updated_at
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${priorityOverride},
        ${conversionProbability},
        ${expectedDealValue},
        ${offeringId},
        ${nextBestAction},
        ${note},
        ${user.id},
        NOW()
      )
      ON CONFLICT (organization_id, company_id)
      DO UPDATE SET
        priority_override = EXCLUDED.priority_override,
        conversion_probability_override = EXCLUDED.conversion_probability_override,
        expected_deal_value_override = EXCLUDED.expected_deal_value_override,
        offering_id_override = EXCLUDED.offering_id_override,
        next_best_action_override = EXCLUDED.next_best_action_override,
        note = EXCLUDED.note,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;

    await tx`
      INSERT INTO opportunity_audit_events (
        organization_id, company_id, snapshot_id, event_type,
        before_json, after_json, note, actor_id
      )
      VALUES (
        ${user.organizationId}, ${companyId}, ${latestSnapshot?.id ?? null},
        'OVERRIDE_UPDATED',
        ${before ? JSON.stringify(before) : null}::text::jsonb,
        ${JSON.stringify(after)}::text::jsonb,
        ${note || 'Human opportunity override updated.'},
        ${user.id}
      )
    `;
  });

  const url = publicUrl(request, "/companies/" + companyId);
  url.searchParams.set("override", "saved");
  return NextResponse.redirect(url, 303);
}
