import { routeAgentRequest, getAgentByName } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AffordanceAtlasAgent, type Env } from "./agent.js";
import { ResearchWorkflow } from "./workflow.js";
import { registerMcpTools, type McpToolContext } from "./mcp.js";

export { AffordanceAtlasAgent };
export { ResearchWorkflow };

type AgentStub = Awaited<ReturnType<McpToolContext["getAgent"]>>;

const ADMIN_TABLES = [
  { name: "research_job", label: "Research Jobs", orderBy: "created_at DESC" },
  { name: "answer", label: "Answers", orderBy: "generated_at DESC" },
  { name: "availability_claim", label: "Availability Claims", orderBy: "created_at DESC" },
  { name: "evidence_item", label: "Evidence Items", orderBy: "created_at DESC" },
  { name: "place", label: "Places", orderBy: "created_at DESC" },
  { name: "affordance", label: "Affordances", orderBy: "created_at DESC" },
  { name: "claim_evidence", label: "Claim Evidence", orderBy: "claim_id ASC" },
  { name: "claim_version", label: "Claim Versions", orderBy: "created_at DESC" },
  { name: "access_condition", label: "Access Conditions", orderBy: "created_at DESC" },
  { name: "coverage_gap", label: "Coverage Gaps", orderBy: "created_at DESC" },
  { name: "research_step", label: "Research Steps", orderBy: "created_at DESC" },
  { name: "evidence_source", label: "Evidence Sources", orderBy: "created_at DESC" },
  { name: "service_area", label: "Service Areas", orderBy: "created_at DESC" },
  { name: "event_log", label: "Event Log", orderBy: "occurred_at DESC" },
] as const;

type AdminTableName = typeof ADMIN_TABLES[number]["name"];

function getAdminTable(name: string): typeof ADMIN_TABLES[number] | null {
  return ADMIN_TABLES.find((table) => table.name === name) ?? null;
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function adminTables(env: Env): Promise<Response> {
  const tables = await Promise.all(ADMIN_TABLES.map(async (table) => {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table.name}`).first<{ count: number }>();
    return { name: table.name, label: table.label, count: count?.count ?? 0 };
  }));
  return json({ authenticated: true, generated_at: new Date().toISOString(), tables });
}

async function adminTableRows(env: Env, tableName: AdminTableName, url: URL): Promise<Response> {
  const table = getAdminTable(tableName);
  if (!table) return json({ error: "Unknown admin table." }, { status: 404 });
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25, 1), 100);
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table.name}`).first<{ count: number }>();
  const rows = await env.DB.prepare(
    `SELECT * FROM ${table.name} ORDER BY ${table.orderBy} LIMIT ? OFFSET ?`,
  ).bind(limit, offset).all<Record<string, unknown>>();
  return json({
    authenticated: true,
    generated_at: new Date().toISOString(),
    table: { name: table.name, label: table.label, count: count?.count ?? 0 },
    limit,
    offset,
    rows: rows.results ?? [],
  });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function tokenMatches(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

function requireAdmin(request: Request, env: Env): Response | null {
  const expected = env.ADMIN_BEARER_TOKEN?.trim();
  if (!expected) {
    return json({ authenticated: false, error: "Admin bearer token is not configured." }, { status: 503 });
  }
  const token = getBearerToken(request);
  if (!token || !tokenMatches(token, expected)) {
    return json({ authenticated: false, error: "Invalid admin bearer token." }, { status: 401 });
  }
  return null;
}

async function adminSummary(env: Env): Promise<Response> {
  const statusRows = await env.DB.prepare(
    "SELECT status, COUNT(*) AS count FROM research_job GROUP BY status ORDER BY status",
  ).all<{ status: string; count: number }>();
  const recentJobs = await env.DB.prepare(
    `SELECT research_job_id, original_user_query, status, error_message, created_at, updated_at, completed_at
     FROM research_job
     ORDER BY created_at DESC
     LIMIT 10`,
  ).all<{
    research_job_id: string;
    original_user_query: string;
    status: string;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  }>();
  return json({
    authenticated: true,
    generated_at: new Date().toISOString(),
    status_counts: statusRows.results ?? [],
    recent_jobs: recentJobs.results ?? [],
  });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const mcpServer = new McpServer({
        name: "affordance-atlas",
        version: "0.0.0",
      });
      registerMcpTools(mcpServer, {
        getAgent: async (sessionId = "mcp") =>
          (await getAgentByName(env.AffordanceAtlasAgent, sessionId)) as unknown as AgentStub,
      });
      const transport = new WebStandardStreamableHTTPServerTransport({});
      await mcpServer.server.connect(transport);
      return transport.handleRequest(request);
    }

    if (url.pathname === "/api/admin/session") {
      const adminError = requireAdmin(request, env);
      if (adminError) return adminError;
      return json({
        authenticated: true,
        generated_at: new Date().toISOString(),
        capabilities: ["view_admin_summary"],
      });
    }

    if (url.pathname === "/api/admin/summary") {
      const adminError = requireAdmin(request, env);
      if (adminError) return adminError;
      return adminSummary(env);
    }

    if (url.pathname === "/api/admin/tables") {
      const adminError = requireAdmin(request, env);
      if (adminError) return adminError;
      return adminTables(env);
    }

    if (url.pathname.startsWith("/api/admin/tables/")) {
      const adminError = requireAdmin(request, env);
      if (adminError) return adminError;
      const tableName = decodeURIComponent(url.pathname.slice("/api/admin/tables/".length));
      const table = getAdminTable(tableName);
      if (!table) return json({ error: "Unknown admin table." }, { status: 404 });
      return adminTableRows(env, table.name, url);
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    return (await env.ASSETS.fetch(request as never)) as unknown as Response;
  },
} satisfies ExportedHandler<Env>;
