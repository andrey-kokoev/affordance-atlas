import { Agent, callable } from "agents";
import type { D1Database, Fetcher } from "@cloudflare/workers-types";
import {
  type Answer,
  type NormalizedQuery,
  type QueryId,
  type ResearchJob,
  type ResearchJobId,
  type AnswerId,
} from "@affordance-atlas/domain";
import * as db from "./db.js";
import { buildDemoAnswer } from "./answer.js";
import type { ResearchWorkflowPayload } from "./workflow.js";

const CACHE_FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000;

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
  ADMIN_BEARER_TOKEN?: string;
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

function hasReusableEvidenceMetadata(answer: Answer): boolean {
  const cutoff = Date.now() - CACHE_FRESHNESS_MS;
  return answer.results.length > 0 && answer.results.every((result) =>
    Array.isArray(result.evidence) &&
    result.evidence.length > 0 &&
    result.evidence.every((item) => {
      const retrievedAt = new Date(item.retrieved_at).getTime();
      return (
        Number.isFinite(retrievedAt) &&
        retrievedAt >= cutoff &&
        item.source_url.length > 0 &&
        item.extracted_text.length > 0 &&
        (item.freshness_state === "current" || item.freshness_state === "recent")
      );
    }),
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

    if (seed === "demo") {
      const answer = buildDemoAnswer(answerId, queryId, userQuery, queryId);
      this.appendMessages([{ role: "assistant", content: answer.answer_summary, answer, createdAt: now }]);
      return { kind: "answered", answer };
    }

    const cachedAnswer = await db.getLatestAnswerForOriginalQuery(this.env.DB, userQuery, this.name);
    if (cachedAnswer && !isPlaceholderResearchAnswer(cachedAnswer) && hasReusableEvidenceMetadata(cachedAnswer)) {
      this.appendMessages([
        { role: "assistant", content: cachedAnswer.answer_summary, answer: cachedAnswer, createdAt: now },
      ]);
      return { kind: "answered", answer: cachedAnswer };
    }

    this.appendMessages([{ role: "system", content: "I’m looking that up for you. This may take a moment.", createdAt: now }]);

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

    try {
      await this.env.RESEARCH_WORKFLOW.create({
        id: jobId,
        params: { jobId, queryId, sessionId: this.name, userQuery, querySnapshot: queuedQuery },
      });
    } catch (error) {
      await db.updateResearchJobStatus(this.env.DB, jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });
      await this.refreshJobs();
    }

    void this.startFiber(
      "workflow-status-refresh",
      async () => {
        for (let i = 0; i < 20; i++) {
          await sleep(1000);
          await this.refreshJobs();
          const current = await db.getResearchJob(this.env.DB, jobId);
          if (current?.status === "completed" || current?.status === "failed" || current?.status === "cancelled") return;
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
  async cancelResearchJob(jobId: ResearchJobId): Promise<ResearchJob | null> {
    const sessionJobs = await db.getResearchJobsBySession(this.env.DB, this.name, 50);
    const job = sessionJobs.find((candidate) => candidate.job_id === jobId);
    if (!job) return null;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return job;

    const now = new Date().toISOString();
    await db.updateResearchJobStatus(this.env.DB, jobId, {
      status: "cancelled",
      errorMessage: "Canceled by user.",
      completedAt: now,
    });
    await this.refreshJobs();
    return db.getResearchJob(this.env.DB, jobId);
  }

  @callable()
  async resetSession(): Promise<void> {
    if (!this.name.startsWith("test-")) {
      throw new Error("resetSession is only allowed for test sessions");
    }
    await db.deleteSessionData(this.env.DB, this.name);
    this.setState({ messages: [], jobs: [] });
  }

  override async onStart(): Promise<void> {
    await this.refreshJobs();
    this.startRefreshForActiveJobs();
  }

  private async refreshJobs(): Promise<void> {
    const jobs = await db.getResearchJobsBySession(this.env.DB, this.name, 20);
    const answers = await db.getCompletedAnswersBySession(this.env.DB, this.name);
    const placeholderAnswerJobIds = new Set(
      answers
        .filter(({ answer }) => isPlaceholderResearchAnswer(answer))
        .map(({ researchJobId }) => researchJobId),
    );
    const validCompletedAnswerJobIds = new Set(
      answers
        .filter(({ answer }) => !isPlaceholderResearchAnswer(answer) && hasReusableEvidenceMetadata(answer))
        .map(({ researchJobId }) => researchJobId),
    );
    const visibleJobs = jobs.filter((job) => {
      if (placeholderAnswerJobIds.has(job.job_id)) return false;
      if (job.status === "completed" && job.result_answer_id && !validCompletedAnswerJobIds.has(job.job_id)) return false;
      return true;
    });
    const retainedMessages = this.state.messages.filter((message) => !isPlaceholderResearchMessage(message));
    const existingSummaries = new Set(
      retainedMessages
        .filter((message) => message.role === "assistant")
        .map((message) => message.content),
    );
    const existingUserQueries = new Set(
      retainedMessages
        .filter((message) => message.role === "user")
        .map((message) => message.content),
    );
    const failedMessages: SessionMessage[] = visibleJobs
      .filter((job) => job.status === "failed")
      .map((job) => ({
        role: "assistant" as const,
        content: `I couldn't verify a reliable answer for "${job.query_snapshot.original_user_query}" from the accessible sources. Check the job details for the technical reason.`,
        createdAt: job.completed_at ?? job.updated_at,
      }))
      .filter((message) => !existingSummaries.has(message.content));
    const hydratedMessages: SessionMessage[] = answers
      .filter(({ answer }) => !isPlaceholderResearchAnswer(answer) && hasReusableEvidenceMetadata(answer))
      .filter(({ answer }) => !existingSummaries.has(answer.answer_summary))
      .flatMap(({ answer, generatedAt, originalUserQuery, jobCreatedAt }) => {
        const messages: SessionMessage[] = [];
        if (!existingUserQueries.has(originalUserQuery)) {
          messages.push({ role: "user", content: originalUserQuery, createdAt: jobCreatedAt });
        }
        messages.push({
          role: "assistant" as const,
          content: answer.answer_summary,
          answer,
          createdAt: generatedAt,
        });
        return messages;
      });
    this.setState({ messages: [...retainedMessages, ...failedMessages, ...hydratedMessages], jobs: visibleJobs });
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
            if (current?.status === "completed" || current?.status === "failed" || current?.status === "cancelled") return;
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
