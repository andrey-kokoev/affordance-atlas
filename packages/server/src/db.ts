import type { D1Database } from "@cloudflare/workers-types";
import {
  type Answer,
  type NormalizedQuery,
  type ResearchJob,
  type ResearchJobId,
  type QueryId,
  type AnswerId,
  ResearchJobSchema,
} from "@affordance-atlas/domain";

function buildFallbackQuerySnapshot(row: ResearchJobRow): NormalizedQuery {
  return {
    query_id: row.query_id as QueryId,
    schema_version: "0.1.0",
    original_user_query: row.original_user_query,
    parsed_at: row.created_at,
    locale: null,
    timezone: "America/New_York",
    constraints: {
      affordance: {
        kind: "fuzzy",
        canonical_label: row.original_user_query,
        category: null,
        subtype: null,
        raw_phrase: row.original_user_query,
        synonyms_considered: [],
        normalization_confidence: "candidate",
      },
      spatial: {
        kind: "unspecified",
        raw_phrase: null,
        anchor_place_id: null,
        anchor_label: null,
        anchor_address: null,
        anchor_coordinates: null,
        radius_distance: null,
        max_travel_time: null,
        travel_mode: null,
        jurisdiction: null,
        normalization_confidence: "candidate",
      },
      temporal: {
        kind: "unspecified",
        raw_phrase: null,
        timezone: "America/New_York",
        window_start: null,
        window_end: null,
        recurrence_filter: null,
        daypart: null,
        normalization_confidence: "candidate",
      },
      access: [],
    },
    context: {
      user_location: null,
      conversation_place: null,
      conversation_time_anchor: null,
      prior_constraints: [],
    },
    uncertainty: {
      ambiguities: [],
      inferred_constraints: [
        {
          field: "stored_snapshot",
          value: "fallback",
          basis: "Stored normalized query did not match the current schema.",
        },
      ],
      unresolved_slots: ["stored_snapshot_invalid"],
    },
    requested_answer_mode: "asynchronous_allowed",
  };
}

export interface ResearchJobRow {
  research_job_id: string;
  query_id: string;
  original_user_query: string;
  normalized_query_json: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  scope_json: string;
  objective_json: string;
  result_answer_id: string | null;
  error_message: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
}

function rowToResearchJob(row: ResearchJobRow): ResearchJob {
  let querySnapshot: NormalizedQuery;
  try {
    querySnapshot = JSON.parse(row.normalized_query_json) as NormalizedQuery;
  } catch {
    querySnapshot = buildFallbackQuerySnapshot(row);
  }

  const base = {
    job_id: row.research_job_id as ResearchJobId,
    query_id: row.query_id as QueryId,
    query_snapshot: querySnapshot,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    scheduled_at: row.scheduled_at,
    completed_at: row.completed_at,
    result_answer_id: row.result_answer_id as AnswerId | null,
    error_message: row.error_message,
  };

  const parsed = ResearchJobSchema.safeParse(base);
  if (parsed.success) return parsed.data;

  return ResearchJobSchema.parse({
    ...base,
    query_snapshot: buildFallbackQuerySnapshot(row),
    error_message: row.error_message ?? "Stored query snapshot was incompatible with the current schema.",
  });
}

export async function createResearchJob(
  db: D1Database,
  job: {
    jobId: ResearchJobId;
    queryId: QueryId;
    originalUserQuery: string;
    querySnapshot: NormalizedQuery;
    scope?: unknown;
    objective?: unknown;
    sessionId?: string;
  },
): Promise<ResearchJob> {
  const now = new Date().toISOString();
  const researchJob: ResearchJob = {
    job_id: job.jobId,
    query_id: job.queryId,
    query_snapshot: job.querySnapshot,
    status: "queued",
    created_at: now,
    updated_at: now,
    scheduled_at: null,
    completed_at: null,
    result_answer_id: null,
    error_message: null,
  };

  await db
    .prepare(
      `INSERT INTO research_job (
        research_job_id, query_id, original_user_query, normalized_query_json,
        status, scope_json, objective_json, result_answer_id, error_message,
        session_id, created_at, updated_at, scheduled_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      researchJob.job_id,
      researchJob.query_id,
      job.originalUserQuery,
      JSON.stringify(researchJob.query_snapshot),
      researchJob.status,
      JSON.stringify(job.scope ?? {}),
      JSON.stringify(job.objective ?? {}),
      researchJob.result_answer_id,
      researchJob.error_message,
      job.sessionId ?? null,
      researchJob.created_at,
      researchJob.updated_at,
      researchJob.scheduled_at,
      researchJob.completed_at,
    )
    .run();

  return researchJob;
}

export async function getResearchJob(
  db: D1Database,
  jobId: ResearchJobId,
): Promise<ResearchJob | null> {
  const row = (await db
    .prepare("SELECT * FROM research_job WHERE research_job_id = ?")
    .bind(jobId)
    .first()) as ResearchJobRow | null;

  if (!row) return null;
  return rowToResearchJob(row);
}

export async function getResearchJobsBySession(
  db: D1Database,
  sessionId: string,
  limit = 50,
): Promise<ResearchJob[]> {
  const { results } = await db
    .prepare("SELECT * FROM research_job WHERE session_id = ? ORDER BY created_at DESC LIMIT ?")
    .bind(sessionId, limit)
    .all<ResearchJobRow>();

  return results?.map(rowToResearchJob) ?? [];
}

export async function updateResearchJobStatus(
  db: D1Database,
  jobId: ResearchJobId,
  updates: {
    status?: "queued" | "running" | "completed" | "failed" | "cancelled";
    resultAnswerId?: AnswerId | null;
    errorMessage?: string | null;
    scheduledAt?: string | null;
    completedAt?: string | null;
  },
): Promise<void> {
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.resultAnswerId !== undefined) {
    sets.push("result_answer_id = ?");
    values.push(updates.resultAnswerId);
  }
  if (updates.errorMessage !== undefined) {
    sets.push("error_message = ?");
    values.push(updates.errorMessage);
  }
  if (updates.scheduledAt !== undefined) {
    sets.push("scheduled_at = ?");
    values.push(updates.scheduledAt);
  }
  if (updates.completedAt !== undefined) {
    sets.push("completed_at = ?");
    values.push(updates.completedAt);
  }

  values.push(jobId);

  await db
    .prepare(`UPDATE research_job SET ${sets.join(", ")} WHERE research_job_id = ?`)
    .bind(...values)
    .run();
}

export async function updateResearchJobSnapshot(
  db: D1Database,
  jobId: ResearchJobId,
  updates: {
    querySnapshot: NormalizedQuery;
    scope?: unknown;
    objective?: unknown;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE research_job
       SET normalized_query_json = ?, scope_json = ?, objective_json = ?, updated_at = ?
       WHERE research_job_id = ?`,
    )
    .bind(
      JSON.stringify(updates.querySnapshot),
      JSON.stringify(updates.scope ?? {}),
      JSON.stringify(updates.objective ?? {}),
      new Date().toISOString(),
      jobId,
    )
    .run();
}

export async function getLatestAnswerForOriginalQuery(
  db: D1Database,
  originalUserQuery: string,
  sessionId?: string,
): Promise<Answer | null> {
  const sessionClause = sessionId ? "AND j.session_id = ?" : "";
  const values = sessionId ? [originalUserQuery, sessionId] : [originalUserQuery];
  const row = await db
    .prepare(
      `SELECT a.answer_json
       FROM answer a
       JOIN research_job j ON j.result_answer_id = a.answer_id
       WHERE j.original_user_query = ? AND j.status = 'completed'
       ${sessionClause}
       ORDER BY j.completed_at DESC, j.updated_at DESC
       LIMIT 1`,
    )
    .bind(...values)
    .first<{ answer_json: string }>();

  return row ? (JSON.parse(row.answer_json) as Answer) : null;
}

export async function getCompletedAnswersBySession(
  db: D1Database,
  sessionId: string,
): Promise<{ answer: Answer; generatedAt: string; researchJobId: ResearchJobId; originalUserQuery: string; jobCreatedAt: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT a.answer_json, a.generated_at, a.research_job_id, j.original_user_query, j.created_at
       FROM answer a
       JOIN research_job j ON j.research_job_id = a.research_job_id
       WHERE j.session_id = ? AND j.status = 'completed'
       ORDER BY a.generated_at ASC`,
    )
    .bind(sessionId)
    .all<{ answer_json: string; generated_at: string; research_job_id: string; original_user_query: string; created_at: string }>();

  return (results ?? []).map((row) => ({
    answer: JSON.parse(row.answer_json) as Answer,
    generatedAt: row.generated_at,
    researchJobId: row.research_job_id as ResearchJobId,
    originalUserQuery: row.original_user_query,
    jobCreatedAt: row.created_at,
  }));
}

export interface ClaimMatch {
  claim_id: string;
  affordance_id: string | null;
  affordance_label: string;
  affordance_category: string;
  place_id: string | null;
  place_name: string;
  place_address: string | null;
  place_latitude: number | null;
  place_longitude: number | null;
  time_scope_json: string;
  claim_validity_json: string;
  verification_state: string;
  confidence_state: string;
  freshness_state: string;
  contradiction_state: string;
}

export async function findMatchingClaims(
  db: D1Database,
  affordanceLabel: string,
  placeName?: string,
): Promise<ClaimMatch[]> {
  const baseSql = `SELECT
    c.claim_id,
    c.affordance_id,
    a.canonical_label AS affordance_label,
    a.category AS affordance_category,
    c.place_id,
    p.canonical_name AS place_name,
    p.address AS place_address,
    p.latitude AS place_latitude,
    p.longitude AS place_longitude,
    c.time_scope_json,
    c.claim_validity_json,
    c.verification_state,
    c.confidence_state,
    c.freshness_state,
    c.contradiction_state
  FROM availability_claim c
  JOIN affordance a ON a.affordance_id = c.affordance_id
  JOIN place p ON p.place_id = c.place_id
  WHERE a.canonical_label = ?
    AND c.verification_state IN ('verified', 'active')
    AND c.confidence_state IN ('high_confidence', 'probable')
    AND c.freshness_state IN ('current', 'recent')
    AND c.contradiction_state IN ('none', 'resolved')`;

  if (placeName) {
    const { results } = await db
      .prepare(`${baseSql} AND p.canonical_name = ?`)
      .bind(affordanceLabel, placeName)
      .all<ClaimMatch>();
    return results ?? [];
  }

  const { results } = await db.prepare(baseSql).bind(affordanceLabel).all<ClaimMatch>();
  return results ?? [];
}

export async function getAccessConditions(
  db: D1Database,
  claimId: string,
): Promise<{ condition_type: string; value_json: string | null; confidence_state: string | null }[]> {
  const { results } = await db
    .prepare(
      "SELECT condition_type, value_json, confidence_state FROM access_condition WHERE claim_id = ?",
    )
    .bind(claimId)
    .all<{ condition_type: string; value_json: string | null; confidence_state: string | null }>();

  return results ?? [];
}

export async function getEvidenceItemsForClaim(
  db: D1Database,
  claimId: string,
): Promise<{
  evidence_item_id: string;
  source_class: string;
  item_class: string;
  source_locator: string | null;
  retrieved_at: string;
  evidence_span: string | null;
  extracted_text: string | null;
  authority_level: string | null;
  freshness_state: string;
}[]> {
  const { results } = await db
    .prepare(
      `SELECT
        e.evidence_item_id,
        COALESCE(s.source_class, 'unknown') AS source_class,
        e.item_class,
        e.source_locator,
        e.retrieved_at,
        e.evidence_span,
        e.extracted_text,
        s.authority_level,
        e.freshness_state
      FROM evidence_item e
      JOIN claim_evidence ce ON ce.evidence_item_id = e.evidence_item_id
      LEFT JOIN evidence_source s ON s.evidence_source_id = e.evidence_source_id
      WHERE ce.claim_id = ?`,
    )
    .bind(claimId)
    .all<{
      evidence_item_id: string;
      source_class: string;
      item_class: string;
      source_locator: string | null;
      retrieved_at: string;
      evidence_span: string | null;
      extracted_text: string | null;
      authority_level: string | null;
      freshness_state: string;
    }>();

  return results ?? [];
}

export async function deleteSessionData(db: D1Database, sessionId: string): Promise<void> {
  // Delete answers, claims, and jobs scoped to the session. Keep shared place/affordance/evidence rows
  // because they may be referenced by other sessions. Claim ownership is inferred from the persisted
  // answer payloads for this session's jobs.
  await db
    .prepare(
      `DELETE FROM access_condition
       WHERE claim_id IN (
         SELECT json_extract(result.value, '$.claim_id')
         FROM answer ans
         JOIN research_job job ON job.research_job_id = ans.research_job_id
         JOIN json_each(ans.answer_json, '$.results') result
         WHERE job.session_id = ?
       )`,
    )
    .bind(sessionId)
    .run();

  await db
    .prepare(
      `DELETE FROM claim_evidence
       WHERE claim_id IN (
         SELECT json_extract(result.value, '$.claim_id')
         FROM answer ans
         JOIN research_job job ON job.research_job_id = ans.research_job_id
         JOIN json_each(ans.answer_json, '$.results') result
         WHERE job.session_id = ?
       )`,
    )
    .bind(sessionId)
    .run();

  await db
    .prepare(
      `DELETE FROM claim_version
       WHERE claim_id IN (
         SELECT json_extract(result.value, '$.claim_id')
         FROM answer ans
         JOIN research_job job ON job.research_job_id = ans.research_job_id
         JOIN json_each(ans.answer_json, '$.results') result
         WHERE job.session_id = ?
       )`,
    )
    .bind(sessionId)
    .run();

  await db
    .prepare(
      `DELETE FROM availability_claim
       WHERE claim_id IN (
         SELECT json_extract(result.value, '$.claim_id')
         FROM answer ans
         JOIN research_job job ON job.research_job_id = ans.research_job_id
         JOIN json_each(ans.answer_json, '$.results') result
         WHERE job.session_id = ?
       )`,
    )
    .bind(sessionId)
    .run();

  await db
    .prepare(
      `DELETE FROM answer WHERE research_job_id IN (
         SELECT research_job_id FROM research_job WHERE session_id = ?
       )`,
    )
    .bind(sessionId)
    .run();

  await db.prepare("DELETE FROM research_job WHERE session_id = ?").bind(sessionId).run();
}

export async function insertAvailabilityClaim(
  db: D1Database,
  claim: {
    claimId: string;
    schemaVersion: string;
    affordanceId: string;
    placeId: string;
    serviceAreaId?: string | null;
    timeScopeJson: string;
    claimValidityJson: string;
    verificationState: string;
    confidenceState: string;
    confidenceScore?: number | null;
    freshnessState: string;
    contradictionState: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO availability_claim (
        claim_id, schema_version, affordance_id, place_id, service_area_id,
        time_scope_json, claim_validity_json, verification_state, confidence_state,
        confidence_score, freshness_state, contradiction_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      claim.claimId,
      claim.schemaVersion,
      claim.affordanceId,
      claim.placeId,
      claim.serviceAreaId ?? null,
      claim.timeScopeJson,
      claim.claimValidityJson,
      claim.verificationState,
      claim.confidenceState,
      claim.confidenceScore ?? null,
      claim.freshnessState,
      claim.contradictionState,
      now,
      now,
    )
    .run();
}

export async function insertPlace(
  db: D1Database,
  place: {
    placeId: string;
    canonicalName: string;
    placeType?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    jurisdiction?: string | null;
    parentPlaceId?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO place (
        place_id, canonical_name, place_type, address, latitude, longitude,
        jurisdiction, parent_place_id, identity_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      place.placeId,
      place.canonicalName,
      place.placeType ?? null,
      place.address ?? null,
      place.latitude ?? null,
      place.longitude ?? null,
      place.jurisdiction ?? null,
      place.parentPlaceId ?? null,
      "resolved",
      now,
      now,
    )
    .run();
}

export async function insertAffordance(
  db: D1Database,
  affordance: {
    affordanceId: string;
    canonicalLabel: string;
    category: string;
    subtype?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO affordance (affordance_id, canonical_label, category, subtype, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      affordance.affordanceId,
      affordance.canonicalLabel,
      affordance.category,
      affordance.subtype ?? null,
      now,
      now,
    )
    .run();
}

export async function insertEvidenceItem(
  db: D1Database,
  item: {
    evidenceItemId: string;
    evidenceSourceId?: string | null;
    itemClass: string;
    sourceType?: string | null;
    sourceLocator?: string | null;
    retrievedAt: string;
    publishedAt?: string | null;
    observedAt?: string | null;
    evidenceSpan?: string | null;
    extractedText?: string | null;
    freshnessState: string;
    artifactRef?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO evidence_item (
        evidence_item_id, evidence_source_id, item_class, source_type,
        source_locator, retrieved_at, published_at, observed_at, evidence_span,
        extracted_text, freshness_state, artifact_ref, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      item.evidenceItemId,
      item.evidenceSourceId ?? null,
      item.itemClass,
      item.sourceType ?? null,
      item.sourceLocator ?? null,
      item.retrievedAt,
      item.publishedAt ?? null,
      item.observedAt ?? null,
      item.evidenceSpan ?? null,
      item.extractedText ?? null,
      item.freshnessState,
      item.artifactRef ?? null,
      new Date().toISOString(),
    )
    .run();
}

export async function linkClaimEvidence(
  db: D1Database,
  claimId: string,
  evidenceItemId: string,
  supportRole = "supports",
): Promise<void> {
  await db
    .prepare("INSERT INTO claim_evidence (claim_id, evidence_item_id, support_role) VALUES (?, ?, ?)")
    .bind(claimId, evidenceItemId, supportRole)
    .run();
}

export async function insertAccessCondition(
  db: D1Database,
  condition: {
    accessConditionId: string;
    claimId: string;
    conditionType: string;
    valueJson?: string;
    confidenceState?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO access_condition (access_condition_id, claim_id, condition_type, value_json, confidence_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      condition.accessConditionId,
      condition.claimId,
      condition.conditionType,
      condition.valueJson ?? "null",
      condition.confidenceState ?? null,
      new Date().toISOString(),
    )
    .run();
}

export async function insertAnswer(
  db: D1Database,
  answer: {
    answerId: string;
    queryId: string;
    researchJobId?: string | null;
    answerMode: string;
    answerState: string;
    answerJson: string;
    generatedAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO answer (answer_id, query_id, research_job_id, answer_mode, answer_state, answer_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      answer.answerId,
      answer.queryId,
      answer.researchJobId ?? null,
      answer.answerMode,
      answer.answerState,
      answer.answerJson,
      answer.generatedAt,
    )
    .run();
}
