# Code Simplification Opportunities

This inventory is grounded in the current repository shape and code paths. It focuses on simplification and maintenance cost rather than feature correctness. Priorities use `P0` for highest leverage or risk reduction, then `P1`, then `P2`.

## Highest-leverage findings

### 1. Split the monolithic Vue app shell

- Priority: P0
- Confidence: High
- Evidence: `packages/web/src/App.vue` is 777 lines and contains chat UI state, answer-quality heuristics, admin authentication, admin table browsing, visual fixture injection, routing by `window.location.pathname`, formatting helpers, and the full chat/admin templates in one component.
- Rationale: One file owns unrelated workflows: user chat, operational admin, test fixture mutation, local storage token handling, and display validation. That makes changes to one screen risky and forces E2E fixture needs into production component state.
- Suggested first step: Extract `AdminView.vue`, `ChatView.vue`, and `AnswerResultCard.vue`, then move admin fetch/state into a `useAdminApi` composable. Keep `App.vue` as a thin route switch until a router is introduced.

### 2. Move visual fixture/test hooks out of production component logic

- Priority: P0
- Confidence: High
- Evidence: `packages/web/src/App.vue` defines `VisualFixture`, `applyVisualFixture`, and exposes `window.__applyAffordanceAtlasVisualFixture`; `packages/web/src/composables/useAffordanceAgent.ts` checks `window.__affordanceAtlasVisualFixtureActive` in connection, state update, polling, and error paths; `packages/web/e2e/visual-snapshots.spec.ts` depends on those globals.
- Rationale: Test-only fixture machinery is interleaved with runtime state flow. The production composable has to know when tests are overriding state, which couples UI tests to implementation details and adds branches to every state update path.
- Suggested first step: Introduce a small dev/test-only fixture adapter loaded by the visual snapshot spec, or gate fixture exposure behind a build-time flag. The composable should only expose normal agent state and actions.

### 3. Break the research pipeline into narrower modules

- Priority: P0
- Confidence: High
- Evidence: `packages/server/src/research.ts` is 585 lines and includes search-query generation, DuckDuckGo/Bing parsing, URL scoring, named-place URL guessing, relevance validation, HTML-to-text conversion, Workers AI URL suggestion, Workers AI extraction, cancellation checks, D1 persistence, and final answer construction.
- Rationale: The file mixes pure ranking/parsing logic with network fetches, LLM calls, database writes, and domain formatting. That makes retry behavior, source validation, and persistence hard to test independently.
- Suggested first step: Split into `research/search.ts`, `research/extract.ts`, `research/source-validation.ts`, and `research/persist.ts`. Start with pure helpers such as `buildSearchQueries`, `extractDuckDuckGoUrls`, `extractBingUrls`, `scoreCandidateUrl`, and `assertSourceRelevant`.

### 4. Consolidate normalized-query fallback construction

- Priority: P1
- Confidence: High
- Evidence: `packages/server/src/db.ts` has `buildFallbackQuerySnapshot`; `packages/server/src/agent.ts` has `buildQueuedQuery`; `packages/server/src/normalize.ts` constructs the full `NormalizedQuery` shape again after AI extraction; `packages/server/src/__tests__/db.test.ts` also repeats a full `querySnapshotBase`.
- Rationale: The strict domain shape is repeated in several places, including fallback, queued, normalized, and test paths. Future schema changes will require broad mechanical edits and increase the chance that fallbacks drift from real normalized queries.
- Suggested first step: Add a domain-level or server-level builder for candidate `NormalizedQuery` snapshots, with overrides for uncertainty, parsed time, and constraints. Update tests to use the builder.

### 5. Reduce D1 helper breadth and raw SQL repetition

- Priority: P1
- Confidence: High
- Evidence: `packages/server/src/db.ts` is 729 lines and combines research-job reads/writes, answer cache reads, claim matching, session deletion, and low-level insert helpers for places, affordances, evidence, claims, access conditions, and answers. `deleteSessionData` repeats the same JSON-derived `claim_id IN (...)` subquery four times.
- Rationale: The file is acting as a broad data access layer and persistence script collection. The repeated session-delete subquery and many positional `bind(...)` calls increase maintenance cost and make schema changes brittle.
- Suggested first step: Split by aggregate (`researchJobs`, `answers`, `claims`) and centralize the session-owned claim subquery or materialize claim IDs once before deletion. Keep low-level insert helpers private to the claim persistence module where possible.

### 6. Replace the regex SQL mock with a narrower test boundary

- Priority: P1
- Confidence: High
- Evidence: `packages/server/src/__tests__/mock-d1.ts` implements SQL parsing through regexes for `INSERT`, `FROM`, `UPDATE`, `WHERE`, and special-case `DELETE ... IN (...)` behavior. It has custom JSON parsing to infer claim ownership from answer payloads.
- Rationale: The mock is now duplicating selected database semantics without actually executing SQL. It can pass tests while diverging from D1 behavior, especially around joins, order, limits, JSON functions, and column names.
- Suggested first step: For DB helper tests, prefer a real SQLite/D1-compatible test fixture where practical. If that is not feasible, narrow the mock to explicit helper-level assertions instead of parsing arbitrary SQL strings.

### 7. Collapse generated visual review artifacts into reproducible outputs

- Priority: P1
- Confidence: High
- Evidence: `packages/web/e2e-snapshots/visual` contains 286 PNGs. The repo also contains generated JSON/HTML review outputs under `packages/web/e2e-snapshots/` and Playwright traces/errors under `packages/web/test-results/`. `packages/web/scripts/visual-snapshot-audit.mjs` is over 1,400 lines and writes many derived artifacts such as contact sheets, review templates, section queues, duplicate reports, and chat progression reports.
- Rationale: The checked-in artifact surface is large relative to the application code and creates review noise. The audit script also contains both validation logic and artifact generation logic, making it hard to change one output without checking many generated files.
- Suggested first step: Decide which artifacts are canonical. Keep either source fixtures plus screenshots, or source fixtures plus generated HTML/JSON, but avoid committing every derived layer. Add generated review outputs and `test-results/` to ignored or ephemeral CI artifacts if they are not intended source.

### 8. Remove API/client shape duplication for admin data

- Priority: P1
- Confidence: Medium
- Evidence: `packages/server/src/index.ts` defines admin table metadata and response shapes through inline handlers; `packages/web/src/App.vue` redefines `AdminSummary`, `AdminTable`, and `AdminTableRows`; the visual snapshot spec separately fabricates admin table fixtures with table names that include examples not present in the server allowlist.
- Rationale: Admin API types are duplicated manually across server, client, and test fixtures. This increases drift risk, especially because admin tables are allowlisted and table rows are arbitrary records.
- Suggested first step: Export small shared admin response schemas/types from `packages/domain` or a server-client contract module. Generate fixture data from those types rather than handwritten parallel shapes.

### 9. Decouple MCP response formatting from agent/domain details

- Priority: P2
- Confidence: Medium
- Evidence: `packages/server/src/mcp.ts` maps full `Answer` objects into hand-written JSON summaries, including result fields and evidence field selection. The same `AskResult` path is also consumed by the web agent client.
- Rationale: MCP output formatting is another presentation layer over the same answer model. As answer fields evolve, the web UI, MCP serializer, and answer builders may drift.
- Suggested first step: Add a small `serializeAnswerSummary(answer)` helper near answer/domain presentation code and use it from MCP. Keep transport-specific wrapping in `mcp.ts`.

### 10. Simplify placeholder and cache filtering state in the agent

- Priority: P2
- Confidence: Medium
- Evidence: `packages/server/src/agent.ts` has `isPlaceholderResearchAnswer`, `isPlaceholderResearchMessage`, `hasReusableEvidenceMetadata`, `refreshJobs`, and `startRefreshForActiveJobs`. `refreshJobs` filters placeholder answers, validates evidence freshness, synthesizes failed assistant messages, hydrates missing user messages, and deduplicates by summary/content.
- Rationale: The session state reconciliation logic is doing cache policy, migration cleanup, message hydration, and UI projection at once. Content-regex placeholder detection is brittle and should not be part of normal state refresh.
- Suggested first step: Introduce an explicit persisted flag or answer metadata for placeholder/legacy answers, then move message projection into a pure function with fixture tests.

### 11. Narrow the worker entrypoint responsibilities

- Priority: P2
- Confidence: Medium
- Evidence: `packages/server/src/index.ts` handles MCP transport setup, admin authentication, admin SQL, route dispatch, agent routing, and asset fallback in one file.
- Rationale: The entrypoint should make request routing obvious. Admin concerns and MCP setup are cohesive enough to live behind `handleAdminRequest` and `handleMcpRequest`, which would also make auth behavior easier to test.
- Suggested first step: Extract `admin.ts` with `ADMIN_TABLES`, auth helpers, and admin response handlers. Leave `index.ts` as route dispatch plus asset fallback.

### 12. Treat answer construction as a reusable presentation boundary

- Priority: P2
- Confidence: Medium
- Evidence: `packages/server/src/answer.ts` builds claim-backed answers, insufficient-coverage answers, and demo answers. `packages/server/src/research.ts` separately builds an async answer inline with similar fields: `results`, `evidence_refs`, `evidence`, caveats, `answer_summary`, and `next_actions`.
- Rationale: There are now multiple answer builders that encode summary/caveat defaults and evidence shape. Inline construction in `research.ts` makes presentation changes easy to miss.
- Suggested first step: Add a `buildResearchAnswerFromExtraction` function in `answer.ts` or a new `answer-builders.ts`, then make `research.ts` pass persisted IDs and extracted data into it.

## Lower-priority cleanups

### 13. Use a route boundary instead of `isAdminPage`

- Priority: P2
- Confidence: Medium
- Evidence: `packages/web/src/App.vue` sets `isAdminPage` from `window.location.pathname === "/admin"` and branches the entire template with `v-if`.
- Rationale: This is acceptable for a very small app, but it reinforces the monolithic component and makes page-level lifecycle behavior less explicit.
- Suggested first step: Introduce a minimal route switch component or Vue Router only if more pages are expected. If not, extracting `AdminView` and `ChatView` is enough.

### 14. Replace repeated polling loops with one helper

- Priority: P2
- Confidence: High
- Evidence: `packages/server/src/agent.ts` starts a 20-iteration one-second status refresh fiber after `ask`, and `startRefreshForActiveJobs` starts a similar 90-iteration loop for active jobs on startup.
- Rationale: The loops differ mostly by duration and job source. A helper would reduce branching and make timeout policy visible in one place.
- Suggested first step: Add `startStatusRefresh(jobId, attempts)` and call it from both paths.

### 15. Keep visual snapshot fixtures closer to typed builders

- Priority: P2
- Confidence: Medium
- Evidence: `packages/web/e2e/visual-snapshots.spec.ts` manually builds normalized queries, jobs, answer results, answers, chat fixtures, admin fixtures, and 70+ snapshot states in one 849-line spec.
- Rationale: The visual test is valuable but too dense. Handwritten domain-shaped objects are another source of schema drift.
- Suggested first step: Move fixture builders to `e2e/fixtures/visual.ts` and import domain types or shared builders where possible. Leave the spec focused on state matrix execution and assertions.

## Suggested sequence

1. Start with the Vue split and fixture isolation because they reduce the largest day-to-day edit surface.
2. Split `research.ts` along pure/helper boundaries before changing behavior.
3. Consolidate `NormalizedQuery` builders so future schema changes are cheaper.
4. Decide which visual snapshot artifacts are canonical and prune or ignore derived outputs.
5. Revisit the D1 mock once DB helper modules are narrower.
