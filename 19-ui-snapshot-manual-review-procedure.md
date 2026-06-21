# UI Snapshot Manual Review Procedure

This procedure is the required human review pass for the visual snapshot inventory in `17-ui-snapshot-review-inventory.md`. It complements the automated evidence in `18-ui-snapshot-review-evidence.md`; it does not replace the automated gates.

## Objective

Review every current generated screenshot in `packages/web/e2e-snapshots/visual/` through the contact sheet, classify defects consistently, export `visual-review-status.json`, and prove the strict manual gate passes.

## Required Inputs

- Current inventory: `17-ui-snapshot-review-inventory.md`
- Evidence and gate status: `18-ui-snapshot-review-evidence.md`
- Contact sheet: `packages/web/e2e-snapshots/index.html`
- Manual review todo: `packages/web/e2e-snapshots/visual-review-todo.md`
- Manual review todo JSON: `packages/web/e2e-snapshots/visual-review-todo.json`
- Manual review status template: `packages/web/e2e-snapshots/visual-review-status.template.json`
- Manual review section queue: `packages/web/e2e-snapshots/visual-review-section-queue.json`
- Duplicate review guidance: `packages/web/e2e-snapshots/visual-review-duplicates.json`
- Chat progression review evidence: `packages/web/e2e-snapshots/visual-review-chat-progression.json`
- Chat progression visual sheet: `packages/web/e2e-snapshots/visual-review-chat-progression.html`
- Section visual review sheets: `packages/web/e2e-snapshots/visual-review-sections/index.html` and `packages/web/e2e-snapshots/visual-review-sections/index.json`
- Inventory coverage evidence: `packages/web/e2e-snapshots/visual-inventory-coverage.json`
- Machine report: `packages/web/e2e-snapshots/visual-review-report.json`
- Screenshot directory: `packages/web/e2e-snapshots/visual/`

## Preflight

1. Run `pnpm --filter @affordance-atlas/web audit:visual`.
2. Confirm the summary reports `pass: true`, `actual: 286`, `states: 73`, `entriesWithoutCoverage: 0`, `unexpectedDuplicates: 0`, `inventoryCoverageIncompleteItems: 0`, `chatProgressionMissingStages: 0`, `chatProgressionMissingFiles: 0`, `reviewTodoConsistencyIssues: 0`, `reviewTodoLinkItemReferences: 910`, `reviewSectionQueueConsistencyIssues: 0`, `reviewStatusTemplateConsistencyIssues: 0`, `duplicateReviewConsistencyIssues: 0`, `duplicateAliasActionFiles: 8`, `duplicateAliasActionConsistencyIssues: 0`, `contactSheetToolbarControls: 10`, `contactSheetFilterControls: 4`, `contactSheetStatusOptions: 4`, `contactSheetViewportFilterOptions: 6`, `contactSheetSectionFilterOptions: 14`, `contactSheetScopeControlReferences: 9`, `contactSheetReviewStatusControls: 286`, `contactSheetReviewNoteControls: 286`, `contactSheetImportGuardReferences: 5`, `contactSheetDuplicateAliasActionFiles: 8`, `contactSheetConsistencyIssues: 0`, `chatProgressionArtifactConsistencyIssues: 0`, `chatProgressionArtifactExpectedFiles: 84`, `chatProgressionHtmlStageAnchors: 18`, `chatProgressionHtmlImageReferences: 84`, `chatProgressionHtmlConsistencyIssues: 0`, `sectionSheetsSections: 14`, `sectionSheetsImageReferences: 624`, `sectionSheetsIndexLinks: 14`, `sectionSheetsScopeControlReferences: 126`, `sectionSheetsExportSchemaReferences: 14`, `sectionSheetsExportSnapshotSetReferences: 14`, `sectionSheetsExportScreenshotCountReferences: 14`, `sectionSheetsImportControlReferences: 14`, `sectionSheetsImportGuardReferences: 14`, `sectionSheetsWarningSummaryReferences: 14`, `sectionSheetsNextPendingReferences: 14`, `sectionSheetsFilterControlReferences: 14`, `sectionSheetsConsistencyIssues: 0`, and `manualReviewPending: 286` unless a real review is already in progress.
3. Open `packages/web/e2e-snapshots/visual-review-todo.md`, `packages/web/e2e-snapshots/visual-review-todo.json`, `packages/web/e2e-snapshots/visual-review-status.template.json`, `packages/web/e2e-snapshots/visual-review-section-queue.json`, `packages/web/e2e-snapshots/visual-review-duplicates.json`, `packages/web/e2e-snapshots/visual-review-chat-progression.json`, `packages/web/e2e-snapshots/visual-review-chat-progression.html`, `packages/web/e2e-snapshots/visual-review-sections/index.html`, `packages/web/e2e-snapshots/visual-review-sections/index.json`, and `packages/web/e2e-snapshots/visual-inventory-coverage.json`; confirm the todo files list the same pending screenshot count and section counts as the audit summary, confirm each todo item includes a maintained contact-sheet anchor and PNG path, confirm the status template has every screenshot initialized to pending, confirm the section queue has one deterministic queue per inventory section with remaining references, confirm duplicate guidance has zero unexpected groups and skip notes, confirm chat progression evidence reports 18 complete stages, 84 present PNG links, and an HTML sheet with 18 stage anchors and 84 image references, confirm section review sheets report 14 sections, 624 image references, 14 section index links, 126 required scope controls, 14 export schema markers, 14 snapshot-set hash markers, 14 screenshot-count markers, 14 import controls, 14 guarded import validators, 14 section warning summaries, 14 section next-pending controls, 14 section filter-control sets, and zero consistency issues, and confirm inventory coverage reports zero incomplete items.
4. Run `pnpm --filter @affordance-atlas/web audit:visual:manual:selftest`.
5. Confirm the self-test passes and reports a complete synthetic review for 286 screenshots, 9 review-scope items, and the documented negative cases.
6. Confirm no synthetic `packages/web/e2e-snapshots/visual-review-status.json` or `visual-review-status.selftest-backup.json` remains after the self-test.

## Contact Sheet Setup

1. Open `packages/web/e2e-snapshots/index.html` in a browser.
2. Enter the reviewer name before marking any screenshot.
3. Use the screenshot size selector:
   - `Small` for triage.
   - `Medium` or `Large` for ordinary review.
   - `Full-width` or `Open full size` for dense tables, mobile overflow, long text, focus rings, and subtle color issues.
4. Use the viewport filter to review mobile, tablet, desktop, wide, narrow, and boundary screenshots deliberately rather than relying only on filename search.
5. Use the inventory section filter, `visual-review-section-queue.json`, `visual-review-sections/index.html`, `visual-review-chat-progression.json`, and `visual-review-chat-progression.html` to review each enumerated screen family deliberately, especially the ordered chat progression, admin data tables, error/loading states, and responsive stress cases. The per-section sheets can also record reviewer identity, required scope attestations, per-screenshot statuses, notes, import a guarded existing review packet for resume, filter by text, status, and viewport, jump to the next visible pending screenshot in that section, and export the same strict-gate-compatible review schema; the final approval file must still be placed at `packages/web/e2e-snapshots/visual-review-status.json`.
6. Use the inventory section progress table to confirm each screen family reaches `0` pending and `0` issue before export.
7. Use `Next pending` to advance through the visible pending screenshots without losing place.
8. Use per-screenshot `Link` anchors from the contact sheet or generated todos when recording issues or handing review to another reviewer.
9. Optionally import `visual-review-status.template.json` to seed local review state with all current screenshots as pending, then make real pass/issue/skip decisions in the contact sheet. Import only review JSON exported or generated for the current contact sheet; stale schema, screenshot count, snapshot-set hash, screenshot map, or review-scope mismatches are rejected before local review state changes.

## Required Scope Attestations

Before exporting, all review-scope checkboxes must be checked after they have actually been reviewed:

- Inventory state coverage
- Responsive layout
- Spacing, density, alignment
- Color/design-system coherence
- Text readability and contrast
- Interaction/focus/hover/disabled states
- Chat progression completeness, including the maintained 18-stage audit contract
- Admin data-table usability
- Error/empty/loading states

Do not check a scope item as complete if any unresolved screenshot issue contradicts that scope.

## Per-Screenshot Decision Rules

Use `Pass` only when the screenshot is production-quality for its intended state and viewport:

- The intended screen/state is clearly visible and recognizable.
- Text is readable, not clipped, and not overlapping unrelated UI.
- Controls fit their containers and have coherent disabled, hover, and focus-visible affordances where applicable.
- Spacing, alignment, density, and table geometry are coherent for the viewport.
- Color usage fits the design system and does not reduce affordance clarity.
- Chat states show a believable progression with no confusing stale, duplicate, or contradictory messages.
- Admin table states preserve scanability, horizontal scroll behavior, and useful cell truncation.
- Error, empty, loading, offline, and reconnecting states have clear hierarchy and recovery affordances.

Use `Issue found` when any visible defect needs a code or fixture change. The note must include the defect, expected correction, and the screenshot anchor or filename.

Use `Skipped/alias` only for an intentional alias or duplicate that is already justified by the audit duplicate rationale. Prefer the guarded `Mark documented aliases skipped` action in the contact sheet, or use the skip-note text in `visual-review-duplicates.json`; the note must explain why the screenshot does not need independent approval. Canonical screenshots in each duplicate group still require normal visual review.

Leave `Pending review` for anything not yet inspected carefully enough to approve.

## Issue Handling Loop

1. Mark the screenshot as `Issue found` and write a specific note.
2. Fix the UI, fixture, or snapshot coverage issue in the relevant source.
3. Regenerate snapshots with the appropriate visual test command.
4. Run `pnpm --filter @affordance-atlas/web audit:visual`.
5. Reopen or refresh the contact sheet.
6. Re-review changed screenshots. Hash/dimension changes intentionally invalidate prior approvals.
7. Repeat until there are no issue screenshots and no pending screenshots.

## Export And Gate

1. Confirm the reviewer name is present.
2. Confirm all required review-scope checkboxes are checked truthfully.
3. Confirm the contact sheet count shows `0 pending`, `0 issue`, and no stale/missing reviewer/note warnings.
4. Confirm every inventory section progress row shows `0` pending and `0` issue.
5. Export `visual-review-status.json` from the contact sheet.
6. Place the exported file at `packages/web/e2e-snapshots/visual-review-status.json`; do not rename the pending `visual-review-status.template.json` as final approval.
7. Run `pnpm --filter @affordance-atlas/web audit:visual:manual`.
8. Completion requires the strict gate to exit 0 with `pass: true`, `manualReviewComplete: true`, `manualReviewPending: 0`, `manualReviewIssues: 0`, and no schema, hash, timestamp, reviewer, note, scope, stale-file, or changed-file issues.

## Evidence Update

After the strict gate passes, update `18-ui-snapshot-review-evidence.md` with:

- The final strict gate output.
- The reviewer identity from `visual-review-status.json`.
- The review status file path and current `snapshot_set_sha256`.
- Any skipped screenshots and their rationale.
- Any issues found and fixed during the manual pass.

Only after this evidence exists can the full UI snapshot review goal be considered complete.
