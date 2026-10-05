import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";
import { canManageGtm } from "@/lib/permissions";
import {
  lifecycleStages,
  relationshipStatusForStage,
  salesCycleDays,
  type LifecycleStage,
} from "@/lib/sales/lifecycle";

const LOST_REASONS = new Set([
  "NO_BUDGET",
  "NO_NEED",
  "TIMING",
  "COMPETITOR",
  "PRICE",
  "WRONG_CONTACT",
  "COMPANY_TOO_SMALL",
  "EXISTING_SUPPLIER",
  "NO_RESPONSE",
  "INTERNAL_SOLUTION",
  "OTHER",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: companyId } = await context.params;
  const formData = await request.formData();
  const sql = db();

  const [company] = await sql<
    { id: string; sourceOrigin: string; displayName: string }[]
  >`
    SELECT
      id,
      source_origin AS "sourceOrigin",
      display_name AS "displayName"
    FROM companies
    WHERE id = ${companyId}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const stage = clean(formData.get("stage")).toUpperCase() as LifecycleStage;
  if (!lifecycleStages.includes(stage)) {
    return NextResponse.json({ error: "Invalid lifecycle stage." }, { status: 400 });
  }

  const ownerUserId = clean(formData.get("ownerUserId")) || null;
  const primaryContactId = clean(formData.get("primaryContactId")) || null;
  const currentOfferingId = clean(formData.get("currentOfferingId")) || null;
  const nextAction = clean(formData.get("nextAction")).slice(0, 1000);
  const nextActionAt = parseDate(clean(formData.get("nextActionAt")));
  const notes = clean(formData.get("notes")).slice(0, 5000);
  const actualContractValue = optionalNumber(formData.get("actualContractValue"));
  const actualOfferingId = clean(formData.get("actualOfferingId")) || currentOfferingId;
  const lostReason = clean(formData.get("lostReason")).toUpperCase() || null;
  const lostReasonNote = clean(formData.get("lostReasonNote")).slice(0, 2000);

  if (ownerUserId) {
    const [member] = await sql<{ userId: string }[]>`
      SELECT user_id AS "userId"
      FROM memberships
      WHERE organization_id = ${user.organizationId}
        AND user_id = ${ownerUserId}
      LIMIT 1
    `;
    if (!member) {
      return NextResponse.json({ error: "Owner is not a workspace member." }, { status: 400 });
    }
    if (ownerUserId !== user.id && !canManageGtm(user.role)) {
      return NextResponse.json(
        { error: "Only managers or workspace administrators can assign another owner." },
        { status: 403 },
      );
    }
  }

  if (primaryContactId) {
    const [contact] = await sql<{ id: string }[]>`
      SELECT id
      FROM contacts
      WHERE id = ${primaryContactId}
        AND company_id = ${companyId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;
    if (!contact) {
      return NextResponse.json({ error: "Primary contact not found." }, { status: 400 });
    }
  }

  const offeringIds = [currentOfferingId, actualOfferingId].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
  for (const offeringId of offeringIds) {
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

  if (stage === "WON" && (actualContractValue === null || actualContractValue <= 0)) {
    return NextResponse.json(
      { error: "Won deals require a positive actual contract value." },
      { status: 400 },
    );
  }
  if (stage === "LOST" && (!lostReason || !LOST_REASONS.has(lostReason))) {
    return NextResponse.json(
      { error: "Lost deals require a lost reason." },
      { status: 400 },
    );
  }

  const [current] = await sql<
    {
      stage: LifecycleStage;
      firstContactAt: Date | null;
      ownerUserId: string | null;
      primaryContactId: string | null;
    }[]
  >`
    SELECT
      stage,
      first_contact_at AS "firstContactAt",
      owner_user_id AS "ownerUserId",
      primary_contact_id AS "primaryContactId"
    FROM company_sales_lifecycle
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    LIMIT 1
  `;

  const previousStage: LifecycleStage = current?.stage ?? "DISCOVERED";
  const closedAt = stage === "WON" || stage === "LOST" ? new Date() : null;
  const relationshipStatus = relationshipStatusForStage(stage);

  const [latestSnapshot] = await sql<
    {
      id: string;
      opportunityScore: number;
      conversionProbability: number;
      dealValueExpected: number;
      expectedRevenue: number;
      offeringId: string | null;
      offeringName: string | null;
      modelVersion: string;
    }[]
  >`
    SELECT
      id,
      opportunity_score AS "opportunityScore",
      conversion_probability::float8 AS "conversionProbability",
      deal_value_expected::float8 AS "dealValueExpected",
      expected_revenue::float8 AS "expectedRevenue",
      offering_id AS "offeringId",
      offering_name AS "offeringName",
      model_version AS "modelVersion"
    FROM opportunity_snapshots
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const resolvedActualOfferingId =
    actualOfferingId ?? latestSnapshot?.offeringId ?? null;
  const resolvedPrimaryContactId =
    primaryContactId ?? current?.primaryContactId ?? null;

  if (stage === "WON" && !resolvedActualOfferingId) {
    return NextResponse.json(
      { error: "Won deals require an Offering." },
      { status: 400 },
    );
  }
  if (stage === "WON" && !resolvedPrimaryContactId) {
    return NextResponse.json(
      { error: "Won deals require a primary contact." },
      { status: 400 },
    );
  }

  const keySignals = await sql<{ id: string }[]>`
    SELECT id
    FROM buying_signals
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
      AND verification_status <> 'OUTDATED'
    ORDER BY strength DESC, observed_at DESC
    LIMIT 8
  `;

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO company_sales_lifecycle (
        organization_id,
        company_id,
        stage,
        owner_user_id,
        primary_contact_id,
        current_offering_id,
        next_action,
        next_action_at,
        notes,
        qualified_at,
        ready_to_contact_at,
        first_contact_at,
        replied_at,
        meeting_at,
        opportunity_at,
        proposal_at,
        closed_at,
        stage_changed_at,
        updated_by,
        updated_at
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${stage},
        ${ownerUserId},
        ${primaryContactId},
        ${currentOfferingId},
        ${nextAction},
        ${nextActionAt},
        ${notes},
        ${stage === "QUALIFIED" ? new Date() : null},
        ${stage === "READY_TO_CONTACT" ? new Date() : null},
        NULL,
        ${stage === "REPLIED" ? new Date() : null},
        ${stage === "MEETING" ? new Date() : null},
        ${stage === "OPPORTUNITY" ? new Date() : null},
        ${stage === "PROPOSAL" ? new Date() : null},
        ${closedAt},
        NOW(),
        ${user.id},
        NOW()
      )
      ON CONFLICT (organization_id, company_id)
      DO UPDATE SET
        stage = EXCLUDED.stage,
        owner_user_id = EXCLUDED.owner_user_id,
        primary_contact_id = EXCLUDED.primary_contact_id,
        current_offering_id = EXCLUDED.current_offering_id,
        next_action = EXCLUDED.next_action,
        next_action_at = EXCLUDED.next_action_at,
        notes = EXCLUDED.notes,
        qualified_at = COALESCE(
          company_sales_lifecycle.qualified_at,
          EXCLUDED.qualified_at
        ),
        ready_to_contact_at = COALESCE(
          company_sales_lifecycle.ready_to_contact_at,
          EXCLUDED.ready_to_contact_at
        ),
        replied_at = COALESCE(
          company_sales_lifecycle.replied_at,
          EXCLUDED.replied_at
        ),
        meeting_at = COALESCE(
          company_sales_lifecycle.meeting_at,
          EXCLUDED.meeting_at
        ),
        opportunity_at = COALESCE(
          company_sales_lifecycle.opportunity_at,
          EXCLUDED.opportunity_at
        ),
        proposal_at = COALESCE(
          company_sales_lifecycle.proposal_at,
          EXCLUDED.proposal_at
        ),
        closed_at = EXCLUDED.closed_at,
        stage_changed_at = CASE
          WHEN company_sales_lifecycle.stage <> EXCLUDED.stage THEN NOW()
          ELSE company_sales_lifecycle.stage_changed_at
        END,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;

    if (stage !== previousStage) {
      await tx`
        INSERT INTO sales_activities (
          organization_id,
          company_id,
          contact_id,
          activity_type,
          channel,
          direction,
          subject,
          summary,
          activity_status,
          actor_id
        )
        VALUES (
          ${user.organizationId},
          ${companyId},
          ${primaryContactId},
          'STAGE_CHANGE',
          'INTERNAL',
          'INTERNAL',
          'Lifecycle stage changed',
          ${"Stage changed from " + previousStage + " to " + stage + "."},
          'COMPLETED',
          ${user.id}
        )
      `;
    }

    await tx`
      UPDATE companies
      SET
        relationship_status = ${relationshipStatus},
        updated_at = NOW()
      WHERE id = ${companyId}
        AND organization_id = ${user.organizationId}
    `;

    if (stage === "WON" || stage === "LOST") {
      const firstContactAt = current?.firstContactAt ?? null;
      const cycle = salesCycleDays(firstContactAt, closedAt ?? new Date());

      await tx`
        INSERT INTO sales_outcomes (
          organization_id,
          company_id,
          outcome,
          opportunity_snapshot_id,
          predicted_opportunity_score,
          predicted_conversion_probability,
          predicted_deal_value,
          predicted_expected_revenue,
          actual_contract_value,
          actual_offering_id,
          primary_contact_id,
          lost_reason,
          lost_reason_note,
          recommendation_source,
          key_buying_signal_ids,
          first_contact_at,
          closed_at,
          sales_cycle_days,
          created_by
        )
        VALUES (
          ${user.organizationId},
          ${companyId},
          ${stage},
          ${latestSnapshot?.id ?? null},
          ${latestSnapshot?.opportunityScore ?? null},
          ${latestSnapshot?.conversionProbability ?? null},
          ${latestSnapshot?.dealValueExpected ?? null},
          ${latestSnapshot?.expectedRevenue ?? null},
          ${stage === "WON" ? actualContractValue : null},
          ${resolvedActualOfferingId},
          ${resolvedPrimaryContactId},
          ${stage === "LOST" ? lostReason : null},
          ${stage === "LOST" ? lostReasonNote : ""},
          ${
            "Company source: " +
            company.sourceOrigin +
            (latestSnapshot
              ? "; M3 model: " + latestSnapshot.modelVersion
              : "; no M3 snapshot available")
          },
          ${JSON.stringify(keySignals.map((signal) => signal.id))}::text::jsonb,
          ${firstContactAt},
          ${closedAt ?? new Date()},
          ${cycle},
          ${user.id}
        )
        ON CONFLICT (organization_id, company_id)
        DO UPDATE SET
          outcome = EXCLUDED.outcome,
          opportunity_snapshot_id = EXCLUDED.opportunity_snapshot_id,
          predicted_opportunity_score = EXCLUDED.predicted_opportunity_score,
          predicted_conversion_probability = EXCLUDED.predicted_conversion_probability,
          predicted_deal_value = EXCLUDED.predicted_deal_value,
          predicted_expected_revenue = EXCLUDED.predicted_expected_revenue,
          actual_contract_value = EXCLUDED.actual_contract_value,
          actual_offering_id = EXCLUDED.actual_offering_id,
          primary_contact_id = EXCLUDED.primary_contact_id,
          lost_reason = EXCLUDED.lost_reason,
          lost_reason_note = EXCLUDED.lost_reason_note,
          recommendation_source = EXCLUDED.recommendation_source,
          key_buying_signal_ids = EXCLUDED.key_buying_signal_ids,
          first_contact_at = EXCLUDED.first_contact_at,
          closed_at = EXCLUDED.closed_at,
          sales_cycle_days = EXCLUDED.sales_cycle_days,
          created_by = EXCLUDED.created_by,
          created_at = NOW()
      `;
    }
  });

  const url = publicUrl(request, "/companies/" + companyId);
  url.searchParams.set(
    "lifecycle",
    stage === "WON" || stage === "LOST" ? "closed" : "saved",
  );
  return NextResponse.redirect(url, 303);
}
