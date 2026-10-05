import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";
import {
  recommendedStageForActivity,
  relationshipStatusForStage,
  shouldAdvanceLifecycle,
  type ContactabilityStatus,
  type LifecycleStage,
} from "@/lib/sales/lifecycle";
import {
  evaluateOutreachGuard,
  type FrequencyPolicy,
} from "@/lib/compliance/outreach";

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

  const isQuick = clean(formData.get("quick")) === "1";
  let contactId = clean(formData.get("contactId")) || null;
  const activityType = clean(formData.get("activityType")).toUpperCase();
  const defaultChannel =
    activityType === "MEETING"
      ? "MEETING"
      : activityType === "NOTE"
        ? "INTERNAL"
        : "EMAIL";
  const channel =
    clean(formData.get("channel")).toUpperCase() ||
    (isQuick ? defaultChannel : "OTHER");
  const requestedDirection =
    clean(formData.get("direction")).toUpperCase() ||
    (isQuick
      ? activityType === "MEETING" || activityType === "NOTE"
        ? "INTERNAL"
        : "OUTBOUND"
      : "INTERNAL");
  const direction =
    activityType === "REPLY"
      ? "INBOUND"
      : activityType === "NOTE"
        ? "INTERNAL"
        : requestedDirection;
  const subject =
    clean(formData.get("subject")).slice(0, 500) ||
    (isQuick ? activityType.replaceAll("_", " ") : "");
  const summary =
    clean(formData.get("summary")).slice(0, 5000) ||
    (isQuick
      ? "Quick action recorded: " + activityType.replaceAll("_", " ").toLowerCase() + "."
      : "");
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

  if (isQuick && !contactId && activityType !== "NOTE") {
    const [preferredContact] = await sql<{ id: string }[]>`
      SELECT c.id
      FROM contacts c
      LEFT JOIN company_sales_lifecycle l
        ON l.organization_id = c.organization_id
       AND l.company_id = c.company_id
      WHERE c.organization_id = ${user.organizationId}
        AND c.company_id = ${companyId}
        AND c.contact_status = 'ACTIVE'
      ORDER BY
        CASE WHEN c.id = l.primary_contact_id THEN 0 ELSE 1 END,
        CASE c.contactability_status
          WHEN 'EXISTING_RELATIONSHIP' THEN 1
          WHEN 'USER_CONFIRMED_CONSENT' THEN 2
          WHEN 'CONTACT_PERMITTED' THEN 3
          ELSE 4
        END,
        CASE c.decision_relevance
          WHEN 'PRIMARY_DECISION_MAKER' THEN 1
          WHEN 'DECISION_MAKER' THEN 2
          WHEN 'CHAMPION' THEN 3
          ELSE 4
        END,
        c.confidence DESC,
        c.updated_at DESC
      LIMIT 1
    `;
    contactId = preferredContact?.id ?? null;
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

  }

  const [current] = await sql<{ stage: LifecycleStage }[]>`
    SELECT stage
    FROM company_sales_lifecycle
    WHERE organization_id = ${user.organizationId}
      AND company_id = ${companyId}
    LIMIT 1
  `;

  const currentStage: LifecycleStage = current?.stage ?? "DISCOVERED";

  let outreachWarning: string | null = null;

  if (direction === "OUTBOUND" && contact) {
    const [policyRows, companySuppressionRows, contactSuppressionRows, contactCountRows, companyCountRows, duplicateRows] =
      await Promise.all([
        sql<FrequencyPolicy[]>`
          SELECT
            contact_window_days AS "contactWindowDays",
            max_contact_outbound AS "maxContactOutbound",
            company_window_days AS "companyWindowDays",
            max_company_outbound AS "maxCompanyOutbound",
            duplicate_warning_hours AS "duplicateWarningHours"
          FROM contact_frequency_policies
          WHERE organization_id = ${user.organizationId}
          LIMIT 1
        `,
        sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM suppression_entries
          WHERE organization_id = ${user.organizationId}
            AND company_id = ${companyId}
            AND scope = 'COMPANY'
            AND active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
        `,
        sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM suppression_entries
          WHERE organization_id = ${user.organizationId}
            AND contact_id = ${contact.id}
            AND scope = 'CONTACT'
            AND active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
        `,
        sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM sales_activities a
          JOIN contact_frequency_policies p
            ON p.organization_id = a.organization_id
          WHERE a.organization_id = ${user.organizationId}
            AND a.contact_id = ${contact.id}
            AND a.direction = 'OUTBOUND'
            AND a.activity_status NOT IN ('PLANNED','CANCELLED')
            AND a.created_at >= NOW() - (p.contact_window_days || ' days')::interval
        `,
        sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM sales_activities a
          JOIN contact_frequency_policies p
            ON p.organization_id = a.organization_id
          WHERE a.organization_id = ${user.organizationId}
            AND a.company_id = ${companyId}
            AND a.direction = 'OUTBOUND'
            AND a.activity_status NOT IN ('PLANNED','CANCELLED')
            AND a.created_at >= NOW() - (p.company_window_days || ' days')::interval
        `,
        sql<{ createdAt: Date }[]>`
          SELECT a.created_at AS "createdAt"
          FROM sales_activities a
          JOIN contact_frequency_policies p
            ON p.organization_id = a.organization_id
          WHERE a.organization_id = ${user.organizationId}
            AND a.contact_id = ${contact.id}
            AND a.direction = 'OUTBOUND'
            AND a.activity_status NOT IN ('PLANNED','CANCELLED')
            AND a.actor_id IS DISTINCT FROM ${user.id}
            AND a.created_at >= NOW() - (p.duplicate_warning_hours || ' hours')::interval
          ORDER BY a.created_at DESC
          LIMIT 1
        `,
      ]);

    const policy: FrequencyPolicy = policyRows[0] ?? {
      contactWindowDays: 7,
      maxContactOutbound: 2,
      companyWindowDays: 14,
      maxCompanyOutbound: 4,
      duplicateWarningHours: 48,
    };

    const guard = evaluateOutreachGuard({
      contactabilityStatus: contact.contactabilityStatus,
      companyStage: currentStage,
      activeCompanySuppression: (companySuppressionRows[0]?.count ?? 0) > 0,
      activeContactSuppression: (contactSuppressionRows[0]?.count ?? 0) > 0,
      contactOutboundCount: contactCountRows[0]?.count ?? 0,
      companyOutboundCount: companyCountRows[0]?.count ?? 0,
      lastOutboundByOtherUserAt: duplicateRows[0]?.createdAt ?? null,
      policy,
    });

    if (!guard.allowed) {
      return NextResponse.json(
        { error: guard.blockers.join(" ") },
        { status: 409 },
      );
    }

    outreachWarning = guard.warnings[0] ?? null;
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

  const returnTo = clean(formData.get("returnTo")) || "/companies/" + companyId;
  const url = publicUrl(request, returnTo);
  url.searchParams.set("activity", "recorded");
  if (outreachWarning) {
    url.searchParams.set("outreach_warning", outreachWarning);
  }
  return NextResponse.redirect(url, 303);
}
