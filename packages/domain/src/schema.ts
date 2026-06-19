import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const IanaTimezoneSchema = z.string().min(1);
export const UrlStringSchema = z.string().url();
export const RRuleStringSchema = z.string().min(1);

declare const brand: unique symbol;

export type BrandedId<Kind extends string> = string & { readonly [brand]: Kind };

export type AffordanceId = BrandedId<"affordance_id">;
export type PlaceId = BrandedId<"place_id">;
export type ServiceAreaId = BrandedId<"service_area_id">;
export type TimeScopeId = BrandedId<"time_scope_id">;
export type ClaimId = BrandedId<"claim_id">;
export type EvidenceSourceId = BrandedId<"evidence_source_id">;
export type EvidenceItemId = BrandedId<"evidence_item_id">;
export type CoverageGapId = BrandedId<"coverage_gap_id">;
export type ResearchJobId = BrandedId<"research_job_id">;
export type ResearchStepId = BrandedId<"research_step_id">;
export type QueryId = BrandedId<"query_id">;
export type AnswerId = BrandedId<"answer_id">;
export type NotificationId = BrandedId<"notification_id">;
export type EventId = BrandedId<"event_id">;
export type CorrelationId = BrandedId<"correlation_id">;

function makeIdSchema<Kind extends string>(_kind: Kind) {
  return z.string().min(1).transform((s) => s as BrandedId<Kind>);
}

export const AffordanceIdSchema = makeIdSchema<"affordance_id">("affordance_id");
export const PlaceIdSchema = makeIdSchema<"place_id">("place_id");
export const ServiceAreaIdSchema = makeIdSchema<"service_area_id">("service_area_id");
export const TimeScopeIdSchema = makeIdSchema<"time_scope_id">("time_scope_id");
export const ClaimIdSchema = makeIdSchema<"claim_id">("claim_id");
export const EvidenceSourceIdSchema = makeIdSchema<"evidence_source_id">("evidence_source_id");
export const EvidenceItemIdSchema = makeIdSchema<"evidence_item_id">("evidence_item_id");
export const CoverageGapIdSchema = makeIdSchema<"coverage_gap_id">("coverage_gap_id");
export const ResearchJobIdSchema = makeIdSchema<"research_job_id">("research_job_id");
export const ResearchStepIdSchema = makeIdSchema<"research_step_id">("research_step_id");
export const QueryIdSchema = makeIdSchema<"query_id">("query_id");
export const AnswerIdSchema = makeIdSchema<"answer_id">("answer_id");
export const NotificationIdSchema = makeIdSchema<"notification_id">("notification_id");
export const EventIdSchema = makeIdSchema<"event_id">("event_id");
export const CorrelationIdSchema = makeIdSchema<"correlation_id">("correlation_id");

export const ConfidenceStateSchema = z.enum(["high_confidence", "probable", "candidate", "insufficient"]);
export const FreshnessStateSchema = z.enum(["current", "recent", "possibly_stale", "stale", "unknown"]);
export const VerificationStateSchema = z.enum(["candidate", "extracted", "normalized", "verified", "active", "stale", "retired"]);
export const ContradictionStateSchema = z.enum(["none", "suspected", "confirmed", "resolved"]);

export const SourceClassSchema = z.enum([
  "official_primary",
  "official_secondary",
  "affiliated",
  "trusted_aggregator",
  "generic_aggregator",
  "user_report",
  "manual_verification",
  "machine_inferred",
  "unknown",
]);

export const EvidenceItemClassSchema = z.enum([
  "webpage",
  "pdf",
  "calendar_feed",
  "calendar_event",
  "structured_api_response",
  "image_or_scan",
  "posted_schedule_photo",
  "phone_note",
  "manual_observation_note",
  "user_submission",
  "search_result_snippet",
]);

export const AuthorityLevelSchema = z.enum([
  "official",
  "affiliated",
  "trusted_third_party",
  "untrusted_third_party",
  "user_report",
  "manual_verification",
  "unknown",
]);

export const AccessConditionTypeSchema = z.enum([
  "reservation_required",
  "ticket_required",
  "walk_in_allowed",
  "cost",
  "eligibility",
  "capacity",
  "language",
  "accessibility",
  "modality",
  "other",
]);

export const ExtractionMethodSchema = z.enum(["manual", "llm", "parser", "api_import", "crawler", "hybrid", "unknown"]);

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);

export const AffordanceRefSchema = z.object({
  affordance_id: AffordanceIdSchema.nullable(),
  canonical_label: z.string().min(1),
  category: z.string().min(1),
  subtype: z.string().min(1).nullable(),
});

export const PlaceRefSchema = z.object({
  place_id: PlaceIdSchema.nullable(),
  canonical_name: z.string().min(1),
  place_type: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  parent_place_id: PlaceIdSchema.nullable(),
});

export const ServiceAreaRefSchema = z.object({
  service_area_id: ServiceAreaIdSchema.nullable(),
  label: z.string().min(1).nullable(),
  geometry_ref: z.string().min(1).nullable(),
  jurisdiction: z.string().min(1).nullable(),
});

export const InstantTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("instant"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema,
  ends_at: z.null(),
  recurrence_rule: z.null(),
  recurrence_label: z.null(),
  exception_rules: z.array(z.string()),
});

export const IntervalTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("interval"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema,
  ends_at: IsoDateTimeSchema,
  recurrence_rule: z.null(),
  recurrence_label: z.null(),
  exception_rules: z.array(z.string()),
});

export const RecurrenceTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("recurrence"),
  timezone: IanaTimezoneSchema,
  starts_at: z.null(),
  ends_at: z.null(),
  recurrence_payload: z.union([
    z.object({
      recurrence_rule: RRuleStringSchema,
      recurrence_label: z.string().min(1).nullable(),
    }),
    z.object({
      recurrence_rule: z.null(),
      recurrence_label: z.string().min(1),
    }),
  ]),
  exception_rules: z.array(z.string()),
});

export const DateTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("date"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema.nullable(),
  ends_at: IsoDateTimeSchema.nullable(),
  recurrence_rule: z.null(),
  recurrence_label: z.string().min(1).nullable(),
  exception_rules: z.array(z.string()),
});

export const DaypartTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("daypart"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema.nullable(),
  ends_at: IsoDateTimeSchema.nullable(),
  recurrence_rule: z.null(),
  recurrence_label: z.string().min(1).nullable(),
  exception_rules: z.array(z.string()),
});

export const SeasonTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("season"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema.nullable(),
  ends_at: IsoDateTimeSchema.nullable(),
  recurrence_rule: z.null(),
  recurrence_label: z.string().min(1).nullable(),
  exception_rules: z.array(z.string()),
});

export const ExceptionTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("exception"),
  timezone: IanaTimezoneSchema,
  starts_at: IsoDateTimeSchema.nullable(),
  ends_at: IsoDateTimeSchema.nullable(),
  recurrence_rule: RRuleStringSchema.nullable(),
  recurrence_label: z.string().min(1).nullable(),
  exception_rules: z.array(z.string()),
});

export const UnknownTimeScopeSchema = z.object({
  time_scope_id: TimeScopeIdSchema.optional(),
  kind: z.literal("unknown"),
  timezone: IanaTimezoneSchema,
  starts_at: z.null(),
  ends_at: z.null(),
  recurrence_rule: z.null(),
  recurrence_label: z.null(),
  exception_rules: z.array(z.string()),
});

export const TimeScopeSchema = z.discriminatedUnion("kind", [
  InstantTimeScopeSchema,
  IntervalTimeScopeSchema,
  RecurrenceTimeScopeSchema,
  DateTimeScopeSchema,
  DaypartTimeScopeSchema,
  SeasonTimeScopeSchema,
  ExceptionTimeScopeSchema,
  UnknownTimeScopeSchema,
]);

export const ClaimValiditySchema = z.object({
  valid_from: IsoDateSchema.nullable(),
  valid_through: IsoDateSchema.nullable(),
  validity_basis: z.string().min(1).nullable(),
});

export const AccessConditionSchema = z.object({
  condition_type: AccessConditionTypeSchema,
  value: JsonValueSchema,
  confidence: ConfidenceStateSchema.nullable(),
  evidence_item_ids: z.array(EvidenceItemIdSchema),
});

export const EvidenceItemSchema = z.object({
  evidence_item_id: EvidenceItemIdSchema,
  evidence_source_id: EvidenceSourceIdSchema.nullable(),
  source_class: SourceClassSchema,
  item_class: EvidenceItemClassSchema,
  source_type: z.string().min(1).nullable(),
  source_locator: z.union([UrlStringSchema, z.string().min(1)]).nullable(),
  retrieved_at: IsoDateTimeSchema,
  published_at: IsoDateTimeSchema.nullable(),
  observed_at: IsoDateTimeSchema.nullable(),
  evidence_span: z.string().min(1).nullable(),
  extracted_text: z.string().min(1).nullable(),
  authority_level: AuthorityLevelSchema,
  freshness_state: FreshnessStateSchema,
  artifact_ref: z.string().min(1).nullable(),
});

export const ConfidenceAssessmentSchema = z.object({
  state: ConfidenceStateSchema,
  score: z.number().min(0).max(1).nullable(),
  basis: z.array(z.string().min(1)),
});

export const AvailabilityClaimSchema = z.object({
  claim_id: ClaimIdSchema,
  claim_type: z.literal("availability_claim"),
  schema_version: z.literal("0.2.0"),
  lifecycle: z.object({
    verification_state: VerificationStateSchema,
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    last_verified_at: IsoDateTimeSchema.nullable(),
  }),
  assertion: z.object({
    affordance: AffordanceRefSchema,
    place: PlaceRefSchema,
    service_area: ServiceAreaRefSchema.nullable(),
    time_scope: TimeScopeSchema,
    claim_validity: ClaimValiditySchema,
    access_conditions: z.array(AccessConditionSchema),
  }),
  evidence: z.object({
    evidence_items: z.array(EvidenceItemSchema).min(1),
    evidence_summary: z.string().min(1).nullable(),
  }),
  assessments: z.object({
    confidence: ConfidenceAssessmentSchema,
    freshness_state: FreshnessStateSchema,
    contradiction_state: ContradictionStateSchema,
  }),
  provenance: z.object({
    extraction_method: ExtractionMethodSchema,
    extracted_by: z.string().min(1).nullable(),
    extraction_run_id: z.string().min(1).nullable(),
    normalized_by: z.string().min(1).nullable(),
    normalization_run_id: z.string().min(1).nullable(),
  }),
  contradiction: z.object({
    contradiction_state: ContradictionStateSchema,
    contradicted_by_claim_ids: z.array(ClaimIdSchema),
    notes: z.string().min(1).nullable(),
  }),
}).superRefine((claim, ctx) => {
  if (claim.assessments.contradiction_state !== claim.contradiction.contradiction_state) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contradiction", "contradiction_state"], message: "contradiction state must agree with assessments.contradiction_state" });
  }

  if (claim.lifecycle.verification_state === "active") {
    const eligible =
      (claim.assessments.confidence.state === "high_confidence" || claim.assessments.confidence.state === "probable") &&
      (claim.assessments.freshness_state === "current" || claim.assessments.freshness_state === "recent") &&
      (claim.assessments.contradiction_state === "none" || claim.assessments.contradiction_state === "resolved");

    if (!eligible) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lifecycle", "verification_state"], message: "active claims must have answer-eligible confidence, freshness, and contradiction states" });
    }
  }
});

export const AffordanceConstraintSchema = z.object({
  kind: z.enum(["exact", "category", "fuzzy", "unspecified"]),
  canonical_label: z.string().min(1).nullable(),
  category: z.string().min(1).nullable(),
  subtype: z.string().min(1).nullable(),
  raw_phrase: z.string().min(1).nullable(),
  synonyms_considered: z.array(z.string()),
  normalization_confidence: ConfidenceStateSchema,
});

const SpatialConstraintBaseSchema = z.object({
  raw_phrase: z.string().nullable(),
  anchor_place_id: PlaceIdSchema.nullable(),
  anchor_label: z.string().nullable(),
  anchor_address: z.string().nullable(),
  anchor_coordinates: z.tuple([z.number(), z.number()]).nullable(),
  radius_distance: z.string().nullable(),
  max_travel_time: z.string().nullable(),
  travel_mode: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  normalization_confidence: ConfidenceStateSchema,
});

export const SpatialConstraintSchema = z.union([
  SpatialConstraintBaseSchema.extend({ kind: z.literal("exact_place"), anchor_place_id: PlaceIdSchema }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("within_radius"), radius_distance: z.string().min(1) }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("near_place") }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("within_travel_time") }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("within_jurisdiction") }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("inside_place") }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("service_area_overlap") }),
  SpatialConstraintBaseSchema.extend({ kind: z.literal("unspecified") }),
]);

const TemporalConstraintBaseSchema = z.object({
  raw_phrase: z.string().nullable(),
  timezone: IanaTimezoneSchema,
  window_start: IsoDateTimeSchema.nullable(),
  window_end: IsoDateTimeSchema.nullable(),
  recurrence_filter: z.string().nullable(),
  daypart: z.string().nullable(),
  normalization_confidence: ConfidenceStateSchema,
});

export const TemporalConstraintSchema = z.union([
  TemporalConstraintBaseSchema.extend({ kind: z.literal("relative_date"), raw_phrase: z.string().min(1), window_start: IsoDateTimeSchema, window_end: IsoDateTimeSchema }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("exact_instant") }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("interval") }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("date") }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("daypart") }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("recurrence_filter") }),
  TemporalConstraintBaseSchema.extend({ kind: z.literal("unspecified") }),
]);

export const AccessConstraintSchema = z.object({
  condition_type: AccessConditionTypeSchema,
  desired_value: JsonValueSchema,
  required: z.boolean(),
  raw_phrase: z.string().min(1).nullable(),
});

export const NormalizedQuerySchema = z.object({
  query_id: QueryIdSchema,
  schema_version: z.literal("0.1.0"),
  original_user_query: z.string().min(1),
  parsed_at: IsoDateTimeSchema,
  locale: z.string().min(1).nullable(),
  timezone: IanaTimezoneSchema,
  constraints: z.object({
    affordance: AffordanceConstraintSchema,
    spatial: SpatialConstraintSchema,
    temporal: TemporalConstraintSchema,
    access: z.array(AccessConstraintSchema),
  }),
  context: z.object({
    user_location: PlaceRefSchema.nullable(),
    conversation_place: PlaceRefSchema.nullable(),
    conversation_time_anchor: IsoDateTimeSchema.nullable(),
    prior_constraints: z.array(z.string()),
  }),
  uncertainty: z.object({
    ambiguities: z.array(z.object({ field: z.string(), description: z.string(), candidates: z.array(z.string()) })),
    inferred_constraints: z.array(z.object({ field: z.string(), value: JsonValueSchema, basis: z.string() })),
    unresolved_slots: z.array(z.string()),
  }),
  requested_answer_mode: z.enum(["synchronous", "asynchronous_allowed", "either"]),
});

export const CoverageGapTypeSchema = z.enum([
  "missing_place",
  "missing_time",
  "missing_availability",
  "missing_access_conditions",
  "ambiguous_query",
  "source_conflict",
]);

export const CoverageGapSchema = z.object({
  gap_id: CoverageGapIdSchema,
  gap_type: CoverageGapTypeSchema,
  description: z.string().min(1),
  constraint_field: z.enum(["affordance", "spatial", "temporal", "access"]),
  constraint_snapshot: JsonValueSchema,
  created_at: IsoDateTimeSchema,
  status: z.enum(["open", "researching", "resolved"]),
});

export const AnswerResultSchema = z.object({
  result_id: z.string().min(1),
  claim_id: ClaimIdSchema,
  affordance_label: z.string().min(1),
  place_label: z.string().min(1),
  place_address: z.string().min(1).nullable(),
  occurrence: z.object({
    starts_at: IsoDateTimeSchema.nullable(),
    ends_at: IsoDateTimeSchema.nullable(),
    timezone: IanaTimezoneSchema,
    recurrence_label: z.string().min(1).nullable(),
  }),
  access_conditions: z.array(AccessConditionSchema),
  confidence_state: ConfidenceStateSchema,
  freshness_state: FreshnessStateSchema,
  verification_state: VerificationStateSchema,
  contradiction_state: ContradictionStateSchema,
  evidence_refs: z.array(EvidenceItemIdSchema).min(1),
  caveats: z.array(z.string()),
});

export const AnswerSchema = z.object({
  answer_id: AnswerIdSchema,
  schema_version: z.literal("0.1.0"),
  query_id: QueryIdSchema,
  generated_at: IsoDateTimeSchema,
  answer_mode: z.enum(["synchronous", "asynchronous"]),
  answer_state: z.enum(["answered", "partially_answered", "insufficient_coverage", "no_supported_availability"]),
  original_user_query: z.string().min(1),
  normalized_query_ref: QueryIdSchema,
  results: z.array(AnswerResultSchema),
  coverage_gaps: z.array(CoverageGapSchema),
  answer_summary: z.string().min(1),
  next_actions: z.array(z.object({ action_type: z.enum(["research", "verify", "ask_user", "none"]), label: z.string() })),
}).superRefine((answer, ctx) => {
  if (answer.answer_state === "answered" && answer.results.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["results"], message: "answered requires at least one result" });
  }
  if (answer.answer_state === "insufficient_coverage" && answer.coverage_gaps.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coverage_gaps"], message: "insufficient_coverage requires coverage gaps" });
  }
});

export const ResearchJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const ResearchJobSchema = z.object({
  job_id: ResearchJobIdSchema,
  query_id: QueryIdSchema,
  query_snapshot: NormalizedQuerySchema,
  status: ResearchJobStatusSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  scheduled_at: IsoDateTimeSchema.nullable(),
  completed_at: IsoDateTimeSchema.nullable(),
  result_answer_id: AnswerIdSchema.nullable(),
  error_message: z.string().nullable(),
});

export type AvailabilityClaim = z.infer<typeof AvailabilityClaimSchema>;
export type NormalizedQuery = z.infer<typeof NormalizedQuerySchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type AnswerResult = z.infer<typeof AnswerResultSchema>;
export type CoverageGap = z.infer<typeof CoverageGapSchema>;
export type ResearchJob = z.infer<typeof ResearchJobSchema>;

interface AnsweredAnswerInput {
  answer_id: string;
  query_id: string;
  answer_mode: "synchronous" | "asynchronous";
  answer_state: "answered";
  original_user_query: string;
  normalized_query_ref: string;
  results: AnswerResult[];
  coverage_gaps?: [];
  answer_summary: string;
  next_actions: { action_type: "research" | "verify" | "ask_user" | "none"; label: string }[];
}

interface GappyAnswerInput {
  answer_id: string;
  query_id: string;
  answer_mode: "synchronous" | "asynchronous";
  answer_state: "insufficient_coverage" | "partially_answered" | "no_supported_availability";
  original_user_query: string;
  normalized_query_ref: string;
  results?: AnswerResult[];
  coverage_gaps: CoverageGap[];
  answer_summary: string;
  next_actions: { action_type: "research" | "verify" | "ask_user" | "none"; label: string }[];
}

export function buildAnswer(input: AnsweredAnswerInput | GappyAnswerInput): Answer {
  const base = {
    schema_version: "0.1.0" as const,
    generated_at: new Date().toISOString(),
    results: input.results ?? [],
    coverage_gaps: input.coverage_gaps ?? [],
  };

  if (input.answer_state === "answered") {
    return AnswerSchema.parse({
      ...input,
      ...base,
      coverage_gaps: [],
    });
  }

  return AnswerSchema.parse({
    ...input,
    ...base,
  });
}

export function parseAvailabilityClaim(input: unknown): AvailabilityClaim {
  return AvailabilityClaimSchema.parse(input);
}

export function parseNormalizedQuery(input: unknown): NormalizedQuery {
  return NormalizedQuerySchema.parse(input);
}

export function parseAnswer(input: unknown): Answer {
  return AnswerSchema.parse(input);
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
