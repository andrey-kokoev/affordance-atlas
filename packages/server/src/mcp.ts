import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResearchJob, ResearchJobId } from "@affordance-atlas/domain";
import type { AskResult } from "./agent.js";

export interface McpToolContext {
  getAgent: (sessionId?: string) => Promise<{
    ask: (query: string, demo?: string) => Promise<AskResult>;
    getJobStatus: (jobId: ResearchJobId) => Promise<ResearchJob | null>;
    listSessionJobs: () => Promise<ResearchJob[]>;
  }>;
}

const SessionIdSchema = z.string().min(1).max(128).optional();

const AskInputSchema = z.object({
  query: z.string().min(1).describe("Natural-language availability question."),
  demo: z.boolean().optional().describe("If true, return an instant sample answer instead of researching."),
  session_id: SessionIdSchema.describe("Optional target Affordance Atlas session id. Defaults to the MCP session."),
});

const GetJobStatusInputSchema = z.object({
  jobId: z.string().regex(/^job_/).describe("The research job ID returned by ask."),
  session_id: SessionIdSchema.describe("Optional target Affordance Atlas session id. Defaults to the MCP session."),
});

const ListSessionJobsInputSchema = z.object({
  session_id: SessionIdSchema.describe("Optional target Affordance Atlas session id. Defaults to the MCP session."),
});

export function registerMcpTools(mcpServer: McpServer, ctx: McpToolContext) {
  mcpServer.tool(
    "ask",
    "Ask Affordance Atlas a natural-language question about where and when an activity or service is available. " +
      "Returns an immediate answer if data is on hand, otherwise queues background research and returns a job_id.",
    AskInputSchema.shape,
    async ({ query, demo, session_id }) => {
      const agent = await ctx.getAgent(session_id);
      const result = await agent.ask(query, demo ? "demo" : undefined);
      if (result.kind === "answered") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  answered: true,
                  summary: result.answer.answer_summary,
                  results: result.answer.results.map((r) => ({
                    place: r.place_label,
                    address: r.place_address,
                    affordance: r.affordance_label,
                    recurrence: r.occurrence.recurrence_label,
                    caveats: r.caveats,
                  })),
                  next_actions: result.answer.next_actions,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                answered: false,
                job_id: result.job.job_id,
                status: result.job.status,
                message: "Research queued. Poll get_job_status or wait for completion.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  mcpServer.tool(
    "get_job_status",
    "Get the current status and result of a research job.",
    GetJobStatusInputSchema.shape,
    async ({ jobId, session_id }) => {
      const agent = await ctx.getAgent(session_id);
      const job = await agent.getJobStatus(jobId as ResearchJobId);
      if (!job) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ found: false, error: "Job not found" }, null, 2) }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                found: true,
                job_id: job.job_id,
                status: job.status,
                query: job.query_snapshot.original_user_query,
                result_answer_id: job.result_answer_id,
                error_message: job.error_message,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  mcpServer.tool(
    "list_session_jobs",
    "List research jobs for the current session, most recent first.",
    ListSessionJobsInputSchema.shape,
    async ({ session_id }) => {
      const agent = await ctx.getAgent(session_id);
      const jobs = await agent.listSessionJobs();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              jobs.map((j) => ({
                job_id: j.job_id,
                status: j.status,
                query: j.query_snapshot.original_user_query,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
