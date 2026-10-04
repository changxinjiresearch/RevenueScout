import { NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/http/public-url";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  canChangeMemberRole,
  canManageWorkspace,
  type WorkspaceRole,
} from "@/lib/permissions";

const VALID_ROLES = new Set(["ADMIN", "MANAGER", "REP"]);

export async function POST(request: NextRequest) {
  const user = await requireUser();

  if (!canManageWorkspace(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const targetUserId = String(formData.get("userId") ?? "");
  const intent = String(formData.get("intent") ?? "role");
  const sql = db();

  const [target] = await sql<{ role: WorkspaceRole }[]>`
    SELECT role
    FROM memberships
    WHERE user_id = ${targetUserId}
      AND organization_id = ${user.organizationId}
    LIMIT 1
  `;

  if (!target) {
    return NextResponse.redirect(
      publicUrl(request, "/workspace?error=Member+not+found"),
      303,
    );
  }

  if (intent === "remove") {
    if (!canChangeMemberRole(user.role, target.role, target.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM memberships
        WHERE user_id = ${targetUserId}
          AND organization_id = ${user.organizationId}
      `;
      await tx`
        UPDATE users
        SET active_organization_id = (
          SELECT organization_id
          FROM memberships
          WHERE user_id = ${targetUserId}
          ORDER BY created_at ASC
          LIMIT 1
        )
        WHERE id = ${targetUserId}
          AND active_organization_id = ${user.organizationId}
      `;
    });

    return NextResponse.redirect(
      publicUrl(request, "/workspace?saved=member-removed"),
      303,
    );
  }

  const nextRole = String(formData.get("role") ?? "") as WorkspaceRole;
  if (!VALID_ROLES.has(nextRole)) {
    return NextResponse.redirect(
      publicUrl(request, "/workspace?error=Invalid+role"),
      303,
    );
  }

  if (!canChangeMemberRole(user.role, target.role, nextRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sql`
    UPDATE memberships
    SET role = ${nextRole}
    WHERE user_id = ${targetUserId}
      AND organization_id = ${user.organizationId}
  `;

  return NextResponse.redirect(
    publicUrl(request, "/workspace?saved=member-role"),
    303,
  );
}
