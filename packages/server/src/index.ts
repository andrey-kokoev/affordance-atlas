import { routeAgentRequest, getAgentByName } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AffordanceAtlasAgent, type Env } from "./agent.js";
import { ResearchWorkflow } from "./workflow.js";
import { registerMcpTools, type McpToolContext } from "./mcp.js";

export { AffordanceAtlasAgent };
export { ResearchWorkflow };

type AgentStub = Awaited<ReturnType<McpToolContext["getAgent"]>>;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/__fixtures/availability/test-library") {
      return new Response(
        `<!doctype html>
        <html lang="en">
          <head><title>Controlled Fixture Library Availability</title></head>
          <body>
            <main data-fixture="availability">
              <h1>Controlled Fixture Library</h1>
              <p class="address">789 Fixture Ave, Testville, NY 12000</p>
              <section aria-label="Availability">
                <h2>Controlled Fixture Reading Room</h2>
                <p>The controlled fixture reading room is available Tuesdays at 2:00 PM.</p>
                <p data-recurrence="weekly">Tuesdays at 2:00 PM</p>
              </section>
            </main>
          </body>
        </html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

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

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    return (await env.ASSETS.fetch(request as never)) as unknown as Response;
  },
} satisfies ExportedHandler<Env>;
