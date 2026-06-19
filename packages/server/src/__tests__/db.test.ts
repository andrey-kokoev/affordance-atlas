import { describe, it, expect } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { QueryId, ResearchJobId } from "@affordance-atlas/domain";
import * as db from "../db.js";
import { MockD1Database } from "./mock-d1.js";

function createDb(): D1Database {
  return new MockD1Database() as unknown as D1Database;
}

const querySnapshotBase = {
  query_id: "q_test" as QueryId,
  schema_version: "0.1.0" as const,
  original_user_query: "test query",
  parsed_at: new Date().toISOString(),
  locale: "en-US",
  timezone: "America/New_York",
  constraints: {
    affordance: {
      kind: "exact" as const,
      canonical_label: "Mass",
      category: null,
      subtype: null,
      raw_phrase: "Mass",
      synonyms_considered: [],
      normalization_confidence: "high_confidence" as const,
    },
    spatial: {
      kind: "unspecified" as const,
      raw_phrase: null,
      anchor_place_id: null,
      anchor_label: null,
      anchor_address: null,
      anchor_coordinates: null,
      radius_distance: null,
      max_travel_time: null,
      travel_mode: null,
      jurisdiction: null,
      normalization_confidence: "candidate" as const,
    },
    temporal: {
      kind: "unspecified" as const,
      raw_phrase: null,
      timezone: "America/New_York",
      window_start: null,
      window_end: null,
      recurrence_filter: null,
      daypart: null,
      normalization_confidence: "candidate" as const,
    },
    access: [],
  },
  context: {
    user_location: null,
    conversation_place: null,
    conversation_time_anchor: new Date().toISOString(),
    prior_constraints: [],
  },
  uncertainty: {
    ambiguities: [],
    inferred_constraints: [],
    unresolved_slots: [],
  },
  requested_answer_mode: "asynchronous_allowed" as const,
};

describe("D1 helpers", () => {
  it("creates and retrieves a research job", async () => {
    const d1 = createDb();
    const job = await db.createResearchJob(d1, {
      jobId: "job_test" as ResearchJobId,
      queryId: "q_test" as QueryId,
      originalUserQuery: "test query",
      querySnapshot: querySnapshotBase,
      sessionId: "session_test",
    });

    expect(job.job_id).toBe("job_test");
    expect(job.status).toBe("queued");

    const retrieved = await db.getResearchJob(d1, "job_test" as ResearchJobId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.query_id).toBe("q_test");
    expect(retrieved?.status).toBe("queued");
  });

  it("updates research job status", async () => {
    const d1 = createDb();
    await db.createResearchJob(d1, {
      jobId: "job_update" as ResearchJobId,
      queryId: "q_update" as QueryId,
      originalUserQuery: "update query",
      querySnapshot: { ...querySnapshotBase, query_id: "q_update" as QueryId, original_user_query: "update query" },
      sessionId: "session_test",
    });

    await db.updateResearchJobStatus(d1, "job_update" as ResearchJobId, { status: "running" });
    const updated = await db.getResearchJob(d1, "job_update" as ResearchJobId);
    expect(updated?.status).toBe("running");
  });

  it("deletes only claims referenced by the reset session's answers", async () => {
    const d1 = createDb();
    const now = new Date().toISOString();

    await db.createResearchJob(d1, {
      jobId: "job_test_session" as ResearchJobId,
      queryId: "q_test_session" as QueryId,
      originalUserQuery: "test session query",
      querySnapshot: { ...querySnapshotBase, query_id: "q_test_session" as QueryId, original_user_query: "test session query" },
      sessionId: "test-session",
    });
    await db.createResearchJob(d1, {
      jobId: "job_other_session" as ResearchJobId,
      queryId: "q_other_session" as QueryId,
      originalUserQuery: "other session query",
      querySnapshot: { ...querySnapshotBase, query_id: "q_other_session" as QueryId, original_user_query: "other session query" },
      sessionId: "other-session",
    });

    await db.insertAvailabilityClaim(d1, {
      claimId: "claim_test_session",
      schemaVersion: "0.1.0",
      affordanceId: "affordance_test",
      placeId: "place_test",
      timeScopeJson: "{}",
      claimValidityJson: "{}",
      verificationState: "active",
      confidenceState: "probable",
      freshnessState: "current",
      contradictionState: "none",
    });
    await db.insertAvailabilityClaim(d1, {
      claimId: "claim_other_session",
      schemaVersion: "0.1.0",
      affordanceId: "affordance_other",
      placeId: "place_other",
      timeScopeJson: "{}",
      claimValidityJson: "{}",
      verificationState: "active",
      confidenceState: "probable",
      freshnessState: "current",
      contradictionState: "none",
    });
    await db.linkClaimEvidence(d1, "claim_test_session", "evidence_test_session");
    await db.linkClaimEvidence(d1, "claim_other_session", "evidence_other_session");
    await db.insertAccessCondition(d1, {
      accessConditionId: "access_test_session",
      claimId: "claim_test_session",
      conditionType: "walk_in_allowed",
    });
    await db.insertAccessCondition(d1, {
      accessConditionId: "access_other_session",
      claimId: "claim_other_session",
      conditionType: "walk_in_allowed",
    });
    await db.insertAnswer(d1, {
      answerId: "answer_test_session",
      queryId: "q_test_session",
      researchJobId: "job_test_session",
      answerMode: "synchronous",
      answerState: "answered",
      answerJson: JSON.stringify({ results: [{ claim_id: "claim_test_session" }] }),
      generatedAt: now,
    });
    await db.insertAnswer(d1, {
      answerId: "answer_other_session",
      queryId: "q_other_session",
      researchJobId: "job_other_session",
      answerMode: "synchronous",
      answerState: "answered",
      answerJson: JSON.stringify({ results: [{ claim_id: "claim_other_session" }] }),
      generatedAt: now,
    });

    await db.deleteSessionData(d1, "test-session");

    const claims = await d1.prepare("SELECT claim_id FROM availability_claim").all<{ claim_id: string }>();
    const conditions = await d1.prepare("SELECT claim_id FROM access_condition").all<{ claim_id: string }>();
    const evidenceLinks = await d1.prepare("SELECT claim_id FROM claim_evidence").all<{ claim_id: string }>();
    const answers = await d1.prepare("SELECT answer_id FROM answer").all<{ answer_id: string }>();
    const jobs = await d1.prepare("SELECT research_job_id FROM research_job").all<{ research_job_id: string }>();

    expect(claims.results.map((row) => row.claim_id)).toEqual(["claim_other_session"]);
    expect(conditions.results.map((row) => row.claim_id)).toEqual(["claim_other_session"]);
    expect(evidenceLinks.results.map((row) => row.claim_id)).toEqual(["claim_other_session"]);
    expect(answers.results.map((row) => row.answer_id)).toEqual(["answer_other_session"]);
    expect(jobs.results.map((row) => row.research_job_id)).toEqual(["job_other_session"]);
  });
});
