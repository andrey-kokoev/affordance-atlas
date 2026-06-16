# Query, Answer, and Coverage Semantics

Filename: `04-query-answer-coverage.md`

Answers DAG nodes: N18, N27, N28, N10.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
```

## 1. Purpose

This document defines how Affordance Atlas turns user language into a resolvable query, how it composes answers from AvailabilityClaims, how it detects coverage gaps, and when it answers synchronously versus creating asynchronous acquisition work.

It answers:

```text
N18  What is the query IR / DSL for this?
N27  What is the canonical answer object?
N28  What is the exact coverage-gap taxonomy?
N10  How do we decide synchronous answer vs asynchronous research?
```

## 2. Resolution contract

A user request is not executed directly against the claim store.

It passes through this sequence:

```text
UserIntent
→ NormalizedQuery
→ ResolutionPlan
→ ClaimMatchSet | CoverageGapSet
→ Answer | ResearchJob
```

The key invariant:

```text
The system resolves constraints over Affordance × Place × TimeScope.
It does not perform keyword search and call the result an answer.
```

## 3. Query IR overview

The Query IR is the canonical intermediate representation of a user request.

It separates:

```text
raw user phrase
normalized affordance constraint
normalized spatial constraint
normalized temporal constraint
access-condition constraints
resolution context
uncertainty
```

Canonical shape:

```yaml
normalized_query:
  query_id: string
  schema_version: string
  original_user_query: string
  parsed_at: datetime
  locale: string | null
  timezone: string
  constraints:
    affordance: AffordanceConstraint
    spatial: SpatialConstraint
    temporal: TemporalConstraint
    access: AccessConstraint[]
  context:
    user_location: PlaceAnchor | null
    conversation_place: PlaceAnchor | null
    conversation_time_anchor: datetime | null
    prior_constraints: string[]
  uncertainty:
    ambiguities: Ambiguity[]
    inferred_constraints: InferredConstraint[]
    unresolved_slots: string[]
  requested_answer_mode: synchronous | asynchronous_allowed | either
```

## 4. Query IR: affordance constraint

```yaml
affordance:
  kind: exact | category | fuzzy | unspecified
  canonical_label: string | null
  category: string | null
  subtype: string | null
  raw_phrase: string | null
  synonyms_considered: string[]
  confidence: verified | high_confidence | probable | candidate | insufficient
```

Examples:

```yaml
affordance:
  kind: exact
  canonical_label: Catholic Mass
  category: religious_service
  subtype: catholic_mass
  raw_phrase: mass
  synonyms_considered: [Mass, Sunday Mass, Catholic Mass]
  confidence: high_confidence
```

```yaml
affordance:
  kind: fuzzy
  canonical_label: Catholic Mass
  category: religious_service
  subtype: catholic_mass
  raw_phrase: mess
  synonyms_considered: [Mass]
  confidence: probable
```

Rules:

```text
Exact affordance constraints match narrower than category constraints.
Fuzzy constraints must preserve uncertainty.
Unspecified affordance means the user is asking what is available at a place/time.
```

## 5. Query IR: spatial constraint

```yaml
spatial:
  kind: exact_place | near_place | within_radius | within_travel_time | within_jurisdiction | inside_place | service_area_overlap | unspecified
  raw_phrase: string | null
  anchor_place_id: string | null
  anchor_label: string | null
  anchor_address: string | null
  anchor_coordinates: [number, number] | null
  radius_distance: string | null
  max_travel_time: string | null
  travel_mode: string | null
  jurisdiction: string | null
  confidence: verified | high_confidence | probable | candidate | insufficient
```

Rules:

```text
SpatialConstraint is request-side.
Place is claim-side.
A spatial constraint may match zero, one, or many places.
A vague spatial phrase must not be stored as a claim place.
```

## 6. Query IR: temporal constraint

```yaml
temporal:
  kind: exact_instant | interval | date | daypart | recurrence_filter | relative_date | unspecified
  raw_phrase: string | null
  timezone: string
  window_start: datetime | null
  window_end: datetime | null
  recurrence_filter: string | null
  daypart: string | null
  confidence: verified | high_confidence | probable | candidate | insufficient
```

Rules:

```text
Relative temporal phrases must resolve against timezone and date anchor.
TemporalConstraint is request-side.
TimeScope is claim-side.
A query temporal window matches a claim when the claim has an occurrence intersecting the window.
```

Example:

```yaml
temporal:
  kind: relative_date
  raw_phrase: next Sunday
  timezone: America/New_York
  window_start: 2026-06-21T00:00:00-04:00
  window_end: 2026-06-22T00:00:00-04:00
  recurrence_filter: null
  daypart: null
  confidence: verified
```

## 7. Query IR: access constraints

```yaml
access:
  - condition_type: reservation_required | ticket_required | walk_in_allowed | cost | eligibility | capacity | language | accessibility | modality | other
    desired_value: string | boolean | number | null
    required: boolean
    raw_phrase: string | null
```

Examples:

```yaml
access:
  - condition_type: walk_in_allowed
    desired_value: true
    required: true
    raw_phrase: walk in
```

```yaml
access:
  - condition_type: language
    desired_value: Spanish
    required: false
    raw_phrase: Spanish if possible
```

Required access constraints affect eligibility. Optional access constraints affect ranking.

## 8. Query forms

The IR supports these forms:

```text
(A, ?, T)  find places where affordance A is available during T
(?, P, T)  find affordances available at place P during T
(A, P, ?)  find times when affordance A is available at place P
(A, P, T)  determine whether A is available at P during T
(?, ?, T)  find affordances available during T within implied/supplied spatial scope
(A, ?, ?)  find where and when A is available
(?, P, ?)  find generally available affordances at P
```

The resolver must know which slots are constrained, inferred, or unresolved.

## 9. ResolutionPlan

A ResolutionPlan is produced from a NormalizedQuery.

```yaml
resolution_plan:
  query_id: string
  candidate_generation_steps:
    - step_type: affordance_lookup | place_lookup | time_expansion | claim_lookup | evidence_check
      input: string
      output_target: string
  match_requirements:
    affordance_required: boolean
    place_required: boolean
    time_required: boolean
    evidence_required: boolean
    freshness_required: boolean
    confidence_minimum: string
  ranking_policy: constraint_first
```

ResolutionPlan exists so that the system can explain why it answered, researched, or refused to conclude.

## 10. Claim matching semantics

A claim matches a query only if all required constraints are satisfied or explicitly marked unresolved.

Match dimensions:

```text
affordance_match
place_match
time_match
access_match
evidence_match
freshness_match
confidence_match
contradiction_match
```

Canonical shape:

```yaml
claim_match:
  claim_id: string
  match_state: full | partial | rejected
  dimensions:
    affordance_match: exact | category | fuzzy | missing | rejected
    place_match: exact | within_constraint | candidate | missing | rejected
    time_match: exact_instance | recurrence_instance | overlaps | missing | rejected
    access_match: satisfied | optional_missing | required_missing | rejected
    evidence_match: admissible | weak | missing | rejected
    freshness_match: current | recent | possibly_stale | stale | unknown
    confidence_match: sufficient | insufficient
    contradiction_match: none | suspected | confirmed
  generated_occurrences:
    - starts_at: datetime
      ends_at: datetime | null
      timezone: string
      derived_from_time_scope: string
```

A full match is answer-eligible.

A partial match may support an answer with caveat or trigger research.

A rejected match must not appear as availability.

## 11. Canonical answer object

An Answer is a user-facing resolution object composed from claims, generated occurrences, evidence, confidence, and coverage notes.

Canonical shape:

```yaml
answer:
  answer_id: string
  schema_version: string
  query_id: string
  generated_at: datetime
  answer_mode: synchronous | asynchronous
  answer_state: answered | partially_answered | insufficient_coverage | no_supported_availability
  original_user_query: string
  normalized_query_ref: string
  results:
    - result_id: string
      claim_id: string
      affordance_label: string
      place_label: string
      place_address: string | null
      occurrence:
        starts_at: datetime | null
        ends_at: datetime | null
        timezone: string
        recurrence_label: string | null
      access_conditions: AccessCondition[]
      confidence_state: string
      freshness_state: string
      evidence_refs: string[]
      caveats: string[]
  coverage_gaps:
    - coverage_gap_id: string
  answer_summary: string
  next_actions:
    - action_type: research | verify | ask_user | none
      label: string
```

## 12. Answer states

Allowed answer states:

```text
answered
partially_answered
insufficient_coverage
no_supported_availability
```

Meanings:

```text
answered
  The system found enough supported claims to answer the normalized query.

partially_answered
  The system found some supported claims but important constraints or confidence requirements remain unresolved.

insufficient_coverage
  The system cannot determine availability because data is missing, stale, ambiguous, or contradicted.

no_supported_availability
  The system has evidence that the requested affordance is not available under the requested constraints.
```

Critical distinction:

```text
insufficient_coverage ≠ no_supported_availability
```

The system may say no only when evidence supports no.

## 13. CoverageGap taxonomy

A CoverageGap is a structured blocker preventing a full supported answer.

Canonical shape:

```yaml
coverage_gap:
  coverage_gap_id: string
  query_id: string
  gap_type: enum
  severity: blocking | degrading | informational
  affected_constraint: affordance | place | time | access | evidence | freshness | confidence | contradiction | answer
  description: string
  required_to_close: string[]
  suggested_research_actions: string[]
```

Initial `gap_type` values:

```text
affordance_unresolved
affordance_ambiguous
place_unresolved
place_ambiguous
spatial_scope_missing
time_unresolved
time_ambiguous
timezone_missing
no_candidate_places
no_candidate_claims
no_admissible_source
source_unreachable
source_found_no_availability_data
availability_data_stale
availability_data_insufficiently_specific
recurrence_exception_unresolved
access_condition_unresolved
reservation_or_capacity_unknown
evidence_missing
evidence_weak
confidence_insufficient
contradictory_sources
claim_contradicted
answer_requires_research
```

## 14. Gap severity

```text
blocking
  Prevents a supported answer.

degrading
  Allows an answer with caveat but lowers confidence or completeness.

informational
  Does not prevent answer, but should be disclosed or stored.
```

Examples:

```text
timezone_missing for "next Sunday" is blocking.
source publication date unknown may be degrading.
parking information missing may be informational unless requested.
```

## 15. Sync vs async decision policy

The resolver decides between synchronous answer and asynchronous research using coverage, evidence, freshness, confidence, and contradiction checks.

Synchronous answer is allowed when:

```text
normalized query has no blocking ambiguity
candidate claims satisfy required constraints
candidate claims have admissible evidence
freshness is acceptable for the affordance category
confidence state meets threshold
no confirmed contradiction affects the answer
required access conditions are known or safely caveated
```

Asynchronous research is required when:

```text
a required constraint is unresolved
no candidate claims exist
candidate claims exist but evidence is missing
source evidence is stale beyond category threshold
sources contradict each other
exception risk is material and unresolved
required access conditions are unknown
confidence is insufficient
user requested research or verification
```

## 16. Decision function

```text
Resolve(q, K) → Answer | CoverageGapSet + ResearchJob
```

Expanded:

```text
Normalize UserIntent into NormalizedQuery.
Generate ResolutionPlan.
Match claims from claim store K.
Evaluate match dimensions.
If all blocking requirements pass, compose Answer synchronously.
If any blocking requirement fails, create CoverageGapSet.
If gaps are researchable, create ResearchJob.
If gaps require user clarification, request clarification or create a clarification-needed gap.
```

The resolver must not convert a coverage gap into a negative answer.

## 17. Synchronous answer thresholds

Initial threshold policy:

```yaml
sync_thresholds:
  evidence_required: true
  minimum_confidence_state: probable
  allowed_verification_states: [verified, active]
  disallowed_verification_states: [candidate, contradicted, retired]
  stale_claim_policy: caveat_or_research
  contradiction_policy: block_if_confirmed
  recurrence_exception_policy: block_or_caveat_if_material
```

Category-specific thresholds may later override defaults.

Example:

```text
Religious service schedule may tolerate recent official website evidence.
Medical appointment availability may require direct current source or API confirmation.
```

## 18. Negative answer policy

The system may only answer “not available” when there is positive evidence of non-availability.

Examples of evidence supporting negative answer:

```text
official calendar says closed on requested date
official page says no services on Monday
venue-specific schedule excludes requested time and is current
reservation API shows no slots for requested window
manual verification confirms unavailable
```

No candidate claim is not enough.

```text
NoCandidateClaims(A, P, T) ≠ NotAvailable(A, P, T)
```

## 19. Partial answer policy

A partial answer is allowed when at least one useful claim is supported but some non-core information remains unresolved.

Allowed partial-answer cases:

```text
availability known, cost unknown
availability known, accessibility unknown
availability known, source publication date unknown but retrieval is fresh
several places found, but ranking preference unknown
recurrence known, non-material exception risk disclosed
```

Not allowed as partial answer without caveat:

```text
availability time unknown
place identity unresolved
evidence missing
confirmed contradiction unresolved
relative date unresolved
required reservation status unknown when reservation is needed for access
```

## 20. ResearchJob trigger payload

When the resolver creates asynchronous work, it should pass a structured payload:

```yaml
research_job_trigger:
  query_id: string
  original_user_query: string
  normalized_query: NormalizedQuery
  coverage_gaps: CoverageGap[]
  research_goal: string
  required_outputs:
    - evidence_items
    - availability_claims
    - answer
  constraints_to_preserve:
    - affordance
    - spatial
    - temporal
    - access
```

The research job must preserve the original query and normalized constraints.

## 21. Examples

### 21.1 What + when, missing where

User:

```text
I want to attend Mass next Sunday near Clifton Park.
```

Normalized query:

```yaml
constraints:
  affordance:
    kind: exact
    canonical_label: Catholic Mass
    category: religious_service
    subtype: catholic_mass
    raw_phrase: Mass
    confidence: high_confidence
  spatial:
    kind: near_place
    anchor_label: Clifton Park, NY
    confidence: high_confidence
  temporal:
    kind: relative_date
    raw_phrase: next Sunday
    timezone: America/New_York
    window_start: 2026-06-21T00:00:00-04:00
    window_end: 2026-06-22T00:00:00-04:00
    confidence: verified
```

Possible resolution:

```text
If active claims exist for nearby places with Sunday Mass occurrences: synchronous answer.
If no claims exist: coverage gap no_candidate_claims, create research job.
If claims exist but holiday exception applies and unresolved: partial answer or research depending materiality.
```

### 21.2 Where + when, missing what

User:

```text
I will be at this church Monday. What is available there?
```

Normalized query:

```yaml
constraints:
  affordance:
    kind: unspecified
  spatial:
    kind: exact_place
    anchor_place_id: place_resolved_from_context
  temporal:
    kind: date
    raw_phrase: Monday
    timezone: resolved_timezone
```

Possible resolution:

```text
Search claims for all affordances at place during Monday.
Return supported claims grouped by affordance.
If no claims: insufficient coverage, not no availability.
```

## 22. Invariants

```text
A query must preserve raw user language and normalized constraints.
A claim match must record which dimensions passed and failed.
An answer must cite evidence-backed claims.
A coverage gap must be explicit when coverage is insufficient.
A negative answer requires positive evidence of non-availability.
A synchronous answer requires no blocking gap.
An asynchronous research job must preserve the original query.
Ranking cannot repair failed constraint satisfaction.
Unknown cannot be converted to false.
```

## 23. Deferred questions

This document does not define:

```text
full ranking algorithm
full source authority scoring
claim extraction pipeline
research job lifecycle
SQL schema
RDF mapping
notification channel implementation
```

Those depend on this query/answer/coverage contract.

## 24. Decision summary

```text
N18 answer:
  The Query IR is NormalizedQuery: a structured representation of raw user intent,
  affordance constraint, spatial constraint, temporal constraint, access constraints,
  context, and uncertainty.

N27 answer:
  The canonical Answer object is a sourced resolution object containing original query,
  normalized query reference, matched claims, generated occurrences, evidence refs,
  confidence, freshness, caveats, coverage gaps, and next actions.

N28 answer:
  Coverage gaps are typed blockers or degraders over affordance, place, time, access,
  evidence, freshness, confidence, contradiction, or answerability.

N10 answer:
  The system answers synchronously only when normalized constraints, evidence,
  freshness, confidence, access, and contradiction checks pass; otherwise it creates
  explicit coverage gaps and research work when the gaps are researchable.
```
