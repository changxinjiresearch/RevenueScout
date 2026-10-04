# RevenueScout Intelligence Engine v1

## Purpose

RevenueScout Intelligence Engine v1 is the default company-analysis path for
RevenueScout. It has no paid AI/model API dependency and does not require a GPU.

The engine turns public company pages and existing evidence into a reproducible
commercial-opportunity assessment.

## Pipeline

1. **Free Web Collector**
   - starts from a verified/stored company website when available
   - can generate a small set of domain candidates from the legal/company name
   - validates the candidate against company-name tokens before accepting it
   - prioritises Home, About, Careers, News, Services, Locations and Contact
   - rejects localhost/private-network targets and validates each redirect hop
   - limits page count and response size

2. **Company Feature Extractor**
   - business summary
   - industry/subindustry
   - explicit employee-scale clues
   - Australian service regions
   - business-model clues
   - technology mentions
   - decision-role mentions

3. **Buying Signal Detector**
   - Hiring
   - Expansion
   - Funding
   - Leadership
   - Technology
   - Procurement / Tender
   - Growth
   - Potential Operational Pain

   Each observation keeps its public URL, excerpt, confidence, strength and
   verification state. Potential Operational Pain remains a hypothesis.

4. **RS Conversion Model v1**
   - Commercial / ICP Fit
   - Buying Intent
   - Timing
   - Need
   - Budget Fit
   - Evidence Confidence
   - Overall Potential Score
   - Estimated Conversion Likelihood

5. **Persistence**
   - source-grounded observations become Company Evidence
   - qualifying observations become Buying Signals
   - high-confidence missing company facts can be auto-filled
   - the full run is saved in `web_enrichment_runs`

## Model behaviour

The model is deterministic: identical inputs produce identical outputs.

Overall Potential Score v1 is:

- Commercial / ICP Fit: 35%
- Buying Intent: 20%
- Timing: 15%
- Need: 15%
- Budget Fit: 10%
- Evidence Confidence: 5%

The conversion likelihood uses a bounded logistic transform over those features.
It is intentionally capped at 35% in v1.

This is a **pre-contact estimate**, not a historically calibrated win
probability. M3/M4 outcome data can later replace the initial coefficients with
a fitted model.

## Epistemic rules

- missing evidence stays missing
- company-name text alone is not proof of industry
- employee count is filled only from explicit public workforce language and
  sufficient confidence
- unverified/undated signals may be retained as evidence but do not drive the
  live conversion model
- stale evidence remains auditable but does not set current company flags
- the human user keeps final Add to Pipeline / Review / Reject authority

## Cost model

There is no per-company model/token charge. The marginal analysis path uses only
the existing RevenueScout server CPU/network resources and publicly accessible
company pages.

External hosting and network infrastructure can still have their normal base
cost; "zero-cost" here means **zero additional paid AI/model/search API usage**.
