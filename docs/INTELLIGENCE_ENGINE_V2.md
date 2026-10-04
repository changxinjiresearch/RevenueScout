# RevenueScout Intelligence Engine v2

## Purpose

Intelligence Engine v2 solves two structural problems in B2B prospect scoring:

1. **Missing data is not negative evidence.**
2. **A commercial claim should not become high confidence merely because one
   page says it.**

The engine therefore separates **Potential** from **Confidence**, validates
claims across independent source families, computes a plausible potential range,
and ranks both sales work and research work.

## Decision pipeline

```
Multiple public sources
        ↓
Evidence
        ↓
Claim extraction
        ↓
Source-family / duplication analysis
        ↓
Cross-source validation
        ↓
Validated facts and buying signals
        ↓
RS Conversion Model v2
        ↓
Potential + Confidence + Range
        ↓
Sales Priority / Research Priority / Value of Information
```

## Claim layer

Supported commercial claim families currently include:

- Industry
- Subindustry
- Employee range
- Service region
- Business model
- Technology use
- Decision role
- Hiring
- Expansion
- Funding
- Leadership
- Technology change
- Procurement / Tender
- Growth
- Potential Operational Pain

Each claim records the evidence that supports or contradicts it.

### Claim states

- **Confirmed** — authoritative evidence or very strong multi-source agreement
- **Corroborated** — at least two independent source families agree
- **Single-source** — only one independent evidence family supports it
- **Conflicted** — independent sources materially disagree
- **Stale** — evidence is too old to drive the live commercial model
- **Unknown** — insufficient evidence exists

A non-authoritative single source is capped and cannot silently become a
high-confidence Company Fact or high-weight Buying Signal.

## Source independence

Raw URL count is not treated as source independence.

RevenueScout groups evidence using:

- registrable domain / source family
- content similarity
- duplicate / syndicated wording

Pages from the same source family do not repeatedly increase confidence.
Near-duplicate syndicated articles on different domains are also treated as one
information family where detected.

## Claim-specific source quality

Source reliability depends on the claim being evaluated.

Examples:

- Registry / GLEIF: strong for legal identity and registration facts
- Official company site: strong for what the company says it does
- Careers / job boards: strong for active hiring
- Government tender portals: authoritative for procurement activity
- Reputable news: useful for funding, expansion and leadership changes
- Operational-pain language: remains a hypothesis unless directly supported

## Confidence

Claim confidence is a deterministic function of:

```
Source Quality
× Source Independence
× Agreement
× Freshness
× Extraction Confidence
```

The components are retained separately for auditability.

## Unknown is not negative

RS Conversion Model v2 no longer converts an unknown field into a zero.

If Hiring, Expansion or Budget Fit is unknown, the dimension is omitted from the
current potential estimate rather than treated as a failed criterion.

The model separately reports:

- **Current Potential**
- **Evidence Confidence**
- **Conservative Potential**
- **Upside Potential**

This allows a company to be:

- high potential / high confidence
- high potential / low confidence
- low potential / high confidence
- genuinely unknown

without collapsing all four cases into a single medium score.

## Priority models

### Sales Priority

Sales Priority combines commercial potential with evidence confidence. It
answers:

> Which company is most worth sales time now?

### Research Priority

Research Priority combines:

- current potential
- plausible upside
- uncertainty
- Value of Information

It answers:

> Which uncertain company is most worth researching next?

### Value of Information

VOI is higher when obtaining one more fact could materially change the decision.

RevenueScout also returns concrete evidence targets such as:

- current buying signals
- employee size / budget proxy
- unresolved industry conflict
- a single-source claim needing independent corroboration

## Today

Today now has two decision queues:

1. **Sales Priority** — companies ready for sales attention
2. **Research Priority** — companies whose uncertainty is worth resolving

This prevents promising but under-documented private companies from being
discarded simply because public information is sparse.

## Persistence

v2 persists:

- source metadata and source family
- independence keys
- source quality
- extraction confidence
- Company Claims
- Claim ↔ Evidence relationships
- support / contradiction stance
- claim status and confidence components
- Potential / Confidence / Conservative / Upside
- Sales Priority
- Research Priority
- Value of Information
- recommended priority action

Only Confirmed / Corroborated commercial claims can automatically become live
high-weight Buying Signals or fill key Company facts.

## Cost

The default v2 path uses no paid AI/model/search API.

It runs on the existing RevenueScout application infrastructure using public
web pages and persisted public evidence. Hosting/network resources still have
their normal base cost; v2 introduces no per-company token/model API charge.
