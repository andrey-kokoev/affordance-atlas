# Recurrence, Identity, and Async Semantics

Filename: `08-recurrence-identity-async.md`

Answers DAG nodes: N08, N13, N35.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
05-acquisition-loop.md
07-claim-state-and-confidence.md
```

## 1. Purpose

This document defines three correctness-critical parts of Affordance Atlas:

```text
N08  How do we model recurrence and exceptions?
N13  What is the identity model?
N35  How does async notification semantics work?
```

These are grouped because recurrence, identity, and async delivery all depend on preserving continuity across time.

A recurring claim must generate date-specific answer occurrences without losing its source assertion.
A claim identity must survive re-ingestion without merging materially different facts.
An async answer must remain tied to the original query even after research changes the claim base.

## 2. Recurrence model

A recurring availability claim has two levels:

```text
Recurring AvailabilityClaim
Generated Occurrence
```

The recurring claim is the durable assertion.

The occurrence is a date-specific projection used for answering a time-bounded query.

Example:

```text
Claim: Available(Catholic Mass, Example Parish, Sundays at 10:00)
Query: next Sunday
Occurrence: 2026-06-21 10:00 America/New_York
```

The answer should cite the recurring claim and show the generated occurrence.

## 3. TimeScope recurrence fields

Canonical recurrence fields:

```yaml
time_scope:
  kind: recurrence
  timezone: America/New_York
  starts_at: null
  ends_at: null
  recurrence_rule: FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0
  recurrence_label: Sundays at 10:00 AM
  exception_rules:
    - holiday schedules may override ordinary Sunday schedule
```

Required semantics:

```text
recurrence_rule   = machine-readable recurrence expression when possible
recurrence_label  = human-readable label for audit and answer display
exception_rules   = known exception rules or material exception risks
```

The system should prefer a machine-readable recurrence rule, but it may retain a label-only recurrence as candidate or partially normalized data.

## 4. Generated occurrence

Generated occurrences are derived answer objects, not stored claims by default.

Canonical shape:

```yaml
generated_occurrence:
  occurrence_id: string
  claim_id: string
  starts_at: datetime
  ends_at: datetime | null
  timezone: string
  derivation:
    source_time_scope_id: string | null
    recurrence_rule: string | null
    exception_applied: boolean
    exception_source_claim_id: string | null
    caveats: string[]
```

Occurrences may be persisted for caching, but claim identity remains attached to the AvailabilityClaim.

## 5. Exception model

An exception is a temporal override or caveat that affects a recurrence.

Exception kinds:

```text
closure
special_schedule
seasonal_schedule
holiday_schedule
one_time_cancellation
one_time_extra_occurrence
time_change
location_change
access_condition_change
unknown_exception_risk
```

Canonical exception shape:

```yaml
recurrence_exception:
  exception_id: string
  affected_claim_id: string
  exception_kind: enum
  applies_to:
    date: date | null
    window_start: datetime | null
    window_end: datetime | null
    recurrence_filter: string | null
  effect:
    suppresses_occurrence: boolean
    adds_occurrence: boolean
    replacement_time_scope: TimeScope | null
    replacement_place_id: string | null
    replacement_access_conditions: AccessCondition[]
  evidence_item_ids: string[]
  confidence_state: high_confidence | probable | candidate | insufficient
```

## 6. Exception vs contradiction

Exceptions are not ordinary contradictions.

Example:

```text
Ordinary source: Sundays at 10:00
Holiday source: Christmas Day Mass at 9:00 and 11:00
```

This should become:

```text
ordinary recurrence + holiday exception
```

not:

```text
ordinary recurrence contradicted by holiday source
```

Contradiction should be considered only after exception modeling is attempted.

Rule:

```text
If two sources differ because one is a narrower exception schedule and the other is an ordinary schedule, model exception first.
```

## 7. Recurrence answer policy

When a query asks for a date window, recurrence must be projected into occurrences.

A recurrence claim answers a query only if:

```text
the generated occurrence intersects the query window
claim validity does not exclude the query date
freshness threshold passes or caveat/research policy allows it
no material exception suppresses or changes the occurrence
```

If exception risk is material and unresolved:

```text
answer_state = partially_answered or insufficient_coverage
coverage_gap = recurrence_exception_unresolved
```

## 8. Identity model overview

Identity must distinguish:

```text
Affordance identity
Place identity
ServiceArea identity
TimeScope identity
AccessCondition identity
EvidenceSource identity
EvidenceItem identity
AvailabilityClaim identity
Occurrence identity
ResearchJob identity
Answer identity
```

Identity is not the same as display name.

Identity must be stable enough for re-ingestion and precise enough to avoid unsafe merges.

## 9. Place identity

Place identity should be resolved from multiple signals:

```text
canonical name
address
coordinates
parent organization
official website
source-specific place IDs
phone number when available
jurisdiction
hierarchy relation
```

Place identity confidence states:

```text
resolved
probable
ambiguous
unresolved
```

Unsafe merge examples:

```text
St. Mary's Church in different towns
parish office vs church building
campus vs chapel
clinic network vs lab site
museum institution vs specific entrance
```

A claim should not become active if place identity is ambiguous and material to the answer.

## 10. Affordance identity

Affordance identity should be resolved from:

```text
canonical label
category
subtype
provider type
ritual/service/action semantics
synonyms
source wording
```

Unsafe merge examples:

```text
Mass vs church service
confession vs parish office hours
museum admission vs guided tour
clinic open hours vs blood draw availability
public meeting vs office hours
```

A claim should not become active if affordance identity is too broad for the user query.

## 11. TimeScope identity

TimeScope identity should distinguish:

```text
one-time instance
ordinary recurrence
seasonal recurrence
holiday recurrence
exception
validity window
```

TimeScope identity dimensions:

```text
kind
timezone
starts_at
ends_at
recurrence_rule
recurrence_label
exception rules
```

Material changes that should create a new claim version or new claim:

```text
Sunday 10:00 becomes Sunday 10:30
ordinary recurrence becomes seasonal recurrence
place changes for the occurrence
access conditions materially change
one-time event replaces recurring schedule
```

Non-material changes that should not create a new identity:

```text
source re-fetched
formatting changed
confidence updated
freshness updated
answer wording changed
```

## 12. AvailabilityClaim identity

AvailabilityClaim identity is based on the normalized assertion, not on the source artifact alone.

Identity dimensions:

```text
affordance_id
place_id
service_area_id when applicable
time_scope identity
material access conditions
evidence lineage
```

Recommended derived key seed:

```text
claim_identity_seed = normalize(
  affordance_id,
  place_id,
  service_area_id,
  time_scope.kind,
  time_scope.timezone,
  time_scope.starts_at,
  time_scope.ends_at,
  time_scope.recurrence_rule,
  material_access_conditions
)
```

Evidence lineage should not by itself split the claim if multiple sources support the same normalized assertion.

Instead:

```text
same assertion + new evidence = same claim with additional evidence
materially different assertion = new claim or claim version
```

## 13. Claim versioning

Claim versioning is needed when the same claim identity changes state or supporting evidence over time.

Versioning should track:

```text
version_id
claim_id
version_number
changed_at
change_reason
previous_values
new_values
evidence_item_ids
```

Versioning events:

```text
evidence_added
confidence_changed
freshness_changed
verification_state_changed
contradiction_state_changed
access_condition_changed
time_scope_changed
place_identity_changed
claim_retired
```

Material assertion changes may create a new claim rather than a new version.

## 14. Evidence identity

EvidenceSource identity identifies the source authority or origin.

EvidenceItem identity identifies a specific retrieved or recorded artifact.

Examples:

```text
EvidenceSource: Example Parish official website
EvidenceItem: retrieved /mass-times page at 2026-06-16T12:00
EvidenceItem: bulletin PDF for week of 2026-06-21
EvidenceItem: phone note from 2026-06-16
```

A new retrieval creates a new EvidenceItem even if it comes from the same EvidenceSource.

## 15. ResearchJob identity

ResearchJob identity is tied to:

```text
original query
normalized query
coverage gaps being addressed
created_at
research scope
```

A ResearchJob must preserve the original query even if later normalization or evidence improves.

Research jobs may produce reusable claims, but they remain historically tied to the query that triggered them.

## 16. Answer identity

Answer identity is tied to:

```text
query_id
answer_mode
generated_at
claim_ids cited
coverage_gap_ids cited
research_job_id when async
```

A later answer to the same query is a new Answer if the claim base, evidence, or state changed materially.

## 17. Async answer semantics

An async answer is not a delayed copy of a synchronous answer.

It is an answer produced after acquisition work changes the system state.

Async answer must distinguish:

```text
known_before_research
learned_during_research
still_unknown
```

Canonical async answer envelope:

```yaml
async_answer:
  answer_id: string
  research_job_id: string
  original_query_id: string
  original_user_query: string
  normalized_query_at_trigger: NormalizedQuery
  generated_at: datetime
  research_summary:
    sources_checked: string[]
    evidence_items_added: string[]
    claims_created: string[]
    claims_updated: string[]
    unresolved_gap_ids: string[]
  answer:
    answer_state: answered | partially_answered | insufficient_coverage | no_supported_availability
    results: []
    caveats: []
  continuity:
    known_before_research: string[]
    learned_during_research: string[]
    still_unknown: string[]
```

## 18. Async continuity rules

An async answer must preserve:

```text
original user query text
normalized query at trigger time
coverage gaps that triggered research
research job scope
sources checked
claims produced or updated
remaining uncertainty
```

It must not silently broaden the user query.

Example:

```text
Original: Mass near Clifton Park next Sunday
Invalid async answer: Here are all church events in Albany this month
Valid async answer: I checked Catholic Mass schedules near Clifton Park for next Sunday...
```

## 19. Async answer states

Allowed async completion states:

```text
completed_with_answer
completed_partial
completed_insufficient_coverage
completed_no_supported_availability
failed
cancelled
```

Meanings:

```text
completed_with_answer
  Research produced enough evidence-backed claims to answer.

completed_partial
  Research improved coverage but left material gaps.

completed_insufficient_coverage
  Research failed to find enough evidence to answer.

completed_no_supported_availability
  Research found positive evidence of non-availability.

failed
  Research could not complete because of source or system failure.

cancelled
  Research was intentionally stopped.
```

## 20. Notification semantics

Notification is delivery metadata, not the answer itself.

Canonical notification shape:

```yaml
notification:
  notification_id: string
  answer_id: string
  research_job_id: string | null
  delivery_channel: in_app | email | webhook | log_only
  delivery_state: pending | sent | failed | suppressed
  created_at: datetime
  sent_at: datetime | null
  summary: string
```

The Answer remains the source of truth.

## 21. Deduplication policy

Deduplication should run at multiple levels:

```text
place deduplication
evidence source deduplication
evidence item deduplication
claim deduplication
occurrence deduplication
answer deduplication
```

Deduplication must prefer false duplicates over false merges.

Rule:

```text
When identity is ambiguous and the merge would affect user actionability, do not merge automatically.
```

## 22. Invariants

```text
A recurrence claim is not the same as a generated occurrence.
An exception is not automatically a contradiction.
ClaimValidity is not TimeScope.
EvidenceSource is not EvidenceItem.
A new retrieval is a new EvidenceItem.
Same normalized assertion plus new evidence usually updates the same claim.
Materially different time/place/access semantics create a new claim or version.
Async answers must preserve the original query and normalized trigger constraints.
Notifications are not answers.
Identity uncertainty must block active use when material to actionability.
```

## 23. Failure modes

```text
recurrence_instance_confusion
  Treating a generated occurrence as a separate unsupported claim.

exception_as_contradiction
  Treating holiday/special schedule as conflict instead of override.

false_place_merge
  Merging similarly named places.

false_claim_merge
  Merging materially different schedules or access conditions.

claim_split_explosion
  Creating new claims for every source retrieval even when the assertion is identical.

async_query_drift
  Research answer no longer corresponds to original user request.

notification_as_answer
  Delivery metadata becomes the only stored result.
```

## 24. Decision summary

```text
N08 answer:
  Recurrence is modeled as a durable TimeScope on an AvailabilityClaim, projected
  into generated occurrences for date-window answers, with explicit exception
  objects that override or caveat recurrence before contradiction is considered.

N13 answer:
  Identity is layered across affordance, place, service area, time scope, evidence,
  claim, occurrence, research job, and answer. AvailabilityClaim identity is based
  on normalized assertion semantics, not source artifact identity alone.

N35 answer:
  Async answers are produced after acquisition work and must preserve the original
  query, normalized trigger constraints, coverage gaps, research scope, new evidence,
  produced claims, and remaining uncertainty. Notification is delivery metadata,
  not the answer itself.
```
