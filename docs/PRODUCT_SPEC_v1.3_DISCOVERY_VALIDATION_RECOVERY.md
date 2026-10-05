# Product Specification Amendment v1.3 — Discovery Validation Recovery

Status: **approved by product owner on 2026-10-05**

This amendment corrects the live behaviour introduced by v1.2 after a zero-result
failure was observed in production.

## Problem

The v1.2 implementation correctly stopped treating a GLEIF legal-name keyword
as independent industry classification evidence, but then required a candidate
to already have both:

- an industry-supporting source; and
- a known website/domain

before it was allowed into the validation stage.

That prematurely removed most registry-discovered companies before RevenueScout
had a chance to locate and validate their official websites.

## Validation tiers

RevenueScout remains multi-source. A visible company must have at least two
independent source families overall.

Industry evidence is now expressed in tiers:

- `SUPPORTED`: at least one strong industry-supporting source family plus at
  least one separate independent source family that verifies the company
  identity/provenance;
- `CORROBORATED`: at least two independent source families directly support
  the industry classification;
- `CONFIRMED`: at least three independent source families directly support the
  industry classification.

A legal-name keyword in GLEIF is still **not** direct industry evidence.

A verified official company website describing logistics/freight/warehousing
services is strong direct industry evidence. GLEIF can independently verify that
the legal entity exists. This combination is therefore multi-source and may be
shown as `SUPPORTED`, while a Wikidata + official-site combination can reach
`CORROBORATED`.

## Progressive validation

The full deduplicated candidate pool MUST enter progressive validation.
Candidates MUST NOT be discarded merely because their website has not yet been
resolved.

For candidates without a trusted website, progressive validation may attempt a
small bounded number of zero-cost domain candidates. These attempts happen in
small batches so the page remains responsive.

## User-visible progress

The final progress summary MUST remain visible after a run completes, including
when zero companies pass validation. The user should be able to see how many
candidates were discovered and how many were validated instead of seeing a
progress bar disappear without explanation.
