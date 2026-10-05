import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";
import {
  canRecordOutboundContact,
  recommendedStageForActivity,
  relationshipStatusForStage,
  shouldAdvanceLifecycle,
  type ContactabilityStatus,
  type LifecycleStage,
} from "@/lib/sales/lifecycle";

const ACTIVITY_TYPES = new Set([
  "OUTREACH",
  "FOLLOW_UP",
  "REPLY",
  "MEETING",
  "PROPOSAL",
  "NOTE",
]);

const CHANNELS = new Set([
  "EMAIL",
  "PHONE",
  "LINKEDIN",
  "MEETING",
  "OTHER",
  "INTERNAL",
]);

const DIRECTIONS = new Set(["OUTBOUND", "INBOUND", "INTERNAL"]);
const ACTIVITY_STATUS = new Set([
  "PLANNED",
  "SENT",
  "COMPLETED",
  "REPLIED",
  "NO_RESPONSE",
  "CANCELLED",
]);

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
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
  const activityType = clean(formData.get("activityType")).toUpperCase();
  const channel = clean(formData.get("channel")).toUpperCase() || "OTHER";
  const requestedDirection =
    clean(formData.get("direction")).toUpperCase() || "INTERNAL";
  const direction =
    activityType === "REPLY"
      ? "INBOUND"
      : activityType === "NOTE"
        ? "INTERNAL"
        : requestedDirection;
  const subject = clean(formData.get("subject")).slice(0, 500);
  const summary = clean(formData.get("summary")).slice(0, 5000);
  const activityStatus =
    clean(formData.get("activityStatus")).toUpperCase() || "COMPLETED";
  const sequenceRaw = Number(clean(formData.get("followUpSequence")) || "0");
  const followUpSequence = Number.isFinite(sequenceRaw)
    ? Math.max(0, Math.min(3, Math.floor(sequenceRaw)))
    : 0;
  const nextActionAt = parseDate(clean(formData.get("nextActionAt")));

  if (!ACTIVITY_TYPES.has(activityType)) {
    return NextResponse.json({ error: "Invalid activity type." }, { status: 400 });
  }
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: "Invalid activity channel." }, { status: 400 });
  }
  if (!DIRECTIONS.has(direction)) {
    return NextResponse.json({ error: "Invalid activity direction." }, { status: 400 });
  }
  if (!ACTIVITY_STATUS.has(activityStatus)) {
    return NextResponse.json({ error: "Invalid activity status." }, { status: 400 });
  }
  if (!summary && activityType !== "NOTE") {
    return NextResponse.json({ error: "Activity summary is required." }, { status: 400 });
  }

  let contact:
    | { id: string; contactabilityStatus: ContactabilityStatus }
    | null = null;

  if (direction === "OUTBOUND" && !contactId) {
    return NextResponse.json(
      { error: "Outbound activity requires a named contact." },
      { status: 400 },
    );
  }

  if (contactId) {
    [contact] = await sql<
      { id: string; contactabilityStatus: ContactabilityStatus }[]
    >`
      SELECT
        id,
        contactability_status AS "contactabilityStatus"
      FROM contacts
      WHERE id = ${contactId}
        AND company_id = ${companyId}
        AND organization_id = ${user.organizationId}
      LIMIT 1
    `;

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    if (
      direction === "OUTBOUND" &&
      !canRecordOutboundContact(contact.contactabilityStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "Outbound contact is blocked because this contact is uncertain, do-not-contact, or unsubscribed.",
        },
        { status: 409 },
      );
    }
  }

  const [current] = await sql<{ stage: LifecycleStage }[]>`
    SELECT stage
    FROM company_sales_lifecycle
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    LIMIT 1
  `;

  const currentStage: LifecycleStage = current?.stage ?? "DISCOVERED";
  if (
    direction === "OUTBOUND" &&
    (currentStage === "DO_NOT_CONTACT" || currentStage === "SUPPRESSED")
  ) {
    return NextResponse.json(
      { error: "Outbound contact is blocked by the company lifecycle status." },
      { status: 409 },
    );
  }

  const isCompletedActivity =
    activityStatus !== "PLANNED" && activityStatus !== "CANCELLED";
  const suggested = isCompletedActivity
    ? recommendedStageForActivity(
        activityType as
          | "OUTREACH"
          | "FOLLOW_UP"
          | "REPLY"
          | "MEETING"
          | "PROPOSAL"
          | "NOTE"
          | "STAGE_CHANGE",
      )
    : null;
  const nextStage =
    suggested && shouldAdvanceLifecycle(currentStage, suggested)
      ? suggested
      : currentStage;

  const now = new Date();
  const relation = relationshipStatusForStage(nextStage);

  await sql.begin(async (tx) => {
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
        follow_up_sequence,
        next_action_at,
        actor_id
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${contactId},
        ${activityType},
        ${channel},
        ${direction},
        ${subject},
        ${summary},
        ${activityStatus},
        ${followUpSequence},
        ${nextActionAt},
        ${user.id}
      )
    `;

    await tx`
      INSERT INTO company_sales_lifecycle (
        organization_id,
        company_id,
        stage,
        primary_contact_id,
        origin_opportunity_snapshot_id,
        origin_prediction_captured_at,
        next_action_at,
        first_contact_at,
        last_contact_at,
        replied_at,
        meeting_at,
        proposal_at,
        stage_changed_at,
        updated_by,
        updated_at
      )
      VALUES (
        ${user.organizationId},
        ${companyId},
        ${nextStage},
        ${contactId},
        (
          SELECT id
          FROM opportunity_snapshots
          WHERE organization_id = ${user.organizationId}
            AND company_id = ${companyId}
          ORDER BY created_at DESC
          LIMIT 1
        ),
        NOW(),
        ${nextActionAt},
        ${isCompletedActivity && (activityType === "OUTREACH" || activityType === "FOLLOW_UP") ? now : null},
        ${isCompletedActivity && direction === "OUTBOUND" ? now : null},
        ${isCompletedActivity && activityType === "REPLY" ? now : null},
        ${isCompletedActivity && activityType === "MEETING" ? now : null},
        ${isCompletedActivity && activityType === "PROPOSAL" ? now : null},
        NOW(),
        ${user.id},
        NOW()
      )
      ON CONFLICT (organization_id, company_id)
      DO UPDATE SET
        stage = ${nextStage},
        primary_contact_id = COALESCE(
          company_sales_lifecycle.primary_contact_id,
          EXCLUDED.primary_contact_id
        ),
        origin_opportunity_snapshot_id = COALESCE(
          company_sales_lifecycle.origin_opportunity_snapshot_id,
          EXCLUDED.origin_opportunity_snapshot_id
        ),
        origin_prediction_captured_at = COALESCE(
          company_sales_lifecycle.origin_prediction_captured_at,
          EXCLUDED.origin_prediction_captured_at
        ),
        next_action_at = COALESCE(
          EXCLUDED.next_action_at,
          company_sales_lifecycle.next_action_at
        ),
        first_contact_at = COALESCE(
          company_sales_lifecycle.first_contact_at,
          EXCLUDED.first_contact_at
        ),
        last_contact_at = COALESCE(
          EXCLUDED.last_contact_at,
          company_sales_lifecycle.last_contact_at
        ),
        replied_at = COALESCE(
          company_sales_lifecycle.replied_at,
          EXCLUDED.replied_at
        ),
        meeting_at = COALESCE(
          company_sales_lifecycle.meeting_at,
          EXCLUDED.meeting_at
        ),
        proposal_at = COALESCE(
          company_sales_lifecycle.proposal_at,
          EXCLUDED.proposal_at
        ),
        stage_changed_at = CASE
          WHEN company_sales_lifecycle.stage <> ${nextStage}
            THEN NOW()
          ELSE company_sales_lifecycle.stage_changed_at
        END,
        updated_by = ${user.id},
        updated_at = NOW()
    `;

    await tx`
      UPDATE companies
      SET relationship_status = ${relation}, updated_at = NOW()
      WHERE id = ${companyId}
        AND organization_id = ${user.organizationId}
    `;
  });

  const url = publicUrl(request, "/companies/" + companyId);
  url.searchParams.set("activity", "recorded");
  return NextResponse.redirect(url, 303);
}
