# Product Specification Amendment v1.7 — M4 Contacts and Sales Lifecycle

Status: **approved and implemented on 2026-10-05**

This amendment completes M4 by connecting RevenueScout's M3 recommendation to
named people, recorded sales activity and an actual commercial outcome.

## Contact model

Each company may have multiple contacts.

A contact stores:

- Name;
- Position;
- Email;
- Phone;
- LinkedIn;
- Location;
- Decision relevance;
- Contact status;
- Contactability / compliance status;
- Source URL and label;
- Verification status;
- Confidence;
- Notes.

Decision relevance includes:

- Primary decision maker;
- Decision maker;
- Influencer;
- Champion;
- Procurement;
- Technical;
- Gatekeeper;
- Unknown.

## Contactability

A contact has an explicit contactability state:

- Contact permitted;
- Existing relationship;
- User-confirmed consent;
- Public business contact;
- Uncertain;
- Do not contact;
- Unsubscribed.

RevenueScout MUST NOT treat the existence of an email address as permission to
contact.

At M4, outbound activity recording is allowed only for:

- Contact permitted;
- Existing relationship;
- User-confirmed consent.

A public business address is retained as provenance but is not, by itself,
treated as permission to contact. All other contactability states are blocked
for outbound activity recording.

Organisation-wide suppression and duplicate-outreach policy remain M5 scope.

## Recommended Contact

M4 resolves the role suggested by M3 against stored contacts.

The recommendation uses:

- title / role alignment;
- decision relevance;
- contactability;
- verification;
- contact confidence.

The UI must answer:

> Why this person?

If no usable named contact exists, RevenueScout keeps the M3 role target and
explicitly instructs the user to find a verified person in that role.

## Opportunity ownership

Each company lifecycle may have one current owner.

Any workspace member may own an opportunity. A REP may assign the opportunity
to themself; assigning another member requires manager-level GTM permission.

The owner is visible on the company page and Today.

## Sales activity

Every real interaction may be recorded with:

- Contact;
- Activity type;
- Channel;
- Direction;
- Subject;
- Factual summary;
- Activity status;
- Follow-up sequence;
- Next-action date;
- Actor;
- Timestamp.

Supported activity types are:

- Outreach;
- Follow-up;
- Reply;
- Meeting;
- Proposal;
- Internal Note.

A named contact is required for outbound activity.

## Lifecycle

The supported lead lifecycle is:

- Discovered;
- Qualified;
- Ready to Contact;
- Contacted;
- Replied;
- Meeting;
- Opportunity;
- Proposal;
- Won;
- Lost;
- Not Fit;
- Do Not Contact;
- Suppressed.

Recorded activity may advance the lifecycle automatically, but MUST NOT move a
company backwards or reopen a closed Won/Lost state automatically.

Manual stage changes remain available and are recorded as internal stage-change
activities.

The lifecycle also stores:

- Owner;
- Primary contact;
- Current Offering;
- Next action;
- Next-action date;
- Shared sales notes;
- First / last contact timestamps;
- Stage timestamps.

Existing company relationship state is synchronised so M1/M2 exclusions continue
to work with M4 outcomes.

## Follow-up recording

Follow-ups may be recorded as:

- Follow-up 1;
- Follow-up 2;
- Final follow-up.

M4 records the sequence and next-action date. Automated contact-frequency and
suppression enforcement beyond contact-level blocking remains M5 scope.

## Won / Lost ground truth

A Won outcome requires:

- Actual contract value.

A Lost outcome requires:

- Lost reason.

Supported Lost Reasons are:

- No budget;
- No need;
- Timing;
- Competitor;
- Price;
- Wrong contact;
- Company too small;
- Existing supplier;
- No response;
- Internal solution;
- Other.

The outcome may also retain:

- Actual Offering;
- Primary contact;
- Lost-reason note;
- First-contact date;
- Closed date;
- Sales-cycle days;
- Original company source;
- Key buying-signal IDs.

## Prediction vs Reality

When a company first enters the sales lifecycle, RevenueScout stores the
current M3 opportunity snapshot as the **origin prediction**. When the company
later closes Won or Lost, the outcome record uses that origin snapshot (falling
back to the current M3 snapshot only when no origin snapshot was available):

- Original Opportunity Score;
- Original Conversion Probability;
- Original Expected Deal Value;
- Original Expected Revenue;
- M3 Opportunity Snapshot ID.

For Won deals it records the actual contract value.

The company page displays:

> Originally predicted

versus

> Actual

including deal-value delta and sales cycle where available.

These records are the ground-truth dataset required for later M6 calibration and
analytics.

## Today integration

Active opportunities expose:

- Lifecycle stage;
- Owner;
- Last contact.

Closed companies continue to flow through the existing company relationship /
ICP exclusion rules so Won customers and rejected/lost leads do not remain
indistinguishable from untouched prospects.

## M4 exit gate

M4 is complete when a RevenueScout recommendation can be followed through:

M3 recommendation
→ named contact
→ owner
→ outreach / reply / meeting / proposal activity
→ lifecycle progression
→ Won or Lost
→ actual outcome
→ prediction-vs-reality record.

This exit gate is passed.
