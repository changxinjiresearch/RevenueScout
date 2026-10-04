# Development Governance

## Authority

GitHub is the authoritative location for RevenueScout source code and
versioned product documentation.

The frozen baseline is `docs/PRODUCT_SPEC_v1.0.md`.

## Product-spec changes

Do not silently change or reinterpret a frozen requirement.

A meaningful product change requires:

1. a written rationale;
2. an explicit specification amendment or new version;
3. implementation linked to that change.

Implementation details may evolve without changing the product specification
when they preserve the same user-visible behaviour.

## Branching

- `main`: stable integration branch.
- `feature/*`: product capabilities.
- `fix/*`: bug fixes.
- `chore/*`: tooling, repository and non-product infrastructure.

Substantial changes should arrive through a pull request.

## Definition of done

A capability is not done merely because a screen renders.

Where relevant, it must have:

- typed domain behaviour;
- validation;
- persistence;
- permission checks;
- error handling;
- tests for decision logic;
- evidence/confidence semantics;
- source/freshness semantics;
- user-visible explainability;
- documentation for material assumptions.

## AI and generated intelligence rules

RevenueScout may generate hypotheses and recommendations, but generated text
must not manufacture facts.

The system must distinguish:

- confirmed fact;
- likely inference;
- unverified information;
- hypothesis;
- model estimate.

Evidence should remain linked to the judgement it influenced.

## Scoring governance

Every scoring version must be reproducible.

When score logic changes, historical score snapshots should retain their
version and original components so that Prediction vs Reality remains valid.

## Compliance

RevenueScout is not a bulk-email platform.

Suppression, unsubscribe and do-not-contact state must override ordinary sales
recommendations.

No recommendation engine may bypass a compliance block merely because the
expected revenue is high.
