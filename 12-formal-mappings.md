# Formal Mappings

Filename: `12-formal-mappings.md`

Answers DAG nodes: N03, N17, N38, N41.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
03-availability-claim-normal-form.md
04-query-answer-coverage.md
08-recurrence-identity-async.md
11-data-model-and-schemas.md
```

## 1. Purpose

This document provides formal frames for the Affordance Atlas domain.

It answers:

```text
N03  How would this be represented as RDF triples / graph / ontology?
N17  Can this be framed as a compiler/runtime?
N38  What is the relation to schema.org Event / Place / OpeningHoursSpecification?
N41  Can we express the whole thing as a small algebra?
```

These mappings are secondary to the kernel and normal form. They should clarify, not replace, the domain model.

## 2. RDF / graph representation

The core graph assertion is:

```text
AvailabilityClaim asserts Available(Affordance, Place, TimeScope)
```

Because the assertion has evidence, confidence, freshness, verification, and contradiction state, it must be represented as a claim node, not as a bare triple.

Bad:

```ttl
:mass :availableAt :church .
```

Good:

```ttl
:claim_001 a aa:AvailabilityClaim ;
  aa:affordance :aff_catholic_mass ;
  aa:place :place_example_church ;
  aa:timeScope :timescope_sunday_1000 ;
  aa:supportedBy :ev_001 ;
  aa:confidenceState "high_confidence" ;
  aa:freshnessState "current" ;
  aa:verificationState "active" ;
  aa:contradictionState "none" .
```

## 3. Minimal RDF classes

```text
aa:Affordance
aa:AffordanceCategory
aa:Place
aa:ServiceArea
aa:TimeScope
aa:ClaimValidity
aa:AccessCondition
aa:AvailabilityClaim
aa:EvidenceSource
aa:EvidenceItem
aa:CoverageGap
aa:ResearchJob
aa:NormalizedQuery
aa:Answer
aa:Notification
```

## 4. Minimal RDF predicates

```text
aa:assertsAffordance
aa:atPlace
aa:withinServiceArea
aa:hasTimeScope
aa:hasClaimValidity
aa:hasAccessCondition
aa:supportedBy
aa:fromEvidenceSource
aa:hasConfidenceState
aa:hasFreshnessState
aa:hasVerificationState
aa:hasContradictionState
aa:createdByResearchJob
aa:answersQuery
aa:hasCoverageGap
```

## 5. RDF example

```ttl
@prefix aa: <https://affordance-atlas.example/ontology#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:aff_catholic_mass a aa:Affordance ;
  aa:canonicalLabel "Catholic Mass" ;
  aa:category "religious_service" ;
  aa:subtype "catholic_mass" .

:place_example_church a aa:Place ;
  aa:canonicalName "Example Parish Church" ;
  aa:placeType "church" ;
  aa:address "123 Main St, Exampletown, NY" .

:timescope_sunday_1000 a aa:TimeScope ;
  aa:kind "recurrence" ;
  aa:timezone "America/New_York" ;
  aa:recurrenceRule "FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0" ;
  aa:recurrenceLabel "Sundays at 10:00 AM" .

:ev_001 a aa:EvidenceItem ;
  aa:itemClass "webpage" ;
  aa:sourceClass "official_primary" ;
  aa:retrievedAt "2026-06-16T12:00:00-05:00"^^xsd:dateTime ;
  aa:evidenceSpan "Sunday Mass 10:00 AM" .

:claim_001 a aa:AvailabilityClaim ;
  aa:assertsAffordance :aff_catholic_mass ;
  aa:atPlace :place_example_church ;
  aa:hasTimeScope :timescope_sunday_1000 ;
  aa:supportedBy :ev_001 ;
  aa:hasConfidenceState "high_confidence" ;
  aa:hasFreshnessState "current" ;
  aa:hasVerificationState "active" ;
  aa:hasContradictionState "none" .
```

## 6. Relation to schema.org

schema.org has useful adjacent types:

```text
schema:Place
schema:Event
schema:OpeningHoursSpecification
schema:Schedule
schema:Offer
schema:Service
```

But schema.org does not directly represent the Affordance Atlas kernel because it lacks first-class coverage gaps, research jobs, evidence provenance, freshness state, contradiction state, and open-world answer semantics.

## 7. Mapping to schema.org

Partial mappings:

```text
aa:Place                  → schema:Place
aa:Affordance             → schema:Service or schema:Event category depending on case
aa:TimeScope recurrence   → schema:Schedule or schema:OpeningHoursSpecification
aa:AvailabilityClaim      → no exact equivalent; may wrap schema objects
aa:EvidenceItem           → schema:CreativeWork or prov:Entity
aa:Answer                 → no exact equivalent
aa:CoverageGap            → no exact equivalent
aa:ResearchJob            → no exact equivalent
```

Use schema.org as export/interoperability vocabulary, not as the internal ontology.

## 8. Event / opening hours distinction

A discrete event can be represented as schema:Event.

Opening hours can be represented as schema:OpeningHoursSpecification.

But an AvailabilityClaim may be neither or may wrap either.

Examples:

```text
Mass every Sunday at 10:00
  Could map partly to Schedule, but the claim also needs evidence and verification state.

Museum open Monday 10-5
  Could map partly to OpeningHoursSpecification.

Guided tour Monday 2pm
  Could map partly to Event or Schedule.

Walk-in blood draw weekdays
  Could map partly to Service + Schedule.
```

## 9. Compiler/runtime framing

Affordance Atlas can be framed as a compiler/runtime.

Compiler side:

```text
UserIntent
→ parse
→ normalize
→ produce Query IR
→ produce ResolutionPlan
```

Runtime side:

```text
ResolutionPlan
→ claim lookup
→ recurrence projection
→ match evaluation
→ coverage-gap generation
→ answer composition
→ research job scheduling when needed
```

Acquisition side is like runtime feedback:

```text
CoverageGap
→ ResearchJob
→ EvidenceItem
→ AvailabilityClaim
→ updated claim store
→ future queries resolve synchronously
```

## 10. Compiler analogy limits

The analogy is useful but not exact.

Useful:

```text
raw intent becomes IR
IR becomes executable plan
runtime evaluates against state
missing symbols produce acquisition work
```

Not exact:

```text
world state changes
sources decay
claims have confidence
answers are open-world
research can change the symbol table
```

## 11. Small algebra

Let:

```text
A = set of Affordances
P = set of Places
S = set of ServiceAreas
T = set of TimeScopes
E = set of EvidenceItems
C = set of AvailabilityClaims
Q = set of NormalizedQueries
G = set of CoverageGaps
R = set of ResearchJobs
Ans = set of Answers
```

Core claim:

```text
c ∈ C = (a, p, s?, t, evidence, states, access_conditions)
where a ∈ A, p ∈ P, s? ∈ S ∪ null, t ∈ T
```

Core predicate:

```text
Available(a, p, t) is asserted by c iff c binds a, p, t and passes evidence/state checks.
```

## 12. Query as partial constraint

A query is a partial constraint over:

```text
A × P × T
```

Represent:

```text
q = (α, π, τ, χ)
```

where:

```text
α = affordance constraint
π = spatial constraint
τ = temporal constraint
χ = access constraints
```

## 13. Match function

```text
match(q, c) → full | partial | rejected
```

A claim fully matches when:

```text
α(c.affordance) = true
π(c.place or c.service_area) = true
τ(project(c.time_scope)) = true
χ(c.access_conditions) = true
state_ok(c) = true
```

## 14. State eligibility function

```text
state_ok(c) =
  evidence_exists(c)
  ∧ confidence(c) ∈ {high_confidence, probable}
  ∧ freshness(c) ∈ {current, recent}
  ∧ verification(c) ∈ {verified, active}
  ∧ contradiction(c) ∈ {none, resolved}
```

Category policies may override freshness and confidence thresholds.

## 15. Resolution function

```text
resolve(q, K) → Answer | CoverageGapSet
```

where K is the current claim base.

```text
M = { c ∈ K | match(q, c) = full }

if M ≠ ∅:
  return Answer(M)
else:
  return CoverageGapSet(q, K)
```

## 16. Acquisition function

```text
acquire(G) → ΔK | unresolved(G)
```

where:

```text
G = coverage gap set
ΔK = new or updated claims/evidence
```

Closed loop:

```text
resolve(q, K) = G
acquire(G) = ΔK
resolve(q, K ∪ ΔK) = Answer | G'
```

## 17. Open-world invariant

```text
¬∃c match(q, c) does not imply ¬Available(q)
```

Absence of a matching claim is a coverage condition, not a negative fact.

Negative answer requires positive evidence:

```text
NoSupportedAvailability(q) requires EvidenceItem supporting non-availability.
```

## 18. Decision summary

```text
N03 answer:
  RDF representation should reify AvailabilityClaim as a node because evidence,
  confidence, freshness, verification, contradiction, and provenance cannot be
  represented safely as a bare availability triple.

N17 answer:
  The system can be framed as compiler/runtime: UserIntent compiles to Query IR
  and ResolutionPlan; runtime evaluates against the claim store and emits Answer
  or CoverageGap-driven acquisition work.

N38 answer:
  schema.org Place, Event, Schedule, OpeningHoursSpecification, Service, and Offer
  are useful export mappings, but schema.org is not the internal ontology because
  it lacks claim provenance, coverage gaps, research jobs, and state semantics.

N41 answer:
  The domain can be expressed as a small algebra over claims, partial constraints,
  match, state eligibility, resolution, and acquisition under an open-world invariant.
```
