# Data Model and Schema Seeds

Filename: `11-data-model-and-schemas.md`

Answers DAG nodes: N11, N39.

Depends on:

```text
03-availability-claim-normal-form.md
04-query-answer-coverage.md
05-acquisition-loop.md
07-claim-state-and-confidence.md
08-recurrence-identity-async.md
10-system-architecture.md
```

## 1. Purpose

This document defines the first relational data model and JSON schema seed for AvailabilityClaims.

It answers:

```text
N11  What is the data model in SQL?
N39  What does a claim look like in JSON?
```

This is a schema seed, not a migration-ready final DDL.

## 2. Relational model principle

Separate durable entities from projections.

Durable tables:

```text
affordance
place
service_area
evidence_source
evidence_item
availability_claim
claim_version
access_condition
coverage_gap
research_job
research_step
answer
event_log
```

Projection tables may be regenerated.

## 3. Core tables

### 3.1 affordance

```sql
create table affordance (
  affordance_id text primary key,
  canonical_label text not null,
  category text not null,
  subtype text,
  provider_type text,
  created_at text not null,
  updated_at text not null
);
```

### 3.2 place

```sql
create table place (
  place_id text primary key,
  canonical_name text not null,
  place_type text,
  address text,
  latitude real,
  longitude real,
  jurisdiction text,
  parent_place_id text references place(place_id),
  identity_state text not null default 'unresolved',
  created_at text not null,
  updated_at text not null
);
```

### 3.3 service_area

```sql
create table service_area (
  service_area_id text primary key,
  label text not null,
  geometry_ref text,
  jurisdiction text,
  provider_place_id text references place(place_id),
  created_at text not null,
  updated_at text not null
);
```

### 3.4 evidence_source

```sql
create table evidence_source (
  evidence_source_id text primary key,
  source_class text not null,
  authority_level text,
  canonical_name text,
  locator text,
  created_at text not null,
  updated_at text not null
);
```

### 3.5 evidence_item

```sql
create table evidence_item (
  evidence_item_id text primary key,
  evidence_source_id text references evidence_source(evidence_source_id),
  item_class text not null,
  source_type text,
  source_locator text,
  retrieved_at text not null,
  published_at text,
  observed_at text,
  evidence_span text,
  extracted_text text,
  freshness_state text not null default 'unknown',
  artifact_ref text,
  created_at text not null
);
```

### 3.6 availability_claim

```sql
create table availability_claim (
  claim_id text primary key,
  schema_version text not null,
  affordance_id text references affordance(affordance_id),
  place_id text references place(place_id),
  service_area_id text references service_area(service_area_id),
  time_scope_json text not null,
  claim_validity_json text not null,
  verification_state text not null,
  confidence_state text not null,
  confidence_score real,
  freshness_state text not null,
  contradiction_state text not null,
  last_verified_at text,
  created_at text not null,
  updated_at text not null
);
```

### 3.7 claim_evidence

```sql
create table claim_evidence (
  claim_id text not null references availability_claim(claim_id),
  evidence_item_id text not null references evidence_item(evidence_item_id),
  support_role text not null default 'supports',
  primary key (claim_id, evidence_item_id)
);
```

### 3.8 access_condition

```sql
create table access_condition (
  access_condition_id text primary key,
  claim_id text not null references availability_claim(claim_id),
  condition_type text not null,
  value_json text,
  confidence_state text,
  created_at text not null
);
```

### 3.9 coverage_gap

```sql
create table coverage_gap (
  coverage_gap_id text primary key,
  query_id text,
  gap_type text not null,
  severity text not null,
  affected_constraint text not null,
  description text not null,
  status text not null default 'open',
  created_at text not null,
  updated_at text not null
);
```

### 3.10 research_job

```sql
create table research_job (
  research_job_id text primary key,
  query_id text,
  original_user_query text not null,
  normalized_query_json text not null,
  status text not null,
  scope_json text not null,
  objective_json text not null,
  created_at text not null,
  updated_at text not null
);
```

### 3.11 answer

```sql
create table answer (
  answer_id text primary key,
  query_id text not null,
  research_job_id text,
  answer_mode text not null,
  answer_state text not null,
  answer_json text not null,
  generated_at text not null
);
```

### 3.12 event_log

```sql
create table event_log (
  event_id text primary key,
  event_type text not null,
  occurred_at text not null,
  actor text,
  correlation_id text,
  causation_id text,
  entity_refs_json text,
  payload_json text not null
);
```

## 4. JSON AvailabilityClaim example

```json
{
  "claim_id": "claim_mass_example_church_sunday_1000",
  "claim_type": "availability_claim",
  "schema_version": "0.2.0",
  "lifecycle": {
    "verification_state": "active",
    "created_at": "2026-06-16T12:00:00-05:00",
    "updated_at": "2026-06-16T12:00:00-05:00",
    "last_verified_at": "2026-06-16T12:00:00-05:00"
  },
  "assertion": {
    "affordance": {
      "affordance_id": "aff_catholic_mass",
      "canonical_label": "Catholic Mass",
      "category": "religious_service",
      "subtype": "catholic_mass"
    },
    "place": {
      "place_id": "place_example_church",
      "canonical_name": "Example Parish Church",
      "place_type": "church",
      "address": "123 Main St, Exampletown, NY",
      "latitude": null,
      "longitude": null,
      "parent_place_id": null
    },
    "service_area": null,
    "time_scope": {
      "kind": "recurrence",
      "timezone": "America/New_York",
      "starts_at": null,
      "ends_at": null,
      "recurrence_rule": "FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0",
      "recurrence_label": "Sundays at 10:00 AM",
      "exception_rules": ["holiday schedules may override ordinary Sunday schedule"]
    },
    "claim_validity": {
      "valid_from": null,
      "valid_through": null,
      "validity_basis": "no explicit source validity window"
    },
    "access_conditions": [
      {
        "condition_type": "walk_in_allowed",
        "value": true,
        "confidence": "probable",
        "evidence_item_ids": ["ev_example_001"]
      }
    ]
  },
  "evidence": {
    "evidence_items": [
      {
        "evidence_item_id": "ev_example_001",
        "evidence_source_id": "src_example_church_website",
        "source_class": "official_primary",
        "item_class": "webpage",
        "source_type": "official_website",
        "source_locator": "https://example.invalid/mass-times",
        "retrieved_at": "2026-06-16T12:00:00-05:00",
        "published_at": null,
        "observed_at": null,
        "evidence_span": "Sunday Mass 10:00 AM",
        "extracted_text": "Sunday Mass 10:00 AM",
        "authority_level": "official",
        "freshness_state": "current"
      }
    ],
    "evidence_summary": "Official parish page lists Sunday Mass at 10:00 AM."
  },
  "assessments": {
    "confidence": {
      "state": "high_confidence",
      "score": null,
      "basis": ["official primary source", "specific recurrence", "source retrieved recently"]
    },
    "freshness_state": "current",
    "contradiction_state": "none"
  },
  "provenance": {
    "extraction_method": "manual",
    "extracted_by": null,
    "extraction_run_id": null,
    "normalized_by": null,
    "normalization_run_id": null
  },
  "contradiction": {
    "contradiction_state": "none",
    "contradicted_by_claim_ids": [],
    "notes": null
  }
}
```

## 5. Indexing requirements

Required lookup indexes:

```text
availability_claim(affordance_id)
availability_claim(place_id)
availability_claim(verification_state, confidence_state, freshness_state, contradiction_state)
evidence_item(evidence_source_id)
coverage_gap(query_id, status)
research_job(query_id, status)
event_log(correlation_id)
```

Geo and recurrence indexes may be added later.

## 6. Schema generation rule

`03-availability-claim-normal-form.md` remains the source of truth.

JSON Schema and SQL migrations must compile from or conform to that normal form.

## 7. Decision summary

```text
N11 answer:
  The first relational model separates affordances, places, service areas,
  evidence sources/items, availability claims, claim evidence links, access
  conditions, coverage gaps, research jobs, answers, and event log entries.

N39 answer:
  A JSON AvailabilityClaim is a schema_versioned object with lifecycle, assertion,
  evidence, assessments, provenance, and contradiction blocks, using the 0.2.0
  normal form.
```
