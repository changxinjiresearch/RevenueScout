# M2 Data Provenance and Discovery

## Rule

RevenueScout must preserve the distinction between:

1. externally observed company data;
2. user-entered enrichment;
3. evidence-backed buying signals;
4. hypotheses generated from those signals;
5. model estimates.

No missing field is silently invented.

## Live discovery provider

M2 starts with a provider abstraction rather than binding the product to one
vendor.

The first provider is **GLEIF**, the Global Legal Entity Identifier Foundation
LEI API.

RevenueScout uses it for:

- real legal entity names;
- LEI identifiers;
- registered/legal addresses;
- legal-form / registration metadata where available;
- provider record timestamps;
- traceable source URLs.

GLEIF does **not** provide complete market coverage for Australian SMEs and it
normally does not provide the industry/headcount fields required by many ICPs.
Those fields remain visibly incomplete after import until another source or a
user enriches them.

Therefore GLEIF is an initial legal-entity discovery/verification adapter, not
a claim that M2 already has comprehensive market coverage.

## Discovery run

Each search stores:

- provider;
- query;
- country;
- region;
- selected ICP context;
- selected Offering context;
- returned candidates;
- result count;
- import count;
- success/failure state.

Imported companies retain a link back to the discovery run.

## Deduplication

Before creating a company, RevenueScout checks in this order:

1. exact external identifier such as LEI;
2. normalised domain;
3. normalised company name plus compatible country.

If a duplicate is found, RevenueScout attaches new evidence to the existing
company instead of creating another company row.

## Evidence

Every evidence record stores:

- source type;
- source label;
- URL when available;
- title;
- excerpt / observation;
- observed date;
- captured date;
- confidence;
- verification status;
- stale-after threshold;
- optional provider record ID;
- optional raw provider payload.

Freshness is computed from observed date and stale-after threshold.

## Buying signals

A buying signal cannot exist without an evidence record.

Supported M2 signal types:

- Hiring
- Expansion
- Funding
- Leadership
- Technology
- Operational Pain
- Growth
- Procurement / Tender

Operational Pain is always presented as a **potential pain signal**, never as a
confirmed business problem merely because negative evidence exists.

## Today integration

For signed-in users, Today uses persisted Company, Evidence and Buying Signal
records.

Company qualification uses saved ICP rules. Recent evidence-backed signals
affect timing, buying intent and confidence. Offering recommendation and deal
value continue to come from the M1 Offering ↔ ICP configuration.

Conversion probability remains an early transparent heuristic in M2. Persistent
and outcome-calibrated opportunity estimates belong to M3.
