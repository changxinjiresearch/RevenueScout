# Product Specification Amendment v1.9 — M6 Basic Analytics and Revenue Learning

Status: **approved and implemented on 2026-10-05**

This amendment completes M6 by turning the M2–M5 operational record into an
auditable revenue-learning layer.

M6 does not silently retrain or rewrite the M3 decision model. It measures what
happened, exposes prediction error and identifies descriptive patterns that can
support a later versioned model update.

## Analytics home

Analytics must answer the core business questions:

- How many new qualified opportunities did we create?
- Where does the sales funnel leak?
- Which current opportunities are worth the most?
- Which current opportunities have the highest estimated conversion probability?
- How much revenue has actually been won?
- How much open Expected Revenue remains?
- Which Buying Signals are associated with meetings, wins and revenue?
- Which ICPs produce the most revenue?
- Which Offerings convert best and produce the most revenue?
- Which primary-contact roles are associated with closed outcomes?
- Why are opportunities being lost?
- How close were M3 predictions to reality?
- How useful do users say the recommendations are?
- Is there enough Won/Lost ground truth to begin formal probability calibration?

## Analysis window

The Analytics page supports:

- last 30 days;
- last 90 days;
- last 365 days;
- all time.

Different metrics use explicit time semantics:

- funnel cohort: companies first added in the selected window;
- new qualified opportunities: qualification timestamps in the selected window;
- closed revenue / calibration / Lost Reasons: outcomes closed in the selected window;
- open forecast and top opportunities: current active pipeline, independent of
  the historical window;
- revenue trend: rolling last 12 calendar months.

The UI states these semantics so different denominators are not silently mixed.

## Sales funnel

The funnel covers:

- Discovered;
- Qualified;
- Contacted;
- Replied;
- Meeting;
- Opportunity;
- Proposal;
- Won.

For each stage RevenueScout reports:

- company count;
- conversion from the initial cohort;
- step conversion from the previous stage.

A zero denominator is shown as unavailable rather than converted into a fake
zero-percent rate.

## Current opportunity rankings

Analytics shows:

### Most valuable open opportunities

Ranked by current probability-adjusted Expected Revenue.

### Most likely to convert

Ranked by current Conversion Probability.

Both rankings:

- use the latest M3 snapshot;
- respect human probability and deal-value overrides;
- exclude explicit HOLD opportunities;
- exclude closed / Not Fit / Do Not Contact / Suppressed companies;
- exclude active organisation-wide company suppression.

The probability ranking remains explicitly pre-calibration until enough real
outcomes exist.

## Forecast

Current active opportunities expose:

- current open expected deal value;
- high-case / upside potential;
- probability-adjusted Expected Revenue;
- active opportunity count.

Forecast values are separated from booked revenue.

Upside potential is not presented as a promise or booked revenue.

## Prediction vs Reality

For closed outcomes, RevenueScout compares the M3 prediction frozen into the M4
ground-truth record against the real result.

Metrics include:

- Predicted Expected Revenue;
- Actual Won Revenue;
- Revenue delta;
- Actual / predicted ratio;
- original Conversion Probability;
- actual Won/Lost result;
- predicted deal value;
- actual contract value;
- sales-cycle duration.

The closed-deal audit links each row back to the company.

## Conversion-probability evaluation

M6 evaluates probability quality without falsely claiming statistical
calibration.

It reports:

- usable closed-prediction sample size;
- Won / Lost counts;
- mean predicted probability;
- actual win rate;
- Brier score;
- mean absolute probability error;
- 10-percentage-point probability bins;
- average prediction and actual win rate inside each populated bin.

Evidence state:

- 0 outcomes: No Ground Truth;
- 1–9: Insufficient Data;
- 10–49: Calibrating;
- 50+: enough ground truth for formal calibration work.

Reaching 50 outcomes does **not** automatically rewrite M3 or declare a new
production model calibrated. Any such change requires a new, explicit model
version.

## Signal Performance

For every evidence-backed Buying Signal type RevenueScout reports:

- distinct companies carrying the signal;
- contacted companies;
- meetings;
- proposals;
- Won deals;
- win rate;
- actual Won Revenue;
- average Won Deal Size;
- average Sales Cycle where available.

Signal revenue is descriptive and may overlap because one company may carry
multiple signal types. Signal totals must not be summed as if they were mutually
exclusive causal attribution.

## ICP Performance

For each ICP RevenueScout reports:

- company count;
- contacted count;
- meetings;
- proposals;
- Won deals;
- win rate;
- Won Revenue;
- average Deal Size;
- average Sales Cycle.

Where available, the ICP attached to the original M3 opportunity snapshot is
preferred over a later classification so outcome analysis is not rewritten with
hindsight.

## Offering Performance

For each Offering RevenueScout reports the same commercial outcome measures as
ICP Performance.

Where available, the Offering attached to the original opportunity snapshot is
preferred.

## Primary-contact role outcomes

Closed outcomes may be grouped by the primary contact's decision relevance:

- Primary Decision Maker;
- Decision Maker;
- Influencer;
- Champion;
- Procurement;
- Technical;
- Gatekeeper;
- Unknown.

This is descriptive association, not proof that the role caused the outcome.

## Lost Reason analytics

M6 groups Lost outcomes by the structured M4 reasons:

- No Budget;
- No Need;
- Timing;
- Competitor;
- Price;
- Wrong Contact;
- Company Too Small;
- Existing Supplier;
- No Response;
- Internal Solution;
- Other.

## Revenue Attribution

RevenueScout reports:

- Won Revenue associated with an M3 opportunity prediction;
- total Won Revenue;
- attribution coverage;
- Won Revenue by company source origin;
- Buying Signal / ICP / Offering revenue associations.

Attribution means that the RevenueScout path is attached to the recorded sale.
It does not claim causal proof that RevenueScout alone caused the revenue.

## Revenue trend

Analytics shows the last 12 calendar months of:

- predicted Expected Revenue on closed outcomes;
- actual Won Revenue;
- Won count;
- Lost count.

Predicted and actual revenue are visually separated.

## Recommendation feedback analytics

M5 feedback is aggregated into:

- Useful;
- Not Useful;
- Useful rate;
- structured Not-Useful reasons.

Feedback remains linked to the M3 snapshot used when the recommendation was
made.

## Learning readiness

M6 explicitly reports whether the workspace has enough real outcomes for deeper
learning.

It counts:

- closed predictions with usable probabilities;
- signal types with at least one Won result;
- ICPs with at least one Won result;
- Offerings with at least one Won result.

M6 analyses; it does not silently self-modify. A future optimisation milestone
may use this evidence to create a new model version.

## Query architecture

M6 reads the existing authoritative M2–M5 tables rather than copying business
facts into a second competing warehouse.

Migration 012 adds indexes for:

- company cohort time;
- lifecycle stage timestamps;
- closed-outcome aggregation;
- signal-type performance;
- opportunity snapshot lookup;
- recommendation feedback.

This keeps analytics traceable to the same operational records used by the
product.

## M6 exit gate

M6 is complete when the business can see whether RevenueScout recommendations
actually create revenue and can trace the answer through:

Company discovery
→ M3 prediction
→ M4 sales execution
→ Won/Lost ground truth
→ funnel / revenue / signal / ICP / Offering analytics
→ prediction-vs-reality evaluation.

**Exit gate: passed.**
