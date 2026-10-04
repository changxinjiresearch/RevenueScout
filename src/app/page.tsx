import Link from "next/link";\nimport { demoOpportunities } from "@/data/demo-opportunities";
import { assessOpportunity } from "@/lib/domain/opportunity-score";

function money(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const opportunities = demoOpportunities
    .map((opportunity) => ({
      ...opportunity,
      assessment: assessOpportunity(opportunity),
    }))
    .sort(
      (a, b) =>
        b.assessment.expectedRevenue - a.assessment.expectedRevenue ||
        b.assessment.opportunityScore - a.assessment.opportunityScore,
    );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">RevenueScout</div>
          <h1>Today</h1>
          <p className="lede">
            The opportunities most worth your sales time right now.
          </p>
        </div>
        <div className="top-actions"><Link className="status-pill" href="/setup">Market Setup</Link><div className="status-pill">MVP vertical slice</div></div>
      </header>

      <section className="summary-grid" aria-label="Today summary">
        <article className="summary-card">
          <span>High-value opportunities</span>
          <strong>{opportunities.length}</strong>
        </article>
        <article className="summary-card">
          <span>Expected revenue</span>
          <strong>
            {money(
              opportunities.reduce(
                (sum, item) => sum + item.assessment.expectedRevenue,
                0,
              ),
            )}
          </strong>
        </article>
        <article className="summary-card">
          <span>Strongest signal</span>
          <strong>{opportunities[0]?.assessment.primarySignal?.type ?? "—"}</strong>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <div className="eyebrow">Priority queue</div>
          <h2>Today's Best Opportunities</h2>
        </div>
        <p>
          Ranked by expected revenue first, then opportunity quality. Every
          recommendation exposes its underlying evidence.
        </p>
      </section>

      <section className="opportunity-list">
        {opportunities.map((opportunity, index) => (
          <article className="opportunity-card" key={opportunity.id}>
            <div className="rank">{index + 1}</div>

            <div className="company-column">
              <div className="company-title-row">
                <div>
                  <h3>{opportunity.companyName}</h3>
                  <p>
                    {opportunity.industry} · {opportunity.location} ·{" "}
                    {opportunity.employeeRange} employees
                  </p>
                </div>
                <span
                  className="confidence"
                  title="Confidence reflects evidence completeness and verification."
                >
                  {opportunity.assessment.confidenceLabel} confidence
                </span>
              </div>

              <div className="explanation-grid">
                <div>
                  <span className="field-label">Why this company</span>
                  <p>{opportunity.whyThisCompany}</p>
                </div>
                <div>
                  <span className="field-label">Why now</span>
                  <p>{opportunity.whyNow}</p>
                </div>
                <div>
                  <span className="field-label">Problem hypothesis</span>
                  <p>{opportunity.problemHypothesis}</p>
                </div>
                <div>
                  <span className="field-label">Recommended offering</span>
                  <p>{opportunity.recommendedOffering}</p>
                </div>
              </div>

              <div className="signal-row">
                {opportunity.signals.map((signal) => (
                  <span className="signal-chip" key={signal.id}>
                    {signal.type.replaceAll("_", " ")} · {signal.label}
                  </span>
                ))}
              </div>

              <div className="next-action">
                <span className="field-label">Next best action</span>
                <strong>{opportunity.nextBestAction}</strong>
                <span>Best person: {opportunity.recommendedContact}</span>
              </div>
            </div>

            <aside className="score-column">
              <div className="score-block">
                <span>Opportunity Score</span>
                <strong>{opportunity.assessment.opportunityScore}</strong>
                <small>/100</small>
              </div>

              <div className="revenue-block">
                <span>Expected Revenue</span>
                <strong>{money(opportunity.assessment.expectedRevenue)}</strong>
                <small>
                  {Math.round(opportunity.conversionProbability * 100)}% ×{" "}
                  {money(opportunity.expectedDealValue)}
                </small>
              </div>

              <details>
                <summary>Why this score?</summary>
                <dl className="score-breakdown">
                  {Object.entries(opportunity.assessment.scoreBreakdown).map(
                    ([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{Math.round(value)}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
            </aside>
          </article>
        ))}
      </section>

      <footer className="disclaimer">
        Initial scoring is a transparent heuristic for product validation, not a
        trained conversion model. Demo information is synthetic and must not be
        interpreted as real company intelligence.
      </footer>
    </main>
  );
}
