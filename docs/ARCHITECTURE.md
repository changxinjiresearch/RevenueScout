# RevenueScout Architecture

## 1. Architecture goal

RevenueScout is a revenue-decision system. The architecture must preserve four product properties:

1. explainability;
2. evidence provenance;
3. confidence and freshness;
4. a learning loop from recommendation to real sales outcome.

The system should therefore prefer traceable domain records over opaque generated output.

## 2. Initial application architecture

The MVP begins as a modular Next.js application.

```text
Browser
  |
  v
Next.js application
  |-- UI / server components
  |-- application services
  |-- domain scoring
  |-- repository interfaces
  |
  v
PostgreSQL (next persistence milestone)
  |
  +-- users / organisations
  +-- offerings / ICPs
  +-- companies / contacts
  +-- signals / evidence sources
  +-- opportunities / score snapshots
  +-- lifecycle events / outreach records
  +-- won & lost outcomes
  +-- feedback / suppression
```

External discovery and enrichment sources will connect through adapters rather
than writing directly into core tables.

## 3. Domain boundaries

### Workspace

Users, organisations, roles and permissions.

### Go-to-market configuration

Offerings, ICP definitions, exclusions, signal-to-offering mappings and sales
playbooks.

### Market intelligence

Companies, contacts, observations, sources, freshness, verification state and
buying signals.

### Opportunity intelligence

Opportunity scores, score components, why-this-company, why-now, problem
hypotheses, deal-value estimates, conversion probability, expected revenue,
recommended contact and next-best action.

### Sales execution

Lifecycle stage, owner, contact records, follow-ups, won/lost state and lost
reason.

### Safety and compliance

Suppression, do-not-contact, consent evidence, duplicate outreach prevention
and organisation-level contact limits.

### Learning and analytics

Prediction snapshots, actual outcomes, signal performance, ICP performance,
offering performance, revenue attribution and forecast.

## 4. Explainability rule

A score or recommendation is not a sufficient product output.

Every material judgement must retain enough structured inputs to answer:

- Why did this company qualify?
- Why is now different from six months ago?
- Which evidence created the signal?
- How reliable and fresh is that evidence?
- Why was this offering selected?
- Why was this contact selected?
- How was expected revenue calculated?

## 5. Scoring strategy

The initial scoring engine is deliberately deterministic and transparent.

It combines:

- ICP Fit
- Buying Intent
- Timing
- Deal Potential
- Contactability
- Evidence Confidence

This is an MVP heuristic, not a trained conversion model. It must be replaced
or calibrated only after RevenueScout has sufficient real outcomes.

The learning loop must preserve both the original prediction and eventual
reality rather than overwriting history.

## 6. Data-source rule

External source adapters produce observations. Observations may produce
signals. Signals may affect opportunity assessments.

No external source is allowed to directly assert an unqualified business
conclusion.

Example:

```text
Public reviews mention long waits
        |
        v
Observation
        |
        v
Potential Operational Pain Signal
        |
        v
Hypothesis used in an opportunity assessment
```

It must never silently become:

`Company definitely has an operational problem.`

## 7. Delivery strategy

Development proceeds in vertical slices so that each milestone leaves a
usable product surface instead of a collection of disconnected backend
modules.

The first slice is Today -> Opportunity -> explanation -> expected revenue.

Persistence, accounts and discovery will then replace the demo adapters
without changing the core domain contract.
