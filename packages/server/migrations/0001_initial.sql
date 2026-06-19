-- Migration: initial schema
-- Creates the full relational model for affordance-atlas.

CREATE TABLE IF NOT EXISTS affordance (
  affordance_id TEXT PRIMARY KEY,
  canonical_label TEXT NOT NULL,
  category TEXT NOT NULL,
  subtype TEXT,
  provider_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS place (
  place_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  place_type TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  jurisdiction TEXT,
  parent_place_id TEXT REFERENCES place(place_id),
  identity_state TEXT NOT NULL DEFAULT 'unresolved',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_area (
  service_area_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  geometry_ref TEXT,
  jurisdiction TEXT,
  provider_place_id TEXT REFERENCES place(place_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_source (
  evidence_source_id TEXT PRIMARY KEY,
  source_class TEXT NOT NULL,
  authority_level TEXT,
  canonical_name TEXT,
  locator TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_item (
  evidence_item_id TEXT PRIMARY KEY,
  evidence_source_id TEXT REFERENCES evidence_source(evidence_source_id),
  item_class TEXT NOT NULL,
  source_type TEXT,
  source_locator TEXT,
  retrieved_at TEXT NOT NULL,
  published_at TEXT,
  observed_at TEXT,
  evidence_span TEXT,
  extracted_text TEXT,
  freshness_state TEXT NOT NULL DEFAULT 'unknown',
  artifact_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_claim (
  claim_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  affordance_id TEXT REFERENCES affordance(affordance_id),
  place_id TEXT REFERENCES place(place_id),
  service_area_id TEXT REFERENCES service_area(service_area_id),
  time_scope_json TEXT NOT NULL,
  claim_validity_json TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  confidence_state TEXT NOT NULL,
  confidence_score REAL,
  freshness_state TEXT NOT NULL,
  contradiction_state TEXT NOT NULL,
  last_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_version (
  claim_version_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES availability_claim(claim_id),
  version_number INTEGER NOT NULL,
  claim_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  UNIQUE(claim_id, version_number)
);

CREATE TABLE IF NOT EXISTS claim_evidence (
  claim_id TEXT NOT NULL REFERENCES availability_claim(claim_id),
  evidence_item_id TEXT NOT NULL REFERENCES evidence_item(evidence_item_id),
  support_role TEXT NOT NULL DEFAULT 'supports',
  PRIMARY KEY (claim_id, evidence_item_id)
);

CREATE TABLE IF NOT EXISTS access_condition (
  access_condition_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES availability_claim(claim_id),
  condition_type TEXT NOT NULL,
  value_json TEXT,
  confidence_state TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coverage_gap (
  coverage_gap_id TEXT PRIMARY KEY,
  query_id TEXT,
  gap_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  affected_constraint TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_job (
  research_job_id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  original_user_query TEXT NOT NULL,
  normalized_query_json TEXT NOT NULL,
  status TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  objective_json TEXT NOT NULL,
  result_answer_id TEXT,
  error_message TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scheduled_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS research_step (
  research_step_id TEXT PRIMARY KEY,
  research_job_id TEXT NOT NULL REFERENCES research_job(research_job_id),
  step_type TEXT NOT NULL,
  step_status TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answer (
  answer_id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  research_job_id TEXT REFERENCES research_job(research_job_id),
  answer_mode TEXT NOT NULL,
  answer_state TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_log (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  entity_refs_json TEXT,
  payload_json TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_claim_affordance_id ON availability_claim(affordance_id);
CREATE INDEX IF NOT EXISTS idx_availability_claim_place_id ON availability_claim(place_id);
CREATE INDEX IF NOT EXISTS idx_availability_claim_states ON availability_claim(verification_state, confidence_state, freshness_state, contradiction_state);
CREATE INDEX IF NOT EXISTS idx_evidence_item_source_id ON evidence_item(evidence_source_id);
CREATE INDEX IF NOT EXISTS idx_coverage_gap_query_status ON coverage_gap(query_id, status);
CREATE INDEX IF NOT EXISTS idx_research_job_query_status ON research_job(query_id, status);
CREATE INDEX IF NOT EXISTS idx_research_job_session ON research_job(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_correlation ON event_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_claim_version_claim ON claim_version(claim_id);
CREATE INDEX IF NOT EXISTS idx_access_condition_claim ON access_condition(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON claim_evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_item ON claim_evidence(evidence_item_id);
