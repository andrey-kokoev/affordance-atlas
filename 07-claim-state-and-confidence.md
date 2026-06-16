# Claim State and Confidence

Filename: `07-claim-state-and-confidence.md`

Answers DAG nodes: N19, N20, N21, N29.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
05-acquisition-loop.md
```

## 1. Purpose

This document defines the state model around AvailabilityClaims.

It answers:

```text
N19  What are the invariants?
N20  What is the lifecycle/state machine of an AvailabilityClaim?
N21  How should confidence be computed?
N29  What are the failure modes / silent degradations?
```

The goal is to prevent state collapse.

In particular, the system must not hide freshness, verification, contradiction, or evidence weakness inside a single vague confidence score.

## 2. State separation

An AvailabilityClaim carries four distinct state concepts:

```text
ConfidenceAssessment
FreshnessState
VerificationState
ContradictionState
```

They answer different questions:

```text
ConfidenceAssessment  = How safe is this claim to use as support for an answer?
FreshnessState        = Is the evidence current enough for this affordance category?
VerificationState     = Where is the claim in its lifecycle?
ContradictionState    = Does this claim conflict with other evidence-backed claims?
```

These states may influence each other, but they must remain separately visible.

Bad:

```text
confidence = 0.62
```

Good:

```yaml
assessments:
  confidence:
    state: probable
    basis:
      - official source
      - specific recurrence
      - no contradiction known
  freshness_state: recent
  verification_state: active
  contradiction_state: none
```

## 3. AvailabilityClaim lifecycle

Lifecycle state is represented by `VerificationState`.

Allowed states:

```text
candidate
extracted
normalized
verified
active
stale
retired
```

Meanings:

```text
candidate
  Possible claim or hypothesis. Not answer-eligible.

extracted
  Claim-like content has been extracted from evidence but not mapped to canonical ontology.

normalized
  Extracted content has been mapped to Affordance, Place, TimeScope, AccessCondition, and EvidenceItem.

verified
  Normalized claim has passed source, extraction, freshness, and consistency checks.

active
  Claim is eligible for answer composition if confidence, freshness, and contradiction checks also pass.

stale
  Claim is retained but no longer fresh enough for ordinary answer use without caveat or research.

retired
  Claim should not be used for answer composition except as audit/history.
```

`contradicted` is not a lifecycle state. It is represented by ContradictionState.

## 4. Lifecycle transitions

Canonical transition path:

```text
candidate
→ extracted
→ normalized
→ verified
→ active
```

Demotion paths:

```text
active → stale
verified → stale
active → retired
stale → retired
```

Reactivation paths:

```text
stale → verified → active
retired → candidate
```

Reactivation from retired should usually create a new claim or new claim version unless identity rules prove it is the same assertion.

## 5. Transition requirements

### 5.1 candidate → extracted

Requires:

```text
evidence item exists
availability-bearing text or structure was found
raw affordance/place/time/access phrases were captured when available
```

### 5.2 extracted → normalized

Requires:

```text
affordance normalized or explicitly unresolved
place normalized or explicitly unresolved
time scope normalized or explicitly unresolved
supporting evidence linked
uncertainty retained
```

### 5.3 normalized → verified

Requires:

```text
evidence source admissibility checked
source/item class assigned
freshness assessed
contradiction check completed
confidence assessed
claim validity assessed
```

### 5.4 verified → active

Requires:

```text
confidence state is high_confidence or probable
freshness state is current or recent, unless category policy permits caveated use
contradiction state is none or resolved
required access conditions are known or safely caveated
```

### 5.5 active → stale

Triggered by:

```text
freshness threshold exceeded
valid_through passed
source becomes unreachable and no recent verification exists
category-specific recheck interval exceeded
```

### 5.6 active/verified → retired

Triggered by:

```text
source confirms schedule ended
place permanently closed
affordance discontinued
claim superseded by materially different claim
manual retirement
```

## 6. FreshnessState

Allowed states:

```text
current
recent
possibly_stale
stale
unknown
```

Meanings:

```text
current
  Evidence is current for the affordance category and time scope.

recent
  Evidence is not brand-new but still acceptable for the category.

possibly_stale
  Evidence may be outdated; answer may require caveat or research.

stale
  Evidence is too old or invalid for ordinary answer use.

unknown
  Freshness cannot be determined.
```

Freshness is category-dependent.

Examples:

```text
Weekly religious-service schedule may tolerate recent official web evidence.
Medical appointment slots require direct current evidence.
Holiday schedules require date-specific evidence.
```

A fresh retrieval of an old document does not make the evidence current.

## 7. ContradictionState

Allowed states:

```text
none
suspected
confirmed
resolved
```

Meanings:

```text
none
  No known conflict with other evidence-backed claims.

suspected
  Potential conflict exists but may be an exception, stale source, or extraction ambiguity.

confirmed
  Claims cannot all be true under the same affordance/place/time/access constraints.

resolved
  Conflict has been resolved by stronger evidence, exception modeling, or human review.
```

A confirmed contradiction blocks active answer use.

A suspected contradiction may allow a caveated answer only if the suspected conflict is non-material for the user’s query.

## 8. ConfidenceAssessment

Allowed states:

```text
high_confidence
probable
candidate
insufficient
```

Meanings:

```text
high_confidence
  Strong evidence, specific extraction, acceptable freshness, no unresolved material contradiction.

probable
  Good enough to use with normal caveats; some minor uncertainty may remain.

candidate
  Plausible but not answer-eligible without more evidence, verification, or normalization.

insufficient
  Not safe to use as answer support.
```

Confidence is an assessment, not a hidden replacement for source, freshness, verification, or contradiction state.

## 9. Confidence inputs

Confidence should be computed from explicit factors:

```text
source_class
item_class
authority_level
freshness_state
extraction_certainty
affordance_specificity
place_specificity
time_specificity
access_condition_specificity
corroboration_count
contradiction_state
exception_risk
verification_history
human_review_result
```

Initial factor interpretation:

```text
official_primary source raises confidence
manual_verification raises confidence
specific affordance/place/time raises confidence
recent/current freshness raises confidence
corroboration raises confidence
suspected contradiction lowers confidence
confirmed contradiction makes confidence insufficient for active use
unknown time or place specificity makes confidence insufficient for exact answers
```

## 10. Confidence scoring model

V0 may use ordinal scoring rather than numeric scoring.

Recommended V0 rule set:

```yaml
confidence_policy_v0:
  high_confidence:
    all:
      - source_class in [official_primary, manual_verification]
      - freshness_state in [current, recent]
      - affordance_specificity in [specific]
      - place_specificity in [specific]
      - time_specificity in [specific]
      - contradiction_state in [none, resolved]
  probable:
    all:
      - source_class in [official_primary, official_secondary, affiliated, trusted_aggregator, manual_verification]
      - freshness_state in [current, recent, possibly_stale]
      - affordance_specificity in [specific, category_specific]
      - place_specificity in [specific]
      - time_specificity in [specific, recurrence_specific]
      - contradiction_state in [none, resolved]
  candidate:
    any:
      - source_class in [generic_aggregator, user_report, machine_inferred, unknown]
      - extraction_certainty = low
      - place_specificity = ambiguous
      - time_specificity = ambiguous
  insufficient:
    any:
      - evidence missing
      - contradiction_state = confirmed
      - required place unresolved
      - required time unresolved
      - required affordance unresolved
      - freshness_state = stale for freshness-sensitive query
```

Numeric scores may be added later, but ordinal states are required for explainability.

## 11. Answer eligibility

A claim is answer-eligible when:

```text
verification_state in [verified, active]
confidence.state in [high_confidence, probable]
freshness_state in [current, recent]
contradiction_state in [none, resolved]
evidence exists
required access conditions are known or caveated
```

A claim is not answer-eligible when:

```text
verification_state in [candidate, extracted, normalized, retired]
confidence.state in [candidate, insufficient]
freshness_state = stale
contradiction_state = confirmed
evidence missing
```

A claim with `freshness_state = possibly_stale` may support a partial answer only with explicit caveat or may trigger research depending on category policy.

## 12. Invariants

Core invariants:

```text
Every user-facing availability claim must cite evidence.
Unknown is not false.
No known availability is not non-availability.
A stale claim must not appear fresh.
A confirmed contradiction must not appear active.
A candidate claim must not appear verified.
Confidence must not hide freshness.
Confidence must not hide contradiction.
Confidence must not hide lifecycle state.
A search snippet must not become active evidence by default.
A recurrence must not be treated as complete without exception awareness.
A query-normalization confidence is not claim confidence.
Claim validity is not availability time.
A service area is not a physical realization point.
A negative answer requires positive evidence of non-availability.
```

## 13. Failure modes

### 13.1 False negative from open-world confusion

Symptom:

```text
System says nothing is available because no stored claims match.
```

Cause:

```text
NoKnownAvailability incorrectly treated as NotAvailable.
```

Prevention:

```text
Return insufficient_coverage and create CoverageGap / ResearchJob.
```

### 13.2 Stale schedule presented as current

Symptom:

```text
Old recurring schedule appears as current availability.
```

Cause:

```text
retrieved_at confused with publication date or verification date.
```

Prevention:

```text
Separate retrieved_at, published_at, last_verified_at, FreshnessState, and ClaimValidity.
```

### 13.3 Exception schedule missed

Symptom:

```text
Ordinary recurrence is shown for Christmas, Easter, holiday, closure, or special event date.
```

Cause:

```text
Recurrence evaluated without exception awareness.
```

Prevention:

```text
Material exception risk creates caveat or research gap.
```

### 13.4 Place identity merge error

Symptom:

```text
Availability from one place is shown for another similarly named place.
```

Cause:

```text
Name match substituted for Place identity resolution.
```

Prevention:

```text
Require place identity, address, hierarchy, or source linkage before active use.
```

### 13.5 Spatial constraint stored as place

Symptom:

```text
Claim place is stored as near Clifton Park or within Cook County.
```

Cause:

```text
Request-side SpatialConstraint confused with claim-side Place.
```

Prevention:

```text
Place must be a resolved physical place; ServiceArea must be explicit when used.
```

### 13.6 Confidence collapse

Symptom:

```text
One confidence score hides stale evidence or contradiction.
```

Cause:

```text
FreshnessState, VerificationState, and ContradictionState collapsed into ConfidenceAssessment.
```

Prevention:

```text
Expose all four states separately in match and answer objects.
```

### 13.7 Source-class inflation

Symptom:

```text
Third-party aggregator or search snippet is treated as official evidence.
```

Cause:

```text
source_type label used as authority class.
```

Prevention:

```text
Separate source_class, item_class, source_locator, and authority assessment.
```

### 13.8 Access-condition hallucination

Symptom:

```text
System assumes free, walk-in, no reservation, or open access without evidence.
```

Cause:

```text
Unknown access condition converted into permissive default.
```

Prevention:

```text
Unknown remains unknown; actionability caveat or research required when material.
```

### 13.9 Async continuity loss

Symptom:

```text
Research completes but answer no longer corresponds exactly to original query.
```

Cause:

```text
ResearchJob did not preserve UserIntent and NormalizedQuery.
```

Prevention:

```text
ResearchJob trigger must store original query, normalized constraints, and coverage gaps.
```

### 13.10 Negative answer without negative evidence

Symptom:

```text
System says not available when it only failed to find a source.
```

Cause:

```text
Absence of evidence treated as evidence of absence.
```

Prevention:

```text
Only no_supported_availability can say no, and only with positive evidence.
```

## 14. Silent degradation catalog

Silent degradation is worse than visible partial failure.

High-risk silent degradations:

```text
fresh source retrieval of stale source content
ordinary recurrence applied to exception date
claim confidence used as all-purpose truth score
source snippet promoted to active evidence
same-named places merged
service area treated as physical place
unknown access condition treated as permissive
contradiction hidden as lower confidence
manual review skipped because result looks plausible
async answer loses original user constraint
```

Each must become either:

```text
explicit state
coverage gap
caveat
human-review trigger
```

## 15. Human review triggers from state model

Human review is required when:

```text
contradiction_state = confirmed and no automatic stronger-source rule resolves it
contradiction_state = suspected and material to user query
freshness_state = unknown for high-stakes or high-volatility category
place identity is ambiguous
extracted time is ambiguous and material
required access condition is unknown and actionability depends on it
source authority cannot be classified
claim would otherwise support a negative answer
```

## 16. Decision summary

```text
N19 answer:
  The core invariants prevent unknown=false, stale=fresh, candidate=verified,
  confidence=truth, and spatial/query concepts being mistaken for claim concepts.

N20 answer:
  AvailabilityClaim lifecycle is represented by VerificationState:
  candidate → extracted → normalized → verified → active, with demotion to stale
  or retired. Contradiction is not lifecycle; it is separate ContradictionState.

N21 answer:
  Confidence is an ordinal assessment derived from source authority, freshness,
  extraction certainty, specificity, corroboration, exception risk, contradiction,
  and verification history, but it must not hide those input states.

N29 answer:
  Primary failure modes are false negatives from open-world confusion, stale claims,
  missed exceptions, place-identity errors, confidence collapse, source-class inflation,
  access-condition hallucination, async continuity loss, and unsupported negative answers.
```
