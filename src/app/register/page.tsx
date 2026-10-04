import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvitationByToken } from "@/lib/auth/invitations";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  if (await getCurrentUser()) {
    redirect("/");
  }

  const { error, invite = "" } = await searchParams;
  const invitation = invite ? await getInvitationByToken(invite) : null;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">RevenueScout</div>
        <h1 className="auth-title">
          {invitation
            ? `Join ${invitation.organizationName}`
            : "Create your workspace"}
        </h1>
        <p className="auth-copy">
          {invitation
            ? `You are joining as ${invitation.role}.`
            : "This establishes the company context used by Offering, ICP and opportunity discovery."}
        </p>

        {invite && !invitation ? (
          <p className="form-error">This invitation is invalid or expired.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}

        <form className="stack-form" action="/api/auth/register" method="post">
          {invitation ? (
            <input type="hidden" name="inviteToken" value={invite} />
          ) : null}
          <label>
            Your name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Work email
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={invitation?.email ?? ""}
              readOnly={Boolean(invitation)}
              required
            />
          </label>
          {!invitation ? (
            <label>
              Organisation name
              <input name="organizationName" required />
            </label>
          ) : null}
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(invite && !invitation)}
          >
            {invitation ? "Create account and join" : "Create workspace"}
          </button>
        </form>

        <p className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
