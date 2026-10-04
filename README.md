# RevenueScout

**B2B customer discovery, buying-signal intelligence, and revenue opportunity optimisation.**

RevenueScout is not intended to be a traditional CRM or a bulk lead database. Its job is to help a small sales team decide where limited sales time is most likely to create revenue.

## Product baseline

The frozen product specification is stored at:

- `docs/PRODUCT_SPEC_v1.0.md`

All implementation decisions must remain traceable to that document unless a later version explicitly supersedes it.

## Current development status

The repository is in the initial scaffold phase.

The first vertical slice implements the core decision surface:

- Today's Best Opportunities
- Opportunity Score
- score decomposition
- Why this company
- Why now
- recommended offering
- estimated deal value
- conversion probability
- expected revenue
- recommended contact
- next best action

The data shown in the initial UI is demo data. It exists to validate the domain model and product interaction before persistence and external data-source integrations are added.

## Stack

- Next.js 16
- React 19
- TypeScript
- Vitest
- PostgreSQL planned for persistence

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
- RevenueScout must not become a bulk-email spam tool.
- Changes to the frozen product scope require a versioned product-spec update.

See `docs/DEVELOPMENT_GOVERNANCE.md` and `docs/ARCHITECTURE.md`.
