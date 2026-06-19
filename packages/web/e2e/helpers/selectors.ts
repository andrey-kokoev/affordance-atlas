import type { Page, Locator } from "@playwright/test";

export function connectionStatus(page: Page): Locator {
  return page.getByTestId("connection-status");
}

export function demoModeToggle(page: Page): Locator {
  return page.getByTestId("demo-mode-toggle").locator("input");
}

export function chatInput(page: Page): Locator {
  return page.getByTestId("chat-input");
}

export function sendButton(page: Page): Locator {
  return page.getByTestId("send-button");
}

export function messagesContainer(page: Page): Locator {
  return page.getByTestId("messages-container");
}

export function messageByRole(page: Page, role: "user" | "assistant" | "system"): Locator {
  return page.getByTestId(`message-${role}`);
}

export function jobListItems(page: Page): Locator {
  return page.getByTestId("job-list-item");
}

export function jobListItem(page: Page): Locator {
  return page.getByTestId("job-list-item");
}

export function jobStatusBadge(page: Page): Locator {
  return page.getByTestId("job-status-badge");
}

export function errorBanner(page: Page): Locator {
  return page.getByTestId("error-banner");
}

export function workingIndicator(page: Page): Locator {
  return page.getByTestId("working-indicator");
}
