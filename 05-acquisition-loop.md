# Acquisition Loop

Filename: `05-acquisition-loop.md`

Answers DAG nodes: N09, N22, N26, N37, N42.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
```

## 1. Purpose

This document defines how Affordance Atlas converts a coverage gap into acquisition work, how it classifies sources, how it extracts and verifies claims, how it handles contradictions, and when human review is required.

It answers:

```text
N09  What is the acquisition loop / research job contract?
N22  What are the source classes?
N26  How do we model contradictory sources?
N37  What is the ingestion/extraction pipeline?
N42  What is the human-in-the-loop boundary?
```

## 2. Acquisition principle

Affordance Atlas does not treat missing coverage as a terminal answer.

When current claims cannot support a safe answer, the system creates acquisition work.

Core loop:

```text
CoverageGap
→ ResearchJob
→ SourceDiscovery
→ EvidenceRetrieval
→ ClaimExtraction
→ ClaimNormalization
→ ClaimVerification
→ ClaimPersistence
→ AnswerComposition
→ Notification
```

The acquisition loop must store what it learns, not merely answer the immediate user.

## 3. ResearchJob contract

A ResearchJob is a durable unit of work created to close one or more CoverageGaps.

Canonical shape:

```yaml
research_job:
  research_job_id: string
  schema_version: string
  created_at: datetime
  updated_at: datetime
  status: enum
  trigger:
    query_id: string
    original_user_query: string
    normalized_query_ref: string
    coverage_gap_ids: string[]
  scope:
    affordance_constraint: object | null
    spatial_constraint: object | null
    temporal_constraint: object | null
    access_constraints: object[]
  objective:
    goal: string
    required_outputs:
      - evidence_items
      - availability_claims
      - answer
    success_criteria: string[]
  plan:
    steps: ResearchStep[]
  outputs:
    evidence_item_ids: string[]
    produced_claim_ids: string[]
    unresolved_gap_ids: string[]
    answer_id: string | null
  audit:
    notes: string[]
    human_review_required: boolean
    human_review_reason: string | null
```

## 4. ResearchJob states

Allowed initial states:

```text
created
planned
discovering_sources
retrieving_evidence
extracting_claims
normalizing_claims
verifying_claims
awaiting_human_review
completed_with_answer
completed_partial
failed
cancelled
```

State meanings:

```text
created                 = job exists but no plan has been made
planned                 = job has ordered research steps
discovering_sources     = finding candidate evidence sources
retrieving_evidence     = fetching or recording evidence items
extracting_claims       = deriving candidate claims from evidence
normalizing_claims      = mapping candidates to ontology and normal form
verifying_claims        = checking evidence, freshness, contradiction, and confidence
awaiting_human_review   = automatic processing is blocked by ambiguity, conflict, or policy
completed_with_answer   = job produced enough claims to answer
completed_partial       = job improved coverage but did not fully answer
failed                  = job could not proceed due to error or inaccessible sources
cancelled               = job was intentionally stopped
```

## 5. ResearchStep contract

```yaml
research_step:
  step_id: string
  step_type: enum
  input: object
  expected_output: string
  status: pending | running | completed | failed | skipped
  evidence_item_ids: string[]
  notes: string[]
```

Allowed initial `step_type` values:

```text
discover_candidate_places
discover_candidate_sources
fetch_source
classify_source
extract_availability_text
extract_candidate_claims
normalize_affordance
normalize_place
normalize_time_scope
extract_access_conditions
detect_exceptions
detect_contradictions
score_confidence
persist_claims
compose_answer
request_human_review
```

## 6. Source classes

A source class describes source authority and expected reliability before item-level evidence is evaluated.

Initial source classes:

```text
official_primary
official_secondary
affiliated
trusted_aggregator
generic_aggregator
user_report
manual_verification
machine_inferred
unknown
```

Meanings:

```text
official_primary
  Source controlled by the place, provider, organization, or authority that directly offers the affordance.

official_secondary
  Source controlled by a parent organization or official network.

affiliated
  Source plausibly connected to the provider but not the direct authority.

trusted_aggregator
  Third-party source with known curation or structured feeds.

generic_aggregator
  Third-party listing with unclear freshness or provenance.

user_report
  User-submitted observation or report.

manual_verification
  Human-confirmed evidence, such as phone call or direct observation.

machine_inferred
  Inference from indirect evidence; not answer-eligible without stronger support.

unknown
  Source authority cannot be determined.
```

## 7. Evidence item classes

Evidence item class describes the concrete artifact retrieved or recorded.

Initial evidence item classes:

```text
webpage
pdf
calendar_feed
calendar_event
structured_api_response
image_or_scan
posted_schedule_photo
phone_note
manual_observation_note
user_submission
search_result_snippet
```

Important invariant:

```text
A search result snippet may support source discovery.
It must not by itself support an active AvailabilityClaim unless policy explicitly allows it.
```

## 8. Source admissibility

A source is admissible for claim creation when it is sufficiently tied to the affordance provider and current enough for the category.

Initial admissibility policy:

```yaml
source_admissibility:
  official_primary: admissible
  official_secondary: admissible_with_context
  affiliated: admissible_with_caveat
  trusted_aggregator: admissible_with_caveat
  generic_aggregator: discovery_only_by_default
  user_report: candidate_only_by_default
  manual_verification: admissible
  machine_inferred: candidate_only
  unknown: discovery_only
```

Admissibility is not enough by itself. The item must still contain specific availability evidence.

## 9. Ingestion/extraction pipeline

The canonical acquisition pipeline:

```text
1. Preserve query and coverage gap
2. Discover candidate places, if needed
3. Discover candidate sources
4. Retrieve evidence items
5. Classify sources and evidence items
6. Extract availability-bearing text or structures
7. Extract candidate claims
8. Normalize affordance, place, time, and access conditions
9. Detect recurrence and exceptions
10. Check freshness
11. Check contradiction
12. Score confidence
13. Persist claims and evidence
14. Compose answer or partial answer
15. Notify user if async
```

Each stage must be auditable.

## 10. Candidate claim extraction

Candidate extraction produces claims that are not yet answer-eligible.

Canonical candidate shape:

```yaml
candidate_claim:
  candidate_claim_id: string
  evidence_item_id: string
  raw_affordance_phrase: string | null
  raw_place_phrase: string | null
  raw_time_phrase: string | null
  raw_access_phrase: string | null
  extracted_text_span: string | null
  extraction_confidence: string
  extraction_notes: string[]
```

Candidate claims become AvailabilityClaims only after normalization and verification.

## 11. Normalization during acquisition

Normalization maps raw extracted material into canonical ontology.

Required normalization outputs:

```text
affordance_ref
place_ref
time_scope
access_conditions
evidence_refs
confidence_assessment
verification_state
```

Normalization must preserve ambiguity.

Examples:

```text
"service" on a church site may not equal Mass.
"open" at a clinic may not equal blood draw availability.
"Sundays 10" requires timezone and AM/PM resolution if not explicit.
```

## 12. Freshness policy

Freshness evaluates whether evidence is recent enough for the affordance category and time scope.

Freshness states:

```text
current
recent
possibly_stale
stale
unknown
```

Freshness inputs:

```text
source publication date
retrieval date
claim last verified date
validity window
recurrence stability
category volatility
known exception risk
```

A fresh retrieval of an old document does not make the claim fresh.

## 13. Contradiction model

Contradiction exists when two or more evidence-backed claims cannot all be true under the same affordance/place/time/access constraints.

Contradiction states:

```text
none
suspected
confirmed
resolved
```

Canonical contradiction record:

```yaml
contradiction_record:
  contradiction_id: string
  affected_claim_ids: string[]
  contradiction_state: none | suspected | confirmed | resolved
  contradiction_type: enum
  stronger_evidence_item_ids: string[]
  weaker_evidence_item_ids: string[]
  resolution: string | null
  human_review_required: boolean
```

Initial contradiction types:

```text
time_conflict
place_conflict
affordance_conflict
access_condition_conflict
validity_conflict
source_authority_conflict
freshness_conflict
exception_conflict
```

## 14. Contradiction resolution policy

The system should prefer evidence using this default ordering:

```text
manual verification for the specific question
official primary current source
official secondary current source
affiliated current source
trusted aggregator current source
older official source
generic aggregator
user report
machine inference
```

But source authority does not automatically win if the evidence is stale or nonspecific.

Resolution factors:

```text
source authority
source freshness
specificity to affordance/place/time
whether source is ordinary schedule or exception schedule
retrieval date
publication date
corroboration
manual verification
```

A confirmed contradiction blocks active use unless a stronger claim resolves it.

## 15. Exception handling

Exceptions are not ordinary contradictions.

Example:

```text
Ordinary schedule: Sundays 10:00
Holiday schedule: Easter Sunday 09:00 and 11:00
```

This should become:

```text
ordinary recurrence + exception rule
```

not:

```text
ordinary recurrence contradicted by holiday schedule
```

The acquisition pipeline must attempt exception detection before contradiction finalization.

## 16. Human-in-the-loop boundary

Human review is required when automatic resolution would create a misleading or unsafe answer.

Human review triggers:

```text
confirmed contradiction without clear stronger source
ambiguous source authority
ambiguous extracted time
ambiguous affordance category
place identity conflict
high-stakes affordance category
phone confirmation needed
source access restriction
image-only source with uncertain extraction
reservation/capacity status critical but unknown
legal/medical/government service uncertainty
```

Human review may produce:

```text
manual_verification evidence item
claim correction
claim rejection
contradiction resolution
coverage gap closure
partial answer with caveat
```

## 17. Research outputs

A completed ResearchJob must produce one of:

```text
answer
partial answer
new active claims but no answer
candidate claims requiring review
explicit unresolved coverage gaps
failure report
```

It must always preserve:

```text
original query
normalized query
coverage gaps addressed
sources checked
evidence retrieved
claims produced or rejected
remaining uncertainty
```

## 18. Persistence requirements

The acquisition loop must persist:

```text
ResearchJob
ResearchStep
EvidenceSource
EvidenceItem
CandidateClaim
AvailabilityClaim
ContradictionRecord
CoverageGap updates
Answer or partial Answer
Notification record, if async
```

Do not persist only the final natural-language answer.

## 19. Async notification semantics

When research completes asynchronously, the user-facing notification should distinguish:

```text
what was known before research
what was learned during research
what remains unknown
which sources support the answer
whether the answer is complete or partial
```

The notification must cite the answer object or produced claims.

## 20. Invariants

```text
No ResearchJob may lose the original query.
No EvidenceItem may be detached from its source class.
No CandidateClaim may be answer-eligible without normalization and verification.
No search snippet may become an active claim by default.
No contradiction may be hidden inside confidence scoring alone.
No exception schedule may be treated as ordinary contradiction before exception modeling.
No stale source may be refreshed merely by refetching it.
No human review requirement may be silently bypassed for speed.
No acquisition result may answer only the current user while discarding reusable claims.
```

## 21. Decision summary

```text
N09 answer:
  The acquisition loop is a durable ResearchJob workflow created from CoverageGaps,
  preserving the original query and producing evidence, normalized claims, answers,
  or unresolved gaps.

N22 answer:
  Source classes distinguish official primary, official secondary, affiliated,
  trusted aggregator, generic aggregator, user report, manual verification,
  machine inferred, and unknown sources, each with default admissibility.

N26 answer:
  Contradictory sources are represented explicitly through contradiction records,
  contradiction states, contradiction types, and resolution policy; contradictions
  block active use unless resolved by stronger evidence.

N37 answer:
  The ingestion/extraction pipeline runs source discovery, evidence retrieval,
  classification, extraction, normalization, exception detection, contradiction
  detection, confidence scoring, persistence, and answer composition.

N42 answer:
  Human review is required when ambiguity, contradiction, high-stakes context,
  source limitations, or critical unknown access conditions would make automatic
  answering misleading or unsafe.
```
