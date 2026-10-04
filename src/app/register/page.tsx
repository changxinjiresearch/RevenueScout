import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) {
    redirect("/setup");
  }

  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">RevenueScout</div>
        <h1 className="auth-title">Create your workspace</h1>
        <p className="auth-copy">
          This establishes the company context used by Offering, ICP and later
          opportunity discovery.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <form className="stack-form" action="/api/auth/register" method="post">
          <label>
            Your name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Work email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Organisation name
            <input name="organizationName" required />
          </label>
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
          <button className="primary-button" type="submit">
            Create workspace
          </button>
        </form>
        <p className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
