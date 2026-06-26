# UI Snapshot Review Evidence

This file records the current evidence for the visual snapshot review inventory in `17-ui-snapshot-review-inventory.md`.

## Current Snapshot Matrix

- Snapshot spec: `packages/web/e2e/visual-snapshots.spec.ts`
- Snapshot coverage manifest: `packages/web/e2e/visual-coverage-manifest.json`
- Generated inventory coverage evidence: `packages/web/e2e-snapshots/visual-inventory-coverage.json`
- Snapshot audit command: `pnpm --filter @affordance-atlas/web audit:visual`
- Manual approval gate command: `pnpm --filter @affordance-atlas/web audit:visual:manual`
- Manual approval gate self-test: `pnpm --filter @affordance-atlas/web audit:visual:manual:selftest`
- Manual review procedure: `19-ui-snapshot-manual-review-procedure.md`
- Snapshot output directory: `packages/web/e2e-snapshots/visual/`
- Review contact sheet: `packages/web/e2e-snapshots/index.html`
- Manual review todo: `packages/web/e2e-snapshots/visual-review-todo.md`
- Manual review todo JSON: `packages/web/e2e-snapshots/visual-review-todo.json`
- Manual review status template: `packages/web/e2e-snapshots/visual-review-status.template.json`
- Manual review section queue: `packages/web/e2e-snapshots/visual-review-section-queue.json`
- Duplicate review guidance: `packages/web/e2e-snapshots/visual-review-duplicates.json`
- Chat progression review evidence: `packages/web/e2e-snapshots/visual-review-chat-progression.json`
- Chat progression visual sheet: `packages/web/e2e-snapshots/visual-review-chat-progression.html`
- Section visual review sheets: `packages/web/e2e-snapshots/visual-review-sections/index.html` and `packages/web/e2e-snapshots/visual-review-sections/index.json`
- Machine audit report: `packages/web/e2e-snapshots/visual-review-report.json`
- Current named UI states: 73
- Current generated PNG snapshots: 286
- Primary viewports: mobile 390 x 844, tablet 768 x 1024, desktop 1280 x 900, wide desktop 1440 x 1000
- Stress viewports: narrow 320 x 740, boundary 960 x 900

## Visual Artifact Policy

Canonical visual-review artifacts stay in `packages/web/e2e-snapshots/` so `pnpm --filter @affordance-atlas/web audit:visual` remains reproducible from committed screenshots, manifests, and scripts. These include the generated report JSON, contact sheets, section sheets, todo files, duplicate guidance, chat progression evidence, inventory coverage, review status template, and PNG snapshots under `visual/`.

Ephemeral local outputs stay untracked. `.gitignore` excludes the Playwright transform cache plus `visual-review-status.json`, the manual-gate self-test backup file, and optional `visual-review-status.local*.json` scratch exports. The strict manual gate still reads `packages/web/e2e-snapshots/visual-review-status.json` when `pnpm --filter @affordance-atlas/web audit:visual:manual` runs, but normal `audit:visual` ignores that local packet so canonical machine artifacts do not churn as reviewers export or iterate on approval files. The strict manual gate is also read-only for canonical generated artifacts; run normal `audit:visual` to regenerate the committed report, contact sheets, queues, and todo artifacts.

To reduce no-op churn, `audit:visual` reuses the previous canonical `generated_at` timestamp when the current screenshot set hash is unchanged. If screenshots change, the regenerated report receives a fresh timestamp and all dependent canonical artifacts update together.

## Covered Screen Families

- Global shell: home/admin online, connecting, offline; home new chat hover/focus; admin back hover/focus; status badges.
- Home empty state: empty, focused input, typed query, disabled/busy/offline input, example query hover/focus, narrow and 960px stress widths, large-text scaling.
- Submission/research: typed query, submitted user-only frame, system lookup-only frame, queued polling, running polling, active research, reconnecting with in-progress messages, offline with in-progress messages, active actions, cancel state, elapsed/job status display, composer recovery states.
- Chat messages: user/system/assistant, long wrapping text, URL/punctuation text, scroll-pressure conversation, explicit scroll top and bottom positions, timestamp alignment through rendered snapshots.
- Answer states: verified result, multi-result result, long answer, large-text long answer, candidate/unverified warning, missing place/schedule, no next actions, next actions, fact card responsiveness.
- Evidence states: collapsed, expanded, source link hover/focus, multiple evidence sources, long source URL, missing evidence span, retrieved timestamp.
- Failure/error states: failed answer, failed job, technical details expanded, unsupported query failure, source fetch failure text, error banner, Clifton Park Mass failure scenario.
- Activity/jobs: no jobs, queued, running, completed, failed, cancelled, highlighted/focused job, long job query, hover/focus states, desktop sidebar and mobile section.
- Admin gate: empty, focused, typed, disabled/enabled unlock, loading, invalid token, desktop/mobile/tablet/wide sizing.
- Admin authenticated: token mask, copy token/header focus, forget hover, copy success, status counts, empty summary, recent jobs expanded.
- Admin tables: initial/populated, many tabs, active/focused tabs, refresh hover, loading, empty table, pagination enabled/disabled, many rows, long values, JSON-like/null/timestamp/URL cells, narrow and 960px stress widths, large-text scaling.
- Interaction/accessibility visual states: keyboard focus-visible, hover, disabled controls, placeholder/input text, target-size checks, readable text contrast, 125% root text scale, no page-level horizontal overflow.

## Automated Review Gates

The visual snapshot test asserts before every screenshot:

- Required route headings and state-specific text/test ids are visible.
- Expected connection status is rendered for online/connecting/offline states.
- Typed input fixtures keep their exact values.
- Requested details sections are expanded before capture.
- Requested hover target is applied before capture.
- Requested focus target is reached through keyboard tab order, so `:focus-visible` snapshots reflect keyboard accessibility rather than programmatic focus only.
- `documentElement.scrollWidth` does not exceed viewport width.
- Visible interactive controls are not too small, do not clip their own content, and do not visibly overlap unrelated controls.
- Controls clipped only by an intentional scroll container edge are not treated as target-size failures unless separately reviewed in a focused state.
- Visible leaf text is at least 11px and meets 4.5:1 contrast for normal text or 3:1 for large/bold text against its effective background.
- PNG screenshots are decoded and checked for blank or near-blank output using conservative color-bucket, dominant-color, and entropy thresholds.
- Exact duplicate PNG groups are treated as audit failures unless they match an executable documented rationale in `packages/web/scripts/visual-snapshot-audit.mjs`.
- Every non-excluded inventory bullet in `17-ui-snapshot-review-inventory.md` must be mapped to at least one existing visual snapshot state in `packages/web/e2e/visual-coverage-manifest.json`.
- Every non-excluded inventory bullet must resolve to concrete generated screenshot files in `visual-inventory-coverage.json`; `audit:visual` fails if any item has missing states, missing files, or zero file references.
- Every generated screenshot entry must carry at least one mapped inventory item in `visual-review-report.json`; `audit:visual` fails if any screenshot is orphaned from review intent.
- Every generated screenshot entry must also carry at least one inventory screen family/section; `audit:visual` fails if any screenshot cannot be filtered and reviewed by inventory section.
- Chat progression is maintained as an explicit 18-stage contract in `packages/web/scripts/visual-snapshot-audit.mjs`; `audit:visual` fails if any required progression state or PNG viewport file is missing.
- `visual-review-chat-progression.json` is regenerated from the maintained contract with stage order, contact-sheet anchors, direct PNG links, dimensions, hashes, and coverage context; `audit:visual` fails if this artifact drifts from the report or loses valid links.
- `visual-review-chat-progression.html` is regenerated as an ordered visual sheet for reviewing the 18-stage chat flow; `audit:visual` fails if the sheet loses a stage anchor, progression image reference, or main contact-sheet link.
- `visual-review-sections/index.html` and its per-section sheets are regenerated from the manual-review section model; `audit:visual` fails if section count, section image references, section index links, screenshot image references, main contact-sheet links, required scope controls, strict export schema markers, snapshot-set hash markers, or screenshot-count markers drift.

## Manual Review Aid

The generated contact sheet at `packages/web/e2e-snapshots/index.html` now includes browser-local review controls for every screenshot:

- Filter screenshots by filename/state/viewport text.
- Filter by review status: pending, pass, issue, skipped.
- Filter by viewport: mobile, tablet, desktop, wide, narrow, and boundary.
- Filter by inventory screen family/section, including Global Shell, Home Chat, Chat Messages, Answer Result States, Evidence Details, Failure And Error States, Activity / Research Jobs, Admin sections, Interaction And Accessibility Visual States, and Responsive Layout Stress Cases.
- Show per-inventory-section progress counts for total, pass, issue, skipped, and pending screenshots so manual review can be audited by screen family.
- Record section-level manual review counts in `visual-review-report.json` and CLI audit output, including sections with pending or issue screenshots.
- Generate `visual-review-todo.md` and `visual-review-todo.json` with a unique pending/issue screenshot checklist plus per-section totals and pending/issue screenshot filenames for review planning, automation, and handoff.
- Generate `visual-review-status.template.json` with every current screenshot hash, dimensions, section metadata, and pending status so manual review can start from a complete current status skeleton without being confused for final approval.
- Generate `visual-review-section-queue.json` with deterministic per-section remaining-review queues, next-item pointers, contact-sheet anchors, and PNG links for resuming review by screen family.
- Generate `visual-review-duplicates.json` with classified duplicate PNG groups, rationale text, canonical/alias file splits, skip-note guidance, and contact-sheet/PNG links; `audit:visual` fails if any duplicate group lacks rationale or valid links, and the contact sheet exposes a reviewer-attributed action for marking the documented alias screenshots as skipped with the generated skip notes.
- Generate `visual-review-chat-progression.json` with the ordered 18-stage chat flow, all 84 progression PNG references, contact-sheet anchors, direct PNG links, dimensions, hashes, and coverage context for focused chat progression review.
- Generate `visual-review-chat-progression.html` as an ordered visual review sheet with stage navigation, all 84 progression images, links back to the main contact sheet, and direct PNG links.
- Generate `visual-review-sections/index.html`, `visual-review-sections/index.json`, and one HTML sheet per inventory section so the full 14-section manual review can proceed through focused visual batches with reviewer identity, required scope checkboxes, per-screenshot pass/issue/skip controls, notes, shared local review state, guarded JSON import for resuming a review packet, strict-gate-compatible JSON export, section-local text/status/viewport filters, section-local next-pending navigation, section-local warnings for stale records, missing notes, missing reviewers, and unchecked scope, links back to the main contact sheet, and direct PNGs.
- Keep the main contact sheet's generated review-control HTML in the maintained audit surface, including toolbar controls, status/viewport/section/zoom filters, required scope controls, per-screenshot status and note controls, guarded import/export markers, warning summaries, next-pending navigation, and duplicate-alias skip actions; `audit:visual` fails if these generated markers drift.
- Record generated todo counts in `visual-review-report.json` and CLI audit output so the unique checklist and section-reference checklist remain auditable; `audit:visual` fails if todo counts drift from manual review pending/issue totals.
- Adjust screenshot card size with small, medium, large, and full-width zoom modes persisted in `localStorage`.
- Open any screenshot at full PNG size from its review card for close inspection.
- Use stable per-screenshot anchors and in-page links for handoff, resuming, and defect references.
- Include contact-sheet anchor links and direct PNG links in generated markdown and JSON todos, so each pending or issue item can be opened from the review plan; `audit:visual` fails if todo links drift from generated anchors or screenshot paths.
- Jump to the next visible pending screenshot from the sticky toolbar.
- Require a top-level review-scope checklist covering inventory state coverage, responsive layout, spacing/density/alignment, color/design-system coherence, text readability/contrast, interaction states, chat progression, admin table usability, and error/empty/loading states, with reviewer identity and timestamp attribution.
- Treat only `pending`, `pass`, `issue`, and `skip` as valid review statuses; invalid status values fail `audit:visual:manual`.
- Show the manifest inventory items each screenshot is intended to cover, so review intent is visible in the contact sheet.
- Mark each screenshot with a status and review note persisted in `localStorage`.
- Bind each review status to the current screenshot SHA-256 hash and dimensions, so changed screenshots return to pending review instead of inheriting stale approval.
- Stamp pass/issue/skip decisions with `reviewed_at` and `reviewed_by`, and require valid, temporally coherent timestamps plus reviewer identity in `audit:visual:manual`.
- Export the local review status as `visual-review-status.json` for archival or handoff.
- Import a previously exported `visual-review-status.json` back into the contact sheet to continue or verify a review pass from saved evidence; import rejects unsupported schema, mismatched screenshot count, mismatched snapshot-set hash, missing screenshots, or missing review scope before changing browser-local review state.
- Require the exported review status file to use schema `affordance-atlas.visual-review-status.v1`, a valid top-level `generated_at`, the current `screenshot_count`, the current `snapshot_set_sha256`, a complete `review_scope` checklist, `review_scope_reviewed_at`, `review_scope_reviewed_by`, and a top-level `screenshots` object; unsupported schemas, missing/invalid/future-dated generation timestamps, count/hash mismatches, missing review-scope attestations or attribution, temporally incoherent review timestamps, or missing/invalid screenshot maps fail `audit:visual:manual`.
- Place the exported file at `packages/web/e2e-snapshots/visual-review-status.json` and run `pnpm --filter @affordance-atlas/web audit:visual:manual` to require every current screenshot to be reviewed with no issues and zero inventory sections with pending or issue screenshots; skipped screenshots must include notes explaining why they are acceptable aliases or exclusions, and issue screenshots must include notes describing the defect to fix.

These controls do not replace human review, but they make the remaining aesthetic approval pass explicit and auditable instead of an informal scroll-through. The required manual pass is defined in `19-ui-snapshot-manual-review-procedure.md`.

## Latest Verification Evidence

Latest typecheck:

```text
pnpm typecheck
exit_code: 0
```

Latest deployment after app visual-state and contrast-token edits:

```text
pnpm deploy:server
exit_code: 0
Deployed affordance-atlas-server: https://affordance-atlas-server.andrei-kokoev.workers.dev
Current Version ID: ae8670c5-4eed-46fd-965b-0a88b1d224e3
```

Latest targeted contrast/readability subset:

```text
pnpm --filter @affordance-atlas/web exec playwright test e2e/visual-snapshots.spec.ts --reporter=line --grep home-empty|chat-success-answer|chat-candidate-warning|chat-failure|admin-auth-summary|admin-data-table
Running 32 tests using 1 worker
32 passed
exit_code: 0
```

Latest targeted large-text subset:

```text
pnpm --filter @affordance-atlas/web exec playwright test e2e/visual-snapshots.spec.ts --reporter=line --grep large-text
Running 12 tests using 1 worker
12 passed
exit_code: 0
```

Latest completed visual suite:

```text
pnpm --filter @affordance-atlas/web exec playwright test e2e/visual-snapshots.spec.ts --reporter=line
Running 286 tests using 1 worker
exit_code: 0
```

Latest machine audit:

```text
pnpm --filter @affordance-atlas/web audit:visual
exit_code: 0
```

Latest manual approval gate self-test:

```text
pnpm --filter @affordance-atlas/web audit:visual:manual:selftest
exit_code: 0
verifiedScreenshots: 286
requiredReviewScope: 9
manualReviewComplete: true
manualReviewPending: 0
manualReviewSections: 14
manualReviewSectionsWithPending: 0
manualReviewSectionsWithIssues: 0
negativeCases: stale screenshot hash, issue without note, missing review scope item, missing review scope reviewer, stale snapshot set hash, invalid screenshot status, missing screenshot reviewer, future screenshot timestamp, malformed screenshots object, stale screenshot count, missing schema, future generated_at, skip without note, missing screenshot timestamp, stale extra file, missing review scope timestamp
synthetic visual-review-status.json restored/removed after test: true
section-level pass/fail invariants asserted: true
```

```json
{
  "expected": 286,
  "actual": 286,
  "states": 73,
  "pass": true,
  "missingStates": 0,
  "extraStates": 0,
  "missingFiles": 0,
  "extraFiles": 0,
  "dimensionIssues": 0,
  "visualQualityIssues": 0,
  "duplicates": 9,
  "unexpectedDuplicates": 0,
  "inventoryItems": 158,
  "coverageMissing": 0,
  "coverageUnknownStates": 0,
  "entriesWithoutCoverage": 0,
  "manualReviewRequired": false,
  "manualReviewComplete": false,
  "manualReviewPending": 286,
  "manualReviewIssues": 0,
  "manualReviewSections": 14,
  "manualReviewSectionsWithPending": 14,
  "manualReviewSectionsWithIssues": 0,
  "reviewTodoUniquePendingOrIssue": 286,
  "reviewTodoSectionPendingOrIssueReferences": 624,
  "reviewTodoJsonUniquePendingOrIssue": 286,
  "reviewTodoJsonSectionPendingOrIssueReferences": 624,
  "reviewTodoConsistencyIssues": 0,
  "reviewTodoLinkItemReferences": 910,
  "reviewTodoContactSheetLinks": 910,
  "reviewTodoScreenshotLinks": 910,
  "reviewSectionQueueSections": 14,
  "reviewSectionQueueSectionsWithRemaining": 14,
  "reviewSectionQueueRemainingReferences": 624,
  "reviewSectionQueueConsistencyIssues": 0,
  "reviewStatusTemplateScreenshots": 286,
  "reviewStatusTemplatePendingScreenshots": 286,
  "reviewStatusTemplateScopeItems": 9,
  "reviewStatusTemplateConsistencyIssues": 0,
  "duplicateReviewGroups": 8,
  "duplicateReviewClassifiedGroups": 8,
  "duplicateReviewUnexpectedGroups": 0,
  "duplicateReviewAliasFiles": 8,
  "duplicateReviewConsistencyIssues": 0,
  "duplicateAliasActionFiles": 8,
  "duplicateAliasActionConsistencyIssues": 0,
  "contactSheetToolbarControls": 10,
  "contactSheetFilterControls": 4,
  "contactSheetStatusOptions": 4,
  "contactSheetViewportFilterOptions": 6,
  "contactSheetSectionFilterOptions": 14,
  "contactSheetZoomOptions": 4,
  "contactSheetScopeControlReferences": 9,
  "contactSheetReviewStatusControls": 286,
  "contactSheetReviewNoteControls": 286,
  "contactSheetExportSchemaReferences": 1,
  "contactSheetExportSnapshotSetReferences": 1,
  "contactSheetExportScreenshotCountReferences": 1,
  "contactSheetImportControlReferences": 1,
  "contactSheetImportGuardReferences": 5,
  "contactSheetWarningSummaryReferences": 1,
  "contactSheetNextPendingReferences": 1,
  "contactSheetDuplicateAliasActionFiles": 8,
  "contactSheetConsistencyIssues": 0,
  "chatProgressionArtifactStages": 18,
  "chatProgressionArtifactCompleteStages": 18,
  "chatProgressionArtifactExpectedFiles": 84,
  "chatProgressionArtifactMissingStages": 0,
  "chatProgressionArtifactMissingFiles": 0,
  "chatProgressionArtifactConsistencyIssues": 0,
  "chatProgressionHtmlStageAnchors": 18,
  "chatProgressionHtmlImageReferences": 84,
  "chatProgressionHtmlConsistencyIssues": 0,
  "sectionSheetsSections": 14,
  "sectionSheetsImageReferences": 624,
  "sectionSheetsPendingReferences": 624,
  "sectionSheetsIssueReferences": 0,
  "sectionSheetsIndexLinks": 14,
  "sectionSheetsScopeControlReferences": 126,
  "sectionSheetsExportSchemaReferences": 14,
  "sectionSheetsExportSnapshotSetReferences": 14,
  "sectionSheetsExportScreenshotCountReferences": 14,
  "sectionSheetsImportControlReferences": 14,
  "sectionSheetsImportGuardReferences": 14,
  "sectionSheetsWarningSummaryReferences": 14,
  "sectionSheetsNextPendingReferences": 14,
  "sectionSheetsFilterControlReferences": 14,
  "sectionSheetsConsistencyIssues": 0,
  "manualReviewChangedFiles": 0,
  "manualReviewStaleFiles": 0,
  "manualReviewSkippedWithoutNotes": 0,
  "manualReviewIssuesWithoutNotes": 0,
  "manualReviewMissingTimestamps": 0,
  "manualReviewTemporalIssues": 0,
  "manualReviewMissingReviewers": 0,
  "manualReviewInvalidStatuses": 0,
  "manualReviewStatusFileSchemaIssue": 0,
  "manualReviewStatusFileGeneratedAtIssue": 0,
  "manualReviewStatusFileScreenshotsIssue": 0,
  "manualReviewStatusFileScreenshotCountIssue": 0,
  "manualReviewStatusFileSnapshotSetIssue": 0,
  "manualReviewStatusFileReviewScopeIssue": 0,
  "manualReviewReviewScopeTimestampIssue": 0,
  "manualReviewReviewScopeReviewerIssue": 0,
  "manualReviewMissingReviewScopeItems": 0,
  "tinyFiles": 0
}
```

Generated review-context check:

```text
visual-review-report.json entries = 286
entries without coverageItems = 0
maintained audit field entriesWithoutCoverage = 0
total screenshot-to-inventory references = 1172
contact sheet coverage details present = true
entries without coverageSections = 0
sectionCount = 14
contact sheet inventory-section filter present = true
manual review sections = 14
manual review sections with pending = 14
manual review sections with issues = 0
```

Current strict manual approval gate:

```text
pnpm --filter @affordance-atlas/web audit:visual:manual
exit_code: 1
manualReviewRequired: true
manualReviewComplete: false
manualReviewPending: 286
manualReviewIssues: 0
manualReviewChangedFiles: 0
manualReviewSkippedWithoutNotes: 0
manualReviewIssuesWithoutNotes: 0
manualReviewMissingTimestamps: 0
manualReviewTemporalIssues: 0
manualReviewMissingReviewers: 0
manualReviewInvalidStatuses: 0
manualReviewStatusFileSchemaIssue: 0
manualReviewStatusFileGeneratedAtIssue: 0
manualReviewStatusFileScreenshotsIssue: 0
manualReviewStatusFileScreenshotCountIssue: 0
manualReviewStatusFileSnapshotSetIssue: 0
manualReviewStatusFileReviewScopeIssue: 0
manualReviewReviewScopeTimestampIssue: 0
manualReviewReviewScopeReviewerIssue: 0
manualReviewMissingReviewScopeItems: 0
```

This failure is expected until `visual-review-status.json` records a completed human review. The self-test proves the strict gate can pass with a complete, current, fully attributed synthetic review packet, and leaves no synthetic approval file behind.

Latest generated artifact count:

```text
packages/web/e2e-snapshots/visual/*.png = 286
```

Transient Playwright `packages/web/test-results/` was removed after the passing run.

## Duplicate Review

The latest duplicate groups are limited to expected or low-risk aliases. This is now enforced by `audit:visual`; any unclassified exact duplicate group makes the audit fail.

- `admin-data-table-*` and `admin-table-pagination-disabled-*` are identical because the default table state is also the disabled-previous pagination state; the enabled pagination state is separately covered and visually distinct.
- `chat-scroll-pressure-*` and `chat-scroll-pressure-bottom-*` are identical because the default long-stack chat fixture auto-scrolls to the bottom; explicit top snapshots are separately covered and visually distinct.
- `chat-job-link-hover-mobile.png` matches `chat-many-job-statuses-mobile.png`; mobile hover is not a meaningful persistent interaction state, while tablet/desktop/wide hover snapshots are distinct.

Earlier exact duplicates for home example hover, admin summary versus table, admin button hover, and source link focus were fixed or converted into valid state coverage.

## Fixes Made During Review

- Disabled primary buttons now use muted surface/text styling so disabled controls do not read as enabled primary actions.
- Admin unauthenticated gate is constrained on desktop instead of stretching across the admin page.
- Visual fixture application is guarded from late live agent state updates so deterministic UI states remain stable during screenshot capture.
- Details summaries gained vertical padding to make interactive summary rows usable and visually less cramped.
- The admin table remains horizontally scrollable for narrow viewports and uses wider fixed columns with line clamps for long cell values.
- The visual harness now distinguishes intentional scrollport clipping from actual control clipping/overlap.
- Home example hover, admin primary-button hover, and source-link hover/focus states now have visible state changes.
- Focus snapshots now require keyboard-reachable targets; the invalid disabled-button focus snapshot was replaced with a disabled pagination layout snapshot.
- Authenticated admin summary fixtures no longer include the full default data table, so summary and table screenshots review distinct UI states.
- The muted color token was darkened from `#6b7280` to `#4b5563` after the readability gate found 4.39:1 contrast on muted surfaces.
- The visual harness now fails low-contrast or sub-11px leaf text across every captured state.
- The visual audit now decodes PNG pixels and fails blank or near-blank screenshots using conservative image-entropy checks.
- Snapshot report and contact sheet generation now live in `packages/web/scripts/visual-snapshot-audit.mjs` instead of an inline one-off command.
- The audit script now records duplicate rationales and fails on unexpected exact duplicate screenshot groups.
- Added `packages/web/e2e/visual-coverage-manifest.json` and audit validation for inventory-to-snapshot traceability.
- Added large-text snapshots for home empty, long answer chat, and admin data table states using a 125% root font size across standard viewports.
- Added status, note, text/status/viewport/inventory-section filtering, counts, screenshot zoom controls, full-size image links, per-screenshot anchors, next-pending navigation, JSON export, and schema/count/hash-guarded JSON import controls to the generated visual review contact sheet.
- Added generated `visual-review-todo.md` and `visual-review-todo.json` as section-organized checklists of pending and issue screenshots, derived from the same audit model used by the strict manual gate.
- Added per-screenshot inventory coverage context to `visual-review-report.json` and the generated contact sheet, then mapped reconnecting/offline chat screenshots so every generated PNG has at least one review-intent item.
- Promoted per-screenshot inventory context into a maintained `audit:visual` gate via `entriesWithoutCoverage`, so future orphan screenshots fail the audit.
- Manual review records now include screenshot SHA-256 hash, dimensions, `reviewed_at` timestamps, and `reviewed_by` identity for pass/issue/skip decisions; `audit:visual:manual` rejects missing or stale approvals when a screenshot changes.
- `audit:visual:manual` now rejects skipped screenshots unless the review record includes a note explaining the skip.
- `audit:visual:manual` now rejects issue screenshots unless the review record includes a note describing the defect to fix.
- `audit:visual:manual` now rejects pass/issue/skip records without a valid `reviewed_at` timestamp or non-empty `reviewed_by` reviewer identity.
- `audit:visual:manual` now rejects future-dated `generated_at` values and pass/issue/skip records whose `reviewed_at` is future-dated or later than the exported review file `generated_at`.
- `audit:visual:manual` now rejects review status files with a missing or unsupported schema.
- `audit:visual:manual` now rejects review status files without a valid top-level `generated_at` timestamp.
- `audit:visual:manual` now rejects review status files without a top-level `screenshots` object.
- Exported review status files now include `screenshot_count` and `snapshot_set_sha256`; `audit:visual:manual` rejects count or aggregate snapshot-set hash mismatches.
- Exported review status files now include `review_scope`, `review_scope_reviewed_at`, and `review_scope_reviewed_by`; `audit:visual:manual` rejects missing, incomplete, unattributed, or temporally incoherent scope attestations for the required UI quality areas.
- Added `scripts/visual-snapshot-manual-gate-selftest.mjs` and `audit:visual:manual:selftest`, which temporarily writes a complete synthetic review file, verifies the strict manual gate can pass with zero pending screenshots, zero pending inventory sections, and zero issue inventory sections, verifies malformed packets fail for stale screenshot hash, issue without note, missing review scope item, missing review scope reviewer, stale snapshot-set hash, invalid screenshot status, missing screenshot reviewer, future screenshot timestamp, malformed screenshots object, stale screenshot count, missing schema, future generated_at, skip without note, missing screenshot timestamp, stale extra file, and missing review scope timestamp, then restores/removes the synthetic file so it cannot masquerade as real approval.
- `audit:visual:manual` now reports and rejects invalid review status values outside `pending`, `pass`, `issue`, and `skip`.
- Added generated `visual-review-chat-progression.json`, which records the maintained 18-stage chat progression as ordered review evidence with 84 current PNG links, dimensions, hashes, anchors, and coverage context; `audit:visual` rejects artifact drift or invalid progression links.
- Added generated `visual-review-chat-progression.html`, an ordered visual sheet for the 18-stage chat progression with 84 embedded progression images, stage anchors, main-sheet links, and PNG links; `audit:visual` rejects missing stage anchors or image/link references.
- Added generated section review sheets under `visual-review-sections/`, including an HTML section index, JSON index, one focused HTML sheet per inventory section, reviewer/import/export controls, per-screenshot status/note controls, required scope checkboxes, guarded resume import, direct PNG links, and strict-gate-compatible export metadata; `audit:visual` rejects missing controls, guarded import validation, fields, links, image references, required scope controls, export schema/hash/count markers, duplicate section slugs, or section count drift.
- Added `audit:visual:manual`, which fails until an exported manual review file covers all current screenshots with no issue/pending statuses.

## Remaining Risk Boundary

The automated suite covers the enumerated screen families and viewports with structural layout, keyboard focus, text readability, and large-text scaling checks plus deterministic screenshot artifacts. The contact sheet makes all 286 PNGs reviewable with explicit per-screenshot review status, note controls, and mapped inventory context for each screenshot, and the machine audit proves artifact completeness, dimensions, traceability, and exact duplicate groups. Manual approvals are now tied to each screenshot SHA-256 hash and dimensions, so changed screenshots require re-review; pass/issue/skip decisions require valid, temporally coherent timestamps and reviewer identity; skipped screenshots require explanatory notes; issue screenshots require defect notes; review status files require the supported schema, valid top-level `generated_at`, current `screenshot_count`, current `snapshot_set_sha256`, complete `review_scope`, `review_scope_reviewed_at`, `review_scope_reviewed_by`, and a top-level `screenshots` object; review status values must be one of `pending`, `pass`, `issue`, or `skip`. The strict manual approval gate currently fails with 286 pending screenshots, so final subjective production-quality approval is explicitly incomplete rather than implicit.

## Confidence

- Snapshot coverage against the inventory: 0.98
- Chat progression coverage: 0.97
- Automated layout/spacing safety: 0.96
- Keyboard focus-state validity: 0.96
- Text contrast/readability safety: 0.97
- Screenshot nonblank/render validity: 0.97
- Color/design-system consistency from current code and generated snapshots: 0.94
- Browser zoom/text-scaling coverage: 0.95
- Manual review workflow readiness: 0.9999
- Manual review completion: 0.00
- Full subjective production-quality completion without manual inspection of every PNG: 0.91

## Completion Audit

- Inventory coverage: currently proven for all listed screen families by named fixture states in `packages/web/e2e/visual-snapshots.spec.ts`, the passing 286-test visual suite, 286 generated PNGs, and the passing maintained `audit:visual` command.
- Inventory traceability: current audit validates 158 inventory bullets against `visual-coverage-manifest.json`, with zero missing manifest items, zero unknown state references, `entriesWithoutCoverage: 0`, `inventoryCoverageIncompleteItems: 0`, and 1172 item-to-file references in `visual-inventory-coverage.json`; every PNG has visible review intent and orphan screenshot entries fail `audit:visual`.
- Viewport coverage: primary viewport classes are covered by `standardViewports`; 320px and 960px stress states are covered separately for home, answer, and admin table layouts; 125% large-text states now cover home, answer, and admin table layouts across standard viewports.
- Structural review: current automated checks prove no page-level horizontal overflow, no clipped fully visible interactive controls, no too-small fully visible interactive targets, no visible unrelated-control overlap, and no low-contrast or undersized visible leaf text in the captured states.
- Render validity: current audit proves every PNG has expected dimensions and no blank/near-blank low-entropy output.
- Duplicate review: current audit proves there are no unexpected exact duplicate screenshot groups; all 9 duplicate groups are classified with executable rationales and exported to `visual-review-duplicates.json` with canonical/alias guidance and skip notes.
- Manual review readiness: generated contact sheet now provides per-screenshot status, notes, filters, counts, inventory coverage context, export, import, skipped-without-note warnings, issue-without-note warnings, and timestamped and reviewer-attributed pass/issue/skip records so a human approval pass can be performed, resumed, handed off, and recorded consistently; generated section sheets provide 14 focused visual review batches with 624 section-image references; review records are bound to current screenshot hashes and dimensions.
- Manual review completion: currently not achieved; `audit:visual:manual` fails because no exported review status file marks the 286 current screenshots as reviewed and issue-free.
- Chat progression: explicit audit-maintained frames cover 18 ordered stages: empty start, typed query, submitted-only, system-looking-only, queued polling, running polling, active research/actions, reconnecting, offline-with-session, cancelled, success, multi-result, candidate, missing-fields, failure, technical failure details, unsupported failure, and scroll pressure top/bottom states. The current audit requires 84 progression PNGs and reports zero missing progression stages/files; `visual-review-chat-progression.json` exposes those 84 PNGs with ordered stage metadata and review links, and `visual-review-chat-progression.html` presents them as an ordered visual review sheet.
- Remaining uncertainty: full aesthetic approval of every PNG is still a human visual judgment. The automated evidence is strong for coverage and structural coherence, but it cannot prove subjective production quality with mathematical certainty.
