import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  jobListItem,
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

test.describe("Affordance Atlas coherence", () => {
  test("D1 jobs persist across reload and a new page for the same session", async ({ page, context }) => {
    const sessionId = createTestSessionId();
    const query = "When can I visit the Statue of Liberty National Monument this week?";
    await openSession(page, sessionId);

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

  test("unsupported ordinary research fails visibly and recovers controls", async ({ page }) => {
    test.setTimeout(300000);
    const sessionId = createTestSessionId();
    await openSession(page, sessionId);

    const query = "Where can I attend a qzxv nonexistent public ceremony in Atlantis tomorrow?";
    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobStatusBadge(page).first()).toHaveText("failed", { timeout: 240000 });
    await expect(jobListItem(page).first()).toContainText(/No promising candidate URL|Could not extract|Open-web research|failed/i);
    await expect(messageByRole(page, "assistant").last()).toContainText("couldn't produce a reliable answer", { timeout: 30000 });
    await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
    await chatInput(page).fill("When is the Brooklyn Museum open this weekend?");
    await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
    await expect(workingIndicator(page)).toHaveCount(0);
  });
});
