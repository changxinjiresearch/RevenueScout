# Product Specification Amendment v1.6 — M3 Opportunity Intelligence

Status: **approved and implemented on 2026-10-05**

This amendment implements the full M3 milestone on top of the completed M2
evidence and buying-signal layer.

## Objective

M3 converts persisted company intelligence into an auditable revenue
opportunity decision.

For every eligible company, RevenueScout must answer:

- Why this company?
- Why now?
- What problem might exist?
- Which Offering should be proposed?
- What is a plausible Low / Expected / High deal-value range?
- What is the estimated conversion probability?
- What is the probability-adjusted Expected Revenue?
- How much sales effort is likely?
- What should the salesperson do next?
- How should the opportunity rank against other opportunities?
- Has a human overridden the model, and if so, who changed what?

## Persisted opportunity snapshots

Opportunity decisions are persisted in immutable historical snapshots.

A snapshot records:

- GTM configuration version;
- input hash;
- model version;
- matched ICP;
- recommended Offering;
- Opportunity Score and component scores;
- Low / Expected / High deal value;
- estimated conversion probability;
- conversion-confidence and calibration state;
- Low / Expected / High expected revenue;
- sales effort;
- revenue efficiency;
- rank score;
- recommended contact;
- next best action;
- Why this company;
- Why now;
- Problem Hypothesis;
- conversion factors.

The same unchanged input does not create duplicate snapshots. Time/freshness is
part of the decision context so opportunity state can evolve as evidence ages.

## Why this company

The explanation is grounded in the matched ICP and the known qualifying facts.
Unknown configured ICP fields remain visible as unknown; they do not silently
become negative evidence.

## Why now

Why Now is derived from persisted evidence-backed buying signals. If no current
buying signal exists, RevenueScout must explicitly say that more research is
needed instead of inventing urgency.

## Problem Hypothesis

Problem Hypothesis is always presented as a hypothesis, never as a confirmed
company fact.

It may be derived from evidence-backed patterns such as:

- hiring;
- expansion;
- funding;
- leadership change;
- technology change;
- operational-pain evidence;
- growth;
- procurement activity.

## Recommended Offering

Offering selection is limited to Offerings explicitly linked to the matched ICP.

When multiple linked Offerings exist, RevenueScout first evaluates problem/need
fit using the Offering description, primary problems, typical customers and
known company conditions. Deal economics are used as a secondary/tie-breaking
signal rather than automatically selecting the most expensive Offering.

## Estimated deal value

RevenueScout displays a range rather than a fake precise price:

- Low;
- Expected;
- High.

Configured minimum / average / ideal Offering economics are preferred. Missing
economics use conservative transparent fallbacks.

## Conversion probability

The M3 conversion estimate is deterministic and explainable.

It uses:

- ICP Fit;
- Buying Intent;
- Timing;
- Contactability;
- Evidence Confidence;
- procurement evidence;
- number of active buying signals.

Until real Won/Lost outcomes exist, the estimate is explicitly marked:

- `PRE_CALIBRATION`;
- `LOW` conversion confidence.

The product must not imply that this probability has been statistically
calibrated before lifecycle outcomes exist.

## Expected Revenue

Expected Revenue is:

`Expected Deal Value × Conversion Probability`

RevenueScout also displays a conservative and upside expected-revenue range.

## Sales effort and revenue efficiency

Sales effort is estimated as Low / Medium / High using configured sales-cycle
length when available and deal size as a fallback.

Revenue efficiency relates probability-adjusted revenue to expected sales
effort and contributes to ranking.

## Ranking

Today ranks opportunities using persisted M3 opportunity intelligence, including
Expected Revenue, confidence, sales effort and M2 Sales Priority.

Human priority overrides affect the effective ranking.

## Human override

A user may explicitly override:

- priority;
- conversion probability;
- expected deal value;
- Offering;
- next best action.

Overrides never rewrite the underlying model snapshot.

The UI must clearly show when a human override is active.

## Audit trail

Every new snapshot and every override update/clear action is appended to an
audit trail with:

- company;
- snapshot where applicable;
- event type;
- before state;
- after state;
- note;
- actor;
- timestamp.

The company page exposes both recent score-snapshot history and the decision
audit trail.

## M3 exit gate

M3 is complete when persisted company evidence and GTM configuration can produce
an explainable, probability-adjusted, ranked revenue opportunity with historical
snapshots, human overrides and an audit trail.
