# System Architecture

Filename: `10-system-architecture.md`

Answers DAG nodes: N05, N12, N30, N40.

Depends on:

```text
00-affordance-atlas-kernel.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
05-acquisition-loop.md
07-claim-state-and-confidence.md
08-recurrence-identity-async.md
```

## 1. Purpose

This document defines the first system architecture for Affordance Atlas.

It answers:

```text
N05  What is the architecture of the system?
N12  What is the event log / CQRS shape?
N30  What should be cached vs recomputed?
N40  What are good names for the modules?
```

## 2. Architectural principle

Architecture must preserve the semantic spine:

```text
UserIntent
→ NormalizedQuery
→ ResolutionPlan
→ ClaimMatchSet | CoverageGapSet
→ Answer | ResearchJob
→ Evidence/Claims
→ Async Answer
```

The system is not a chatbot wrapper. It is a claim-resolution and claim-acquisition system.

## 3. Logical modules

Initial module map:

```text
intent-parser
constraint-normalizer
affordance-normalizer
place-resolver
time-resolver
claim-store
coverage-checker
resolver
answer-composer
research-runner
source-discoverer
evidence-fetcher
evidence-classifier
claim-extractor
claim-normalizer
claim-verifier
contradiction-resolver
evidence-ledger
event-log
notification-runner
```

## 4. Synchronous path

```text
User query
→ intent-parser
→ constraint-normalizer
→ resolver
→ claim-store lookup
→ coverage-checker
→ answer-composer
→ Answer
```

The synchronous path must never invent claims.

It may answer only from existing active/verified claims that pass freshness, confidence, verification, contradiction, access, and constraint checks.

## 5. Asynchronous acquisition path

```text
CoverageGapSet
→ research-runner
→ source-discoverer
→ evidence-fetcher
→ evidence-classifier
→ claim-extractor
→ claim-normalizer
→ claim-verifier
→ contradiction-resolver
→ claim-store
→ answer-composer
→ notification-runner
```

The asynchronous path must persist reusable claims and evidence, not only the final answer.

## 6. Core stores

Required stores:

```text
claim_store
place_store
affordance_store
evidence_store
coverage_gap_store
research_job_store
answer_store
event_log
```

Optional later stores:

```text
cache_store
search_index
embedding_index
geo_index
source_registry
```

## 7. CQRS split

Command side mutates state:

```text
CreateResearchJob
RecordEvidenceItem
CreateCandidateClaim
NormalizeClaim
VerifyClaim
ActivateClaim
MarkClaimStale
RetireClaim
RecordContradiction
ResolveContradiction
ComposeAnswer
SendNotification
```

Query side reads projections:

```text
ClaimsByAffordancePlaceTime
PlacesBySpatialConstraint
EvidenceByClaim
ActiveClaimsByPlace
OpenCoverageGapsByQuery
ResearchJobStatus
AnswersByQuery
```

## 8. Event log

The event log is append-only.

Canonical event shape:

```yaml
event:
  event_id: string
  event_type: string
  occurred_at: datetime
  actor: string | null
  correlation_id: string | null
  causation_id: string | null
  entity_refs:
    query_id: string | null
    claim_id: string | null
    evidence_item_id: string | null
    research_job_id: string | null
  payload: object
```

## 9. Initial event types

```text
UserIntentReceived
NormalizedQueryCreated
ResolutionPlanCreated
ClaimMatchSetCreated
CoverageGapCreated
ResearchJobCreated
ResearchStepStarted
ResearchStepCompleted
EvidenceSourceDiscovered
EvidenceItemRetrieved
EvidenceItemClassified
CandidateClaimExtracted
ClaimNormalized
ClaimVerified
ClaimActivated
ClaimMarkedStale
ClaimRetired
ContradictionDetected
ContradictionResolved
AnswerComposed
NotificationQueued
NotificationSent
NotificationFailed
```

## 10. Projection examples

`active_claims_projection`:

```text
claim_id
affordance_id
place_id
time_scope_summary
confidence_state
freshness_state
verification_state
contradiction_state
last_verified_at
```

`query_answer_projection`:

```text
query_id
answer_id
answer_state
answer_mode
generated_at
result_count
coverage_gap_count
```

`research_status_projection`:

```text
research_job_id
status
query_id
open_gap_count
produced_claim_count
last_step
updated_at
```

## 11. Cache vs recompute policy

Cache only derived values that are expensive or useful for interaction.

Recompute when correctness depends on current state.

Cache candidates:

```text
geocoding results
place search results
parsed source documents
normalized query IR
generated occurrences for common windows
claim match sets
rendered answer summaries
source fetch results with retrieval metadata
```

Recompute candidates:

```text
answer eligibility
freshness status when time passes
contradiction status after new evidence
coverage gaps after new claims
ranking after user preference changes
```

## 12. Cache invalidation rules

Invalidate generated answer/match caches when:

```text
claim state changes
freshness state changes
new contradiction is recorded
exception is added
place identity is merged/split
affordance taxonomy changes
source policy changes
```

Do not cache negative answers without positive evidence.

## 13. Module boundaries

```text
intent-parser
  Raw text to UserIntent parse candidates.

constraint-normalizer
  UserIntent to NormalizedQuery.

affordance-normalizer
  Raw whatness phrases to Affordance constraints.

place-resolver
  Spatial constraints to candidate Places or ServiceAreas.

time-resolver
  Relative and recurrence phrases to TemporalConstraint / TimeScope objects.

claim-store
  Durable AvailabilityClaim and claim-version storage.

coverage-checker
  Determines whether matched claims are enough to answer.

resolver
  Orchestrates synchronous resolution.

answer-composer
  Builds Answer objects from match sets, claims, evidence, and gaps.

research-runner
  Orchestrates async acquisition work.

evidence-ledger
  Stores EvidenceSource and EvidenceItem records.

contradiction-resolver
  Detects and resolves claim conflicts.

notification-runner
  Delivers async answer notifications.
```

## 14. Minimal v0 architecture

V0 can be a modular monolith.

Recommended v0 stack shape:

```text
single web/service process
SQLite or Postgres
append-only event_log table
plain background worker for research jobs
manual/LLM-assisted extraction initially
filesystem or object storage for evidence artifacts
```

Do not over-distribute before the state model stabilizes.

## 15. Decision summary

```text
N05 answer:
  The system architecture is a resolver plus acquisition loop over a claim store,
  evidence ledger, coverage-gap store, research-job store, answer store, and event log.

N12 answer:
  CQRS splits command events that mutate claims/evidence/jobs from read projections
  used for answering, research status, and active-claim lookup.

N30 answer:
  Cache parsed/geocoded/generated artifacts, but recompute answer eligibility,
  freshness, contradiction, coverage, and ranking when state changes.

N40 answer:
  Module names should reflect semantic work: intent-parser, constraint-normalizer,
  claim-store, coverage-checker, research-runner, evidence-ledger, claim-verifier,
  contradiction-resolver, answer-composer, notification-runner.
```
