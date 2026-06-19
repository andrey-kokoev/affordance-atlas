# Chat and Research Target UX

## Purpose

The app answers user questions about when and where an affordance is available. Chat is the primary surface. Research jobs are a secondary diagnostic surface that explain what the app is doing, not a competing source of truth.

## Initial Critical Review

The pre-fix UX could open with a user message, a system "looking that up" message, and a sidebar job marked `completed`, but no assistant answer. That is incoherent because completion implies a user-visible outcome. It also exposed stale placeholder research (`Workflow Research Desk`) as if it were real research, which violates the product promise.

The main problems were:

- A completed job could be visible after its stale placeholder answer was filtered from chat.
- Rehydrated sessions could show historical work without explaining whether an answer was available.
- The job sidebar used raw lifecycle labels without user-facing meaning.
- Ordinary user queries could previously receive placeholder answers instead of sourced answers or explicit failures.

## Rewritten UX Contract

The chat/research UX must satisfy these rules:

- A user question appears immediately in the transcript.
- If research is needed, the transcript shows one system message saying the app is looking it up.
- While research is queued or running, a visible working indicator appears and the matching job is visible as `queued` or `running`.
- A completed job must have a corresponding visible assistant answer in the transcript.
- A failed job must have visible error text in the job card and must not appear as a silent completion.
- Stale placeholder answers are not valid answers and must not hydrate into chat.
- Jobs whose only completed answer is a stale placeholder are not current user-facing jobs and must not appear as completed in the sidebar.
- The sidebar is secondary: it should say `answer shown` for completed jobs, `failed` with a reason for failed jobs, and should never be the only place a successful outcome appears.
- Ordinary supported queries must use sourced public data. Unsupported queries must fail visibly rather than fabricate fallback content.
- Demo mode is explicitly opt-in and may return a sample answer, but non-demo research must not return sample or placeholder content.

## Second Critical Review

This contract is stricter than the current implementation in two important ways. First, it requires server state to hide or repair legacy placeholder jobs, not only new jobs. Second, it requires e2e tests to assert state coherence across both surfaces: transcript and sidebar.

The contract intentionally does not require arbitrary open-web questions to always succeed. It requires successful jobs to have visible answers, failed jobs to have visible reasons, and no fabricated fallback answers. That is the coherent product boundary for the current vertical slice.

## Required Fixes

- Filter stale placeholder answers from cache lookup and session hydration.
- Filter completed jobs whose answer was a stale placeholder, so they cannot appear as completed without an answer.
- Preserve valid completed jobs and hydrate their answer cards into chat.
- Make the job sidebar label completed jobs as `answer shown`.
- Add e2e assertions for the exact Clifton Park Mass query proving the transcript has a real sourced answer and the sidebar does not show an orphan completion.
- Keep Browser Run strict fixture and open-web e2e coverage as required pass paths.
