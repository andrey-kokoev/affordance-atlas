# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-snapshots.spec.ts >> visual snapshots >> captures admin-table-filtered mobile
- Location: e2e\visual-snapshots.spec.ts:871:7

# Error details

```
Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at https://affordance-atlas-server.andrei-kokoev.workers.dev/admin
Call log:
  - navigating to "https://affordance-atlas-server.andrei-kokoev.workers.dev/admin", waiting until "networkidle"

```

# Test source

```ts
  773 |     function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  774 |       const lighter = Math.max(luminance(foreground), luminance(background));
  775 |       const darker = Math.min(luminance(foreground), luminance(background));
  776 |       return (lighter + 0.05) / (darker + 0.05);
  777 |     }
  778 | 
  779 |     function effectiveBackground(element: Element): [number, number, number] | null {
  780 |       let current: Element | null = element;
  781 |       while (current) {
  782 |         const background = window.getComputedStyle(current).backgroundColor;
  783 |         if (background && !background.endsWith(", 0)") && background !== "transparent") {
  784 |           const rgb = parseRgb(background);
  785 |           if (rgb) return rgb;
  786 |         }
  787 |         current = current.parentElement;
  788 |       }
  789 |       return parseRgb(window.getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255];
  790 |     }
  791 | 
  792 |     const issues: string[] = [];
  793 |     const elements = [...document.querySelectorAll<HTMLElement>("body *")]
  794 |       .filter((element) => {
  795 |         const text = element.innerText?.replace(/\s+/g, " ").trim();
  796 |         if (!text) return false;
  797 |         if ([...element.children].some((child) => (child as HTMLElement).innerText?.trim())) return false;
  798 |         const rect = element.getBoundingClientRect();
  799 |         const style = window.getComputedStyle(element);
  800 |         return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  801 |       });
  802 | 
  803 |     for (const element of elements) {
  804 |       const style = window.getComputedStyle(element);
  805 |       const fontSize = Number.parseFloat(style.fontSize);
  806 |       const foreground = parseRgb(style.color);
  807 |       const background = effectiveBackground(element);
  808 |       if (!foreground || !background) continue;
  809 |       const ratio = contrastRatio(foreground, background);
  810 |       const largeText = fontSize >= 18 || (fontSize >= 14 && Number.parseInt(style.fontWeight, 10) >= 700);
  811 |       const minRatio = largeText ? 3 : 4.5;
  812 |       const label = `${element.tagName.toLowerCase()}:${element.innerText.replace(/\s+/g, " ").trim().slice(0, 56)}`;
  813 |       if (fontSize < 11) {
  814 |         issues.push(`${label} is too small (${fontSize.toFixed(1)}px)`);
  815 |       }
  816 |       if (ratio < minRatio) {
  817 |         issues.push(`${label} has low contrast (${ratio.toFixed(2)}:1)`);
  818 |       }
  819 |     }
  820 | 
  821 |     return issues;
  822 |   });
  823 | 
  824 |   expect(violations).toEqual([]);
  825 | }
  826 | 
  827 | async function expectConnection(page: Page, connectionText: SnapshotState["connectionText"]): Promise<void> {
  828 |   if (connectionText === null) {
  829 |     return;
  830 |   }
  831 |   await expect(page.getByTestId("connection-status")).toHaveText(connectionText ?? "Online", { timeout: 60000 });
  832 | }
  833 | 
  834 | function interactionLocator(page: Page, interaction: NonNullable<SnapshotState["interaction"]>) {
  835 |   if (interaction.testId) {
  836 |     return page.getByTestId(interaction.testId).first();
  837 |   }
  838 |   if (!interaction.role || interaction.name === undefined) {
  839 |     throw new Error("Interaction requires either testId or role/name.");
  840 |   }
  841 |   return page.getByRole(interaction.role, { name: interaction.name }).first();
  842 | }
  843 | 
  844 | async function applyFixture(page: Page, fixture: VisualFixture): Promise<void> {
  845 |   await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__applyAffordanceAtlasVisualFixture === "function");
  846 |   await page.evaluate((value) => {
  847 |     const fn = (window as unknown as { __applyAffordanceAtlasVisualFixture: (fixture: VisualFixture) => void }).__applyAffordanceAtlasVisualFixture;
  848 |     fn(value);
  849 |   }, fixture);
  850 | }
  851 | 
  852 | async function applyKeyboardFocus(page: Page, locator: ReturnType<typeof interactionLocator>): Promise<void> {
  853 |   const handle = await locator.elementHandle();
  854 |   if (!handle) throw new Error("Focus target was not found.");
  855 |   await page.keyboard.press("Escape");
  856 |   for (let idx = 0; idx < 80; idx += 1) {
  857 |     const focused = await handle.evaluate((element) => document.activeElement === element);
  858 |     if (focused) return;
  859 |     await page.keyboard.press("Tab");
  860 |   }
  861 |   throw new Error("Focus target was not reachable by keyboard tab order.");
  862 | }
  863 | 
  864 | test.describe("visual snapshots", () => {
  865 |   test.beforeAll(async () => {
  866 |     await mkdir(snapshotDir, { recursive: true });
  867 |   });
  868 | 
  869 |   for (const state of states) {
  870 |     for (const viewportName of state.viewports) {
  871 |       test(`captures ${state.name} ${viewportName}`, async ({ page }) => {
  872 |         await page.setViewportSize(viewports[viewportName]);
> 873 |         await page.goto(state.path, { waitUntil: "networkidle" });
      |                    ^ Error: page.goto: net::ERR_NETWORK_ACCESS_DENIED at https://affordance-atlas-server.andrei-kokoev.workers.dev/admin
  874 |         if (state.textScale === "large") {
  875 |           await page.addStyleTag({ content: ":root { font-size: 125%; }" });
  876 |         }
  877 |         if (state.fixture) {
  878 |           await applyFixture(page, state.fixture);
  879 |         }
  880 |         await expectConnection(page, state.connectionText);
  881 |         for (const expandText of [...(state.expandText ? [state.expandText] : []), ...(state.expandTexts ?? [])]) {
  882 |           await page.getByText(expandText).first().click();
  883 |         }
  884 |         if (state.focusTestId) {
  885 |           await page.getByTestId(state.focusTestId).focus();
  886 |         }
  887 |         if (state.scrollMessages) {
  888 |           await page.getByTestId("messages-container").evaluate((element, position) => {
  889 |             element.scrollTop = position === "top" ? 0 : element.scrollHeight;
  890 |           }, state.scrollMessages);
  891 |         }
  892 |         if (state.interaction) {
  893 |           const locator = interactionLocator(page, state.interaction);
  894 |           if (state.interaction.kind === "focus") {
  895 |             await applyKeyboardFocus(page, locator);
  896 |           } else {
  897 |             await locator.hover();
  898 |           }
  899 |         }
  900 |         await expect(page.getByRole("heading", { name: state.heading })).toBeVisible();
  901 |         if (state.requiredText) {
  902 |           await expect(page.getByText(state.requiredText).first()).toBeVisible();
  903 |         }
  904 |         for (const text of state.requiredTexts ?? []) {
  905 |           await expect(page.getByText(text).first()).toBeVisible();
  906 |         }
  907 |         if (state.requiredTestId) {
  908 |           await expect(page.getByTestId(state.requiredTestId).first()).toBeVisible();
  909 |         }
  910 |         if (state.requiredInput) {
  911 |           await expect(page.getByTestId(state.requiredInput.testId)).toHaveValue(state.requiredInput.value);
  912 |         }
  913 |         await expectNoHorizontalOverflow(page);
  914 |         await expectInteractiveLayout(page);
  915 |         await expectReadableText(page);
  916 | 
  917 |         await page.screenshot({
  918 |           path: path.join(snapshotDir, `${state.name}-${viewportName}.png`),
  919 |           fullPage: true,
  920 |         });
  921 |       });
  922 |     }
  923 |   }
  924 | });
  925 | 
```