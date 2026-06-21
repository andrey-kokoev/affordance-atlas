# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: real-research-engine.spec.ts >> General open-web research >> answers ordinary query with visible evidence: observatory admission
- Location: e2e\real-research-engine.spec.ts:56:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByTestId('message-assistant').last().getByTestId('answer-evidence').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('message-assistant').last().getByTestId('answer-evidence').first()
    14 × locator resolved to <div data-testid="answer-evidence" class="grid gap-1.5 border-y border-border py-2 text-sm">…</div>
       - unexpected value "hidden"

```

```yaml
- banner:
  - heading "Affordance Atlas" [level=1]
  - button "New chat"
  - text: Online
- main:
  - region "Chat":
    - strong: You
    - time: 8:54:40 PM
    - paragraph: When is the Empire State Building Observatory open?
    - strong: System
    - time: 8:54:40 PM
    - paragraph: I’m looking that up for you. This may take a moment.
    - strong: Atlas
    - time: 8:56:06 PM
    - paragraph: Empire State Building Observatory offers public webpage visit hours on daily.
    - text: Place
    - strong: Empire State Building Observatory
    - text: Empire State Building - Main/Top Deck Observatories Available for
    - strong: public webpage visit hours
    - text: When
    - strong: daily
    - text: "Confidence:"
    - strong: High confidence
    - group: Sources and evidence (1)
    - group: Caveats
    - paragraph: "Next: Verify the extracted schedule with the venue."
    - textbox "Ask when and where something is available..."
    - button "Ask" [disabled]
  - complementary "Research jobs":
    - heading "Activity" [level=2]
    - list:
      - listitem:
        - button "When is the Empire State Building Observatory open?completed":
          - strong: When is the Empire State Building Observatory open?
          - text: completed
        - paragraph: "Answer: Empire State Building Observatory offers public webpage visit hours on daily.. Select this job to jump to it."
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { createTestSessionId, setSessionId } from "./helpers/session.js";
  3  | import {
  4  |   chatInput,
  5  |   connectionStatus,
  6  |   jobOutcome,
  7  |   jobListItem,
  8  |   jobStatusBadge,
  9  |   messageByRole,
  10 |   sendButton,
  11 |   workingIndicator,
  12 | } from "./helpers/selectors.js";
  13 | 
  14 | const ordinaryQueries = [
  15 |   { query: "When can I visit the Statue of Liberty National Monument this week?", affordanceType: "public visiting hours", expectedDomains: ["nps.gov", "statuecitycruises.com"] },
  16 |   { query: "What time is Sunday Mass at St. Patrick's Cathedral in New York?", affordanceType: "religious service", expectedDomains: ["saintpatrickscathedral.org", "saintpatrickscathedral.com", "catholicchurch.directory"] },
  17 |   { query: "When is Grand Central Terminal open in New York?", affordanceType: "terminal access", expectedDomains: ["grandcentralterminal.com", "mta.info"] },
  18 |   { query: "When is the Union Square Greenmarket open in Manhattan?", affordanceType: "farmers market", expectedDomains: ["grownyc.org", "unionsquarenyc.org"] },
  19 |   { query: "When is the Empire State Building Observatory open?", affordanceType: "observatory admission", expectedDomains: ["esbnyc.com", "empirestatebuilding.com", "empire-state-building-nyc.com"] },
  20 | ];
  21 | 
  22 | async function openNewSession(page: import("@playwright/test").Page, sessionId: string): Promise<void> {
  23 |   await setSessionId(page, sessionId);
  24 |   await page.goto("/");
  25 |   await expect(connectionStatus(page)).toHaveText("Online", { timeout: 60000 });
  26 | }
  27 | 
  28 | async function askAndExpectEvidence(page: import("@playwright/test").Page, query: string): Promise<string> {
  29 |   await chatInput(page).fill(query);
  30 |   await sendButton(page).click();
  31 | 
  32 |   await expect(messageByRole(page, "system").last()).toContainText("I’m looking that up for you", { timeout: 30000 });
  33 |   await expect(jobListItem(page).first().locator("strong")).toHaveText(query, { timeout: 60000 });
  34 |   await expect(jobStatusBadge(page).first()).toHaveText(/queued|running|completed/, { timeout: 30000 });
  35 | 
  36 |   await expect(jobStatusBadge(page).first()).toHaveText("completed", { timeout: 240000 });
  37 |   await expect(jobOutcome(page).first()).toContainText("Answer:");
  38 |   await expect(workingIndicator(page)).toHaveCount(0);
  39 | 
  40 |   const answer = messageByRole(page, "assistant").last();
  41 |   await expect(answer).toContainText(/Confidence:/, { timeout: 30000 });
  42 |   await expect(answer.getByTestId("answer-result").first()).toBeVisible();
> 43 |   await expect(answer.getByTestId("answer-evidence").first()).toBeVisible();
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  44 |   const sourceLink = answer.getByTestId("answer-source-link").first();
  45 |   await expect(sourceLink).toHaveAttribute("href", /^https?:\/\//);
  46 |   await expect(answer).toContainText(/Retrieved/);
  47 |   await expect(answer).not.toContainText("Unverified lead");
  48 | 
  49 |   const href = await sourceLink.getAttribute("href");
  50 |   if (!href) throw new Error(`Missing source URL for ${query}`);
  51 |   return new URL(href).hostname.replace(/^www\./, "");
  52 | }
  53 | 
  54 | test.describe("General open-web research", () => {
  55 |   for (const item of ordinaryQueries) {
  56 |     test(`answers ordinary query with visible evidence: ${item.affordanceType}`, async ({ page }) => {
  57 |       test.setTimeout(300000);
  58 |       const sessionId = createTestSessionId();
  59 |       await openNewSession(page, sessionId);
  60 |       const sourceDomain = await askAndExpectEvidence(page, item.query);
  61 |       expect(
  62 |         item.expectedDomains.some((domain) => sourceDomain.includes(domain)),
  63 |         `source domain ${sourceDomain} was not one of ${item.expectedDomains.join(", ")}`,
  64 |       ).toBe(true);
  65 |     });
  66 |   }
  67 | 
  68 | });
  69 | 
```