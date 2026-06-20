# General Open-Web Research Goal

## Goal

Build a production-deployed Affordance Atlas app that handles ordinary natural-language availability questions through a general open-web research pipeline. For every non-demo user query, the system must either produce a chat-visible answer grounded in newly retrieved external web evidence, or produce a chat-visible failure explaining why no reliable answer could be produced. It must never satisfy ordinary research with hardcoded query-specific URLs, controlled fixtures, seeded data, cached placeholder answers, or generic fallback answers.

## Acceptance

- Source discovery is general: ordinary queries may use reusable search/discovery mechanisms, but not query-specific `if this query then this URL` shortcuts.
- Each answered result includes place, affordance, recurrence/time, confidence, caveats, source URL, retrieved timestamp, and extracted evidence text or span.
- The answer must be relevant to the submitted query's affordance, place, and time constraints.
- Failed research must appear in chat and the job sidebar with a concrete reason, not as silent completion.
- Completed jobs must always have a visible assistant answer in chat.
- Reloading or reconnecting must preserve coherent chat/job state.
- Cached answers may be reused only if they contain valid evidence metadata and are not stale under the app's freshness policy.
- Production e2e must pass for at least five unrelated ordinary queries across at least three source domains and at least three affordance types.
- E2E tests must run against production and must not use demo mode, fixtures, seeded answers, marker strings, or hardcoded per-query routes.
- Unsupported cases are acceptable only when they fail honestly and visibly.
