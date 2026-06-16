# Boundaries and Generalization

Filename: `09-boundaries-and-generalization.md`

Answers DAG nodes: N06, N15, N32, N34.

Depends on:

```text
00-affordance-atlas-kernel.md
02-minimal-ontology.md
04-query-answer-coverage.md
06-v0-scope.md
07-claim-state-and-confidence.md
08-recurrence-identity-async.md
```

## 1. Purpose

This document defines what Affordance Atlas is not, how it compares to adjacent products, how it generalizes beyond the first vertical, and what would force the ontology to reopen.

It answers:

```text
N06  What is the boundary between search, crawler, calendar, event aggregator, and this system?
N15  How would this compare to Google Maps / Perplexity / Eventbrite / Yelp?
N32  Can this be generalized beyond public events?
N34  What would make this not terminal / what would reopen the object?
```

## 2. Boundary statement

Affordance Atlas is not defined by source type, UI pattern, or acquisition method.

It is defined by its answer contract:

```text
Return sourced AvailabilityClaims over Available(Affordance, Place, TimeScope),
or expose/close coverage gaps.
```

Everything else is implementation or input.

## 3. Boundary against search

Search returns documents or passages matching a query.

Affordance Atlas returns normalized claims satisfying constraints.

Search may be used for:

```text
source discovery
candidate place discovery
evidence retrieval
fallback research
```

Search is not sufficient for:

```text
claim normalization
freshness assessment
contradiction handling
recurrence projection
negative answer policy
async knowledge acquisition
```

## 4. Boundary against crawler

A crawler fetches pages.

Affordance Atlas acquires, normalizes, verifies, stores, and answers from claims.

Crawler output may become EvidenceItem.

It does not by itself become AvailabilityClaim.

## 5. Boundary against calendar

A calendar stores scheduled time objects.

Affordance Atlas stores evidence-backed availability claims.

Calendars are good for:

```text
explicit events
structured recurrence
known source feeds
```

Calendars are weak for:

```text
source authority
place identity
access conditions
open-world coverage gaps
claims from PDFs or websites
holiday exceptions across sources
```

## 6. Boundary against event aggregator

Event aggregators usually collect discrete events.

Affordance Atlas covers:

```text
events
recurring services
opening-hour access
walk-in availability
appointment slots
public programs
rituals
facility access
office hours
mobile/service-area availability
```

The primitive is not Event.

The primitive is AvailabilityClaim.

## 7. Boundary against recommendation engine

Recommendation engines optimize preference fit.

Affordance Atlas first optimizes truth under constraints.

Preference and ranking are secondary:

```text
constraint satisfaction first
source support second
freshness/confidence/contradiction state third
ranking preference after eligibility
```

## 8. Comparison: Google Maps

Google Maps is strong at:

```text
place search
business profiles
hours
reviews
navigation
```

Affordance Atlas differs because it models:

```text
affordance-specific availability
recurring services beyond business hours
source evidence and claim provenance
coverage gaps
async acquisition
open-world uncertainty
claim lifecycle
```

Example:

```text
Church open hours do not imply Catholic Mass availability.
Clinic open hours do not imply blood draw availability.
Museum open hours do not imply guided tour availability.
```

## 9. Comparison: Perplexity / answer engines

Answer engines are strong at synthesizing web text.

Affordance Atlas differs because it persists normalized claims and reuses them.

The key distinction:

```text
one-off answer synthesis vs closed-loop claim-base expansion
```

Affordance Atlas should be able to answer a similar later query synchronously from stored claims.

## 10. Comparison: Eventbrite

Eventbrite is strong for ticketed, publisher-created events.

Affordance Atlas includes many affordances that are not ticketed events:

```text
Mass
confession
walk-in services
public office hours
facility access
municipal drop-off programs
clinic services
```

Eventbrite can be a source, not the domain boundary.

## 11. Comparison: Yelp

Yelp is strong at local business discovery and reviews.

Affordance Atlas differs because it resolves affordance-specific actionability.

Example:

```text
A restaurant listing is not the same as a reservation slot.
A gym listing is not the same as pickup basketball availability.
A clinic listing is not the same as walk-in lab service.
```

## 12. Generalization beyond public events

The domain generalizes wherever the following are true:

```text
a user has an intent to realize an affordance
availability is constrained by place or service area
availability is constrained by time
source evidence can support or refute a claim
missing coverage can be researched or integrated
```

Generalization targets:

```text
religious services
museum tours and admission
municipal services
library rooms and programs
medical lab services
public meetings
sports drop-ins
classes and workshops
seasonal markets
waste drop-off programs
passport/permit services
```

## 13. Generalization pressure by category

Some categories add new requirements.

```text
Appointments
  Need slot inventory, reservation status, expiration, booking API.

Medical services
  Need eligibility, insurance, high-stakes policy, stronger freshness.

Government services
  Need jurisdiction, eligibility, documents required, official-source priority.

Ticketed activities
  Need price, capacity, purchase link, cancellation policy.

Mobile services
  Need ServiceArea and route/time coupling.

Virtual/hybrid services
  Need modality and access link handling.
```

## 14. Ontology insufficiency tests

The ontology should reopen if a real use case cannot be represented without lying.

Reopen triggers:

```text
Availability depends on capacity inventory not representable as AccessCondition.
Availability depends on personalized eligibility not representable as AccessCondition.
Availability is probabilistic rather than claim-like.
Availability is negotiated, not pre-existing.
Place is replaced by dynamic route or moving provider.
Time is contingent on demand or queue state.
Affordance requires multi-step workflow rather than single realization.
Source evidence supports policy but not actual availability.
```

## 15. Examples that stress the ontology

```text
Walk-in blood draw at clinic
  Need eligibility, insurance, lab hours separate from clinic hours.

Passport renewal appointment
  Need slot availability, documents, jurisdiction, booking link.

Food pantry pickup
  Need eligibility, service area, capacity, holiday exceptions.

Mobile vaccination van
  Need moving place, route schedule, service area, access conditions.

Restaurant table for five
  Need reservation inventory, party size, time slot.
```

## 16. Boundary rule

If the user asks:

```text
What documents mention X?
```

that is search.

If the user asks:

```text
Can I do X at/near P during T?
```

that is Affordance Atlas.

If the answer requires:

```text
sourced Available(A, P, T)
```

then it belongs to this domain.

## 17. Decision summary

```text
N06 answer:
  The boundary is the answer contract: Affordance Atlas returns sourced
  AvailabilityClaims or explicit coverage gaps, not documents, listings, or
  generic events.

N15 answer:
  Compared with Google Maps, Perplexity, Eventbrite, and Yelp, Affordance Atlas
  persists evidence-backed affordance availability claims with freshness,
  recurrence, contradiction, and acquisition semantics.

N32 answer:
  The system generalizes beyond public events to any real-world affordance where
  whatness, whereness, whenness, access conditions, and evidence can be modeled.

N34 answer:
  The ontology must reopen when availability cannot be represented as a sourced
  claim over Affordance, Place/ServiceArea, TimeScope, ClaimValidity, and
  AccessCondition without hiding material conditions.
```
