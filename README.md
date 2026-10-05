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

All implementation decisions must remain traceable to those documents unless a later version explicitly supersedes them.

## Current development status

M0, M1 and M2 are complete. M3 (Opportunity Intelligence) is the next formal milestone.

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
