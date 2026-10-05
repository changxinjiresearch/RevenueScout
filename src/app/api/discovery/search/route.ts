import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDiscoveryProvider } from "@/lib/discovery/providers";
import {
  discoveryProgress,
  initialProgressiveDiscoveryState,
} from "@/lib/discovery/progressive";
import { publicUrl } from "@/lib/http/public-url";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();

  const providerId = String(formData.get("provider") ?? "MULTI_SOURCE");
  const provider = getDiscoveryProvider(providerId);
  const query = String(formData.get("query") ?? "").trim();
  const country =
    String(formData.get("country") ?? "").trim().toUpperCase() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const offeringId =
    String(formData.get("offeringId") ?? "").trim() || null;
  const icpId = String(formData.get("icpId") ?? "").trim() || null;

  if (!provider || provider.id !== "MULTI_SOURCE") {
    const url = publicUrl(request, "/discover");
    url.searchParams.set(
      "error",
      "User-facing discovery requires the multi-source semantic provider.",
    );
    return NextResponse.redirect(url, 303);
  }

  if (query.length < 2) {
    const url = publicUrl(request, "/discover");
    url.searchParams.set("error", "Enter at least 2 characters to search.");
    return NextResponse.redirect(url, 303);
  }

  const state = initialProgressiveDiscoveryState(query);
  if (state.semantics.length === 0) {
    const url = publicUrl(request, "/discover");
    url.searchParams.set("error", "Enter a meaningful industry keyword.");
    return NextResponse.redirect(url, 303);
  }

  const progress = discoveryProgress(state, 0);
  const sql = db();
  const [run] = await sql<{ id: string }[]>\`
    INSERT INTO discovery_runs (
      organization_id,
      provider,
      offering_id,
      icp_id,
      query,
      country,
      region,
      status,
      progress,
      work_state,
      created_by
    )
    VALUES (
      \${user.organizationId},
      \${provider.id},
      \${offeringId},
      \${icpId},
      \${query},
      \${country},
      \${region},
      'RUNNING',
      \${JSON.stringify(progress)}::text::jsonb,
      \${JSON.stringify(state)}::text::jsonb,
      \${user.id}
    )
    RETURNING id
  \`;

  return NextResponse.redirect(
    publicUrl(request, \`/discover?run=\${run.id}\`),
    303,
  );
}
