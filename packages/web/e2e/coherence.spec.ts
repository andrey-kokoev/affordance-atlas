import { test, expect } from "@playwright/test";
import { createTestSessionId, resetSession, seedTestAnswer, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  demoModeToggle,
  jobListItem,
  jobListItems,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

const BASE_URL = process.env.BASE_URL || "https://affordance-atlas-server.andrei-kokoev.workers.dev";

async function mcpRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
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
  return JSON.parse(dataLine.slice(5)) as Record<string, unknown>;
}

function firstMcpText(payload: Record<string, unknown>): string {
  const result = payload.result as { content?: { text?: string }[] } | undefined;
  return result?.content?.[0]?.text ?? "";
}

async function openCleanSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  await resetSession(page);
  const demoToggle = demoModeToggle(page);
  if (await demoToggle.isChecked()) {
    await demoToggle.uncheck();
  }
}

test.describe("Affordance Atlas coherence", () => {
  test("D1 jobs persist across reload and a new page for the same session", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const query = "Persistence fixture reading room availability";
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query);

    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });

    const secondPage = await context.newPage();
    await setSessionId(secondPage, sessionId);
    await secondPage.goto("/");
    await expect(connectionStatus(secondPage)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItem(secondPage).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await secondPage.close();
  });

  test("reset clears test session state and rejects non-test sessions", async ({ page }) => {
    const sessionId = createTestSessionId();
    await openCleanSession(page, sessionId);

    await chatInput(page).fill("Reset fixture availability");
    await sendButton(page).click();
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });

    await resetSession(page);
    await expect(jobListItems(page)).toHaveCount(0);
    await expect(messageByRole(page, "user")).toHaveCount(0);

    const nonTestPage = await page.context().newPage();
    await setSessionId(nonTestPage, `nontest-${crypto.randomUUID()}`);
    await nonTestPage.goto("/");
    await expect(connectionStatus(nonTestPage)).toHaveText("Online", { timeout: 60000 });
    const rejected = await nonTestPage.evaluate(async () => {
      const fn = (window as Record<string, unknown>).__resetSession as (() => Promise<void>) | undefined;
      if (!fn) return false;
      try {
        await fn();
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
    await nonTestPage.close();
  });

  test("deterministic failure hook surfaces a failed job and recovers controls", async ({ page }) => {
    const sessionId = createTestSessionId();
    await openCleanSession(page, sessionId);

    await chatInput(page).fill("__force_failure__ deterministic e2e");
    await sendButton(page).click();

    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobStatusBadge(page).first()).toHaveText("failed", { timeout: 30000 });
    await expect(jobListItem(page).first()).toContainText("Forced deterministic research failure for e2e.");
    await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
    await chatInput(page).fill("recovery after forced failure");
    await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
  });

  test("seeded completed answer returns synchronously without queuing another job", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__seeded_claim__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await seedTestAnswer(page, query);
    await expect(jobListItems(page)).toHaveCount(1);
    await expect(jobStatusBadge(page).first()).toHaveText("completed");

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "assistant")).toBeVisible({ timeout: 30000 });
    await expect(messageByRole(page, "assistant")).toContainText("Seeded Test Library");
    await expect(jobListItems(page)).toHaveCount(1);
  });

  test("seeded answer renders result card details", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__seeded_render__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await seedTestAnswer(page, query);
    await chatInput(page).fill(query);
    await sendButton(page).click();

    const assistant = messageByRole(page, "assistant");
    await expect(assistant).toBeVisible({ timeout: 30000 });
    await expect(assistant).toContainText("Seeded Test Library");
    await expect(assistant).toContainText("123 Fixture Way, Testville, NY 12000");
    await expect(assistant).toContainText("Seeded Test Reading Room");
    await expect(assistant).toContainText("Weekdays at 9:00 AM");
    await expect(assistant).toContainText("Seeded deterministic e2e fixture.");
    await expect(assistant).toContainText("Next: No further action needed.");
  });

  test("reset deletes seeded persistence before a later ask", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__seeded_reset__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await seedTestAnswer(page, query);
    await expect(jobStatusBadge(page).first()).toHaveText("completed");

    await resetSession(page);
    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItems(page)).toHaveCount(0);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobListItems(page)).toHaveCount(1, { timeout: 120000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query);
  });

  test("concurrent test sessions remain isolated through reset", async ({ page, context }) => {
    const firstSessionId = createTestSessionId();
    const secondSessionId = createTestSessionId();
    const firstQuery = `first isolated ${crypto.randomUUID()}`;
    const secondQuery = `second isolated ${crypto.randomUUID()}`;
    await openCleanSession(page, firstSessionId);

    const secondPage = await context.newPage();
    await openCleanSession(secondPage, secondSessionId);

    await chatInput(page).fill(firstQuery);
    await sendButton(page).click();
    await expect(jobListItem(page).first().locator("strong")).toHaveText(firstQuery, { timeout: 120000 });

    await chatInput(secondPage).fill(secondQuery);
    await sendButton(secondPage).click();
    await expect(jobListItem(secondPage).first().locator("strong")).toHaveText(secondQuery, { timeout: 120000 });

    await resetSession(page);
    await expect(jobListItems(page)).toHaveCount(0);

    await secondPage.reload();
    await expect(connectionStatus(secondPage)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItem(secondPage).first().locator("strong")).toHaveText(secondQuery, { timeout: 60000 });
    await secondPage.close();
  });

  test("same-session tabs receive job and reset updates without reload", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const query = `same tab realtime ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    const secondPage = await context.newPage();
    await setSessionId(secondPage, sessionId);
    await secondPage.goto("/");
    await expect(connectionStatus(secondPage)).toHaveText("Online", { timeout: 60000 });

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 120000 });
    await expect(jobListItem(secondPage).first().locator("strong")).toHaveText(query, { timeout: 120000 });

    await resetSession(secondPage);
    await expect(jobListItems(secondPage)).toHaveCount(0);
    await expect(jobListItems(page)).toHaveCount(0, { timeout: 60000 });
    await secondPage.close();
  });

  test("browser-created jobs are visible through MCP session targeting", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `browser to mcp ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 120000 });

    const listPayload = await mcpRequest({
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "list_session_jobs", arguments: { session_id: sessionId } },
    });
    const jobs = JSON.parse(firstMcpText(listPayload)) as { query: string }[];
    expect(jobs.some((job) => job.query === query)).toBe(true);
  });

  test("MCP-created jobs hydrate into the browser session", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `mcp to browser ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    const askPayload = await mcpRequest({
      jsonrpc: "2.0",
      id: 102,
      method: "tools/call",
      params: { name: "ask", arguments: { session_id: sessionId, query } },
    });
    const askJson = JSON.parse(firstMcpText(askPayload)) as { answered: boolean; job_id?: string };
    expect(askJson.answered).toBe(false);
    expect(askJson.job_id).toBeTruthy();

    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
  });

  test("deterministic completion progresses through statuses and broadcasts the answer", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const query = `__progress_complete__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    const secondPage = await context.newPage();
    await setSessionId(secondPage, sessionId);
    await secondPage.goto("/");
    await expect(connectionStatus(secondPage)).toHaveText("Online", { timeout: 60000 });

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(jobStatusBadge(page).first()).toHaveText("queued", { timeout: 30000 });
    await expect(jobStatusBadge(secondPage).first()).toHaveText("queued", { timeout: 30000 });
    await expect(workingIndicator(page)).toBeVisible();

    await expect(jobStatusBadge(page).first()).toHaveText("running", { timeout: 30000 });
    await expect(jobStatusBadge(secondPage).first()).toHaveText("running", { timeout: 30000 });

    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 30000 });
    await expect(jobStatusBadge(secondPage).first()).toHaveText("completed", { timeout: 30000 });
    await expect(workingIndicator(page)).toHaveCount(0);
    await expect(messageByRole(page, "assistant")).toContainText("Progression Test Place", { timeout: 30000 });
    await expect(messageByRole(secondPage, "assistant")).toContainText("Progression Test Place", { timeout: 30000 });
    await secondPage.close();
  });

  test("deterministic delayed failure reaches failed state and clears working indicator", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__progress_fail__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(jobStatusBadge(page).first()).toHaveText("queued", { timeout: 30000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText("running", { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText("failed", { timeout: 30000 });
    await expect(jobListItem(page).first()).toContainText("Deterministic delayed failure for e2e.");
    await expect(workingIndicator(page)).toHaveCount(0);
  });

  test("reload during deterministic running state hydrates and completes", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__progress_complete__ reload ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobStatusBadge(page).first()).toHaveText("running", { timeout: 30000 });

    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await expect(jobStatusBadge(page).first()).toHaveText(/running|completed/, { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 30000 });
    await expect(messageByRole(page, "assistant")).toContainText("Progression Test Place", { timeout: 30000 });
  });

  test("deterministic realtime progression does not bleed to another session", async ({ page, context }) => {
    const firstSessionId = createTestSessionId();
    const secondSessionId = createTestSessionId();
    const query = `__progress_complete__ no bleed ${crypto.randomUUID()}`;
    await openCleanSession(page, firstSessionId);

    const secondPage = await context.newPage();
    await openCleanSession(secondPage, secondSessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 30000 });
    await expect(messageByRole(page, "assistant")).toContainText("Progression Test Place", { timeout: 30000 });

    await expect(jobListItems(secondPage)).toHaveCount(0);
    await expect(messageByRole(secondPage, "assistant")).toHaveCount(0);
    await secondPage.close();
  });

  test("MCP-started deterministic progression is observed by the browser", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__progress_complete__ mcp observed ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    const askPayload = await mcpRequest({
      jsonrpc: "2.0",
      id: 201,
      method: "tools/call",
      params: { name: "ask", arguments: { session_id: sessionId, query } },
    });
    const askJson = JSON.parse(firstMcpText(askPayload)) as { answered: boolean; job_id?: string };
    expect(askJson.answered).toBe(false);
    expect(askJson.job_id).toBeTruthy();

    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await expect(jobStatusBadge(page).first()).toHaveText("running", { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 30000 });
    await expect(messageByRole(page, "assistant")).toContainText("Progression Test Place", { timeout: 30000 });
  });

  test("browser-started deterministic progression is pollable through MCP", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__progress_complete__ mcp polling ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 60000 });

    const listPayload = await mcpRequest({
      jsonrpc: "2.0",
      id: 202,
      method: "tools/call",
      params: { name: "list_session_jobs", arguments: { session_id: sessionId } },
    });
    const jobs = JSON.parse(firstMcpText(listPayload)) as { job_id: string; query: string }[];
    const jobId = jobs.find((job) => job.query === query)?.job_id;
    expect(jobId).toBeTruthy();

    const seenStatuses = new Set<string>();
    const start = Date.now();
    let resultAnswerId: string | null | undefined;
    while (Date.now() - start < 30000) {
      const statusPayload = await mcpRequest({
        jsonrpc: "2.0",
        id: 203,
        method: "tools/call",
        params: { name: "get_job_status", arguments: { session_id: sessionId, jobId } },
      });
      const statusJson = JSON.parse(firstMcpText(statusPayload)) as { status: string; result_answer_id?: string | null };
      seenStatuses.add(statusJson.status);
      resultAnswerId = statusJson.result_answer_id;
      if (statusJson.status === "completed") break;
      await page.waitForTimeout(500);
    }

    expect(seenStatuses.has("queued") || seenStatuses.has("running")).toBe(true);
    expect(seenStatuses.has("completed")).toBe(true);
    expect(resultAnswerId).toBeTruthy();
  });

  test("browser-seeded cached answer is returned through MCP session targeting", async ({ page }) => {
    const sessionId = createTestSessionId();
    const query = `__seeded_mcp_cache__ ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);
    await seedTestAnswer(page, query);

    const askPayload = await mcpRequest({
      jsonrpc: "2.0",
      id: 204,
      method: "tools/call",
      params: { name: "ask", arguments: { session_id: sessionId, query } },
    });
    const askJson = JSON.parse(firstMcpText(askPayload)) as { answered: boolean; summary?: string; results?: { place: string }[] };
    expect(askJson.answered).toBe(true);
    expect(askJson.summary).toContain("Seeded Test Library");
    expect(askJson.results?.[0]?.place).toBe("Seeded Test Library");

    await expect(jobListItems(page)).toHaveCount(1);
  });

  test("concurrent deterministic jobs keep ordering and terminal correctness", async ({ page }) => {
    const sessionId = createTestSessionId();
    const completeQuery = `__progress_complete__ ordering ${crypto.randomUUID()}`;
    const failQuery = `__progress_fail__ ordering ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(completeQuery);
    await sendButton(page).click();
    await expect(jobListItem(page).first().locator("strong")).toHaveText(completeQuery, { timeout: 60000 });

    await chatInput(page).fill(failQuery);
    await sendButton(page).click();
    await expect(jobListItem(page).first().locator("strong")).toHaveText(failQuery, { timeout: 60000 });
    await expect(jobListItem(page).nth(1).locator("strong")).toHaveText(completeQuery, { timeout: 60000 });

    await expect(jobListItem(page).filter({ hasText: failQuery }).getByTestId("job-status-badge")).toHaveText("failed", { timeout: 30000 });
    await expect(jobListItem(page).filter({ hasText: completeQuery }).getByTestId("job-status-badge")).toHaveText("completed", { timeout: 30000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(failQuery);
    await expect(jobListItem(page).nth(1).locator("strong")).toHaveText(completeQuery);
  });
});
