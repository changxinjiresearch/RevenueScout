# Product Specification Amendment v1.2 — Progressive Discovery and Priority

Status: **approved by product owner on 2026-10-05**

This amendment extends the discovery behaviour defined by
`docs/PRODUCT_SPEC_v1.0.md` and
`docs/PRODUCT_SPEC_v1.1_DISCOVERY_AMENDMENT.md`.

## Rationale

Live testing exposed three product problems:

1. exhaustive multi-source discovery could keep one HTTP request open for more
   than two minutes;
2. a legal-name keyword from an identity registry could be counted too strongly
   as independent industry evidence, which caused many results to stop at the
   same two-source threshold;
3. the discovery UI collapsed most valid companies into the same
   `Needs enrichment` state even when some were materially stronger than
   others.

## Progressive discovery

Starting a discovery run MUST return control to the user immediately after the
run is persisted.

Long-running source discovery and evidence validation MUST proceed in bounded,
resumable steps. While the run is active, the UI MUST show:

- current stage;
- semantic variants searched;
- candidate count;
- validation progress;
- count of validated companies already visible.

Validated companies SHOULD appear progressively. The user must not have to wait
for the entire source universe to finish before seeing usable results.

There remains no fixed product-level cap on the final number of validated
companies.

## Evidence-role separation

A source can prove different things.

Legal-entity registries such as GLEIF are authoritative identity evidence, but a
semantic word in a legal name (for example, “Shipping” or “Logistics”) MUST NOT
by itself count as independent industry classification evidence.

Industry corroboration requires at least two independent source families that
actually support the industry claim. A typical valid combination is:

- Wikidata or another independent public knowledge/directory source; and
- a verified official company website describing relevant services.

GLEIF may still be retained as a third source family for identity provenance,
but it is not automatically one of the two industry-supporting families.

Discovery MUST continue retaining additional high-quality evidence when
available rather than stopping simply because the minimum industry threshold has
been met.

## Qualification-state separation

The UI MUST distinguish:

- industry validation;
- ICP qualification;
- missing/unknown qualification fields;
- relative discovery priority.

Unknown fields such as employee count MUST remain unknown. They MUST NOT become
negative evidence.

Suggested qualification states are:

- `QUALIFIED`;
- `PARTIALLY_QUALIFIED`;
- `NOT_QUALIFIED`.

## Relative discovery priority

Validated companies MUST be ranked against the other validated companies in the
same discovery run using evidence quality, source diversity, known ICP matches
and known ICP conflicts.

Priority bands are:

- `HIGH`;
- `MEDIUM`;
- `RESEARCH`.

If a run contains at least one validated company with no known ICP
disqualifier, the run MUST contain at least one `HIGH` priority result.

This is a **relative discovery priority**, not a fabricated claim that the
company has a high absolute conversion probability. Missing fields remain
visible on high-priority results.

Known ICP conflicts MUST prevent a company from being promoted into the high
priority tier.

## Source-count presentation

The UI SHOULD distinguish total retained evidence source families from
industry-supporting source families. For example:

`3 sources · 2 industry`

This avoids implying that every retained source supports every claim.
