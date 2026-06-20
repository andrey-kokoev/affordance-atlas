const MCP_URL = process.env.BASE_URL
  ? `${process.env.BASE_URL}/mcp`
  : "https://affordance-atlas-server.andrei-kokoev.workers.dev/mcp";

let failed = false;

async function mcpRequest(body) {
  const headers = { Accept: "application/json, text/event-stream", "Content-Type": "application/json" };
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) {
    throw new Error(`Unexpected MCP response: ${text.slice(0, 200)}`);
  }
  const payload = JSON.parse(dataLine.slice(5));
  if (payload.error) {
    throw new Error(`MCP error: ${JSON.stringify(payload.error)}`);
  }
  return payload;
}

async function mcpRequestRaw(body) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
  const payload = dataLine ? JSON.parse(dataLine.slice(5)) : null;
  return { ok: response.ok, status: response.status, text, payload };
}

function assert(condition, message) {
  if (!condition) {
    failed = true;
    throw new Error(message);
  }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed = true;
    console.error(`✗ ${name}`);
    console.error(err instanceof Error ? err.message : String(err));
  }
}

await test("mcp initialize", async () => {
  const result = (await mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
  }));
  assert(result.result?.protocolVersion === "2024-11-05", "protocol version mismatch");
  assert(result.result?.capabilities?.tools, "tools capability missing");
});

await test("mcp tools/list", async () => {
  const result = (await mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }));
  const names = result.result?.tools.map((t) => t.name) ?? [];
  assert(names.includes("ask"), "ask tool missing");
  assert(names.includes("get_job_status"), "get_job_status tool missing");
  assert(names.includes("list_session_jobs"), "list_session_jobs tool missing");
});

await test("mcp ask non-demo queues observable research", async () => {
  const query = "What time is Sunday Mass at St. Patrick's Cathedral in New York?";
  const askResult = (await mcpRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "ask",
      arguments: { query },
    },
  }));
  const askText = askResult.result?.content[0]?.text ?? "";
  const askJson = JSON.parse(askText);
  assert(askJson.answered === false, "expected research to be queued");
  assert(askJson.job_id, "expected job_id");

  const jobId = askJson.job_id;

  const start = Date.now();
  let lastStatus = "";
  while (Date.now() - start < 30000) {
    const statusResult = (await mcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_job_status", arguments: { jobId } },
    }));
    const statusText = statusResult.result?.content[0]?.text ?? "";
    const statusJson = JSON.parse(statusText);
    lastStatus = statusJson.status;
    if (["queued", "running", "completed", "failed"].includes(lastStatus)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert(["queued", "running", "completed", "failed"].includes(lastStatus), `job was not observable; last=${lastStatus}`);

  const listResult = (await mcpRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "list_session_jobs", arguments: {} },
  }));
  const listText = listResult.result?.content[0]?.text ?? "[]";
  const jobs = JSON.parse(listText);
  assert(jobs.some((j) => j.job_id === jobId), "job not in list_session_jobs");
});

await test("mcp session_id targets an isolated session", async () => {
  const sessionId = `test-${crypto.randomUUID()}`;
  const query = `mcp targeted ${crypto.randomUUID()}`;
  const askResult = (await mcpRequest({
    jsonrpc: "2.0",
    id: 61,
    method: "tools/call",
    params: {
      name: "ask",
      arguments: { session_id: sessionId, query },
    },
  }));
  const askJson = JSON.parse(askResult.result?.content[0]?.text ?? "{}");
  assert(askJson.answered === false, "expected targeted research to be queued");
  assert(askJson.job_id, "expected targeted job id");

  const targetedList = (await mcpRequest({
    jsonrpc: "2.0",
    id: 62,
    method: "tools/call",
    params: { name: "list_session_jobs", arguments: { session_id: sessionId } },
  }));
  const targetedJobs = JSON.parse(targetedList.result?.content[0]?.text ?? "[]");
  assert(targetedJobs.some((job) => job.job_id === askJson.job_id && job.query === query), "targeted job missing");

  const defaultList = (await mcpRequest({
    jsonrpc: "2.0",
    id: 63,
    method: "tools/call",
    params: { name: "list_session_jobs", arguments: {} },
  }));
  const defaultJobs = JSON.parse(defaultList.result?.content[0]?.text ?? "[]");
  assert(!defaultJobs.some((job) => job.job_id === askJson.job_id), "targeted job leaked into default MCP session");
});

await test("mcp unknown job returns structured not-found result", async () => {
  const result = (await mcpRequest({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "get_job_status", arguments: { jobId: "job_does_not_exist" } },
  }));
  const text = result.result?.content[0]?.text ?? "";
  const json = JSON.parse(text);
  assert(json.found === false, "expected found=false");
  assert(json.error === "Job not found", "expected not-found error text");
});

await test("mcp invalid tool args return JSON-RPC error without worker crash", async () => {
  const result = await mcpRequestRaw({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "ask", arguments: { query: "" } },
  });
  assert(result.ok, `expected HTTP ok JSON-RPC error, got ${result.status}: ${result.text.slice(0, 200)}`);
  assert(result.payload?.result?.isError === true, "expected structured MCP tool error result");
  const text = result.payload.result.content[0]?.text ?? "";
  assert(text.includes("Input validation error"), "expected input validation error text");
});

if (failed) {
  process.exit(1);
} else {
  console.log("\nAll MCP tests passed");
}
