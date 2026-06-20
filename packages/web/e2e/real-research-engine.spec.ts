import { test, expect } from "@playwright/test";
import { createTestSessionId, setSessionId } from "./helpers/session.js";
import {
  chatInput,
  connectionStatus,
  jobOutcome,
  jobListItem,
  jobStatusBadge,
  messageByRole,
  sendButton,
  workingIndicator,
} from "./helpers/selectors.js";

const ordinaryQueries = [
  { query: "When can I visit the Statue of Liberty National Monument this week?", affordanceType: "public visiting hours", expectedDomains: ["nps.gov", "statuecitycruises.com"] },
  { query: "What time is Sunday Mass at St. Patrick's Cathedral in New York?", affordanceType: "religious service", expectedDomains: ["saintpatrickscathedral.org", "saintpatrickscathedral.com", "catholicchurch.directory"] },
  { query: "When is Grand Central Terminal open in New York?", affordanceType: "terminal access", expectedDomains: ["grandcentralterminal.com", "mta.info"] },
  { query: "When is the Union Square Greenmarket open in Manhattan?", affordanceType: "farmers market", expectedDomains: ["grownyc.org", "unionsquarenyc.org"] },
  { query: "When is the Empire State Building Observatory open?", affordanceType: "observatory admission", expectedDomains: ["esbnyc.com", "empirestatebuilding.com", "empire-state-building-nyc.com"] },
];

async function openNewSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  await setSessionId(page, sessionId);
  await page.goto("/");
  await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
}

async function askAndExpectEvidence(page: import("@playwright/test").Page, query: string): Promise<string> {
  await chatInput(page).fill(query);
  await sendButton(page).click();

  await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
  await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
  await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });

  await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 240000 });
  await expect(jobOutcome(page).first()).toContainText("Answer:");
  await expect(workingIndicator(page)).toHaveCount(0);

  const answer = messageByRole(page, "assistant").last();
  await expect(answer).toContainText(/Confidence:/, { timeout: 30000 });
  await expect(answer.getByTestId("answer-result").first()).toBeVisible();
  await expect(answer.getByTestId("answer-evidence").first()).toBeVisible();
  const sourceLink = answer.getByTestId("answer-source-link").first();
  await expect(sourceLink).toHaveAttribute("href", /^https?:\/\//);
  await expect(answer).toContainText(/Retrieved/);

  const href = await sourceLink.getAttribute("href");
  if (!href) throw new Error(`Missing source URL for ${query}`);
  return new URL(href).hostname.replace(/^www\./, "");
}

test.describe("General open-web research", () => {
  for (const item of ordinaryQueries) {
    test(`answers ordinary query with visible evidence: ${item.affordanceType}`, async ({ page }) => {
      test.setTimeout(300000);
      const sessionId = createTestSessionId();
      await openNewSession(page, sessionId);
      const sourceDomain = await askAndExpectEvidence(page, item.query);
      expect(
        item.expectedDomains.some((domain) => sourceDomain.includes(domain)),
        `source domain ${sourceDomain} was not one of ${item.expectedDomains.join(", ")}`,
      ).toBe(true);
    });
  }

  test("production coverage spans five queries, source domains, and affordance types", () => {
    expect(ordinaryQueries).toHaveLength(5);
    expect(new Set(ordinaryQueries.map((item) => item.affordanceType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(ordinaryQueries.flatMap((item) => item.expectedDomains)).size).toBeGreaterThanOrEqual(3);
  });
});
