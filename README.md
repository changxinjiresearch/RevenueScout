# RevenueScout

**B2B customer discovery, buying-signal intelligence, and revenue opportunity optimisation.**

RevenueScout is not intended to be a traditional CRM or a bulk lead database. Its job is to help a small sales team decide where limited sales time is most likely to create revenue.

## Product baseline

The frozen product specification and approved discovery amendment are stored at:

- `docs/PRODUCT_SPEC_v1.0.md`
- `docs/PRODUCT_SPEC_v1.1_DISCOVERY_AMENDMENT.md`
- `docs/PRODUCT_SPEC_v1.2_PROGRESSIVE_DISCOVERY.md`
- `docs/PRODUCT_SPEC_v1.3_DISCOVERY_VALIDATION_RECOVERY.md`
- `docs/PRODUCT_SPEC_v1.4_ICP_GEOGRAPHY_AND_CORROBORATION.md`
- `docs/PRODUCT_SPEC_v1.5_AU_LOGISTICS_SOURCE_EXPANSION.md`
- `docs/PRODUCT_SPEC_v1.6_M3_OPPORTUNITY_INTELLIGENCE.md`
- `docs/PRODUCT_SPEC_v1.7_M4_CONTACTS_SALES_LIFECYCLE.md`
- `docs/PRODUCT_SPEC_v1.8_M5_DAILY_WORK_SURFACE.md`
- `docs/PRODUCT_SPEC_v1.9_M6_BASIC_ANALYTICS.md`

All implementation decisions must remain traceable to those documents unless a later version explicitly supersedes them.

## Current development status

M0, M1, M2, M3, M4, M5 and M6 are complete. The core MVP milestone set is complete; later optimisation work should be driven by real user and Won/Lost data rather than by expanding scope by default.

The current application includes:

- account, workspace, role and permission management
- Offering and ICP configuration with executable qualification rules
- persistent companies, evidence and buying signals
- progressive multi-source semantic company discovery
- no fixed product-level discovery result cap
- bounded/resumable discovery steps with results appearing progressively
- pre-render company deduplication across provider identifiers, domains and normalized company identities
- multi-source validation with Supported / Corroborated / Confirmed industry-evidence tiers
- identity evidence (for example GLEIF) kept separate from direct industry-classification evidence
- relative High / Medium / Research discovery priority with unknown fields kept non-negative
- canonical ICP geography matching (for example Australia ↔ AU, VIC ↔ AU-VIC)
- exact-company structured-source corroboration where independent evidence exists
- Australian logistics association-directory corroboration across FTA/APSA, ATA, AFRA and ALC with source-role rules that prevent membership/name matches from overclaiming industry proof
- GLEIF and Wikidata discovery inputs plus verified official-company-site evidence
- RevenueScout Intelligence Engine v2
- Claim cross-validation and source-independence analysis
- Current Potential, Evidence Confidence and Conservative/Upside Potential Range
- Sales Priority, Research Priority and Value of Information
- persisted, explainable company-research results and a production Today surface
- immutable M3 opportunity score snapshots with configuration/input provenance
- Why This Company, Why Now and explicitly-labelled Problem Hypothesis
- deterministic Recommended Offering selection using ICP mapping, problem fit and deal economics
- Low / Expected / High deal-value ranges
- explainable pre-calibration conversion probability
- probability-adjusted Expected Revenue and expected-revenue range
- sales-effort and revenue-efficiency estimates
- M3 ranking on Today
- human priority / probability / deal-value / Offering / next-action overrides
- append-only opportunity decision audit trail and snapshot history
- persistent multi-contact company records with provenance and confidence
- deterministic Recommended Contact selection with a visible "Why this person?" rationale
- contactability / compliance status with outbound activity allowed only for explicit Contact Permitted, Existing Relationship or User-confirmed Consent states
- opportunity ownership across workspace members
- complete Discovered → Qualified → Contacted → Replied → Meeting → Opportunity → Proposal → Won/Lost lifecycle
- structured outreach, follow-up, reply, meeting, proposal and note activity records
- lifecycle timestamps, primary contact, current Offering and next-action scheduling
- Won outcomes with actual contract value and sales-cycle duration
- structured Lost Reasons
- M3 prediction-vs-reality ground-truth snapshots for future calibration
- M4 stage / owner / last-contact context on Today
- M5 Today views for Mine, Due, Unassigned, Watchlist and lifecycle stage
- Today sorting by opportunity, Expected Revenue, probability, score and next-action date
- one-click Assign to me and Watch actions from Today
- company-page quick actions for Contacted, Follow-up, Reply, Meeting and Proposal
- long M4 data-entry forms moved behind advanced disclosures instead of being the default workflow
- reduced new-contact entry to essential identity fields
- workspace search across companies, contacts, opportunity explanations, notes, industries and locations
- filters for geography, industry, size, score, signal, Expected Revenue, stage, owner, Last Contact, Last Signal, ICP, Offering and Watchlist
- Watchlist work surface with latest signal and next action
- organisation-wide company/contact suppression
- explicit contact permission and withdrawal records
- server-side contact/company outreach-frequency limits
- duplicate team-outreach warnings
- hard suppression from Today and research queues
- persisted Useful / Not useful recommendation feedback
- M6 Analytics page with 30 / 90 / 365-day and all-time analysis windows
- discovered → qualified → contacted → replied → meeting → opportunity → proposal → Won funnel with cohort and step conversion rates
- current highest-Expected-Revenue and highest-conversion-probability opportunity rankings
- live open-pipeline deal value, upside potential and probability-adjusted Expected Revenue forecast
- closed Prediction vs Reality analysis using the original M3 snapshot captured before the outcome
- probability evaluation with actual win rate, mean predicted probability, Brier score and calibration bins without falsely declaring a small sample calibrated
- Signal Performance across companies, contacts, meetings, proposals, wins and actual revenue
- ICP Performance using origin-prediction classifications where available
- Offering Performance using origin-prediction recommendations where available
- primary-contact role outcome analysis
- structured Lost Reason analytics
- Revenue Attribution and source-origin breakdown
- last-12-month predicted-vs-actual revenue trend
- recommendation feedback analytics
- learning-readiness indicators showing when enough ground truth exists for a later versioned optimisation model

The default Intelligence Engine path does not require a paid AI/model/search API.

## Stack

- Next.js 16
- React 19
- TypeScript
- Vitest
- PostgreSQL

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Run checks:

```bash
npm run typecheck
npm test
npm run build
```

## Repository rules

- GitHub is the authoritative source for code and product documentation.
- Product behaviour must remain explainable.
- Low-confidence information must never be presented as confirmed fact.
- Missing information must not silently become negative evidence.
- RevenueScout must not become a bulk-email spam tool.
- Changes to the frozen product scope require a versioned product-spec update.

See `docs/DEVELOPMENT_GOVERNANCE.md` and `docs/ARCHITECTURE.md`.
