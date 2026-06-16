# Availability Claim Normal Form

Filename: `03-availability-claim-normal-form.md`

Answers DAG node: N04.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
```

## 1. Purpose

This document defines the canonical normal form for an AffordanceAvailabilityClaim.

The normal form is the semantic source for later artifacts:

```text
JSON examples
JSON Schema
SQL schema
RDF/Turtle mapping
extraction output contracts
answer composition
coverage-gap checks
```

It is not yet a database schema. It is a normalized record contract.

## 2. Record-level definition

An AffordanceAvailabilityClaim is a sourced assertion that:

```text
Available(Affordance, Place, TimeScope)
```

is true enough, under stated access conditions and verification state, to be considered by the resolver.

Expanded assertion:

```text
EvidenceSet supports Available(Affordance, Place, TimeScope)
under AccessConditions,
with ConfidenceAssessment,
in VerificationState,
within ClaimValidity.
```

The claim is not a document, event, listing, schedule, or answer.

It is the normalized assertion from which answers may be composed.

## 3. Normal form goals

The normal form must:

```text
separate user language from normalized constraints
separate place identity from spatial constraint
separate availability time from source time
separate evidence source from evidence item
separate confidence from verification state
represent recurrence and exceptions
represent access conditions
represent provenance
support contradiction handling
support freshness checks
support sync/async coverage decisions
```

## 4. Top-level shape

```yaml
affordance_availability_claim:
  claim_id: string
  claim_type: affordance_availability_claim
  schema_version: string
  lifecycle:
    verification_state: enum
    created_at: datetime
    updated_at: datetime
    last_verified_at: datetime | null
    valid_from: date | null
    valid_through: date | null
  assertion:
    affordance: AffordanceRef
    place: PlaceRef
    time_scope: TimeScope
    access_conditions: AccessCondition[]
  evidence:
    evidence_items: EvidenceItemRef[]
    evidence_summary: string | null
  confidence:
    state: enum
    score: number | null
    basis: string[]
  provenance:
    extraction_method: enum
    extracted_by: string | null
    extraction_run_id: string | null
    normalized_by: string | null
    normalization_run_id: string | null
  contradiction:
    contradiction_state: enum
    contradicted_by_claim_ids: string[]
    notes: string | null
```

## 5. Required top-level fields

Required fields:

```text
claim_id
claim_type
schema_version
lifecycle.verification_state
assertion.affordance
assertion.place
assertion.time_scope
evidence.evidence_items
confidence.state
provenance.extraction_method
contradiction.contradiction_state
```

A record without these fields is not a valid AvailabilityClaim.

## 6. Claim identity

`claim_id` identifies the normalized claim, not merely the source artifact.

Claim identity should be stable across re-ingestion when the same assertion is observed again.

Identity-relevant dimensions:

```text
affordance identity
place identity
time-scope identity
access-condition identity when actionability changes
evidence lineage
```

Identity should not change merely because:

```text
the source was fetched again
the confidence score changed
the claim was reverified
the answer wording changed
```

Identity may change when:

```text
the available affordance changes
the place changes
the recurrence changes materially
a one-time event replaces a recurrence
access conditions materially change
```

## 7. Lifecycle block

```yaml
lifecycle:
  verification_state: candidate | extracted | normalized | verified | active | stale | contradicted | retired
  created_at: datetime
  updated_at: datetime
  last_verified_at: datetime | null
  valid_from: date | null
  valid_through: date | null
```

Semantics:

```text
created_at       = when this normalized claim record was first created
updated_at       = when this claim record was last modified
last_verified_at = when the claim was last checked against admissible evidence
valid_from       = first date the claim should be considered applicable, if known
valid_through    = last date the claim should be considered applicable, if known
```

`valid_from` and `valid_through` are not the same as availability time.

Example:

```text
A schedule may say Sunday Mass is at 10:00.
The recurring availability time is Sundays 10:00.
The claim validity window may be 2026-01-01 through 2026-08-31.
```

## 8. Assertion block

```yaml
assertion:
  affordance:
    affordance_id: string | null
    canonical_label: string
    category: string
    subtype: string | null
  place:
    place_id: string | null
    canonical_name: string
    place_type: string | null
    address: string | null
    latitude: number | null
    longitude: number | null
    parent_place_id: string | null
  time_scope:
    kind: enum
    timezone: string
    starts_at: datetime | null
    ends_at: datetime | null
    recurrence_rule: string | null
    recurrence_label: string | null
    exception_rules: string[]
    valid_from: date | null
    valid_through: date | null
  access_conditions:
    - condition_type: string
      value: string | boolean | number | null
      confidence: enum | null
      evidence_item_ids: string[]
```

The assertion block is the normalized claim content.

It should be machine-readable enough for filtering and human-readable enough for audit.

## 9. Affordance normal form

```yaml
affordance:
  affordance_id: string | null
  canonical_label: string
  category: string
  subtype: string | null
```

Required semantics:

```text
affordance_id    = stable internal ID when known
canonical_label  = human-readable normalized name
category         = broad normalized class
subtype          = narrower normalized class when applicable
```

Example:

```yaml
affordance:
  affordance_id: aff_catholic_mass
  canonical_label: Catholic Mass
  category: religious_service
  subtype: catholic_mass
```

The affordance normal form should not store raw user phrasing. Raw phrasing belongs in UserIntent or NormalizedQuery.

## 10. Place normal form

```yaml
place:
  place_id: string | null
  canonical_name: string
  place_type: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  parent_place_id: string | null
```

Required semantics:

```text
place_id         = stable internal place identity when known
canonical_name   = resolved place name
place_type       = normalized place class
address          = postal or descriptive address
latitude         = WGS84 latitude when known
longitude        = WGS84 longitude when known
parent_place_id  = containing place if relevant
```

A claim must not use a vague spatial phrase as its place.

Bad:

```yaml
place:
  canonical_name: near Clifton Park
```

Good:

```yaml
place:
  canonical_name: St. Example Church
  address: 123 Main St, Clifton Park, NY
```

The user-side phrase `near Clifton Park` belongs to SpatialConstraint, not Place.

## 11. TimeScope normal form

```yaml
time_scope:
  kind: instant | interval | date | daypart | recurrence | season | validity_window | exception | unknown
  timezone: string
  starts_at: datetime | null
  ends_at: datetime | null
  recurrence_rule: string | null
  recurrence_label: string | null
  exception_rules: string[]
  valid_from: date | null
  valid_through: date | null
```

Required semantics:

```text
kind              = form of temporal availability
starts_at         = start datetime for instant/interval instances
ends_at           = end datetime for intervals when known
recurrence_rule   = machine-readable recurrence when known
recurrence_label  = human-readable recurrence when useful
exception_rules   = known or suspected exceptions
valid_from        = first date this time_scope is known to apply
valid_through     = last date this time_scope is known to apply
```

The system must distinguish:

```text
availability time
source publication time
source retrieval time
claim verification time
answer generation time
```

Only availability time belongs in `assertion.time_scope`.

## 12. AccessCondition normal form

```yaml
access_conditions:
  - condition_type: reservation_required | ticket_required | walk_in_allowed | cost | eligibility | capacity | language | accessibility | modality | other
    value: string | boolean | number | null
    confidence: verified | high_confidence | probable | candidate | insufficient | null
    evidence_item_ids: string[]
```

Access conditions should be explicit when they affect actionability.

Unknown access conditions must not be silently converted to permissive defaults.

Example:

```yaml
access_conditions:
  - condition_type: reservation_required
    value: false
    confidence: high_confidence
    evidence_item_ids: [ev_001]
  - condition_type: cost
    value: free
    confidence: probable
    evidence_item_ids: []
```

## 13. Evidence block

```yaml
evidence:
  evidence_items:
    - evidence_item_id: string
      evidence_source_id: string | null
      source_type: enum
      source_locator: string | null
      retrieved_at: datetime
      published_at: datetime | null
      observed_at: datetime | null
      evidence_span: string | null
      extracted_text: string | null
      authority_level: enum
      freshness_state: enum
  evidence_summary: string | null
```

Allowed initial `source_type` values:

```text
official_website
official_calendar
pdf_bulletin
posted_schedule
government_page
venue_page
trusted_aggregator
user_report
manual_phone_note
manual_observation
unknown
```

Allowed initial `authority_level` values:

```text
official
affiliated
trusted_third_party
untrusted_third_party
user_report
manual_verification
unknown
```

Allowed initial `freshness_state` values:

```text
current
recent
possibly_stale
stale
unknown
```

EvidenceItem is the concrete observed artifact. EvidenceSource is the source identity behind it.

## 14. Confidence block

```yaml
confidence:
  state: verified | high_confidence | probable | candidate | stale | contradicted | insufficient
  score: number | null
  basis: string[]
```

Confidence answers:

```text
How safe is this claim to use in an answer?
```

Confidence is derived from:

```text
source authority
source freshness
extraction certainty
specificity of affordance/place/time
corroboration
contradiction state
known exception risk
verification history
```

Numeric score is optional. The state is required.

## 15. Provenance block

```yaml
provenance:
  extraction_method: manual | llm | parser | api_import | crawler | hybrid | unknown
  extracted_by: string | null
  extraction_run_id: string | null
  normalized_by: string | null
  normalization_run_id: string | null
```

Provenance records how the claim entered the system.

It is distinct from Evidence.

Evidence answers:

```text
What supports the claim?
```

Provenance answers:

```text
How did this system produce the normalized record?
```

## 16. Contradiction block

```yaml
contradiction:
  contradiction_state: none | suspected | confirmed | resolved
  contradicted_by_claim_ids: string[]
  notes: string | null
```

Contradiction state is required because silence is unsafe.

A claim with `contradiction_state: confirmed` must not be treated as active even if its lifecycle has not yet been retired.

## 17. Complete example

```yaml
affordance_availability_claim:
  claim_id: claim_mass_example_church_sunday_1000
  claim_type: affordance_availability_claim
  schema_version: 0.1.0
  lifecycle:
    verification_state: active
    created_at: 2026-06-16T12:00:00-05:00
    updated_at: 2026-06-16T12:00:00-05:00
    last_verified_at: 2026-06-16T12:00:00-05:00
    valid_from: null
    valid_through: null
  assertion:
    affordance:
      affordance_id: aff_catholic_mass
      canonical_label: Catholic Mass
      category: religious_service
      subtype: catholic_mass
    place:
      place_id: place_example_church
      canonical_name: Example Parish Church
      place_type: church
      address: 123 Main St, Exampletown, NY
      latitude: null
      longitude: null
      parent_place_id: null
    time_scope:
      kind: recurrence
      timezone: America/New_York
      starts_at: null
      ends_at: null
      recurrence_rule: FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0
      recurrence_label: Sundays at 10:00 AM
      exception_rules:
        - holiday schedules may override ordinary Sunday schedule
      valid_from: null
      valid_through: null
    access_conditions:
      - condition_type: walk_in_allowed
        value: true
        confidence: probable
        evidence_item_ids: [ev_example_001]
  evidence:
    evidence_items:
      - evidence_item_id: ev_example_001
        evidence_source_id: src_example_church_website
        source_type: official_website
        source_locator: https://example.invalid/mass-times
        retrieved_at: 2026-06-16T12:00:00-05:00
        published_at: null
        observed_at: null
        evidence_span: Sunday Mass 10:00 AM
        extracted_text: Sunday Mass 10:00 AM
        authority_level: official
        freshness_state: current
    evidence_summary: Official parish page lists Sunday Mass at 10:00 AM.
  confidence:
    state: high_confidence
    score: null
    basis:
      - official source
      - specific affordance
      - specific recurrence
      - source retrieved recently
      - no contradiction known
  provenance:
    extraction_method: manual
    extracted_by: null
    extraction_run_id: null
    normalized_by: null
    normalization_run_id: null
  contradiction:
    contradiction_state: none
    contradicted_by_claim_ids: []
    notes: null
```

## 18. Normalization rules

### 18.1 One claim per normalized assertion

A claim should represent one normalized availability assertion.

Do not combine unrelated affordances into one claim.

Bad:

```text
Church has Mass, confession, adoration, and office hours on Sunday.
```

Good:

```text
Claim 1: Available(Catholic Mass, Church, Sunday 10:00)
Claim 2: Available(Confession, Church, Saturday 15:00-16:00)
Claim 3: Available(Adoration, Church, First Friday 19:00)
```

### 18.2 Recurrence and instance are distinct

A recurring claim may generate date-specific instances for answering.

The recurrence claim remains the source assertion.

Example:

```text
Claim: Sundays at 10:00
Query: next Sunday
Answer instance: 2026-06-21 10:00
```

The answer instance should point back to the recurrence claim.

### 18.3 Exceptions do not delete recurrence

An exception modifies applicability. It does not erase the underlying recurring claim.

Example:

```text
Ordinary Sunday Mass at 10:00.
Christmas schedule different.
```

This should be represented as recurrence plus exception awareness, not as contradictory ordinary data.

### 18.4 Unknown is explicit

Unknown values remain null or explicit unknown states.

The system must not convert unknown to false.

Examples:

```text
reservation_required unknown ≠ reservation_required false
cost unknown ≠ free
valid_through unknown ≠ never expires
```

### 18.5 Evidence is mandatory

A claim without evidence is not an AvailabilityClaim.

It may exist as a candidate hypothesis, but it must not be eligible for normal answer composition.

## 19. Derived artifacts

This normal form should later generate or constrain:

```text
claim.schema.json
availability_claim table group
RDF/Turtle claim mapping
extraction output schema
answer claim citation format
coverage-check inputs
```

## 20. Decision summary

```text
N04 answer:
  The canonical record normal form is AffordanceAvailabilityClaim, a normalized,
  evidence-backed assertion over Affordance, Place, and TimeScope, with explicit
  access conditions, lifecycle, confidence, provenance, contradiction state,
  and freshness-aware evidence.
```
