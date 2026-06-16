# Minimal Ontology

Filename: `02-minimal-ontology.md`

Answers DAG nodes: N01, N02, N23, N24, N25.

## 1. Purpose

This document defines the first operational ontology for Affordance Atlas.

It answers five kernel questions:

```text
N01  What is the minimal ontology / primitive set for this domain?
N02  Is AffordanceAvailabilityClaim the right primitive, or is there a better one?
N23  What is the decomposition of time?
N24  What is the decomposition of where?
N25  What is the decomposition of whatness?
```

The goal is not a final universal ontology. The goal is the smallest set of concepts strong enough to support claim storage, query resolution, coverage-gap detection, and acquisition.

## 2. Ontological commitment

Affordance Atlas is built around this assertion form:

```text
Available(Affordance, Place, TimeScope)
```

A user asks partial constraints over:

```text
Affordance × Place × TimeScope
```

The system returns, acquires, or rejects availability claims based on evidence.

Therefore, the ontology must represent at least:

```text
what is available
where it is available
when it is available
under what access conditions
according to what evidence
with what confidence
with what freshness
with what verification state
with what contradiction state
within what claim validity window
```

## 3. Minimal ontology inventory

The minimal ontology contains these core classes:

```text
Affordance
AffordanceCategory
Place
ServiceArea
SpatialConstraint
TimeScope
TemporalConstraint
ClaimValidity
AccessCondition
AvailabilityClaim
EvidenceSource
EvidenceItem
ConfidenceAssessment
FreshnessState
VerificationState
ContradictionState
CoverageGap
ResearchJob
UserIntent
NormalizedQuery
Answer
Notification
```

These are minimal because removing any one of them causes a semantic failure:

```text
Without Affordance, the system collapses into place/time search.
Without Place, the system loses physical realizability.
Without TimeScope, the system loses actionability.
Without ClaimValidity, availability time gets confused with claim applicability.
Without AccessCondition, the system may answer with unusable availability.
Without Evidence, the system becomes unsupported assertion.
Without ConfidenceAssessment, the system cannot choose sync answer vs gap.
Without FreshnessState, current evidence and stale evidence become indistinguishable.
Without VerificationState, lifecycle state is confused with truth confidence.
Without ContradictionState, conflicting evidence is hidden inside confidence.
Without CoverageGap, unknown becomes falsely terminal.
Without ResearchJob, the closed loop disappears.
Without NormalizedQuery, user language cannot be separated from resolved constraints.
Without Answer, claim retrieval is not yet user-facing resolution.
```

## 4. Core primitive decision

The canonical class name is:

```text
AvailabilityClaim
```

The full semantic name is:

```text
AffordanceAvailabilityClaim
```

They are aliases. Use `AvailabilityClaim` in schemas and code unless the longer name is needed for explanatory clarity.

This remains the best primitive because it binds the three irreducible axes:

```text
Affordance  = what can be realized
Place       = where it can be realized
TimeScope   = when it can be realized
```

and attaches the required truth-supporting envelope:

```text
Evidence
ConfidenceAssessment
FreshnessState
VerificationState
ContradictionState
AccessCondition
ClaimValidity
```

Rejected alternatives:

```text
Event
  Too narrow. Many valid claims are recurring services, opening hours, walk-ins, appointment slots, or facility access.

Place
  Too static. A place alone does not say what is available or when.

Schedule
  Too temporal. A schedule alone does not identify user-realizable affordance or evidence quality.

Opportunity
  Useful product word, but too vague as a kernel primitive.

Availability
  Correct but underspecified unless bound to affordance, place, time, evidence, and verification.

Affordance
  Too abstract. It describes possible action, not its situated availability.
```

Canonical primitive:

```text
AvailabilityClaim(
  claim_id,
  affordance,
  place,
  time_scope,
  claim_validity,
  access_conditions,
  evidence_set,
  confidence_assessment,
  freshness_state,
  verification_state,
  contradiction_state,
  last_verified_at
)
```

## 5. Class definitions

### 5.1 Affordance

An Affordance is a real-world possibility of action, attendance, access, receipt, participation, or service-use.

Examples:

```text
attend Mass
visit a museum
receive a blood draw
join pickup basketball
attend a city council meeting
use a reading room
renew a passport
```

An affordance is not merely a keyword. It has action semantics.

### 5.2 AffordanceCategory

An AffordanceCategory groups affordances into normalized classes.

Examples:

```text
religious_service
confession
museum_admission
guided_tour
medical_lab_service
public_meeting
sports_drop_in
civic_service
class_or_workshop
```

Categories support normalization, search, aggregation, and generalization.

### 5.3 Place

A Place is a physical location, venue, facility, campus, building, room, or service point where an affordance may be realized.

A place may have hierarchy:

```text
campus → building → floor → room
parish → church building → chapel
museum → wing → gallery
clinic network → clinic site → lab counter
```

### 5.4 ServiceArea

A ServiceArea is a bounded region over which a provider claims coverage or eligibility.

A ServiceArea is not a Place. It can constrain where users are eligible or where a mobile/remote service applies, but it is not itself the ordinary physical realization point of an affordance.

Examples:

```text
within Cook County
inside a school district
covered by a mobile clinic route
served by a municipal office
```

### 5.5 SpatialConstraint

A SpatialConstraint is a user- or system-specified restriction over possible places or service areas.

Examples:

```text
near Clifton Park, NY
within 20 minutes of me
inside this museum
at St. Mary's Church
within Cook County
reachable by public transit
```

SpatialConstraint is not identical to Place. It may resolve to zero, one, or many places.

### 5.6 TimeScope

A TimeScope is the temporal availability object attached to a claim.

It describes when the affordance is available.

Examples:

```text
2026-06-21 10:00 America/New_York
Mondays 09:00-17:00
first Friday of each month
summer season
except federal holidays
```

A TimeScope does not describe when the claim record is valid. Claim applicability belongs to `ClaimValidity`.

### 5.7 TemporalConstraint

A TemporalConstraint is a user- or system-specified restriction over possible TimeScopes.

Examples:

```text
next Sunday
Monday afternoon
this weekend
before 5pm
during Lent
within the next 7 days
```

TemporalConstraint is not identical to TimeScope. It is a request-side filter expression.

### 5.8 ClaimValidity

ClaimValidity describes the date range in which the claim record should be considered applicable.

Examples:

```text
valid_from: 2026-01-01
valid_through: 2026-08-31
valid_from: null
valid_through: null
```

ClaimValidity is not availability time.

Example:

```text
Availability time: Sundays at 10:00
Claim validity: this schedule is known to apply through August 2026
```

### 5.9 AccessCondition

An AccessCondition is a condition that affects whether a user can actually realize the affordance.

Examples:

```text
reservation_required
ticket_required
walk_in_allowed
cost
capacity
membership_required
age_limit
language
eligibility
security_screening
accessibility
remote_or_hybrid_modality
```

Access conditions are part of actionability.

### 5.10 AvailabilityClaim

AvailabilityClaim is the canonical stored assertion:

```text
Available(Affordance, Place, TimeScope)
```

with evidence, confidence, freshness, verification state, contradiction state, claim validity, and access conditions.

### 5.11 EvidenceSource

An EvidenceSource is the source identity behind evidence.

Examples:

```text
official website
PDF bulletin
embedded calendar
venue page
government page
trusted aggregator
manual phone note
user-submitted report
```

### 5.12 EvidenceItem

An EvidenceItem is a retrieved or recorded piece of evidence from a source.

Examples:

```text
specific webpage snapshot
specific PDF file
specific calendar event payload
specific phone-confirmation note
specific image of a posted schedule
```

EvidenceSource is the source identity. EvidenceItem is the concrete observed artifact.

### 5.13 ConfidenceAssessment

ConfidenceAssessment represents how safe it is to use the claim as support for an answer.

It should not encode lifecycle, freshness, or contradiction directly.

Initial states:

```text
high_confidence
probable
candidate
insufficient
```

Confidence is based on:

```text
source authority
source freshness
extraction certainty
specificity
corroboration
known exception risk
verification history
contradiction state as input, not as confidence state
```

### 5.14 FreshnessState

FreshnessState represents whether the supporting evidence is temporally current enough for the affordance category.

Initial states:

```text
current
recent
possibly_stale
stale
unknown
```

### 5.15 VerificationState

VerificationState represents the current lifecycle state of a claim.

Initial states:

```text
candidate
extracted
normalized
verified
active
stale
retired
```

`contradicted` is not a VerificationState. It belongs to ContradictionState.

### 5.16 ContradictionState

ContradictionState represents whether the claim conflicts with other evidence-backed claims.

Initial states:

```text
none
suspected
confirmed
resolved
```

A confirmed contradiction blocks active use unless resolved by stronger evidence.

### 5.17 CoverageGap

A CoverageGap is a structured reason why the system cannot answer from current claims.

Examples:

```text
no resolved place
no admissible source
stale availability
contradictory evidence
holiday exception unresolved
access condition unresolved
```

### 5.18 ResearchJob

A ResearchJob is work created to close a CoverageGap.

It preserves the original query, target constraints, research scope, evidence gathered, claims produced, and remaining uncertainty.

### 5.19 UserIntent

UserIntent is the raw or lightly parsed user request before full normalization.

Example:

```text
I want to attend a mess next sunday
```

### 5.20 NormalizedQuery

NormalizedQuery is the resolved constraint form produced from UserIntent.

Example:

```text
affordance_constraint: religious_service.mass
spatial_constraint: missing or inferred from context
temporal_constraint: next Sunday in resolved timezone
uncertainty: possible spelling correction from mess to Mass
```

### 5.21 Answer

An Answer is the user-facing resolution object composed from matching claims, evidence, confidence, caveats, and unresolved gaps.

### 5.22 Notification

A Notification is an asynchronous delivery object produced when a ResearchJob later creates an answer.

## 6. Whatness decomposition

Whatness decomposes into:

```text
affordance_id
canonical_label
category
subtype
synonyms
intent_verbs
object_nouns
modality
eligibility
access_conditions
required_booking
price_model
capacity_model
language
provider_type
```

### 6.1 Whatness fields

```yaml
affordance:
  affordance_id: string
  canonical_label: string
  category: string
  subtype: string | null
  synonyms: string[]
  intent_verbs: string[]
  object_nouns: string[]
  provider_type: string | null
  default_access_conditions: AccessCondition[]
```

### 6.2 Whatness examples

```yaml
affordance:
  canonical_label: Catholic Mass
  category: religious_service
  subtype: catholic_mass
  synonyms:
    - Mass
    - Sunday Mass
    - liturgy
  intent_verbs:
    - attend
    - go to
  object_nouns:
    - mass
    - service
  provider_type: parish_or_church
```

```yaml
affordance:
  canonical_label: Blood draw
  category: medical_lab_service
  subtype: venipuncture
  synonyms:
    - lab draw
    - blood test
    - phlebotomy
  intent_verbs:
    - get
    - receive
  object_nouns:
    - blood draw
    - lab test
  provider_type: clinic_or_lab
```

### 6.3 Whatness invariants

```text
Whatness is not keyword match.
Whatness must preserve action semantics.
Whatness may require disambiguation.
Whatness may imply default provider types but must not hard-code them as facts.
Whatness may carry access implications, but claim-specific access conditions override category defaults.
```

## 7. Whereness decomposition

Whereness decomposes into:

```text
place_id
canonical_name
place_type
address
coordinates
jurisdiction
parent_place
subplace
service_area
spatial_constraint
distance_or_travel_time
entrance_or_access_point
physical_virtual_modality
```

### 7.1 Place fields

```yaml
place:
  place_id: string
  canonical_name: string
  place_type: string
  address: string | null
  latitude: number | null
  longitude: number | null
  jurisdiction: string | null
  parent_place_id: string | null
  source_place_ids: string[]
```

### 7.2 ServiceArea fields

```yaml
service_area:
  service_area_id: string
  label: string
  geometry_ref: string | null
  jurisdiction: string | null
  provider_place_id: string | null
```

### 7.3 SpatialConstraint fields

```yaml
spatial_constraint:
  kind: enum
  anchor_place_id: string | null
  anchor_address: string | null
  anchor_coordinates: [number, number] | null
  radius_distance: string | null
  max_travel_time: string | null
  travel_mode: string | null
  jurisdiction: string | null
```

Allowed `kind` values initially:

```text
exact_place
near_place
within_radius
within_travel_time
within_jurisdiction
inside_place
service_area_overlap
unspecified
```

### 7.4 Whereness invariants

```text
A place is not the same as a spatial constraint.
A service area is not the same as a physical realization point.
A named place must be identity-resolved before claim matching.
A spatial constraint may resolve to multiple places.
A physical affordance requires a physical place unless explicitly modeled as mobile, remote, virtual, hybrid, or service-area based.
Virtual or hybrid access must be explicit, not silently merged with physical availability.
```

## 8. Whenness decomposition

Whenness decomposes into multiple temporal roles.

The system must not collapse these:

```text
user_requested_time
claim_availability_time
claim_recurrence_rule
claim_exception_rule
claim_validity_window
source_publication_time
source_retrieval_time
claim_last_verified_at
answer_generated_at
```

### 8.1 TimeScope fields

```yaml
time_scope:
  time_scope_id: string
  kind: enum
  timezone: string
  starts_at: datetime | null
  ends_at: datetime | null
  recurrence_rule: string | null
  recurrence_label: string | null
  exception_rules: string[]
```

Allowed `kind` values initially:

```text
instant
interval
date
daypart
recurrence
season
exception
unknown
```

### 8.2 ClaimValidity fields

```yaml
claim_validity:
  valid_from: date | null
  valid_through: date | null
  validity_basis: string | null
```

### 8.3 TemporalConstraint fields

```yaml
temporal_constraint:
  original_phrase: string
  normalized_window_start: datetime | null
  normalized_window_end: datetime | null
  timezone: string
  recurrence_filter: string | null
  daypart: string | null
  uncertainty: string[]
```

### 8.4 Whenness examples

```yaml
temporal_constraint:
  original_phrase: next Sunday
  normalized_window_start: 2026-06-21T00:00:00-04:00
  normalized_window_end: 2026-06-22T00:00:00-04:00
  timezone: America/New_York
```

```yaml
time_scope:
  kind: recurrence
  timezone: America/New_York
  recurrence_rule: FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0
  recurrence_label: Sundays at 10:00
  exception_rules:
    - Easter schedule may override ordinary Sunday schedule
    - Christmas schedule may override ordinary Sunday schedule

claim_validity:
  valid_from: null
  valid_through: null
  validity_basis: no explicit source validity window
```

### 8.5 Whenness invariants

```text
A user temporal phrase is not the same as a claim TimeScope.
A recurrence is incomplete without exception awareness.
A claim validity window is not an availability window.
A source retrieval time is not an availability time.
A source publication time is not a verification time.
Timezone must be explicit before resolving relative dates.
Stale claims must not satisfy freshness-sensitive queries without caveat.
```

## 9. Relationship summary

Core relationships:

```text
UserIntent normalizes_to NormalizedQuery
NormalizedQuery contains AffordanceConstraint
NormalizedQuery contains SpatialConstraint
NormalizedQuery contains TemporalConstraint
AvailabilityClaim asserts Available(Affordance, Place, TimeScope)
AvailabilityClaim has ClaimValidity
AvailabilityClaim has AccessCondition
AvailabilityClaim supported_by EvidenceItem
EvidenceItem comes_from EvidenceSource
AvailabilityClaim has ConfidenceAssessment
AvailabilityClaim has FreshnessState
AvailabilityClaim has VerificationState
AvailabilityClaim has ContradictionState
CoverageGap blocks Answer
CoverageGap creates ResearchJob
ResearchJob produces EvidenceItem
ResearchJob produces AvailabilityClaim
Answer cites AvailabilityClaim
Notification delivers Answer
```

## 10. Minimal YAML sketch

```yaml
availability_claim:
  claim_id: claim_001
  affordance:
    canonical_label: Catholic Mass
    category: religious_service
    subtype: catholic_mass
  place:
    canonical_name: Example Parish Church
    place_type: church
    address: 123 Main St, Exampletown, NY
    latitude: null
    longitude: null
  time_scope:
    kind: recurrence
    timezone: America/New_York
    recurrence_rule: FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0
    recurrence_label: Sundays at 10:00
    exception_rules:
      - holiday schedules may override ordinary recurrence
  claim_validity:
    valid_from: null
    valid_through: null
    validity_basis: no explicit source validity window
  access_conditions:
    - walk_in_allowed: true
    - reservation_required: false
  evidence_set:
    - evidence_id: ev_001
      source_type: official_website
      retrieval_time: 2026-06-16T12:00:00-05:00
      extracted_support: Sunday Mass 10:00 AM
  confidence_assessment:
    state: high_confidence
    basis:
      - official source
      - specific time
      - current retrieval
  freshness_state: current
  verification_state: active
  contradiction_state: none
  last_verified_at: 2026-06-16T12:00:00-05:00
```

## 11. Open questions deferred

This document intentionally defers:

```text
full SQL schema
RDF/Turtle mapping
JSON Schema validation
ranking policy
sync/async threshold policy
research job state machine
source authority scoring
contradiction resolution algorithm
minimal v0 build plan
```

Those depend on this ontology but should not be mixed into it.

## 12. Decision summary

```text
N01 answer:
  The minimal ontology consists of Affordance, Place, ServiceArea, TimeScope,
  ClaimValidity, AccessCondition, AvailabilityClaim, Evidence, ConfidenceAssessment,
  FreshnessState, VerificationState, ContradictionState, CoverageGap, ResearchJob,
  UserIntent, NormalizedQuery, Answer, and Notification.

N02 answer:
  AvailabilityClaim / AffordanceAvailabilityClaim is the correct core primitive
  because it binds whatness, whereness, and whenness into an evidence-backed,
  verification-aware assertion.

N23 answer:
  Time decomposes into requested time, availability time, recurrence, exception,
  claim validity, source publication, source retrieval, verification, and
  answer-generation time. Availability time belongs to TimeScope; claim
  applicability belongs to ClaimValidity.

N24 answer:
  Where decomposes into place identity, spatial constraint, coordinates/address,
  hierarchy, jurisdiction, service area, travel relation, and physical/virtual modality.

N25 answer:
  Whatness decomposes into affordance, category, subtype, synonyms, intent verbs,
  object nouns, provider type, eligibility, access conditions, and modality.
```
