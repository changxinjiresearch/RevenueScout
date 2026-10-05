# Product Specification Amendment v1.5 — Australian Logistics Source Expansion

Status: **approved by product owner on 2026-10-05**

This amendment expands the independent evidence universe used by Australian
logistics discovery while preserving the rule that source diversity must be
real rather than cosmetically inflated.

## New public source families

For Australian logistics candidates, progressive validation may now use the
following additional public industry sources:

- Freight & Trade Alliance / Australian Peak Shippers Association member
  directories (`ftalliance.com.au`);
- Australian Trucking Association corporate-member content
  (`truck.net.au`);
- Australian Furniture Removers Association directory (`afra.com.au`);
- Australian Logistics Council member directory
  (`austlogistics.com.au`).

These are additional to the existing source families:

- GLEIF;
- Wikidata;
- verified official company websites.

## Evidence-role rules

A directory may only be attached to a candidate when RevenueScout can match the
specific company by a sufficiently specific company name or verified domain.

A company name containing the searched industry term MUST NOT prove its own
industry classification.

Directory roles differ:

- FTA/APSA category membership can directly support relevant logistics/freight
  classification because the directory category itself is specific;
- AFRA directory membership can directly support transport/storage/removals
  classification where those semantics overlap the current market search;
- ATA content only supports industry when the nearby member description contains
  relevant logistics/transport semantics after the company name is removed;
- ALC membership is retained as supply-chain sector evidence, but membership
  alone does not automatically prove that the member is itself a logistics
  operator.

## Source-family independence

Multiple pages from the same organisation count as one independent source
family.

For example, a company appearing in three FTA/APSA category pages still adds
only one `ftalliance.com.au` family to the source count.

## Expected presentation

Source counts should now vary naturally when evidence exists, for example:

- `2 sources · 1 industry`;
- `3 sources · 2 industry`;
- `4 sources · 2 industry`;
- `5 sources · 3 industry`.

RevenueScout MUST NOT manufacture an additional source merely to avoid repeated
counts. A company with only two independently verified sources must continue to
show two.

## Performance

Industry-directory pages should be fetched once per server process and reused
across candidate validation within that process. The directory expansion must
remain part of bounded progressive validation rather than returning to a
single long-running discovery request.
