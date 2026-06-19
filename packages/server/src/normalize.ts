import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import type { Ai } from "@cloudflare/workers-types";
import {
  type NormalizedQuery,
  type PlaceId,
  type QueryId,
  IanaTimezoneSchema,
} from "@affordance-atlas/domain";
import { z } from "zod";

const NormalizedQueryShapeSchema = z.object({
  original_user_query: z.string().min(1),
  locale: z.string().nullable(),
  timezone: IanaTimezoneSchema,
  affordance: z.object({
    kind: z.enum(["exact", "category", "fuzzy", "unspecified"]),
    canonical_label: z.string().nullable(),
    category: z.string().nullable(),
    subtype: z.string().nullable(),
    raw_phrase: z.string().nullable(),
    synonyms_considered: z.array(z.string()),
  }),
  spatial: z.object({
    kind: z.enum([
      "exact_place",
      "within_radius",
      "near_place",
      "within_travel_time",
      "within_jurisdiction",
      "inside_place",
      "service_area_overlap",
      "unspecified",
    ]),
    raw_phrase: z.string().nullable(),
    anchor_place_id: z.string().nullable(),
    anchor_label: z.string().nullable(),
    anchor_address: z.string().nullable(),
    anchor_coordinates: z.array(z.number()).length(2).nullable(),
    radius_distance: z.string().nullable(),
    max_travel_time: z.string().nullable(),
    travel_mode: z.string().nullable(),
    jurisdiction: z.string().nullable(),
  }),
  temporal: z.object({
    kind: z.enum([
      "relative_date",
      "exact_instant",
      "interval",
      "date",
      "daypart",
      "recurrence_filter",
      "unspecified",
    ]),
    raw_phrase: z.string().nullable(),
    window_start: z.string().datetime({ offset: true }).nullable(),
    window_end: z.string().datetime({ offset: true }).nullable(),
    recurrence_filter: z.string().nullable(),
    daypart: z.string().nullable(),
  }),
  access: z.array(
    z.object({
      condition_type: z.enum([
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
      ]),
      desired_value: z.unknown(),
      required: z.boolean(),
      raw_phrase: z.string().nullable(),
    }),
  ),
});

export interface NormalizeQueryInput {
  userQuery: string;
  queryId: QueryId;
  userTimezone?: string;
}

export async function normalizeUserQuery(
  aiBinding: Ai,
  input: NormalizeQueryInput,
): Promise<NormalizedQuery> {
  const workersai = createWorkersAI({ binding: aiBinding as never });
  const now = new Date().toISOString();
  const timezone = input.userTimezone ?? "America/New_York";

  const { object } = await generateObject({
    model: workersai("@cf/moonshotai/kimi-k2.6"),
    schema: NormalizedQueryShapeSchema,
    system:
      "You normalize free-text user queries about where and when an activity or service is available into a structured query shape. " +
      "Infer the affordance (the activity/service), the spatial constraint (place/area), the temporal constraint (when), and any access conditions. " +
      "Use null for unknown fields. Keep raw_phrase as the user's original wording for that slot.",
    prompt: `Normalize this query: "${input.userQuery}". User timezone: ${timezone}. Current time: ${now}.`,
  });

  const normalized: NormalizedQuery = {
    query_id: input.queryId,
    schema_version: "0.1.0",
    original_user_query: input.userQuery,
    parsed_at: now,
    locale: object.locale,
    timezone,
    constraints: {
      affordance: {
        kind: object.affordance.kind,
        canonical_label: object.affordance.canonical_label,
        category: object.affordance.category,
        subtype: object.affordance.subtype,
        raw_phrase: object.affordance.raw_phrase,
        synonyms_considered: object.affordance.synonyms_considered,
        normalization_confidence: object.affordance.kind === "exact" ? "high_confidence" : "probable",
      },
      spatial: {
        kind: object.spatial.kind,
        raw_phrase: object.spatial.raw_phrase,
        anchor_place_id: object.spatial.anchor_place_id as PlaceId | null,
        anchor_label: object.spatial.anchor_label,
        anchor_address: object.spatial.anchor_address,
        anchor_coordinates: object.spatial.anchor_coordinates,
        radius_distance: object.spatial.radius_distance,
        max_travel_time: object.spatial.max_travel_time,
        travel_mode: object.spatial.travel_mode,
        jurisdiction: object.spatial.jurisdiction,
        normalization_confidence: object.spatial.kind === "unspecified" ? "candidate" : "probable",
      } as NormalizedQuery["constraints"]["spatial"],
      temporal: {
        kind: object.temporal.kind,
        raw_phrase: object.temporal.raw_phrase,
        timezone,
        window_start: object.temporal.window_start,
        window_end: object.temporal.window_end,
        recurrence_filter: object.temporal.recurrence_filter,
        daypart: object.temporal.daypart,
        normalization_confidence: object.temporal.kind === "unspecified" ? "candidate" : "probable",
      } as NormalizedQuery["constraints"]["temporal"],
      access: object.access.map((a) => ({
        condition_type: a.condition_type,
        desired_value: a.desired_value,
        required: a.required,
        raw_phrase: a.raw_phrase,
      })) as NormalizedQuery["constraints"]["access"],
    },
    context: {
      user_location: null,
      conversation_place: null,
      conversation_time_anchor: now,
      prior_constraints: [],
    },
    uncertainty: {
      ambiguities: [],
      inferred_constraints: [],
      unresolved_slots: [],
    },
    requested_answer_mode: "asynchronous_allowed",
  };

  return normalized;
}
