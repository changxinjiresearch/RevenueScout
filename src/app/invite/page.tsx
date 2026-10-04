import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvitationByToken } from "@/lib/auth/invitations";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const invitation = await getInvitationByToken(token);
  const user = await getCurrentUser();

  if (!invitation) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">Workspace invitation</div>
          <h1 className="auth-title">Invitation unavailable</h1>
          <p className="auth-copy">
            This invitation is invalid, expired or has already been accepted.
          </p>
          <Link href="/" className="primary-link">Open RevenueScout</Link>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">Workspace invitation</div>
          <h1 className="auth-title">Join {invitation.organizationName}</h1>
          <p className="auth-copy">
            You were invited as <strong>{invitation.role}</strong> using{" "}
            <strong>{invitation.email}</strong>.
          </p>
          <Link
            className="primary-link"
            href={`/register?invite=${encodeURIComponent(token)}`}
          >
            Create account and join
          </Link>
          <p className="auth-foot">
            Already have an account? Sign in, then reopen this invitation link.
          </p>
          <Link href="/login">Sign in</Link>
        </section>
      </main>
    );
  }

  const matches = user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">Workspace invitation</div>
        <h1 className="auth-title">Join {invitation.organizationName}</h1>
        <p className="auth-copy">
          Role: <strong>{invitation.role}</strong>
        </p>
        {!matches ? (
          <p className="form-error">
            This invitation belongs to {invitation.email}, but you are signed in
            as {user.email}.
          </p>
        ) : (
          <form action="/api/workspace/invitations/accept" method="post">
            <input type="hidden" name="token" value={token} />
            <button className="primary-button" type="submit">
              Accept invitation
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
