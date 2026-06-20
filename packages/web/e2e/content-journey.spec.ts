import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  jobOutcome,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

async function openSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
}

async function ask(page: import("@playwright/test").Page, query: string): Promise<void> {
  await chatInput(page).fill(query);
  await sendButton(page).click();
}

test.describe("Affordance Atlas content journey", () => {
  test("user asks an ordinary question, reloads, and sees coherent chat and job state", async ({ page }) => {
    test.setTimeout(300000);
    const sessionId = createTestSessionId();
    const question = "When can I visit the Statue of Liberty National Monument this week?";

    await openSession(page, sessionId);
    await ask(page, question);

    await expect(messageByRole(page, "user").last()).toContainText(question);
    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 240000 });
    await expect(jobOutcome(page).first()).toContainText("Answer:");
    await expect(messageByRole(page, "assistant").last()).toContainText(/Confidence:/, { timeout: 30000 });

    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(messageByRole(page, "assistant").last()).toContainText(/Confidence:/, { timeout: 30000 });
    await expect(jobStatusBadge(page).first()).toHaveText("completed");
    await expect(jobOutcome(page).first()).toContainText("Answer:");
    await expect(workingIndicator(page)).toHaveCount(0);
  });
});
