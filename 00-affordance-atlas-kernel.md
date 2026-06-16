# Affordance Atlas Kernel

Filename: `00-affordance-atlas-kernel.md`

## 1. Purpose of this document

This document defines the semantic kernel of Affordance Atlas.

It specifies what the system is, what its primary objects mean, what an answer must contain, and when the system must admit insufficient coverage instead of pretending to know.

This document is pre-architecture. Later schemas, services, databases, agents, and user interfaces must conform to this kernel.

## 2. One-sentence definition

Affordance Atlas is a closed-loop, evidence-backed, spatiotemporal affordance-availability resolver: a system that converts partial user constraints over what, where, and when into sourced claims about real-world affordances available at physical places during bounded time scopes.

## 3. Domain definition

The domain is:

```text
sourced claims over Available(Affordance, Place, TimeScope)
```

queried by partial constraints over:

```text
Affordance × Place × TimeScope
```

with unresolved constraints converted into acquisition tasks.

Affordance Atlas is not primarily a search engine, event listing site, calendar, map, crawler, or recommendation engine.

It may use all of those as components or sources.

Its product object is:

```text
a sourced, freshness-aware, confidence-scored claim that an affordance is available at a place during a time scope
```

## 4. Kernel predicate

```text
Available(A, P, T)
```

means:

```text
A user can realize affordance A
at physical place P
during time scope T
under the stated access conditions,
according to cited evidence.
```

The predicate is claim-relative, not absolute.

More precise form:

```text
Claims(E, Available(A, P, T), C, V)
```

where:

```text
E = evidence
C = confidence assessment
V = verification state
```

The system should not assert bare availability without evidence and verification context.

## 5. Core primitive

The core primitive is:

```text
AffordanceAvailabilityClaim
```

Canonical meaning:

```text
An AffordanceAvailabilityClaim asserts that a specific affordance is available
at a specific place during a specific time scope, based on specific evidence,
with explicit freshness, confidence, and verification state.
```

Canonical shape:

```text
AffordanceAvailabilityClaim(
  claim_id,
  affordance,
  place,
  time_scope,
  access_conditions,
  evidence_set,
  confidence,
  verification_state,
  valid_from,
  valid_through,
  last_verified_at
)
```

A claim is not identical to an event.

A claim may describe an event, recurring service, opening-hour access, appointment slot, walk-in service, public program, ritual, tour, class, office hour, or other real-world opportunity.

## 6. Whatness

Whatness is the affordance the user wants to realize.

An affordance is:

```text
a real-world possibility of action, attendance, access, receipt, participation, or service-use
```

Examples:

```text
attend Mass
go to confession
visit a museum
get a blood draw
attend a class
join pickup basketball
attend a public meeting
renew a passport
take a guided tour
use a library reading room
drop off hazardous waste
```

Whatness is not merely a keyword.

It may involve:

```text
category
synonyms
subtype
eligibility
required reservation
cost
capacity
language
modality
service mode
ritual form
access restrictions
```

Examples of distinction:

```text
"Mass" is not identical to "church event".
"Confession" is not identical to "church open hours".
"Blood draw" is not identical to "clinic open".
"Guided tour" is not identical to "museum admission".
```

## 7. Whereness

Whereness is the physical-location constraint under which the affordance may be realized.

A place is:

```text
a physical location, venue, facility, campus, building, room, service point, or bounded service area
```

Examples:

```text
near Clifton Park, NY
at this church
inside this museum
within 20 minutes of me
at a named venue
on a campus
in a specific building
in a specific room
inside a transit station
within a county
```

Whereness may involve:

```text
place identity
address
coordinates
jurisdiction
service area
distance
travel time
campus/building/room hierarchy
entrance
accessibility
physical vs virtual distinction
```

The default domain is physical availability.

Virtual or hybrid affordances may be represented only when explicitly modeled as modality or access conditions.

## 8. Whenness

Whenness is the temporal constraint under which the affordance may be realized.

A TimeScope is:

```text
an instant, interval, date, daypart, recurrence rule, season, exception, validity window, or verification timestamp relevant to availability
```

Examples:

```text
next Sunday
on Monday
tomorrow morning
between 2pm and 5pm
every first Friday
during Lent
holiday schedule
walk-in weekdays
valid through August
last verified yesterday
```

Whenness must distinguish at least:

```text
user_requested_time
claim_availability_time
source_publication_time
source_retrieval_time
claim_last_verified_at
claim_validity_window
exception_time
```

Recurring availability is incomplete without exception handling.

A weekly schedule is not enough if holidays, closures, seasonal changes, or special calendars can override it.

## 9. User query form

A user query is a partial constraint over:

```text
What × Where × When
```

Common query forms:

```text
(A, ?, T)  → I want to do A during T. Where can I do it?
(?, P, T)  → I will be at P during T. What is available there then?
(A, P, ?)  → I want A at P. When is it available?
(A, P, T)  → Is A available at P during T?
(?, ?, T)  → What is available during T, within an implied or supplied area?
(A, ?, ?)  → Where and when can I realize A?
(?, P, ?)  → What affordances are generally available at P?
```

A query may be underspecified.

The system may infer missing constraints only when the inference is made explicit.

Examples:

```text
"near me" requires a user location or an explicitly supplied anchor.
"next Sunday" requires a timezone and calendar date.
"this place" requires a resolved place identity.
"Mass" requires category normalization and may require denomination/rite disambiguation.
```

## 10. Constraint normalization

Before resolution, the system must normalize:

```text
user intent → canonical affordance constraint
location phrase → canonical place or spatial constraint
time phrase → canonical time scope
```

Normalization must preserve uncertainty.

Example:

```text
User phrase: "mess next sunday"
Possible normalization:
  affordance: "Mass" if spelling/intent confidence is high
  temporal constraint: next Sunday in user's timezone
  spatial constraint: missing unless supplied by context
  uncertainty: spelling ambiguity retained
```

The system must not silently discard ambiguity that could change the answer.

## 11. Answer contract

An answer is not a list of links.

An answer is a set of availability claims satisfying the normalized constraints.

A canonical answer contains:

```text
answer_id
original_user_query
normalized_constraints
matching_claims
place details
time details
access conditions
evidence references
freshness
confidence
uncertainty
exceptions or caveats
coverage-gap notes, if any
recommended next action, if any
```

A user-facing answer may be concise, but the underlying answer object must preserve evidence and uncertainty.

The system should say “coverage is insufficient” rather than fabricate.

## 12. Closed-loop behavior

The system has two resolution paths.

### 12.1 Known-answer path

```text
query
→ parse and normalize constraints
→ search claim base
→ evaluate constraint satisfaction
→ evaluate freshness
→ evaluate confidence
→ compose sourced answer
→ answer synchronously
```

### 12.2 Unknown-answer path

```text
query
→ parse and normalize constraints
→ search claim base
→ detect coverage gap
→ create research job
→ acquire evidence
→ extract candidate claims
→ normalize claims
→ verify claims
→ update claim base
→ compose sourced answer
→ answer asynchronously
```

The system treats missing knowledge as work to perform, not as terminal failure.

## 13. Coverage gap

A coverage gap exists when the system cannot produce an answer that satisfies minimum requirements for relevance, freshness, evidence, and confidence.

Coverage gaps include:

```text
no resolved affordance
no resolved place
no resolved time scope
no candidate place known
candidate place known but no admissible source
source found but no relevant availability data
availability data found but stale
availability data found but contradicted
availability data found but insufficiently specific
category ambiguous
holiday exception unresolved
eligibility condition unresolved
reservation/capacity condition unresolved
```

Critical invariant:

```text
NoKnownAvailability(A, P, T) ≠ NotAvailable(A, P, T)
```

Absence of known data is not evidence of non-availability.

The system may say:

```text
"I do not have sufficient coverage to answer."
```

It must not say:

```text
"Nothing is available."
```

unless supported by evidence.

## 14. Evidence

Every availability claim must be grounded in evidence.

Evidence may include:

```text
official website
official calendar
PDF bulletin
posted schedule
embedded calendar
government page
venue page
trusted aggregator
user-submitted report
phone-confirmed note
manual verification note
```

Evidence must carry:

```text
evidence_id
source identity
source type
source URL or locator when available
retrieval time
publication time when available
extraction method
extracted support
evidence span or citation
freshness assessment
authority assessment
```

Evidence quality is not uniform.

Official, current, specific, directly relevant evidence outranks stale, indirect, generic, or third-party evidence.

## 15. Confidence

Confidence is not a generic LLM probability.

Confidence is a structured assessment of whether the claim is safe to use in an answer.

Confidence depends on:

```text
source authority
source freshness
extraction certainty
specificity of affordance
specificity of place
specificity of time
corroboration
contradiction state
known exception risk
verification history
```

Useful confidence states:

```text
verified
high_confidence
probable
candidate
stale
contradicted
insufficient
```

The system may compute numeric confidence internally, but user-facing confidence should be interpretable.

## 16. Verification state

Verification state answers:

```text
What do we know about the claim's reliability right now?
```

Initial states:

```text
candidate
extracted
normalized
verified
active
stale
contradicted
retired
```

State meanings:

```text
candidate     = possible claim found but not normalized or verified
extracted     = claim extracted from evidence
normalized    = claim mapped to canonical affordance/place/time
verified      = claim passed source, freshness, and consistency checks
active        = claim is usable for answers
stale         = claim may be outdated
contradicted  = claim conflicts with stronger or newer evidence
retired       = claim should not be used except for audit/history
```

A stale claim may be shown only as stale.

A contradicted claim must not silently appear as active.

## 17. Access conditions

Availability is incomplete without access conditions when those conditions affect user actionability.

Access conditions may include:

```text
reservation required
walk-in allowed
ticket required
cost
eligibility
age restriction
membership
language
capacity
dress code
security screening
accessibility
remote/hybrid modality
cancellation policy
```

A claim may still be valid when access conditions are unknown, but the unknowns must be represented.

Example:

```text
Available(guided_tour, museum, Monday 2pm)
```

is weaker than:

```text
Available(guided_tour, museum, Monday 2pm)
with reservation_required = true
and ticket_required = true
```

## 18. Acquisition loop

A research job exists to close a coverage gap.

Research job stages:

```text
preserve original user query
define missing constraints
discover candidate places or sources
retrieve evidence
classify evidence
extract candidate claims
normalize what/where/when
detect exceptions
detect contradictions
assign confidence
persist claims
compose answer
notify user
```

The acquisition loop must store what it learned, not merely answer the current user.

A completed research job should improve future synchronous coverage.

## 19. Async answer contract

An asynchronous answer must preserve continuity with the original query.

It must include:

```text
original query
research scope
newly acquired claims
evidence used
confidence
remaining uncertainty
answer timestamp
```

An async answer must not pretend it was known at query time.

It should distinguish:

```text
known before research
learned during research
still unknown
```

## 20. Human-in-the-loop boundary

Human review may be required when:

```text
sources conflict
evidence is ambiguous
the source is image-only or hard to parse
phone confirmation is needed
availability depends on eligibility
the answer is high-stakes
the claim would otherwise be misleading
the source has legal or access restrictions
```

Human intervention is part of the system boundary, not an implementation failure.

## 21. Non-goals

Affordance Atlas is not primarily:

```text
a generic search engine
an event listing site
a calendar app
a map app
a recommendation engine
a crawler
a chatbot wrapper
a business directory
a reservation platform
```

It may integrate with any of these.

But its core responsibility remains:

```text
produce, maintain, and answer from sourced real-world affordance-availability claims
```

## 22. Boundary against event search

Event search usually asks:

```text
What events match these keywords?
```

Affordance Atlas asks:

```text
What can a person actually do, attend, receive, or access,
at this place or near this place,
during this time scope,
according to what evidence?
```

Many valid claims are not events:

```text
opening hours
walk-in services
recurring rituals
appointment slots
seasonal schedules
office hours
public services
drop-in programs
facility access
scheduled services
```

## 23. Boundary against recommendations

Recommendations optimize preference fit.

Affordance Atlas first optimizes truth under constraints.

Ranking may consider convenience, distance, user preference, cost, freshness, and quality, but only after the system establishes that the affordance is plausibly available.

Constraint satisfaction precedes preference ranking.

## 24. Boundary against closed-world databases

Affordance Atlas is open-world with respect to missing data.

It may answer from a closed structured claim base only when the claim base has sufficient coverage.

Otherwise it must expose or close the gap.

```text
unknown ≠ false
unverified ≠ unavailable
stale ≠ active
candidate ≠ verified
```

## 25. Minimal ontology

Initial ontology:

```text
Affordance
AffordanceCategory
Place
SpatialConstraint
TimeScope
TemporalConstraint
AccessCondition
AvailabilityClaim
EvidenceSource
EvidenceItem
ConfidenceAssessment
VerificationState
CoverageGap
ResearchJob
UserIntent
NormalizedQuery
Answer
Notification
```

## 26. Minimal system modules

Initial module map:

```text
intent-parser
constraint-normalizer
place-resolver
time-resolver
affordance-normalizer
claim-store
coverage-checker
answer-composer
research-runner
source-discoverer
evidence-fetcher
claim-extractor
claim-normalizer
claim-verifier
evidence-ledger
contradiction-resolver
notification-runner
```

## 27. Minimal v0

A viable v0 may restrict scope to:

```text
one affordance category
one geography
official sources only
recurring schedules plus exceptions
semi-automated verification
synchronous answer when known
async answer when research completes
```

A strong first vertical is religious services, because it exercises:

```text
recurrence
official sources
physical places
holiday exceptions
stale schedules
category synonyms
partial user constraints
```

This is a good proving vertical, not a permanent product boundary.

## 28. Design invariants

```text
Every user-facing availability claim must have evidence.
No stale claim may appear fresh.
No contradicted claim may appear active.
No missing data may be treated as non-availability.
No answer may collapse whatness, whereness, and whenness into mere keyword match.
No async research job may lose the original user intent.
No source extraction may be accepted without provenance.
No ranking may outrank constraint satisfaction.
No recurrence may be treated as complete without exception awareness.
No inferred constraint may be hidden from the user.
No source may be treated as authoritative without source-class assessment.
```

## 29. Kernel summary

Affordance Atlas answers:

```text
What can I do, attend, receive, or access?
Where?
When?
Under what access conditions?
According to what evidence?
With what freshness and confidence?
```

Its fundamental predicate is:

```text
Available(Affordance, Place, TimeScope)
```

Its fundamental record is:

```text
AffordanceAvailabilityClaim
```

Its fundamental behavior is:

```text
answer when covered;
research when not covered;
store what was learned;
answer with provenance;
never confuse unknown with false.
```
