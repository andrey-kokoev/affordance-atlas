import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import {
  connectionStatus,
  chatInput,
  sendButton,
  messageByRole,
  jobListItem,
  jobStatusBadge,
} from "./helpers/selectors.js";

const NONSENSE_QUERY = "Where can I attend a qzxv nonexistent public ceremony in Atlantis tomorrow?";

test.describe("Affordance Atlas errors", () => {
  test("a failed research path surfaces an error in chat and sidebar, then recovers input", async ({ page }) => {
    test.setTimeout(300000);
    const sessionId = createTestSessionId();
    await setSessionId(page, sessionId);
    await page.goto("/");

    await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });

    await chatInput(page).fill(NONSENSE_QUERY);
    await sendButton(page).click();

    await expect(jobListItem(page).first()).toBeVisible({ timeout: 120000 });
    await expect(jobStatusBadge(page).first()).toHaveText("failed", { timeout: 240000 });
    await expect(jobListItem(page).first()).toContainText(/No promising candidate URL|Could not extract|research failed|Open-web research/i);
    await expect(messageByRole(page, "assistant").last()).toContainText("couldn't produce a reliable answer", { timeout: 30000 });

    await expect(chatInput(page)).toBeEnabled({ timeout: 30000 });
    await chatInput(page).fill("When is the Brooklyn Museum open this weekend?");
    await expect(sendButton(page)).toBeEnabled({ timeout: 30000 });
  });
});
