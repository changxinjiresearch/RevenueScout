# Product Specification Amendment v1.8 — M5 Daily Work Surface, Search, Watchlist and Compliance

Status: **approved and implemented on 2026-10-05**

This amendment completes M5 and changes the daily interaction model from
"manually fill CRM-style forms" to "review automation and confirm only the
events that actually happened."

## Product objective

RevenueScout should be usable as a salesperson's daily work surface.

The default workflow is:

Today
→ inspect the highest-value next action
→ use a one-click sales action where possible
→ open detailed fields only when correction or closure data is needed.

Detailed forms remain available for auditability and exceptions, but are not
the primary interaction.

## Today

Today is the primary daily work queue.

It exposes:

- ranked opportunities;
- Expected Revenue;
- Due Actions;
- Watchlist count;
- Unassigned opportunities;
- research candidates.

The user can filter the queue by:

- All;
- Mine;
- Due;
- Unassigned;
- Watchlist;
- lifecycle stage.

The user can sort by:

- best opportunity;
- Expected Revenue;
- Conversion Probability;
- Opportunity Score;
- Next Action date.

Today supports one-click:

- Assign to me;
- Watch / Stop watching;
- recommendation feedback.

## Low-friction sales actions

The company page exposes a compact Quick Actions area above the full M4 forms.

Where the underlying facts already exist, the user confirms only the event:

- Contacted;
- Followed up;
- Reply received;
- Meeting held;
- Proposal sent;
- Assign to me;
- Add / remove Watchlist;
- Do Not Contact.

RevenueScout automatically carries forward the stored company, primary /
recommended contact, owner, current Offering, lifecycle and timestamp.

Won / Lost remains an explicit advanced action because RevenueScout must not
invent:

- actual contract value;
- actual Offering;
- primary contact;
- Lost Reason.

## Reduced contact entry

A new contact no longer requires a long CRM-style form.

The default Add Contact flow asks only for the useful identity fields such as:

- Name;
- Position;
- Email;
- Phone;
- LinkedIn;
- optional source URL.

Other fields use safe defaults until evidence exists.

Contactability is not edited casually in the contact form. It is changed
through an explicit permission / withdrawal record.

## Search

The workspace search surface is company-centred but searches across:

- company names;
- legal names;
- domains;
- industries;
- subindustries;
- countries / states / cities;
- contacts;
- contact positions and emails;
- lifecycle notes;
- sales activity subjects and summaries;
- matched ICP;
- recommended Offering;
- Why This Company;
- Why Now;
- Problem Hypothesis;
- Next Best Action.

## Filters

Search supports:

- Country;
- State;
- City;
- Industry;
- employee-count range;
- Opportunity Score;
- Signal;
- Expected Revenue;
- Stage;
- Owner;
- Last Contact;
- Last Signal;
- ICP;
- Offering;
- Watchlist.

## Sort

Search supports:

- recently updated;
- Opportunity Score;
- Expected Revenue;
- Conversion Probability;
- Expected Deal Value;
- Latest Signal.

## Watchlist

A user may add a company to the Watchlist when fit is strong but timing is not
yet good enough for active selling.

The Watchlist page shows:

- current Opportunity Score;
- Expected Revenue;
- Conversion Probability;
- lifecycle stage;
- owner;
- latest signal;
- Next Action;
- optional watch reason.

Watchlist is monitoring state, not permission to contact.

## Organisation-wide suppression

Suppression may apply to:

- a company;
- a contact.

Reasons include:

- Do Not Contact;
- Unsubscribed;
- Requested Stop;
- Legal / Policy;
- Duplicate / Conflict;
- Other.

Active suppression is enforced across the workspace.

A company on active suppression is removed from Today sales and research
recommendations even if ICP configuration would otherwise allow it.

Clearing a company suppression restores the lifecycle and relationship state
that existed before suppression instead of erasing sales history.

## Permission records

RevenueScout records contactability separately from contact discovery.

Supported permission records include:

- Contact Permitted;
- Existing Relationship;
- User-confirmed Consent;
- Withdrawn.

A public business address alone is not treated as permission.

A permission record does not silently clear an organisation-wide suppression.
Suppression must be reviewed explicitly.

## Duplicate outreach prevention

Before / around outbound execution RevenueScout checks whether another workspace
member recently contacted the same person.

The workspace policy defines the duplicate-warning window.

The company page surfaces the recent team contact so a salesperson can avoid
parallel outreach.

## Contact-frequency policy

Workspace managers can configure:

- contact window in days;
- maximum outbound touches per contact;
- company window in days;
- maximum outbound touches per company;
- duplicate warning window in hours.

The outbound activity endpoint enforces these limits server-side.

Default policy:

- maximum 2 outbound touches per contact in 7 days;
- maximum 4 outbound touches per company in 14 days;
- duplicate-team warning within 48 hours.

Defaults remain enforced even for a newly-created workspace before a custom
policy row is saved.

## Recommendation feedback

Recommendations support:

- Useful;
- Not useful.

Not-useful reasons include:

- Wrong company;
- Wrong timing;
- Wrong signal;
- Wrong Offering;
- Too small;
- Too large;
- Already contacted;
- Other.

Feedback is persisted against the company and latest M3 snapshot for later
analytics and model improvement.

## M4 form simplification

The full M4 forms remain available under collapsed advanced sections for:

- data correction;
- unusual activity detail;
- Won / Lost closure;
- audit history.

They are no longer the default workflow.

## M5 exit gate

M5 is complete when a salesperson can safely use RevenueScout every day to:

- see what deserves attention;
- search and filter the workspace;
- assign work;
- monitor a Watchlist;
- confirm common sales events with minimal entry;
- enforce Do Not Contact / suppression;
- avoid duplicate and excessive outreach;
- record explicit permission changes;
- give recommendation feedback.

**Exit gate: passed.**
