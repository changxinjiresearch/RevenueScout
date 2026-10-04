# MVP Implementation Plan

This plan maps the frozen product specification into buildable vertical
milestones.

## M0 — Repository and decision-engine foundation

Status: **in progress**

- project scaffold
- frozen product specification
- domain types
- transparent Opportunity Score
- Expected Revenue calculation
- Today-page prototype
- unit tests for scoring invariants

Exit gate: project builds, core scoring tests pass, and the Today page explains
every recommendation.

## M1 — Workspace, Offering and ICP

- account creation and sign-in
- organisation/workspace
- roles
- onboarding
- Offering CRUD
- ICP CRUD
- inclusion and exclusion rules

Exit gate: a real user can define what they sell and who they want to sell it
to.

## M2 — Company, evidence and buying signals

- Company record
- manual lead creation
- company deduplication
- evidence/source model
- confidence and freshness
- signal model
- initial discovery-adapter contract
- company intelligence page

Exit gate: companies can enter RevenueScout with traceable evidence and
signals.

## M3 — Opportunity intelligence

- persisted score snapshots
- Why this company
- Why now
- Problem Hypothesis
- Recommended Offering
- Estimated Deal Value
- Conversion Probability
- Expected Revenue
- ranking
- user override + audit marker

Exit gate: the product can rank and explain opportunities using persisted data.

## M4 — Contacts and sales lifecycle

- Contact
- Recommended Contact
- contactability/compliance status
- lifecycle stages
- contact records
- owner
- Won/Lost
- Lost Reason
- actual contract value
- prediction-vs-reality snapshot

Exit gate: RevenueScout can follow a recommendation through to a real outcome.

## M5 — Today, search, watchlist and compliance

- production Today page
- filters/search/sort
- watchlist
- suppression list
- Do Not Contact
- duplicate-outreach guard
- feedback

Exit gate: a salesperson can use RevenueScout as a daily work surface safely.

## M6 — Basic analytics

- discovered/contacted/replied/meeting/opportunity/won funnel
- expected vs actual revenue
- signal performance
- ICP performance
- Offering performance
- basic revenue attribution

Exit gate: the business can see whether RevenueScout recommendations actually
create revenue.
