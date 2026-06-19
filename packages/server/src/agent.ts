import { Agent, callable } from "agents";
import type { D1Database, Fetcher } from "@cloudflare/workers-types";
import {
  type Answer,
  type NormalizedQuery,
  type QueryId,
  type ResearchJob,
  type ResearchJobId,
  type AnswerId,
  type ClaimId,
  type EvidenceItemId,
  buildAnswer,
} from "@affordance-atlas/domain";
import * as db from "./db.js";
import { buildDemoAnswer } from "./answer.js";
import type { ResearchWorkflowPayload } from "./workflow.js";

export interface SessionState {
  messages: SessionMessage[];
  jobs: ResearchJob[];
}

export type SessionMessage =
  | { role: "user"; content: string; createdAt: string }
  | { role: "assistant"; content: string; answer?: Answer; createdAt: string }
  | { role: "system"; content: string; createdAt: string };

export type AskResult =
  | { kind: "answered"; answer: Answer }
  | { kind: "queued"; job: ResearchJob };

export interface Env {
  DB: D1Database;
  AI: import("@cloudflare/workers-types").Ai;
  BROWSER: unknown;
  LOADER: unknown;
  ASSETS: Fetcher;
  RESEARCH_WORKFLOW: {
    create(options: { id?: string; params: ResearchWorkflowPayload }): Promise<{ id: string }>;
  };
  AffordanceAtlasAgent: DurableObjectNamespace<AffordanceAtlasAgent>;
}

function buildQueuedQuery(queryId: QueryId, userQuery: string, now: string): NormalizedQuery {
  return {
    query_id: queryId,
    schema_version: "0.1.0",
    original_user_query: userQuery,
    parsed_at: now,
    locale: null,
    timezone: "America/New_York",
    constraints: {
      affordance: {
        kind: "fuzzy",
        canonical_label: userQuery,
        category: null,
        subtype: null,
        raw_phrase: userQuery,
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
          field: "normalization",
          value: "pending",
          basis: "Queued before Workers AI normalization to keep the session responsive.",
        },
      ],
      unresolved_slots: ["normalization_pending"],
    },
    requested_answer_mode: "asynchronous_allowed",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlaceholderResearchAnswer(answer: Answer): boolean {
  const searchable = [
    answer.answer_summary,
    ...answer.results.flatMap((result) => [
      result.place_label,
      result.place_address ?? "",
      result.affordance_label,
      result.occurrence.recurrence_label ?? "",
      ...result.caveats,
    ]),
  ].join("\n");

  return /Workflow Research Desk|Workflow-backed research completed/i.test(searchable);
}

function isPlaceholderResearchMessage(message: SessionMessage): boolean {
  return message.role === "assistant" && (
    /Workflow Research Desk|Workflow-backed research completed/i.test(message.content) ||
    (message.answer ? isPlaceholderResearchAnswer(message.answer) : false)
  );
}

export class AffordanceAtlasAgent extends Agent<Env, SessionState> {
  override initialState: SessionState = { messages: [], jobs: [] };

  @callable()
  async ask(userQuery: string, seed?: string): Promise<AskResult> {
    const now = new Date().toISOString();
    this.appendMessages([{ role: "user", content: userQuery, createdAt: now }]);

    const queryId = `q_${crypto.randomUUID()}` as QueryId;
    const answerId = `answer_${queryId}` as AnswerId;

    if (
      this.name.startsWith("test-") &&
      (userQuery.includes("__progress_complete__") || userQuery.includes("__progress_fail__"))
    ) {
      return this.startDeterministicProgression({
        userQuery,
        queryId,
        complete: userQuery.includes("__progress_complete__"),
        now,
      });
    }

    if (this.name.startsWith("test-") && userQuery.includes("__force_failure__")) {
      const queuedQuery = buildQueuedQuery(queryId, userQuery, now);
      const jobId = `job_${crypto.randomUUID()}` as ResearchJobId;
      const job = await db.createResearchJob(this.env.DB, {
        jobId,
        queryId,
        originalUserQuery: userQuery,
        querySnapshot: queuedQuery,
        scope: queuedQuery.constraints,
        objective: { find: userQuery, near: null },
        sessionId: this.name,
      });
      await db.updateResearchJobStatus(this.env.DB, jobId, {
        status: "failed",
        errorMessage: "Forced deterministic research failure for e2e.",
        completedAt: now,
      });
      const failedJob = await db.getResearchJob(this.env.DB, jobId);
      this.setState({ messages: this.state.messages, jobs: [failedJob ?? job, ...this.state.jobs] });
      return { kind: "queued", job: failedJob ?? job };
    }

    if (seed === "demo") {
      const answer = buildDemoAnswer(answerId, queryId, userQuery, queryId);
      this.appendMessages([{ role: "assistant", content: answer.answer_summary, answer, createdAt: now }]);
      return { kind: "answered", answer };
    }

    const cachedAnswer = await db.getLatestAnswerForOriginalQuery(this.env.DB, userQuery, this.name);
    if (cachedAnswer && !isPlaceholderResearchAnswer(cachedAnswer)) {
      this.appendMessages([
        { role: "assistant", content: cachedAnswer.answer_summary, answer: cachedAnswer, createdAt: now },
      ]);
      return { kind: "answered", answer: cachedAnswer };
    }

    const queuedQuery = buildQueuedQuery(queryId, userQuery, now);

    const jobId = `job_${crypto.randomUUID()}` as ResearchJobId;
    const job = await db.createResearchJob(this.env.DB, {
      jobId,
      queryId,
      originalUserQuery: userQuery,
      querySnapshot: queuedQuery,
      scope: queuedQuery.constraints,
      objective: { find: userQuery, near: null },
      sessionId: this.name,
    });

    this.setState({ messages: this.state.messages, jobs: [job, ...this.state.jobs] });
    this.appendMessages([{ role: "system", content: "I’m looking that up for you. This may take a moment.", createdAt: now }]);

    void this.env.RESEARCH_WORKFLOW.create({
      id: jobId,
      params: { jobId, queryId, sessionId: this.name, userQuery },
    }).catch(async (error) => {
      await db.updateResearchJobStatus(this.env.DB, jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });
      await this.refreshJobs();
    });

    void this.startFiber(
      "workflow-status-refresh",
      async () => {
        for (let i = 0; i < 20; i++) {
          await sleep(1000);
          await this.refreshJobs();
          const current = await db.getResearchJob(this.env.DB, jobId);
          if (current?.status === "completed" || current?.status === "failed") return;
        }
      },
      { idempotencyKey: `refresh:${jobId}` },
    );

    return { kind: "queued", job };
  }

  @callable()
  async getJobStatus(jobId: ResearchJobId): Promise<ResearchJob | null> {
    return db.getResearchJob(this.env.DB, jobId);
  }

  @callable()
  async listSessionJobs(): Promise<ResearchJob[]> {
    await this.refreshJobs();
    this.startRefreshForActiveJobs();
    return this.state.jobs;
  }

  @callable()
  async resetSession(): Promise<void> {
    if (!this.name.startsWith("test-")) {
      throw new Error("resetSession is only allowed for test sessions");
    }
    await db.deleteSessionData(this.env.DB, this.name);
    this.setState({ messages: [], jobs: [] });
  }

  @callable()
  async seedTestAnswer(userQuery: string): Promise<Answer> {
    if (!this.name.startsWith("test-")) {
      throw new Error("seedTestAnswer is only allowed for test sessions");
    }

    const now = new Date().toISOString();
    const queryId = `q_${crypto.randomUUID()}` as QueryId;
    const answerId = `answer_${crypto.randomUUID()}` as AnswerId;
    const jobId = `job_${crypto.randomUUID()}` as ResearchJobId;
    const placeId = `place_${crypto.randomUUID()}`;
    const affordanceId = `aff_${crypto.randomUUID()}`;
    const claimId = `claim_${crypto.randomUUID()}`;
    const evidenceItemId = `ev_${crypto.randomUUID()}`;
    const queuedQuery = buildQueuedQuery(queryId, userQuery, now);

    await db.insertPlace(this.env.DB, {
      placeId,
      canonicalName: "Seeded Test Library",
      address: "123 Fixture Way, Testville, NY 12000",
    });
    await db.insertAffordance(this.env.DB, {
      affordanceId,
      canonicalLabel: "Seeded Test Reading Room",
      category: "test_fixture",
    });
    await db.insertEvidenceItem(this.env.DB, {
      evidenceItemId,
      itemClass: "manual_observation_note",
      sourceLocator: `test-session:${this.name}`,
      retrievedAt: now,
      evidenceSpan: "Seeded fixture availability for deterministic e2e.",
      extractedText: "Seeded Test Library offers a seeded reading room on weekdays at 9:00 AM.",
      freshnessState: "current",
    });
    await db.insertAvailabilityClaim(this.env.DB, {
      claimId,
      schemaVersion: "0.2.0",
      affordanceId,
      placeId,
      timeScopeJson: JSON.stringify({
        kind: "recurrence",
        timezone: "America/New_York",
        starts_at: null,
        ends_at: null,
        recurrence_payload: { recurrence_rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", recurrence_label: "Weekdays at 9:00 AM" },
        exception_rules: [],
      }),
      claimValidityJson: JSON.stringify({ valid_from: null, valid_through: null, validity_basis: "e2e fixture" }),
      verificationState: "active",
      confidenceState: "high_confidence",
      freshnessState: "current",
      contradictionState: "none",
    });
    await db.linkClaimEvidence(this.env.DB, claimId, evidenceItemId);

    const job = await db.createResearchJob(this.env.DB, {
      jobId,
      queryId,
      originalUserQuery: userQuery,
      querySnapshot: queuedQuery,
      scope: queuedQuery.constraints,
      objective: { find: "Seeded Test Reading Room", near: "Seeded Test Library" },
      sessionId: this.name,
    });

    const answer = buildAnswer({
      answer_id: answerId,
      query_id: queryId,
      answer_mode: "synchronous",
      answer_state: "answered",
      original_user_query: userQuery,
      normalized_query_ref: queryId,
      results: [
        {
          result_id: `result_${claimId}`,
          claim_id: claimId as ClaimId,
          affordance_label: "Seeded Test Reading Room",
          place_label: "Seeded Test Library",
          place_address: "123 Fixture Way, Testville, NY 12000",
          occurrence: {
            starts_at: null,
            ends_at: null,
            timezone: "America/New_York",
            recurrence_label: "Weekdays at 9:00 AM",
          },
          access_conditions: [],
          confidence_state: "high_confidence",
          freshness_state: "current",
          verification_state: "active",
          contradiction_state: "none",
          evidence_refs: [evidenceItemId as EvidenceItemId],
          caveats: ["Seeded deterministic e2e fixture."],
        },
      ],
      answer_summary: "Seeded Test Library offers a seeded reading room on weekdays at 9:00 AM.",
      next_actions: [{ action_type: "none", label: "No further action needed." }],
    });

    await db.insertAnswer(this.env.DB, {
      answerId,
      queryId,
      researchJobId: jobId,
      answerMode: "synchronous",
      answerState: "answered",
      answerJson: JSON.stringify(answer),
      generatedAt: now,
    });
    await db.updateResearchJobStatus(this.env.DB, jobId, {
      status: "completed",
      resultAnswerId: answerId,
      completedAt: now,
    });
    const completedJob = await db.getResearchJob(this.env.DB, jobId);
    this.setState({ messages: this.state.messages, jobs: [completedJob ?? job, ...this.state.jobs] });
    return answer;
  }

  private async startDeterministicProgression(input: {
    userQuery: string;
    queryId: QueryId;
    complete: boolean;
    now: string;
  }): Promise<AskResult> {
    const queuedQuery = buildQueuedQuery(input.queryId, input.userQuery, input.now);
    const jobId = `job_${crypto.randomUUID()}` as ResearchJobId;
    const answerId = `answer_${crypto.randomUUID()}` as AnswerId;
    const evidenceItemId = `ev_${crypto.randomUUID()}` as EvidenceItemId;
    const claimId = `claim_${crypto.randomUUID()}` as ClaimId;
    const job = await db.createResearchJob(this.env.DB, {
      jobId,
      queryId: input.queryId,
      originalUserQuery: input.userQuery,
      querySnapshot: queuedQuery,
      scope: queuedQuery.constraints,
      objective: { find: input.userQuery, near: null },
      sessionId: this.name,
    });

    this.setState({ messages: this.state.messages, jobs: [job, ...this.state.jobs] });
    this.appendMessages([{ role: "system", content: "I’m looking that up for you. This may take a moment.", createdAt: input.now }]);

    void this.startFiber(
      "deterministic-progress",
      async () => {
        await sleep(1200);
        await db.updateResearchJobStatus(this.env.DB, jobId, {
          status: "running",
          scheduledAt: new Date().toISOString(),
        });
        await this.refreshJobs();

        await sleep(3000);
        const completedAt = new Date().toISOString();
        if (!input.complete) {
          await db.updateResearchJobStatus(this.env.DB, jobId, {
            status: "failed",
            errorMessage: "Deterministic delayed failure for e2e.",
            completedAt,
          });
          await this.refreshJobs();
          return;
        }

        const answer = buildAnswer({
          answer_id: answerId,
          query_id: input.queryId,
          answer_mode: "asynchronous",
          answer_state: "answered",
          original_user_query: input.userQuery,
          normalized_query_ref: input.queryId,
          results: [
            {
              result_id: `result_${claimId}`,
              claim_id: claimId,
              affordance_label: "Deterministic Test Availability",
              place_label: "Progression Test Place",
              place_address: "456 Progress Ln, Testville, NY 12000",
              occurrence: {
                starts_at: null,
                ends_at: null,
                timezone: "America/New_York",
                recurrence_label: "Daily at noon",
              },
              access_conditions: [],
              confidence_state: "high_confidence",
              freshness_state: "current",
              verification_state: "active",
              contradiction_state: "none",
              evidence_refs: [evidenceItemId],
              caveats: ["Deterministic delayed completion for e2e."],
            },
          ],
          answer_summary: "Progression Test Place offers deterministic test availability daily at noon.",
          next_actions: [{ action_type: "none", label: "No further action needed." }],
        });

        await db.insertAnswer(this.env.DB, {
          answerId,
          queryId: input.queryId,
          researchJobId: jobId,
          answerMode: "asynchronous",
          answerState: "answered",
          answerJson: JSON.stringify(answer),
          generatedAt: completedAt,
        });
        await db.updateResearchJobStatus(this.env.DB, jobId, {
          status: "completed",
          resultAnswerId: answerId,
          completedAt,
        });
        await this.refreshJobs();
      },
      { idempotencyKey: jobId },
    );

    return { kind: "queued", job };
  }

  override async onStart(): Promise<void> {
    await this.refreshJobs();
    this.startRefreshForActiveJobs();
  }

  private async refreshJobs(): Promise<void> {
    const jobs = await db.getResearchJobsBySession(this.env.DB, this.name, 20);
    const answers = await db.getCompletedAnswersBySession(this.env.DB, this.name);
    const retainedMessages = this.state.messages.filter((message) => !isPlaceholderResearchMessage(message));
    const existingSummaries = new Set(
      retainedMessages
        .filter((message) => message.role === "assistant")
        .map((message) => message.content),
    );
    const hydratedMessages: SessionMessage[] = answers
      .filter(({ answer }) => !isPlaceholderResearchAnswer(answer))
      .filter(({ answer }) => !existingSummaries.has(answer.answer_summary))
      .map(({ answer, generatedAt }) => ({
        role: "assistant" as const,
        content: answer.answer_summary,
        answer,
        createdAt: generatedAt,
      }));
    this.setState({ messages: [...retainedMessages, ...hydratedMessages], jobs });
  }

  private startRefreshForActiveJobs(): void {
    for (const job of this.state.jobs) {
      if (job.status !== "queued" && job.status !== "running") continue;
      void this.startFiber(
        "workflow-status-refresh",
        async () => {
          for (let i = 0; i < 90; i++) {
            await sleep(1000);
            await this.refreshJobs();
            const current = await db.getResearchJob(this.env.DB, job.job_id);
            if (current?.status === "completed" || current?.status === "failed") return;
          }
        },
        { idempotencyKey: `refresh:${job.job_id}` },
      );
    }
  }

  private appendMessages(messages: SessionMessage[]): void {
    this.setState({ messages: [...this.state.messages, ...messages], jobs: this.state.jobs });
  }
}
