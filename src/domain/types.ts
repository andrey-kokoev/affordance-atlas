// Affordance Atlas core domain type system.
// Source documents: 00-12 markdown/yaml semantic spine.

export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type IsoDate = Brand<string, "IsoDate">;
export type IsoDateTime = Brand<string, "IsoDateTime">;
export type IanaTimezone = Brand<string, "IanaTimezone">;
export type UrlString = Brand<string, "UrlString">;
export type RRuleString = Brand<string, "RRuleString">;

export type AffordanceId = Brand<string, "AffordanceId">;
export type PlaceId = Brand<string, "PlaceId">;
export type ServiceAreaId = Brand<string, "ServiceAreaId">;
export type TimeScopeId = Brand<string, "TimeScopeId">;
export type ClaimId = Brand<string, "ClaimId">;
export type EvidenceSourceId = Brand<string, "EvidenceSourceId">;
export type EvidenceItemId = Brand<string, "EvidenceItemId">;
export type CoverageGapId = Brand<string, "CoverageGapId">;
export type ResearchJobId = Brand<string, "ResearchJobId">;
export type ResearchStepId = Brand<string, "ResearchStepId">;
export type QueryId = Brand<string, "QueryId">;
export type AnswerId = Brand<string, "AnswerId">;
export type NotificationId = Brand<string, "NotificationId">;
export type EventId = Brand<string, "EventId">;
export type CorrelationId = Brand<string, "CorrelationId">;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type ConfidenceState =
  | "high_confidence"
  | "probable"
  | "candidate"
  | "insufficient";

export type FreshnessState =
  | "current"
  | "recent"
  | "possibly_stale"
  | "stale"
  | "unknown";

export type VerificationState =
  | "candidate"
  | "extracted"
  | "normalized"
  | "verified"
  | "active"
  | "stale"
  | "retired";

export type ContradictionState =
  | "none"
  | "suspected"
  | "confirmed"
  | "resolved";

export type SourceClass =
  | "official_primary"
  | "official_secondary"
  | "affiliated"
  | "trusted_aggregator"
  | "generic_aggregator"
  | "user_report"
  | "manual_verification"
  | "machine_inferred"
  | "unknown";

export type EvidenceItemClass =
  | "webpage"
  | "pdf"
  | "calendar_feed"
  | "calendar_event"
  | "structured_api_response"
  | "image_or_scan"
  | "posted_schedule_photo"
  | "phone_note"
  | "manual_observation_note"
  | "user_submission"
  | "search_result_snippet";

export type AuthorityLevel =
  | "official"
  | "affiliated"
  | "trusted_third_party"
  | "untrusted_third_party"
  | "user_report"
  | "manual_verification"
  | "unknown";

export type TimeScopeKind =
  | "instant"
  | "interval"
  | "date"
  | "daypart"
  | "recurrence"
  | "season"
  | "exception"
  | "unknown";

export type SpatialConstraintKind =
  | "exact_place"
  | "near_place"
  | "within_radius"
  | "within_travel_time"
  | "within_jurisdiction"
  | "inside_place"
  | "service_area_overlap"
  | "unspecified";

export type TemporalConstraintKind =
  | "exact_instant"
  | "interval"
  | "date"
  | "daypart"
  | "recurrence_filter"
  | "relative_date"
  | "unspecified";

export type AffordanceConstraintKind =
  | "exact"
  | "category"
  | "fuzzy"
  | "unspecified";

export type AccessConditionType =
  | "reservation_required"
  | "ticket_required"
  | "walk_in_allowed"
  | "cost"
  | "eligibility"
  | "capacity"
  | "language"
  | "accessibility"
  | "modality"
  | "other";

export type ExtractionMethod =
  | "manual"
  | "llm"
  | "parser"
  | "api_import"
  | "crawler"
  | "hybrid"
  | "unknown";

export interface AffordanceRef {
  readonly affordance_id: AffordanceId | null;
  readonly canonical_label: string;
  readonly category: string;
  readonly subtype: string | null;
}

export interface Affordance extends AffordanceRef {
  readonly affordance_id: AffordanceId;
  readonly synonyms: readonly string[];
  readonly intent_verbs: readonly string[];
  readonly object_nouns: readonly string[];
  readonly provider_type: string | null;
  readonly default_access_conditions: readonly AccessCondition[];
}

export interface PlaceRef {
  readonly place_id: PlaceId | null;
  readonly canonical_name: string;
  readonly place_type: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly parent_place_id: PlaceId | null;
}

export interface Place extends PlaceRef {
  readonly place_id: PlaceId;
  readonly jurisdiction: string | null;
  readonly source_place_ids: readonly string[];
  readonly identity_state: "resolved" | "probable" | "ambiguous" | "unresolved";
}

export interface ServiceAreaRef {
  readonly service_area_id: ServiceAreaId | null;
  readonly label: string | null;
  readonly geometry_ref: string | null;
  readonly jurisdiction: string | null;
}

export interface ServiceArea extends ServiceAreaRef {
  readonly service_area_id: ServiceAreaId;
  readonly provider_place_id: PlaceId | null;
}

export interface TimeScope {
  readonly time_scope_id?: TimeScopeId;
  readonly kind: TimeScopeKind;
  readonly timezone: IanaTimezone;
  readonly starts_at: IsoDateTime | null;
  readonly ends_at: IsoDateTime | null;
  readonly recurrence_rule: RRuleString | null;
  readonly recurrence_label: string | null;
  readonly exception_rules: readonly string[];
}

export interface ClaimValidity {
  readonly valid_from: IsoDate | null;
  readonly valid_through: IsoDate | null;
  readonly validity_basis: string | null;
}

export interface AccessCondition {
  readonly condition_type: AccessConditionType;
  readonly value: JsonValue;
  readonly confidence: ConfidenceState | null;
  readonly evidence_item_ids: readonly EvidenceItemId[];
}

export interface EvidenceSource {
  readonly evidence_source_id: EvidenceSourceId;
  readonly source_class: SourceClass;
  readonly authority_level: AuthorityLevel;
  readonly canonical_name: string | null;
  readonly locator: UrlString | string | null;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
}

export interface EvidenceItem {
  readonly evidence_item_id: EvidenceItemId;
  readonly evidence_source_id: EvidenceSourceId | null;
  readonly source_class: SourceClass;
  readonly item_class: EvidenceItemClass;
  readonly source_type: string | null;
  readonly source_locator: UrlString | string | null;
  readonly retrieved_at: IsoDateTime;
  readonly published_at: IsoDateTime | null;
  readonly observed_at: IsoDateTime | null;
  readonly evidence_span: string | null;
  readonly extracted_text: string | null;
  readonly authority_level: AuthorityLevel;
  readonly freshness_state: FreshnessState;
  readonly artifact_ref: string | null;
}

export interface ConfidenceAssessment {
  readonly state: ConfidenceState;
  readonly score: number | null;
  readonly basis: readonly string[];
}

export interface ClaimLifecycle {
  readonly verification_state: VerificationState;
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
  readonly last_verified_at: IsoDateTime | null;
}

export interface ClaimAssertion {
  readonly affordance: AffordanceRef;
  readonly place: PlaceRef;
  readonly service_area: ServiceAreaRef | null;
  readonly time_scope: TimeScope;
  readonly claim_validity: ClaimValidity;
  readonly access_conditions: readonly AccessCondition[];
}

export interface ClaimEvidence {
  readonly evidence_items: readonly EvidenceItem[];
  readonly evidence_summary: string | null;
}

export interface ClaimAssessments {
  readonly confidence: ConfidenceAssessment;
  readonly freshness_state: FreshnessState;
  readonly contradiction_state: ContradictionState;
}

export interface ClaimProvenance {
  readonly extraction_method: ExtractionMethod;
  readonly extracted_by: string | null;
  readonly extraction_run_id: string | null;
  readonly normalized_by: string | null;
  readonly normalization_run_id: string | null;
}

export interface ClaimContradiction {
  readonly contradiction_state: ContradictionState;
  readonly contradicted_by_claim_ids: readonly ClaimId[];
  readonly notes: string | null;
}

export interface AvailabilityClaim {
  readonly claim_id: ClaimId;
  readonly claim_type: "availability_claim";
  readonly schema_version: "0.2.0";
  readonly lifecycle: ClaimLifecycle;
  readonly assertion: ClaimAssertion;
  readonly evidence: ClaimEvidence;
  readonly assessments: ClaimAssessments;
  readonly provenance: ClaimProvenance;
  readonly contradiction: ClaimContradiction;
}

export type AffordanceAvailabilityClaim = AvailabilityClaim;

export interface GeneratedOccurrence {
  readonly occurrence_id: string;
  readonly claim_id: ClaimId;
  readonly starts_at: IsoDateTime;
  readonly ends_at: IsoDateTime | null;
  readonly timezone: IanaTimezone;
  readonly derivation: {
    readonly source_time_scope_id: TimeScopeId | null;
    readonly recurrence_rule: RRuleString | null;
    readonly exception_applied: boolean;
    readonly exception_source_claim_id: ClaimId | null;
    readonly caveats: readonly string[];
  };
}

export interface AffordanceConstraint {
  readonly kind: AffordanceConstraintKind;
  readonly canonical_label: string | null;
  readonly category: string | null;
  readonly subtype: string | null;
  readonly raw_phrase: string | null;
  readonly synonyms_considered: readonly string[];
  readonly normalization_confidence: ConfidenceState;
}

export interface SpatialConstraint {
  readonly kind: SpatialConstraintKind;
  readonly raw_phrase: string | null;
  readonly anchor_place_id: PlaceId | null;
  readonly anchor_label: string | null;
  readonly anchor_address: string | null;
  readonly anchor_coordinates: readonly [number, number] | null;
  readonly radius_distance: string | null;
  readonly max_travel_time: string | null;
  readonly travel_mode: string | null;
  readonly jurisdiction: string | null;
  readonly normalization_confidence: ConfidenceState;
}

export interface TemporalConstraint {
  readonly kind: TemporalConstraintKind;
  readonly raw_phrase: string | null;
  readonly timezone: IanaTimezone;
  readonly window_start: IsoDateTime | null;
  readonly window_end: IsoDateTime | null;
  readonly recurrence_filter: string | null;
  readonly daypart: string | null;
  readonly normalization_confidence: ConfidenceState;
}

export interface AccessConstraint {
  readonly condition_type: AccessConditionType;
  readonly desired_value: JsonValue;
  readonly required: boolean;
  readonly raw_phrase: string | null;
}

export interface Ambiguity {
  readonly field: string;
  readonly description: string;
  readonly candidates: readonly string[];
}

export interface InferredConstraint {
  readonly field: string;
  readonly value: JsonValue;
  readonly basis: string;
}

export interface NormalizedQuery {
  readonly query_id: QueryId;
  readonly schema_version: "0.1.0";
  readonly original_user_query: string;
  readonly parsed_at: IsoDateTime;
  readonly locale: string | null;
  readonly timezone: IanaTimezone;
  readonly constraints: {
    readonly affordance: AffordanceConstraint;
    readonly spatial: SpatialConstraint;
    readonly temporal: TemporalConstraint;
    readonly access: readonly AccessConstraint[];
  };
  readonly context: {
    readonly user_location: PlaceRef | null;
    readonly conversation_place: PlaceRef | null;
    readonly conversation_time_anchor: IsoDateTime | null;
    readonly prior_constraints: readonly string[];
  };
  readonly uncertainty: {
    readonly ambiguities: readonly Ambiguity[];
    readonly inferred_constraints: readonly InferredConstraint[];
    readonly unresolved_slots: readonly string[];
  };
  readonly requested_answer_mode: "synchronous" | "asynchronous_allowed" | "either";
}

export type MatchState = "full" | "partial" | "rejected";
export type AnswerState = "answered" | "partially_answered" | "insufficient_coverage" | "no_supported_availability";
export type AnswerMode = "synchronous" | "asynchronous";

export interface ClaimMatch {
  readonly claim_id: ClaimId;
  readonly match_state: MatchState;
  readonly dimensions: {
    readonly affordance_match: "exact" | "category" | "fuzzy" | "missing" | "rejected";
    readonly place_match: "exact" | "within_constraint" | "candidate" | "missing" | "rejected";
    readonly time_match: "exact_instance" | "recurrence_instance" | "overlaps" | "missing" | "rejected";
    readonly access_match: "satisfied" | "optional_missing" | "required_missing" | "rejected";
    readonly evidence_match: "admissible" | "weak" | "missing" | "rejected";
    readonly freshness_match: FreshnessState;
    readonly confidence_match: "sufficient" | "insufficient";
    readonly verification_match: "active" | "verified" | "stale" | "candidate" | "rejected";
    readonly contradiction_match: ContradictionState;
  };
  readonly generated_occurrences: readonly GeneratedOccurrence[];
}

export type CoverageGapType =
  | "affordance_unresolved"
  | "affordance_ambiguous"
  | "place_unresolved"
  | "place_ambiguous"
  | "spatial_scope_missing"
  | "time_unresolved"
  | "time_ambiguous"
  | "timezone_missing"
  | "no_candidate_places"
  | "no_candidate_claims"
  | "no_admissible_source"
  | "source_unreachable"
  | "source_found_no_availability_data"
  | "availability_data_stale"
  | "availability_data_insufficiently_specific"
  | "recurrence_exception_unresolved"
  | "access_condition_unresolved"
  | "reservation_or_capacity_unknown"
  | "evidence_missing"
  | "evidence_weak"
  | "confidence_insufficient"
  | "verification_state_not_answerable"
  | "contradictory_sources"
  | "claim_contradicted"
  | "answer_requires_research";

export interface CoverageGap {
  readonly coverage_gap_id: CoverageGapId;
  readonly query_id: QueryId;
  readonly gap_type: CoverageGapType;
  readonly severity: "blocking" | "degrading" | "informational";
  readonly affected_constraint: "affordance" | "place" | "time" | "access" | "evidence" | "freshness" | "confidence" | "verification" | "contradiction" | "answer";
  readonly description: string;
  readonly required_to_close: readonly string[];
  readonly suggested_research_actions: readonly string[];
}

export interface AnswerResult {
  readonly result_id: string;
  readonly claim_id: ClaimId;
  readonly affordance_label: string;
  readonly place_label: string;
  readonly place_address: string | null;
  readonly occurrence: {
    readonly starts_at: IsoDateTime | null;
    readonly ends_at: IsoDateTime | null;
    readonly timezone: IanaTimezone;
    readonly recurrence_label: string | null;
  };
  readonly access_conditions: readonly AccessCondition[];
  readonly confidence_state: ConfidenceState;
  readonly freshness_state: FreshnessState;
  readonly verification_state: VerificationState;
  readonly contradiction_state: ContradictionState;
  readonly evidence_refs: readonly EvidenceItemId[];
  readonly caveats: readonly string[];
}

export interface Answer {
  readonly answer_id: AnswerId;
  readonly schema_version: "0.1.0";
  readonly query_id: QueryId;
  readonly generated_at: IsoDateTime;
  readonly answer_mode: AnswerMode;
  readonly answer_state: AnswerState;
  readonly original_user_query: string;
  readonly normalized_query_ref: QueryId;
  readonly results: readonly AnswerResult[];
  readonly coverage_gaps: readonly CoverageGapId[];
  readonly answer_summary: string;
  readonly next_actions: readonly {
    readonly action_type: "research" | "verify" | "ask_user" | "none";
    readonly label: string;
  }[];
}

export type ResearchJobStatus =
  | "created"
  | "planned"
  | "discovering_sources"
  | "retrieving_evidence"
  | "extracting_claims"
  | "normalizing_claims"
  | "verifying_claims"
  | "awaiting_human_review"
  | "completed_with_answer"
  | "completed_partial"
  | "completed_insufficient_coverage"
  | "completed_no_supported_availability"
  | "failed"
  | "cancelled";

export interface ResearchStep {
  readonly step_id: ResearchStepId;
  readonly step_type:
    | "discover_candidate_places"
    | "discover_candidate_sources"
    | "fetch_source"
    | "classify_source"
    | "extract_availability_text"
    | "extract_candidate_claims"
    | "normalize_affordance"
    | "normalize_place"
    | "normalize_time_scope"
    | "extract_access_conditions"
    | "detect_exceptions"
    | "detect_contradictions"
    | "score_confidence"
    | "persist_claims"
    | "compose_answer"
    | "request_human_review";
  readonly input: JsonObject;
  readonly expected_output: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "skipped";
  readonly evidence_item_ids: readonly EvidenceItemId[];
  readonly notes: readonly string[];
}

export interface ResearchJob {
  readonly research_job_id: ResearchJobId;
  readonly schema_version: "0.1.0";
  readonly created_at: IsoDateTime;
  readonly updated_at: IsoDateTime;
  readonly status: ResearchJobStatus;
  readonly trigger: {
    readonly query_id: QueryId;
    readonly original_user_query: string;
    readonly normalized_query_ref: QueryId;
    readonly coverage_gap_ids: readonly CoverageGapId[];
  };
  readonly scope: {
    readonly affordance_constraint: AffordanceConstraint | null;
    readonly spatial_constraint: SpatialConstraint | null;
    readonly temporal_constraint: TemporalConstraint | null;
    readonly access_constraints: readonly AccessConstraint[];
  };
  readonly objective: {
    readonly goal: string;
    readonly required_outputs: readonly ("evidence_items" | "availability_claims" | "answer")[];
    readonly success_criteria: readonly string[];
  };
  readonly plan: {
    readonly steps: readonly ResearchStep[];
  };
  readonly outputs: {
    readonly evidence_item_ids: readonly EvidenceItemId[];
    readonly produced_claim_ids: readonly ClaimId[];
    readonly unresolved_gap_ids: readonly CoverageGapId[];
    readonly answer_id: AnswerId | null;
  };
  readonly audit: {
    readonly notes: readonly string[];
    readonly human_review_required: boolean;
    readonly human_review_reason: string | null;
  };
}

export interface AsyncAnswerEnvelope {
  readonly answer_id: AnswerId;
  readonly research_job_id: ResearchJobId;
  readonly original_query_id: QueryId;
  readonly original_user_query: string;
  readonly normalized_query_at_trigger: NormalizedQuery;
  readonly generated_at: IsoDateTime;
  readonly research_summary: {
    readonly sources_checked: readonly string[];
    readonly evidence_items_added: readonly EvidenceItemId[];
    readonly claims_created: readonly ClaimId[];
    readonly claims_updated: readonly ClaimId[];
    readonly unresolved_gap_ids: readonly CoverageGapId[];
  };
  readonly answer: Answer;
  readonly continuity: {
    readonly known_before_research: readonly string[];
    readonly learned_during_research: readonly string[];
    readonly still_unknown: readonly string[];
  };
}

export interface Notification {
  readonly notification_id: NotificationId;
  readonly answer_id: AnswerId;
  readonly research_job_id: ResearchJobId | null;
  readonly delivery_channel: "in_app" | "email" | "webhook" | "log_only";
  readonly delivery_state: "pending" | "sent" | "failed" | "suppressed";
  readonly created_at: IsoDateTime;
  readonly sent_at: IsoDateTime | null;
  readonly summary: string;
}

export interface DomainEvent {
  readonly event_id: EventId;
  readonly event_type: string;
  readonly occurred_at: IsoDateTime;
  readonly actor: string | null;
  readonly correlation_id: CorrelationId | null;
  readonly causation_id: EventId | null;
  readonly entity_refs: {
    readonly query_id?: QueryId;
    readonly claim_id?: ClaimId;
    readonly evidence_item_id?: EvidenceItemId;
    readonly research_job_id?: ResearchJobId;
    readonly answer_id?: AnswerId;
  };
  readonly payload: JsonObject;
}

export function isAnswerEligibleClaim(claim: AvailabilityClaim): boolean {
  return (
    (claim.lifecycle.verification_state === "verified" || claim.lifecycle.verification_state === "active") &&
    (claim.assessments.confidence.state === "high_confidence" || claim.assessments.confidence.state === "probable") &&
    (claim.assessments.freshness_state === "current" || claim.assessments.freshness_state === "recent") &&
    (claim.assessments.contradiction_state === "none" || claim.assessments.contradiction_state === "resolved") &&
    claim.evidence.evidence_items.length > 0
  );
}
