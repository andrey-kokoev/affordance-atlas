import {
  type Answer,
  type AnswerResult,
  type AnswerId,
  type ClaimId,
  type CoverageGapId,
  type EvidenceItemId,
  type QueryId,
  AccessConditionSchema,
  buildAnswer,
} from "@affordance-atlas/domain";
import type { ClaimMatch } from "./db.js";

export interface BuildAnswerFromClaimsInput {
  answerId: AnswerId;
  queryId: QueryId;
  originalUserQuery: string;
  normalizedQueryRef: QueryId;
  matches: ClaimMatch[];
  accessConditionsByClaim?: Record<string, import("zod").infer<typeof AccessConditionSchema>[]>;
}

function parseTimeScope(json: string): AnswerResult["occurrence"] {
  try {
    const ts = JSON.parse(json) as {
      timezone?: string;
      starts_at?: string | null;
      ends_at?: string | null;
      recurrence_payload?: { recurrence_label?: string | null } | null;
      recurrence_label?: string | null;
    };
    return {
      starts_at: ts.starts_at ?? null,
      ends_at: ts.ends_at ?? null,
      timezone: ts.timezone ?? "America/New_York",
      recurrence_label: ts.recurrence_payload?.recurrence_label ?? ts.recurrence_label ?? null,
    };
  } catch {
    return { starts_at: null, ends_at: null, timezone: "America/New_York", recurrence_label: null };
  }
}

export function buildAnswerFromClaims(input: BuildAnswerFromClaimsInput): Answer {
  const conditionsMap = input.accessConditionsByClaim ?? {};
  const results: AnswerResult[] = input.matches.map((match) => ({
    result_id: `result_${match.claim_id}`,
    claim_id: match.claim_id as ClaimId,
    affordance_label: match.affordance_label,
    place_label: match.place_name,
    place_address: match.place_address,
    occurrence: parseTimeScope(match.time_scope_json),
    access_conditions: conditionsMap[match.claim_id] ?? [],
    confidence_state: match.confidence_state as AnswerResult["confidence_state"],
    freshness_state: match.freshness_state as AnswerResult["freshness_state"],
    verification_state: match.verification_state as AnswerResult["verification_state"],
    contradiction_state: match.contradiction_state as AnswerResult["contradiction_state"],
    evidence_refs: [match.claim_id as unknown as EvidenceItemId],
    caveats: ["Verify details with the venue before traveling."],
  }));

  return buildAnswer({
    answer_id: input.answerId,
    query_id: input.queryId,
    answer_mode: "synchronous",
    answer_state: "answered",
    original_user_query: input.originalUserQuery,
    normalized_query_ref: input.normalizedQueryRef,
    results,
    answer_summary: `Found ${results.length} availability result(s) for "${input.originalUserQuery}".`,
    next_actions: [{ action_type: "none", label: "No further action needed." }],
  });
}

export function buildInsufficientCoverageAnswer(
  answerId: AnswerId,
  queryId: QueryId,
  originalUserQuery: string,
  normalizedQueryRef: QueryId,
): Answer {
  return buildAnswer({
    answer_id: answerId,
    query_id: queryId,
    answer_mode: "synchronous",
    answer_state: "insufficient_coverage",
    original_user_query: originalUserQuery,
    normalized_query_ref: normalizedQueryRef,
    coverage_gaps: [
      {
        gap_id: `gap_${queryId}` as CoverageGapId,
        gap_type: "missing_availability",
        description: `No availability claims found matching "${originalUserQuery}".`,
        constraint_field: "spatial",
        constraint_snapshot: { query: originalUserQuery },
        created_at: new Date().toISOString(),
        status: "open",
      },
    ],
    answer_summary: `We don't have availability data for "${originalUserQuery}" yet. Research has been queued.`,
    next_actions: [
      {
        action_type: "research",
        label: `Researching availability for "${originalUserQuery}".`,
      },
    ],
  });
}

export function buildDemoAnswer(
  answerId: AnswerId,
  queryId: QueryId,
  originalUserQuery: string,
  normalizedQueryRef: QueryId,
): Answer {
  return buildAnswer({
    answer_id: answerId,
    query_id: queryId,
    answer_mode: "synchronous",
    answer_state: "answered",
    original_user_query: originalUserQuery,
    normalized_query_ref: normalizedQueryRef,
    results: [
      {
        result_id: "result_demo",
        claim_id: "claim_demo" as ClaimId,
        affordance_label: "Catholic Mass",
        place_label: "St. Edward the Confessor Church",
        place_address: "527 Clifton Park Center Rd, Clifton Park, NY 12065",
        occurrence: {
          starts_at: "2026-06-21T10:00:00-04:00",
          ends_at: null,
          timezone: "America/New_York",
          recurrence_label: "Sundays at 10:00 AM",
        },
        access_conditions: [
          {
            condition_type: "walk_in_allowed",
            value: true,
            confidence: "probable",
            evidence_item_ids: ["ev_demo" as EvidenceItemId],
          },
        ],
        confidence_state: "probable",
        freshness_state: "current",
        verification_state: "active",
        contradiction_state: "none",
        evidence_refs: ["ev_demo" as EvidenceItemId],
        caveats: ["Confirm schedule with parish before traveling."],
      },
    ],
    answer_summary:
      "St. Edward the Confessor Church in Clifton Park offers Sunday Mass at 10:00 AM.",
    next_actions: [{ action_type: "none", label: "No further action needed." }],
  });
}
