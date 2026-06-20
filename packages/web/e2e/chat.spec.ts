import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import { chatInput, connectionStatus, jobListItem, messageByRole, newChatButton, sendButton } from "./helpers/selectors.js";

test.describe("Affordance Atlas chat", () => {
  test("non-demo chat queues ordinary open-web research", async ({ page }) => {
    const sessionId = createTestSessionId();
    await setSessionId(page, sessionId);
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("Affordance Atlas");
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });

    const query = "When is the Union Square Greenmarket open in Manhattan?";
    await chatInput(page).fill(query);
    await sendButton(page).click();

    await expect(messageByRole(page, "user").last()).toContainText(query, { timeout: 120000 });
    await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
  });

  test("new chat starts a fresh visible session", async ({ page }) => {
    await page.goto("/");

    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    const sessionId = await page.evaluate(() => window.localStorage.getItem("affordance-atlas-session-id"));

    await Promise.all([
      page.waitForEvent("load"),
      newChatButton(page).click(),
    ]);
    await page.waitForFunction(
      (previousSessionId) => window.localStorage.getItem("affordance-atlas-session-id") !== previousSessionId,
      sessionId,
    );
    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await expect(messageByRole(page, "user")).toHaveCount(0);
    await expect(messageByRole(page, "assistant")).toHaveCount(0);
    await expect(page.getByText("No research jobs yet.")).toBeVisible();
  });
});
