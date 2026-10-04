import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDiscoveryProvider } from "@/lib/discovery/providers";
import { publicUrl } from "@/lib/http/public-url";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();

  const providerId = String(formData.get("provider") ?? "GLEIF");
  const provider = getDiscoveryProvider(providerId);
  const query = String(formData.get("query") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim().toUpperCase() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const offeringId = String(formData.get("offeringId") ?? "").trim() || null;
  const icpId = String(formData.get("icpId") ?? "").trim() || null;

  if (!provider) {
    const url = publicUrl(request, "/discover");
    url.searchParams.set("error", "Unknown discovery provider.");
    return NextResponse.redirect(url, 303);
  }

  if (query.length < 2) {
    const url = publicUrl(request, "/discover");
    url.searchParams.set("error", "Enter at least 2 characters to search.");
    return NextResponse.redirect(url, 303);
  }

  const sql = db();
  const [run] = await sql<{ id: string }[]>`
    INSERT INTO discovery_runs (
      organization_id,
      provider,
      offering_id,
      icp_id,
      query,
      country,
      region,
      status,
      created_by
    )
    VALUES (
      ${user.organizationId},
      ${provider.id},
      ${offeringId},
      ${icpId},
      ${query},
      ${country},
      ${region},
      'RUNNING',
      ${user.id}
    )
    RETURNING id
  `;

  try {
    const results = await provider.search({
      query,
      country,
      region,
      limit: 12,
    });

    await sql`
      UPDATE discovery_runs
      SET
        status = 'COMPLETED',
        result_count = ${results.length},
        results = ${JSON.stringify(results)}::jsonb,
        completed_at = NOW()
      WHERE id = ${run.id}
    `;

    return NextResponse.redirect(
      publicUrl(request, `/discover?run=${run.id}`),
      303,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery provider failed.";

    await sql`
      UPDATE discovery_runs
      SET
        status = 'FAILED',
        error_message = ${message},
        completed_at = NOW()
      WHERE id = ${run.id}
    `;

    const url = publicUrl(request, "/discover");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  }
}
