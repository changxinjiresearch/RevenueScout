# Product Specification Amendment v1.4 — ICP Geography Normalisation and Corroboration

Status: **approved by product owner on 2026-10-05**

This amendment fixes systematic false ICP mismatches observed in live discovery and
improves independent source corroboration.

## Geography normalisation

ICP configuration accepts human-readable geography such as `Australia`,
`Victoria` and `New South Wales`, while external providers may return codes
such as `AU`, `AU-VIC` and `NSW`.

RevenueScout MUST compare canonical geography rather than raw strings.

At minimum:

- Australia / AUS / AU are equivalent;
- Victoria / VIC / AU-VIC are equivalent;
- New South Wales / NSW / AU-NSW are equivalent;
- Queensland / QLD / AU-QLD are equivalent;
- South Australia / SA / AU-SA are equivalent;
- Western Australia / WA / AU-WA are equivalent;
- Tasmania / TAS / AU-TAS are equivalent;
- Northern Territory / NT / AU-NT are equivalent;
- Australian Capital Territory / ACT / AU-ACT are equivalent.

A formatting difference MUST NOT create a hard ICP mismatch.

The Discovery UI MUST expose the exact known conflicting fields whenever a
company is marked `NOT_QUALIFIED`.

## Additional source corroboration

During progressive validation, RevenueScout SHOULD attempt an exact-company
lookup in independent structured sources when a candidate does not already have
that source family.

For Wikidata corroboration:

- company-name similarity must be sufficiently high;
- geography must match;
- industry semantics must occur in the descriptive content, not only in the
  company name;
- evidence provenance and provider identifiers must be retained.

This may raise a candidate from:

`2 sources · 1 industry`

to:

`3 sources · 2 industry`

when the independent source genuinely contains relevant evidence. RevenueScout
MUST NOT fabricate source diversity when an additional independent source is not
available.
