# Product Specification Amendment v1.1 — Multi-source Semantic Discovery

Status: **approved by product owner on 2026-10-05**

This amendment extends `docs/PRODUCT_SPEC_v1.0.md` section 6 without changing
the rest of the frozen baseline.

## Rationale

The original discovery slice used GLEIF legal-name search and a fixed result
limit. That behaviour is insufficient for RevenueScout's actual product goal:

- a legal-name keyword match does not prove that the company operates in the
  requested industry;
- a single source is not enough for a high-confidence industry classification;
- literal keyword matching misses companies described by related business
  semantics such as freight, warehousing, distribution or 3PL;
- fixed result caps hide valid candidates;
- the same company can be returned by multiple providers and must not appear
  more than once.

## 6.1A Multi-source discovery requirement

Normal user-facing company discovery MUST use more than one independent public
source family.

Single-source adapters may exist internally for identity resolution, diagnostics
and backward compatibility, but a company MUST NOT appear in the normal
validated discovery list solely because one provider returned it.

## 6.1B Semantic industry discovery

The user's market/industry term is a concept, not merely a literal company-name
substring.

RevenueScout MUST:

1. expand supported market terms into materially related business semantics;
2. search those semantic variants across discovery sources;
3. retain which semantic variants matched each company;
4. validate industry relevance from evidence content rather than assuming that a
   name match is an industry classification.

For example, a search for `logistics` may include concepts such as freight,
freight forwarding, warehousing, distribution, supply chain, 3PL, fulfilment,
shipping, courier, haulage, last-mile delivery and trucking.

## 6.1C Cross-source industry validation

A company may enter the validated discovery result set only when the requested
industry is supported by at least **two independent source families**.

Examples of independent source families include:

- GLEIF legal-entity data;
- Wikidata;
- a verified official company website;
- other future public registries, directories or authoritative datasets.

Multiple pages from the same official website count as one source family.
Duplicate or syndicated evidence must not inflate the source count.

The result must retain:

- source family;
- source URL;
- evidence excerpt;
- matched semantic terms;
- confidence;
- observation time;
- provider identifier where available.

## 6.1D No arbitrary result cap

RevenueScout MUST NOT impose a fixed product-level maximum such as 12, 20, 50 or
100 companies on a discovery run.

Provider page sizes are transport details only. Where a provider exposes
pagination, RevenueScout should continue until that provider's matching result
set is exhausted.

The final discovery run retains all unique companies that pass validation.

This requirement does **not** mean RevenueScout claims to enumerate every
company in the real world. Coverage remains bounded by the connected sources and
their public data. If one or more sources fail or are unavailable, the product
must not silently describe a partial result as globally exhaustive.

## 6.1E Discovery-list deduplication

Deduplication occurs before presentation.

Evidence that two records represent the same company includes, in descending
strength:

1. shared authoritative provider identifier;
2. normalized verified domain;
3. normalized legal/company name plus country;
4. high-overlap normalized company names in the same country.

When duplicates are merged, RevenueScout MUST preserve the provenance and
identifiers from every merged source.

A company appears only once in the discovery list.

## 6.1F Import behaviour

Importing a multi-source discovery result MUST preserve all retained source
evidence and all provider identifiers. Importing must not collapse the company
back to a synthetic single-source record.

## Acceptance criteria

A search for `logistics` must demonstrate that:

- the search is expanded to multiple logistics-related semantics;
- more than one independent source family participates in discovery/validation;
- literal legal-name matching alone is insufficient;
- every visible result has at least two independent industry-supporting source
  families;
- duplicates returned by different sources appear once;
- no fixed product-level result count is applied;
- all retained sources and semantic matches remain inspectable after import.
