import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-copy">
          Sign in to configure the market RevenueScout should pursue.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <form className="stack-form" action="/api/auth/login" method="post">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
        <p className="auth-foot">
          New to RevenueScout? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
