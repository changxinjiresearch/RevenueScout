import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/http/public-url";

const SOURCE_TYPES = new Set([
  "GLEIF",
  "COMPANY_WEBSITE",
  "NEWS",
  "JOB_BOARD",
  "TENDER",
  "REGISTRY",
  "MANUAL",
  "OTHER",
]);

const VERIFICATION = new Set([
  "CONFIRMED",
  "LIKELY",
  "UNVERIFIED",
  "OUTDATED",
]);

function validSourceUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const formData = await request.formData();

  const sourceType = String(formData.get("sourceType") ?? "MANUAL");
  const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const observedAtRaw = String(formData.get("observedAt") ?? "").trim();
  const confidenceRaw = Number(formData.get("confidence") ?? 0.5);
  const staleAfterDaysRaw = Number(formData.get("staleAfterDays") ?? 90);
  const verification = String(
    formData.get("verificationStatus") ?? "UNVERIFIED",
  );

  if (!sourceLabel || !title || !excerpt || !observedAtRaw) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("error", "Evidence source, title, excerpt and observed date are required.");
    return NextResponse.redirect(url, 303);
  }

  if (!validSourceUrl(sourceUrl)) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("error", "Evidence URL must be HTTP or HTTPS.");
    return NextResponse.redirect(url, 303);
  }

  const observedAt = new Date(observedAtRaw);
  if (Number.isNaN(observedAt.getTime())) {
    const url = publicUrl(request, `/companies/${id}`);
    url.searchParams.set("error", "Observed date is invalid.");
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  const [company] = await sql`
    SELECT 1
    FROM companies
    WHERE id = ${id}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const contentHash = createHash("sha256")
    .update([sourceUrl, sourceLabel, title, excerpt, observedAt.toISOString()].join("|"))
    .digest("hex");

  await sql`
    INSERT INTO company_evidence (
      organization_id,
      company_id,
      source_type,
      source_url,
      source_label,
      title,
      excerpt,
      observed_at,
      confidence,
      verification_status,
      stale_after_days,
      content_hash,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${id},
      ${SOURCE_TYPES.has(sourceType) ? sourceType : "OTHER"},
      ${sourceUrl || null},
      ${sourceLabel},
      ${title},
      ${excerpt},
      ${observedAt},
      ${Math.max(0, Math.min(1, confidenceRaw))},
      ${VERIFICATION.has(verification) ? verification : "UNVERIFIED"},
      ${Math.max(1, Math.min(3650, Math.round(staleAfterDaysRaw || 90)))},
      ${contentHash},
      ${user.id}
    )
    ON CONFLICT (company_id, content_hash) WHERE content_hash IS NOT NULL
    DO NOTHING
  `;

  return NextResponse.redirect(
    publicUrl(request, `/companies/${id}?saved=evidence`),
    303,
  );
}
