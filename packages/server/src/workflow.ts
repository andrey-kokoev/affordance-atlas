import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { Ai, D1Database } from "@cloudflare/workers-types";
import type { NormalizedQuery, QueryId, ResearchJobId } from "@affordance-atlas/domain";
import * as db from "./db.js";
import { runResearch } from "./research.js";

export interface ResearchWorkflowPayload {
  jobId: ResearchJobId;
  queryId: QueryId;
  sessionId: string;
  userQuery: string;
  querySnapshot: NormalizedQuery;
}

export interface ResearchWorkflowEnv {
  DB: D1Database;
  AI: Ai;
  BROWSER: unknown;
}

export class ResearchWorkflow extends WorkflowEntrypoint<ResearchWorkflowEnv, ResearchWorkflowPayload> {
  override async run(event: WorkflowEvent<ResearchWorkflowPayload>, step: WorkflowStep): Promise<{ answerId?: string; status: string }> {
    const payload = event.payload;

    await step.do(
      "run general open-web research",
      { retries: { limit: 1, delay: "10 seconds", backoff: "linear" }, timeout: "5 minutes" },
      async () => {
        await runResearch(
          {
            db: this.env.DB,
            ai: this.env.AI,
            browser: this.env.BROWSER,
            sessionId: payload.sessionId,
          },
          payload.jobId,
          payload.querySnapshot,
        );
        return { jobId: payload.jobId };
      },
    );

    const job = await db.getResearchJob(this.env.DB, payload.jobId);
    if (job?.result_answer_id) {
      return { status: job.status, answerId: job.result_answer_id };
    }
    return { status: job?.status ?? "failed" };
  }
}
