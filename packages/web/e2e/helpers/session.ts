import type { Page } from "@playwright/test";

const STORAGE_KEY = "affordance-atlas-session-id";

export function createTestSessionId(): string {
  return `test-${crypto.randomUUID()}`;
}

export async function setSessionId(page: Page, sessionId: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: sessionId },
  );
}

export async function resetSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fn = (window as Record<string, unknown>).__resetSession as
      | (() => Promise<void>)
      | undefined;
    if (typeof fn !== "function") {
      throw new Error("__resetSession not exposed on window");
    }
    await fn();
  });
}
