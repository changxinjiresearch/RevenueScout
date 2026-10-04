import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  canChangeMemberRole,
  canInviteRole,
  canManageWorkspace,
  type WorkspaceRole,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "REP";
  expiresAt: Date;
};

type Membership = {
  organizationId: string;
  organizationName: string;
  role: WorkspaceRole;
};

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; error?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const sql = db();

  const members = await sql<Member[]>`
    SELECT u.id, u.name, u.email, m.role
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = ${user.organizationId}
    ORDER BY
      CASE m.role
        WHEN 'OWNER' THEN 1
        WHEN 'ADMIN' THEN 2
        WHEN 'MANAGER' THEN 3
        ELSE 4
      END,
      u.name
  `;

  const invitations = await sql<PendingInvitation[]>`
    SELECT
      id,
      email,
      role,
      expires_at AS "expiresAt"
    FROM workspace_invitations
    WHERE organization_id = ${user.organizationId}
      AND accepted_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
  `;

  const memberships = await sql<Membership[]>`
    SELECT
      o.id AS "organizationId",
      o.name AS "organizationName",
      m.role
    FROM memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ${user.id}
    ORDER BY m.created_at ASC
  `;

  const canManage = canManageWorkspace(user.role);
  const invitePath = params.invite
    ? `/invite?token=${encodeURIComponent(params.invite)}`
    : null;

  return (
    <main className="setup-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">RevenueScout</Link>
        <div className="nav-links">
          <Link href="/">Today</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/companies">Companies</Link>
          <Link href="/setup">Market Setup</Link>
          <Link className="nav-active" href="/workspace">Workspace</Link>
        </div>
      </nav>

      <header className="setup-header">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>{user.organizationName}</h1>
          <p className="lede">
            Manage members, roles and the active workspace. Role permissions
            are enforced server-side, not only hidden in the interface.
          </p>
        </div>
        <div className="workspace-chip">
          <span>Your role</span>
          <strong>{user.role}</strong>
        </div>
      </header>

      {params.error ? <div className="error-banner">{params.error}</div> : null}
      {params.saved ? <div className="success-banner">Workspace updated.</div> : null}

      {invitePath ? (
        <section className="invite-result">
          <strong>Invitation created.</strong>
          <p>
            This link is shown once. Send it to the invited person:
          </p>
          <a href={invitePath}>{invitePath}</a>
        </section>
      ) : null}

      {memberships.length > 1 ? (
        <section className="setup-section">
          <div className="setup-section-heading">
            <div><span className="step-number">↔</span><h2>Your workspaces</h2></div>
            <p>Switching changes the organisation used by Today and Market Setup.</p>
          </div>
          <div className="config-list">
            {memberships.map((membership) => (
              <form
                className="config-card workspace-row"
                action="/api/workspace/switch"
                method="post"
                key={membership.organizationId}
              >
                <input
                  type="hidden"
                  name="organizationId"
                  value={membership.organizationId}
                />
                <div>
                  <strong>{membership.organizationName}</strong>
                  <small>{membership.role}</small>
                </div>
                {membership.organizationId === user.organizationId ? (
                  <span className="status-pill">Active</span>
                ) : (
                  <button className="secondary-button" type="submit">Switch</button>
                )}
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="setup-section">
        <div className="setup-section-heading">
          <div><span className="step-number">01</span><h2>Members</h2></div>
          <p>
            Owner and Admin manage membership. Managers can edit go-to-market
            configuration. Sales Reps use recommendations without changing the model.
          </p>
        </div>

        <div className="config-list">
          {members.map((member) => (
            <article className="config-card member-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <small>{member.email}</small>
              </div>
              <span className="role-badge">{member.role}</span>

              {canManage &&
              member.id !== user.id &&
              member.role !== "OWNER" ? (
                <div className="member-actions">
                  <form action="/api/workspace/members" method="post">
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="intent" value="role" />
                    <select name="role" defaultValue={member.role}>
                      {(["ADMIN", "MANAGER", "REP"] as const)
                        .filter((role) =>
                          canChangeMemberRole(user.role, member.role, role),
                        )
                        .map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                    <button className="secondary-button" type="submit">
                      Update role
                    </button>
                  </form>
                  {canChangeMemberRole(user.role, member.role, member.role) ? (
                    <form action="/api/workspace/members" method="post">
                      <input type="hidden" name="userId" value={member.id} />
                      <input type="hidden" name="intent" value="remove" />
                      <button className="danger-button" type="submit">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {canManage ? (
        <section className="setup-section">
          <div className="setup-section-heading">
            <div><span className="step-number">02</span><h2>Invite a member</h2></div>
            <p>
              Invitations expire after seven days. The invited email determines
              which account can join the workspace.
            </p>
          </div>
          <form
            className="config-card invite-form"
            action="/api/workspace/invitations"
            method="post"
          >
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="role">
                {(["ADMIN", "MANAGER", "REP"] as const)
                  .filter((role) => canInviteRole(user.role, role))
                  .map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
              </select>
            </label>
            <button className="primary-button" type="submit">Create invitation</button>
          </form>

          {invitations.length > 0 ? (
            <div className="pending-invites">
              <h3>Pending invitations</h3>
              {invitations.map((invitation) => (
                <div key={invitation.id}>
                  <span>{invitation.email}</span>
                  <span>{invitation.role}</span>
                  <small>
                    expires {new Date(invitation.expiresAt).toLocaleDateString("en-AU")}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
