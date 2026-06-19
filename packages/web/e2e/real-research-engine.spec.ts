import { test, expect } from "@playwright/test";
import { createTestSessionId, resetSession, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  demoModeToggle,
  jobListItem,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

async function openCleanSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  await resetSession(page);
  const demoToggle = demoModeToggle(page);
  if (await demoToggle.isChecked()) await demoToggle.uncheck();
}

test.describe("Real research engine", () => {
  test("Browser Run extracts controlled availability content and produces an answer", async ({ page }) => {
    test.setTimeout(240000);
    const sessionId = createTestSessionId();
    const query = `__workflow_browser_strict__ Extract controlled fixture availability ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running/, { timeout: 30000 });

    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 210000 });
    const answer = messageByRole(page, "assistant").last();
    await expect(answer).toContainText("Controlled Fixture Reading Room", { timeout: 30000 });
    await expect(answer).toContainText("789 Fixture Ave, Testville, NY 12000");
    await expect(answer).toContainText("Tuesdays at 2:00 PM");
    await expect(answer).not.toContainText("Browser extraction fallback");
    await expect(workingIndicator(page)).toHaveCount(0);
  });

  test("Browser Run extracts required open-web availability content and produces an answer", async ({ page }) => {
    test.setTimeout(240000);
    const sessionId = createTestSessionId();
    const query = `__workflow_open_web_strict__ Extract Statue of Liberty National Monument public visiting hours ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running/, { timeout: 30000 });

    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 210000 });
    const answer = messageByRole(page, "assistant").last();
    await expect(answer).toContainText(/Statue of Liberty|National Park Service/i, { timeout: 30000 });
    await expect(answer).not.toContainText("Browser extraction fallback");
    await expect(answer).not.toContainText("Workflow Research Desk");
    await expect(workingIndicator(page)).toHaveCount(0);
  });

  test("ordinary Clifton Park Mass query uses open-web parish data instead of fallback", async ({ page }) => {
    test.setTimeout(240000);
    const sessionId = createTestSessionId();
    const query = `Where can I go to Mass in Clifton Park on Sunday? ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running/, { timeout: 30000 });

    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 210000 });
    const answer = messageByRole(page, "assistant").last();
    await expect(answer).toContainText(/St\. Edward|Clifton Park/i, { timeout: 30000 });
    await expect(answer).toContainText(/7:30|9:00|11:00/);
    await expect(answer).not.toContainText("Workflow Research Desk");
    await expect(answer).not.toContainText("Workflow-backed research completed");
    await expect(workingIndicator(page)).toHaveCount(0);
  });
});
