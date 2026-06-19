# AGENTS.md — affordance-atlas

## Workspace basics
- Package manager is **pnpm**. Use `pnpm ...` at the repo root; do not use npm/yarn.
- `pnpm-workspace.yaml` includes `packages/*` and `apps/*`. New packages must live there to be part of the workspace.
- Root `tsconfig.json` uses project references (`composite: true`). Add new TS packages to its `references` array.
- `.npmrc` lists `esbuild`, `sharp`, and `workerd` as `onlyBuiltDependencies` so pnpm builds their native binaries.
- `.gitignore` excludes `node_modules/`, `dist/`, `*.tsbuildinfo`, `.env`, and `.wrangler/`.

## Daily commands
- `pnpm install` — install dependencies.
- `pnpm dev` — start the Vite/Vue web app (`apps/web`).
- `pnpm dev:server` — start the Hono/Wrangler dev server (`packages/server`).
- `pnpm build` — build all packages recursively in dependency order.
- `pnpm typecheck` — build `packages/domain` then typecheck all packages in dependency order.
- `pnpm -r --sort typecheck` — typecheck in dependency order (domain → server → web). Requires `packages/domain/dist` to exist first.
- `pnpm --filter @affordance-atlas/server test` — run server tests.
- `pnpm deploy:server` — deploy `packages/server` to Cloudflare Workers.
- No lint or formatter scripts exist yet.

## Package layout
- `packages/domain` — Zod domain schemas and parsers (`AvailabilityClaim`, `NormalizedQuery`, `Answer`, `CoverageGap`, `ResearchJob`). Source of truth is `src/schema.ts`.
- `packages/server` — Hono API on Cloudflare Workers. Entrypoint: `src/index.ts`. Config: `wrangler.toml`. Uses D1 binding `DB` for `research_jobs` persistence.
- `apps/web` — Vue 3 + Vite frontend. Entrypoint: `src/main.ts`. Dev server: `vite`.
- `@affordance-atlas/domain` is consumed from its built `dist/` output via the workspace package link. Consumers no longer include domain source directly.

## TypeScript quirks
- `tsconfig.base.json` is strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`.
- Type-only imports must use `import type ...` because of `verbatimModuleSyntax`.
- Domain IDs are **branded strings** at the type level (e.g. `PlaceId`, `QueryId`, `AnswerId`) to prevent mixing ID kinds at compile time. They parse as plain strings at runtime via Zod. Use `as PlaceId` / `as QueryId` etc. when constructing literals, or import the branded type for function signatures.

## Server API behavior
- `POST /queries/answer` accepts a `NormalizedQuery`.
  - `requested_answer_mode: "synchronous" | "either"`: returns an `Answer` immediately (`200` if answered, `202` if insufficient coverage).
  - `requested_answer_mode: "asynchronous_allowed"`: returns an immediate `Answer` if data is available (`?seed=demo`); otherwise queues a `ResearchJob` in D1 and returns `202` with `{ accepted, job_id, status, check_url }`.
- `GET /research-jobs/:job_id` returns the persisted `ResearchJob`.

## Database
- `packages/server` uses Cloudflare D1 binding `DB`.
- Database name: `affordance-atlas-db`.
- Schema: `research_jobs(job_id, query_id, query_snapshot, status, created_at, updated_at, scheduled_at, completed_at, result_answer_id, error_message)`.

## Deployment
- `pnpm deploy:server` publishes `affordance-atlas-server` via Wrangler.
- Live URL: `https://affordance-atlas-server.andrei-kokoev.workers.dev`
- There is no separate development environment; deployed Workers run in production.

## Current caveats
- The root README is a placeholder. The real design docs are the numbered markdown files at repo root (`00-*` through `12-*`), especially `11-data-model-and-schemas.md` and `12-formal-mappings.md` for schema semantics.
- The server's "answered" data path is currently backed by a deterministic `?seed=demo` fallback. Real availability resolution requires the acquisition loop to populate claims and link jobs to answers.
- Tests for the server use an in-memory mock D1. Changes to D1 SQL or the mock may require updating `src/__tests__/mock-d1.ts`.
