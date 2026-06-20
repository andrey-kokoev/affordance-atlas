import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId, resetSession } from "./helpers/session.js";
import {
  connectionStatus,
  chatInput,
  sendButton,
  messageByRole,
  jobListItem,
  jobStatusBadge,
} from "./helpers/selectors.js";

const RESEARCH_QUERY = "Mass times St Edward the Confessor Church Clifton Park NY";

test.describe("Affordance Atlas research", () => {
  test("real research path queues a job and keeps the UI usable", async ({ page }) => {
    const sessionId = createTestSessionId();
    await setSessionId(page, sessionId);
    await page.goto("/");

    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await resetSession(page);

    await chatInput(page).fill(RESEARCH_QUERY);
    await sendButton(page).click();

    await expect(messageByRole(page, "user")).toHaveText(/St Edward/);

    // The job should appear in the sidebar (system message may lag due to AI latency)
    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });

    const queryText = await jobListItem(page).first().locator("strong").textContent();
    expect(queryText).toContain(RESEARCH_QUERY);

    await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
    await chatInput(page).fill("another question");
    await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
  });

  test("production research smoke exposes an observable job", async ({ page }) => {
    const sessionId = createTestSessionId();
    await setSessionId(page, sessionId);
    await page.goto("/");

    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
    await resetSession(page);

    await chatInput(page).fill(RESEARCH_QUERY);
    await sendButton(page).click();

    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed|failed/, { timeout: 30000 });
  });
});
