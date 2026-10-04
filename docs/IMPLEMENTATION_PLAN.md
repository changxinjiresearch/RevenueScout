# MVP Implementation Plan

This plan maps the frozen product specification into buildable vertical
milestones.

## M0 — Repository and decision-engine foundation

Status: **completed**

- project scaffold
- frozen product specification
- domain types
- transparent Opportunity Score
- Expected Revenue calculation
- Today-page prototype
- unit tests for scoring invariants
- CI
- production deployment

Exit gate: passed.

## M1 — Workspace, Offering and ICP

Status: **completed**

### M1-A — Account and persistence

- PostgreSQL persistence
- registration, login and logout
- secure password hashing and session cookies
- organisation/workspace
- Offering CRUD
- ICP CRUD
- idempotent schema migrations

### M1-B — Guided onboarding

- first-run setup gate
- company profile step
- complete Offering step
- ICP step
- Offering ↔ ICP mapping step
- progress/completeness state
- validation and field guidance
- incomplete configurations route back to onboarding instead of an empty dashboard

### M1-C — Roles and workspace management

- OWNER / ADMIN / MANAGER / REP
- server-side permission checks
- workspace member list
- invitation links with expiry
- invitation acceptance
- member role updates
- member removal
- multiple workspace membership and active-workspace switching

### M1-D — ICP and Offering intelligence

- structured ICP criteria
- executable hard exclusions
- weighted ICP Fit
- match explanation
- Offering ↔ ICP mapping
- deterministic Offering recommendation
- deal-value basis from minimum / average / ideal Offering economics

### M1-E — Configuration-to-decision integration

- Today reads the active workspace configuration
- hard-excluded companies are suppressed before ranking
- ICP Fit is calculated rather than hard-coded
- Recommended Offering is derived from explicit mappings
- Estimated Deal Value is derived from Offering economics
- Why this company cites matched ICP criteria
- recommendation shows the matched ICP and deal-value basis
- organisation configuration is versioned whenever GTM rules change

Exit gate: a real user can define what they sell, define who they want to sell
it to, control who may edit those rules, and see the saved configuration alter
the decision surface in a traceable way.

## M2 — Company, evidence and buying signals

Status: **completed**

- persistent Company record and company database
- manual lead creation
- deduplication by provider identifier, normalised domain, and normalised
  company-name/country
- explicit existing-customer / pipeline / contacted / rejected / unsubscribed
  relationship states
- evidence/source model with source URL, observation date, verification,
  confidence, freshness and retained provenance
- evidence-backed Buying Signal model for Hiring, Expansion, Funding,
  Leadership, Technology, Potential Operational Pain, Growth and Procurement
- per-company Signal Timeline
- live discovery adapter contract
- first real external provider: GLEIF LEI reference data
- traceable discovery runs and import provenance
- company intelligence / enrichment page
- signed-in Today now reads persisted M2 companies, evidence and signals instead
  of synthetic company fixtures
- missing external fields remain explicitly missing; RevenueScout does not
  invent industry, headcount or buying signals
- synthetic fixtures remain only for signed-out demo mode
- RevenueScout Intelligence Engine v1 runs with no paid AI/model API dependency
- zero-cost public-web collector fetches verified company pages and existing public evidence URLs
- deterministic feature extraction identifies industry, workforce clues, service regions, business models, technologies and decision roles
- built-in Buying Signal Detector identifies Hiring, Expansion, Funding, Leadership, Technology, Procurement, Growth and Potential Operational Pain
- RS Conversion Model v1 combines ICP fit, buying intent, timing, need, budget fit and evidence confidence into a reproducible commercial-potential score and conservative pre-contact conversion estimate
- source-grounded observations are persisted as Evidence / Buying Signals
- high-confidence company facts can be auto-filled while uncertain facts remain estimates
- fast-review UI shows commercial potential, conversion likelihood, why-fit, why-now, risks, recommended contact and next action

Exit gate: **passed**. Companies can enter RevenueScout from a real external source or
manual creation, duplicates are controlled, every buying signal points to stored
evidence, and signed-in ranking is driven by persisted company intelligence.

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
