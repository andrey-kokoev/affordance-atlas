import { test, expect } from "@playwright/test";
import { createTestSessionId, resetSession, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  demoModeToggle,
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

test.describe("Workflow-backed research", () => {
  test("user asks fixture question, leaves, and returns to workflow researched answer", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const query = `__workflow_fixture_fast__ When is the controlled fixture reading room available? ${crypto.randomUUID()}`;
    await openCleanSession(page, sessionId);

    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(workingIndicator(page)).toBeVisible();
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });

    await page.close();
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const returnPage = await context.newPage();
    await setSessionId(returnPage, sessionId);
    await returnPage.goto("/");
    await expect(connectionStatus(returnPage)).toHaveText("Online", { timeout: 60000 });
    await expect(jobStatusBadge(returnPage).first()).toHaveText("completed", { timeout: 60000 });
    await expect(messageByRole(returnPage, "assistant").last()).toContainText("Controlled Fixture Library", { timeout: 30000 });
    await expect(messageByRole(returnPage, "assistant").last()).toContainText("Tuesdays at 2:00 PM");
    await expect(workingIndicator(returnPage)).toHaveCount(0);
    await returnPage.close();
  });
});
