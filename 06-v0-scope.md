# V0 Scope

Filename: `06-v0-scope.md`

Answers DAG nodes: N14, N33, N36.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
05-acquisition-loop.md
```

## 1. Purpose

This document defines the first buildable vertical slice for Affordance Atlas.

It answers:

```text
N14  What would be a vertical slice / test case?
N33  What is the first vertical that proves the abstraction?
N36  What is the minimal v0?
```

The goal of v0 is not product completeness. The goal is to prove that the kernel works under real-world messiness:

```text
partial user query
physical place constraint
time-bounded availability
recurrence
source evidence
freshness
coverage gap
research job
new claim persistence
answer composition
```

## 2. V0 proving vertical

The first proving vertical is:

```text
Catholic Mass availability near a specified place during a specified date window.
```

Canonical test query:

```text
I want to attend Mass next Sunday near Clifton Park, NY.
```

This vertical is narrow enough to build and broad enough to test the core abstraction.

## 3. Why this vertical

Catholic Mass availability is a strong first vertical because it exercises the hard parts without requiring marketplace integration or private inventory access.

It has:

```text
real physical places
recurring schedules
official sources
PDF bulletins
source freshness issues
holiday exceptions
category normalization
place discovery
partial query completion
sync answer when covered
async research when uncovered
```

It is not chosen because the product is only religious services.

It is chosen because the category exposes the system's semantic requirements early.

## 4. V0 non-goals

V0 does not need:

```text
multi-category coverage
user accounts
payments
reservations
real-time capacity
mobile app
full map UI
full RDF ontology
full SQL optimization
full ranking personalization
fully autonomous browsing at scale
phone-call automation
```

V0 should not become a generic event crawler.

## 5. V0 scope boundary

V0 supports one primary query pattern:

```text
(A, ?, T)
```

Meaning:

```text
Find places where affordance A is available during time scope T within a spatial constraint.
```

For v0:

```text
A = Catholic Mass
T = specific date or relative date resolved to a date window
Spatial constraint = near a supplied town/place/address
```

Example:

```text
Mass near Clifton Park next Sunday
```

## 6. V0 canonical flow

```text
User query
→ normalize affordance as Catholic Mass
→ resolve relative date and timezone
→ resolve spatial anchor
→ search existing claims
→ if sufficient claims exist, answer synchronously
→ if not, create coverage gaps
→ create research job
→ discover nearby Catholic parishes/churches
→ find official source pages or bulletins
→ extract Mass schedules
→ normalize recurrence and exceptions
→ persist AvailabilityClaims
→ compose answer
→ answer asynchronously
```

## 7. V0 required concepts

V0 must implement these concepts from the kernel:

```text
Affordance
Place
SpatialConstraint
TimeScope
TemporalConstraint
ClaimValidity
AccessCondition
AvailabilityClaim
EvidenceItem
ConfidenceAssessment
FreshnessState
VerificationState
ContradictionState
CoverageGap
ResearchJob
Answer
Notification or async answer placeholder
```

## 8. V0 required records

V0 should be able to store:

```text
places
sources
evidence_items
affordances
availability_claims
coverage_gaps
research_jobs
answers
```

It may store these in a simple relational database, JSON files, SQLite, or another minimal persistence layer.

The semantic contract matters more than persistence technology for v0.

## 9. V0 claim requirements

A v0 Mass claim must include:

```text
affordance = Catholic Mass
place identity
place address or coordinates when available
time scope as recurrence or instance
timezone
claim validity
evidence item
source class
item class
retrieved_at
confidence state
freshness state
verification state
contradiction state
exception caveat when relevant
```

Minimum valid example:

```yaml
availability_claim:
  claim_id: claim_example_mass_sunday_1000
  claim_type: availability_claim
  schema_version: 0.2.0
  lifecycle:
    verification_state: active
    created_at: 2026-06-16T12:00:00-05:00
    updated_at: 2026-06-16T12:00:00-05:00
    last_verified_at: 2026-06-16T12:00:00-05:00
  assertion:
    affordance:
      affordance_id: aff_catholic_mass
      canonical_label: Catholic Mass
      category: religious_service
      subtype: catholic_mass
    place:
      place_id: place_example_parish
      canonical_name: Example Parish
      place_type: church
      address: 123 Main St, Exampletown, NY
      latitude: null
      longitude: null
      parent_place_id: null
    service_area: null
    time_scope:
      kind: recurrence
      timezone: America/New_York
      starts_at: null
      ends_at: null
      recurrence_rule: FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0
      recurrence_label: Sundays at 10:00 AM
      exception_rules:
        - holiday schedules may override ordinary Sunday schedule
    claim_validity:
      valid_from: null
      valid_through: null
      validity_basis: no explicit source validity window
    access_conditions:
      - condition_type: walk_in_allowed
        value: true
        confidence: probable
        evidence_item_ids: [ev_example_001]
  evidence:
    evidence_items:
      - evidence_item_id: ev_example_001
        evidence_source_id: src_example_parish_website
        source_class: official_primary
        item_class: webpage
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
  assessments:
    confidence:
      state: high_confidence
      score: null
      basis:
        - official primary source
        - specific recurrence
        - source retrieved recently
    freshness_state: current
    contradiction_state: none
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

## 10. V0 answer requirements

A v0 answer must include:

```text
matched places
Mass times for requested date window
addresses
source references
freshness or retrieval date
confidence state
verification state
contradiction state
exception caveat if ordinary recurrence may be overridden
coverage-gap notes if incomplete
```

A v0 answer must not include unsupported claims.

## 11. V0 coverage gaps

V0 must detect these gaps at minimum:

```text
affordance_unresolved
place_unresolved
time_unresolved
timezone_missing
no_candidate_places
no_candidate_claims
no_admissible_source
source_found_no_availability_data
availability_data_stale
recurrence_exception_unresolved
confidence_insufficient
contradictory_sources
```

## 12. V0 research job requirements

A v0 research job must preserve:

```text
original query
normalized query
spatial anchor
temporal window
affordance constraint
coverage gaps
candidate places checked
sources checked
evidence items found
claims produced
remaining gaps
answer produced, if any
```

## 13. V0 source policy

V0 admissible sources:

```text
official parish/church website
official parish/church calendar
official bulletin PDF
manual verification note
```

V0 discovery-only sources:

```text
Google result snippet
generic local listing
third-party mass-time aggregator
user report
```

Discovery-only sources may help find official sources or candidate places. They should not alone create active claims.

## 14. V0 extraction policy

V0 may use manual, LLM-assisted, or parser-assisted extraction.

Regardless of method, the output must become:

```text
EvidenceItem
CandidateClaim
AvailabilityClaim
```

with provenance.

V0 should prefer correctness and auditability over fully automated scale.

## 15. V0 sync/async behavior

Synchronous answer is allowed when:

```text
active claims already exist
claims match Mass, place constraint, and requested date window
source evidence is admissible
freshness is current/recent enough for the category
confidence is probable or higher
no blocking contradiction exists
exception risk is caveated or resolved
```

Async research is required when:

```text
no matching claims exist
claims exist but are stale
sources conflict
official source has not been checked
holiday/exception schedule may override and is unresolved
```

## 16. V0 success criteria

V0 is successful when it can complete this loop:

```text
1. Receive query: Mass near Clifton Park next Sunday.
2. Normalize what/where/when.
3. Find no prior coverage or insufficient coverage.
4. Create coverage gap and research job.
5. Discover candidate Catholic churches/parishes near Clifton Park.
6. Retrieve official source evidence.
7. Extract Mass schedules.
8. Persist AvailabilityClaims with evidence.
9. Compose an answer with times, places, caveats, and sources.
10. Re-answer the same or similar query synchronously from stored claims.
```

The second answer being synchronous is the proof that acquisition expanded the claim base.

## 17. V0 build components

Minimal components:

```text
query normalizer
place resolver
claim store
coverage checker
research job store
evidence recorder
claim extractor/normalizer
answer composer
simple notification or async result mechanism
```

Optional for v0:

```text
map UI
automated crawler scheduler
RDF export
full ranking engine
multi-user notification preferences
```

## 18. V0 artifact sequence

Recommended next implementation artifacts:

```text
claim.schema.json
query.schema.json
answer.schema.json
coverage-gap.schema.json
research-job.schema.json
seed-affordances.yaml
seed-source-policy.yaml
v0-test-cases.md
```

## 19. V0 test cases

Initial test cases:

```text
Mass near Clifton Park next Sunday.
Mass near Clifton Park this Sunday morning.
Mass at a named parish next Sunday.
What is available at this parish on Monday?
Mass near Clifton Park on Christmas Day.
Mass near Clifton Park with Spanish language preference.
```

The first three are in v0 core.

The last three expose likely v0 boundary pressure.

## 20. Out-of-scope but adjacent

Do not include in v0 unless needed for proving the loop:

```text
confession schedules
adoration schedules
Protestant services
synagogue services
mosque prayer times
museum opening hours
medical appointments
public meetings
reservation booking
```

These are later generalization targets.

## 21. V0 invariants

```text
V0 must not answer from search snippets alone.
V0 must not treat no stored Mass claim as no Mass available.
V0 must not hide stale evidence.
V0 must preserve original query through research.
V0 must persist reusable claims after research.
V0 must cite evidence for each answer result.
V0 must distinguish ordinary recurrence from holiday exceptions.
V0 must be narrow in category but complete in semantic loop.
```

## 22. Decision summary

```text
N14 answer:
  The vertical slice is Catholic Mass availability near a specified place during a specified date window, starting with the query "Mass near Clifton Park next Sunday."

N33 answer:
  The first proving vertical is religious-service availability, specifically Catholic Mass, because it exercises recurrence, official sources, physical places, exceptions, stale schedules, and partial user constraints.

N36 answer:
  Minimal v0 supports one affordance category, one spatial query pattern, date-window resolution, official-source evidence, claim persistence, coverage-gap detection, research jobs, synchronous answers when covered, and asynchronous answers after acquisition.
```
