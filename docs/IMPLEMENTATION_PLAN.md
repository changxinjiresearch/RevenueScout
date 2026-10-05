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
- multi-source semantic discovery is the normal user-facing discovery path
- semantic industry expansion (for example logistics → freight / warehousing / distribution / supply chain / 3PL and related concepts)
- GLEIF legal-entity data and Wikidata are independent discovery sources, with verified official company websites used as an additional source family
- no fixed product-level discovery result cap; provider pagination is exhausted
- pre-render deduplication by identifiers, verified domain and normalized company identity
- only companies with at least two independent industry-supporting source families enter the validated discovery list
- all merged provider identifiers and evidence provenance survive import
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
- RevenueScout Intelligence Engine v2 inserts a Claim + Cross-validation layer between Evidence and live Company Facts / Buying Signals
- source independence is estimated by registrable-domain family plus near-duplicate content clustering, so syndicated copies do not inflate confidence
- Claim confidence separates Source Quality, Independence, Agreement, Freshness and Extraction Confidence
- non-authoritative single-source commercial claims cannot silently become high-confidence facts
- mutually exclusive claims can be marked Conflicted instead of averaged away
- RS Conversion Model v2 treats missing decision dimensions as Unknown rather than zero/negative evidence
- Current Potential is separated from Evidence Confidence and a Conservative-to-Upside Potential Range
- Sales Priority answers who is worth contacting now
- Research Priority answers which uncertain company is worth investigating next
- Value of Information ranks the evidence gap most likely to change the decision
- source-grounded observations are persisted as Evidence; only Confirmed/Corroborated commercial claims become live high-weight Buying Signals
- high-confidence company facts can be auto-filled while single-source/conflicted facts stay visible without silently becoming canonical
- fast-review UI shows Potential, Confidence, Potential Range, Sales Priority, Research Priority, VOI, cross-validated claims, why-fit, why-now, risks, recommended contact and next evidence target

Exit gate: **passed**. Companies can enter RevenueScout from a real external source or
manual creation, duplicates are controlled, evidence is grouped into auditable
claims with cross-source validation, and signed-in Today separates sales work
from research work instead of treating sparse public data as negative evidence.

## M3 — Opportunity intelligence

Status: **completed**

- immutable persisted score snapshots keyed by configuration/input state
- historical snapshot view on the company page
- Why this company
- Why now
- explicitly-labelled Problem Hypothesis
- Recommended Offering from explicit ICP links, problem/need fit and deal economics
- Low / Expected / High Estimated Deal Value
- explainable pre-calibration Conversion Probability
- Low / Expected / High probability-adjusted Expected Revenue
- estimated Sales Effort and Revenue Efficiency
- persisted M3 ranking on Today
- human priority / probability / deal-value / Offering / next-action overrides
- append-only audit trail for snapshot creation and override changes
- unknown ICP dimensions remain unknown instead of becoming negative evidence
- canonical geography matching is retained in opportunity qualification

Exit gate: **passed**. Persisted company evidence and GTM configuration produce an explainable, probability-adjusted, ranked revenue opportunity with historical snapshots, human overrides and an audit trail.

## M4 — Contacts and sales lifecycle

Status: **completed**

- persistent Contact records with Name, Position, Email, Phone, LinkedIn, Location, decision relevance, source, confidence and verification
- Recommended Contact resolved from the M3 role target using title fit, decision relevance, contactability and evidence quality
- explicit Why This Person explanation
- contactability / compliance states
- outbound activity allowed only for explicit Contact Permitted, Existing Relationship or User-confirmed Consent states; a public business address alone is not treated as permission
- opportunity owner assignment to workspace members
- complete lifecycle stages: Discovered, Qualified, Ready to Contact, Contacted, Replied, Meeting, Opportunity, Proposal, Won, Lost, Not Fit, Do Not Contact and Suppressed
- structured activity records for Outreach, Follow-up, Reply, Meeting, Proposal and internal Notes
- Follow-up 1 / Follow-up 2 / Final follow-up sequence recording
- activity-driven forward lifecycle advancement without automatic regression
- primary contact, current Offering, next action, next-action date and shared sales notes
- Won requires actual contract value
- Lost requires a structured Lost Reason
- actual Offering, primary contact, closed date and sales-cycle duration captured in outcomes
- latest M3 Opportunity Score, Conversion Probability, Expected Deal Value and Expected Revenue frozen into the outcome record
- Prediction vs Reality card on the company page
- stage / owner / last-contact context shown on Today
- company relationship state synchronised with lifecycle outcomes so existing ICP exclusions continue to work

Exit gate: **passed**. A RevenueScout recommendation can be followed from a named contact and owner through recorded sales activity to Won/Lost ground truth, including actual contract value and prediction-vs-reality history.

## M5 — Today, search, watchlist and compliance

Status: **completed**

- production Today work queue
- Today views: All / Mine / Due / Unassigned / Watchlist
- lifecycle-stage filtering and commercial sorting on Today
- one-click assignment and Watchlist actions
- low-friction company Quick Actions for Contacted, Follow-up, Reply, Meeting and Proposal
- detailed M4 forms moved behind advanced disclosures
- reduced new-contact entry to essential identity fields
- workspace-wide search over Companies, Contacts, opportunity context, Notes, Industries and Locations
- filters for Country, State, City, Industry, Size, Score, Signal, Expected Revenue, Stage, Owner, Last Contact, Last Signal, ICP, Offering and Watchlist
- sort by Opportunity Score, Expected Revenue, Conversion Probability, Deal Value, Latest Signal and recency
- Watchlist page with current score, revenue, probability, stage, owner, latest signal and Next Action
- organisation-wide company/contact Suppression List
- company-level Do Not Contact quick action
- explicit permission / withdrawal records separate from discovered email addresses
- server-side duplicate-outreach detection
- configurable contact-level and company-level contact-frequency limits
- suppressed companies hard-removed from Today sales and research recommendations
- recommendation Useful / Not useful feedback with structured reasons
- suppression preserves/restores the prior lifecycle and relationship state

Exit gate: **passed**. A salesperson can use RevenueScout as a daily work surface with minimal manual entry while search, Watchlist, suppression, duplicate-outreach and contact-frequency controls are enforced server-side.

## M6 — Basic analytics

Status: **completed**

- selectable 30 / 90 / 365-day and all-time analytics windows
- cohort-based Discovered → Qualified → Contacted → Replied → Meeting → Opportunity → Proposal → Won funnel
- step conversion and from-start conversion rates with zero denominators kept unavailable rather than fabricated
- current most valuable opportunities ranked by probability-adjusted Expected Revenue
- current most likely-to-convert opportunities ranked by Conversion Probability
- active-pipeline forecast separated into expected deal value, upside potential and probability-adjusted Expected Revenue
- Expected Revenue vs Actual Won Revenue on closed outcomes
- closed-deal audit preserving the original M3 probability, deal value and Expected Revenue next to the real outcome
- probability evaluation using sample size, predicted-vs-actual win rate, Brier score, absolute probability error and calibration bins
- explicit learning-readiness states; small samples remain pre-calibration and never silently relabel M3 as calibrated
- Buying Signal performance across companies, Contacted, Meetings, Proposals, Won and actual revenue
- ICP performance with origin-snapshot classification preferred where available
- Offering performance with origin-snapshot recommendation preferred where available
- primary-contact role outcome analysis
- structured Lost Reason analytics
- Revenue Attribution coverage and revenue by company acquisition source
- last-12-month predicted-vs-actual revenue trend
- Useful / Not useful recommendation feedback analytics
- learning-readiness counts for probabilities, signals, ICPs and Offerings with Won ground truth
- M6 query indexes over cohort dates, lifecycle timestamps, outcomes, signals, opportunity snapshots and feedback
- Analytics is a first-class production navigation surface

Exit gate: **passed**. The business can see whether RevenueScout recommendations actually create revenue, identify which signals / ICPs / Offerings are associated with outcomes, and measure M3 prediction error against real M4 Won/Lost ground truth without silently rewriting historical predictions.


## Core MVP status

M0 through M6 have passed their exit gates. The core MVP is complete. Further
model optimisation should be driven by accumulated real Won/Lost outcomes and
versioned explicitly rather than silently changing historical predictions.
