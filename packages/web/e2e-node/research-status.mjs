const MCP_URL = process.env.BASE_URL
  ? `${process.env.BASE_URL}/mcp`
  : "https://affordance-atlas-server.andrei-kokoev.workers.dev/mcp";
const query = process.argv.slice(2).join(" ") || "When can I visit the Statue of Liberty National Monument this week?";
const session_id = `diag-${crypto.randomUUID()}`;
const pollCount = Number.parseInt(process.env.POLL_COUNT ?? "24", 10);

async function mcpRequest(body) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  if (!response.ok || !dataLine) {
    throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 1000)}`);
  }
  const payload = JSON.parse(dataLine.slice(5));
  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload;
}

async function callTool(name, args, id) {
  const payload = await mcpRequest({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const text = payload.result?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { parse_error: text };
  }
}

const timeline = [];
const ask = await callTool("ask", { query, session_id }, 1);
timeline.push({ elapsed_ms: 0, status: ask.status ?? (ask.answered ? "answered" : "unknown"), job_id: ask.job_id ?? null });
if (ask.answered) {
  console.log(JSON.stringify({ session_id, query, ask, timeline, final: ask }, null, 2));
  process.exit(0);
}
if (!ask.job_id) throw new Error(`ask did not return a job_id: ${JSON.stringify(ask)}`);

let final = null;
for (let i = 0; i < pollCount; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const status = await callTool("get_job_status", { jobId: ask.job_id, session_id }, 2 + i);
  timeline.push({
    elapsed_ms: (i + 1) * 5000,
    status: status.status,
    result_answer_id: status.result_answer_id ?? null,
    error_message: status.error_message ?? null,
  });
  if (status.status === "completed" || status.status === "failed") {
    final = status;
    break;
  }
}

console.log(JSON.stringify({
  session_id,
  query,
  ask_status: ask.status ?? null,
  job_id: ask.job_id ?? null,
  timeline: timeline.map((item) => `${item.elapsed_ms}:${item.status}${item.error_message ? `:${item.error_message}` : ""}`),
  final,
}));
if (!final) process.exitCode = 2;
