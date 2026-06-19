import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { createQuickActionTools } from "agents/browser/ai";
import type { Ai } from "@cloudflare/workers-types";
import { z } from "zod";
import {
  type NormalizedQuery,
  type ResearchJobId,
  type AnswerId,
  type PlaceId,
  type AffordanceId,
  type ClaimId,
  type EvidenceItemId,
  buildAnswer,
} from "@affordance-atlas/domain";
import * as db from "./db.js";

export interface ResearchContext {
  db: import("@cloudflare/workers-types").D1Database;
  ai: Ai;
  browser: unknown;
  sessionId?: string;
}

const ExtractedScheduleSchema = z.object({
  found: z.boolean(),
  place_name: z.string().nullable(),
  place_address: z.string().nullable(),
  affordance_label: z.string().nullable(),
  schedule_description: z.string().nullable(),
  recurrence_rule: z.string().nullable(),
  recurrence_label: z.string().nullable(),
  source_url: z.string().nullable(),
  source_title: z.string().nullable(),
  confidence: z.enum(["high_confidence", "probable", "candidate", "insufficient"]),
});

export async function runResearch(
  ctx: ResearchContext,
  jobId: ResearchJobId,
  query: NormalizedQuery,
): Promise<void> {
  await db.updateResearchJobStatus(ctx.db, jobId, { status: "running", scheduledAt: new Date().toISOString() });

  try {
    const searchQuery = `${query.constraints.affordance.canonical_label ?? query.original_user_query} ${query.constraints.spatial.anchor_label ?? ""}`.trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    const quickActions = createQuickActionTools({ browser: ctx.browser as never }) as unknown as Record<
      string,
      (args: unknown) => Promise<unknown>
    >;
    const workersai = createWorkersAI({ binding: ctx.ai as never });

    // 1. Get search results as markdown
    const searchResult = (await quickActions.browser_markdown?.({
      url: searchUrl,
    })) as { markdown?: string } | undefined;

    const searchMarkdown = searchResult?.markdown ?? "";

    // 2. Ask the model to pick the most promising result URL
    const { object: urlPick } = await generateObject({
      model: workersai("@cf/moonshotai/kimi-k2.6"),
      schema: z.object({ candidate_url: z.string().nullable(), reason: z.string() }),
      system:
        "You are given a markdown search results page. Pick the single most authoritative URL that likely contains a current schedule or availability info. Return null if none look promising.",
      prompt: `Search query: "${searchQuery}"\n\nSearch results markdown (first 8000 chars):\n${searchMarkdown.slice(0, 8000)}`,
    });

    if (!urlPick.candidate_url) {
      throw new Error("No promising candidate URL found in search results.");
    }

    // 3. Extract structured schedule data from the candidate page
    const extraction = (await quickActions.browser_extract?.({
      url: urlPick.candidate_url,
      prompt:
        "Extract the schedule or availability information for the service or activity mentioned. Include place name, address, schedule description, recurrence rule (e.g. FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0), recurrence label (e.g. Sundays at 10:00 AM), source URL, source title, and confidence.",
      schema: ExtractedScheduleSchema,
    })) as { data?: z.infer<typeof ExtractedScheduleSchema> } | undefined;

    const data = extraction?.data;
    if (!data?.found || !data.place_name || !data.affordance_label) {
      throw new Error("Could not extract a usable schedule from the candidate page.");
    }

    // 4. Persist extracted data as an AvailabilityClaim
    const now = new Date().toISOString();
    const placeId = `place_${crypto.randomUUID()}` as PlaceId;
    const affordanceId = `aff_${crypto.randomUUID()}` as AffordanceId;
    const claimId = `claim_${crypto.randomUUID()}` as ClaimId;
    const evidenceItemId = `ev_${crypto.randomUUID()}` as EvidenceItemId;
    const answerId = `answer_${crypto.randomUUID()}` as AnswerId;

    await db.insertPlace(ctx.db, {
      placeId,
      canonicalName: data.place_name,
      address: data.place_address,
    });

    await db.insertAffordance(ctx.db, {
      affordanceId,
      canonicalLabel: data.affordance_label,
      category: "general",
    });

    await db.insertEvidenceItem(ctx.db, {
      evidenceItemId,
      itemClass: "webpage",
      sourceLocator: data.source_url ?? urlPick.candidate_url,
      retrievedAt: now,
      evidenceSpan: data.schedule_description ?? data.recurrence_label ?? "schedule",
      extractedText: data.schedule_description ?? data.recurrence_label ?? null,
      freshnessState: "current",
    });

    await db.insertAvailabilityClaim(ctx.db, {
      claimId,
      schemaVersion: "0.2.0",
      affordanceId,
      placeId,
      timeScopeJson: JSON.stringify({
        kind: "recurrence",
        timezone: query.timezone,
        starts_at: null,
        ends_at: null,
        recurrence_payload:
          data.recurrence_rule && data.recurrence_label
            ? { recurrence_rule: data.recurrence_rule, recurrence_label: data.recurrence_label }
            : data.recurrence_label
              ? { recurrence_rule: null, recurrence_label: data.recurrence_label }
              : { recurrence_rule: "FREQ=WEEKLY", recurrence_label: data.schedule_description ?? "Regular schedule" },
        exception_rules: [],
      }),
      claimValidityJson: JSON.stringify({
        valid_from: null,
        valid_through: null,
        validity_basis: `extracted from ${data.source_url ?? urlPick.candidate_url}`,
      }),
      verificationState: "active",
      confidenceState: data.confidence,
      freshnessState: "current",
      contradictionState: "none",
    });

    await db.linkClaimEvidence(ctx.db, claimId, evidenceItemId);

    // 5. Build and store answer
    const answer = buildAnswer({
      answer_id: answerId,
      query_id: query.query_id,
      answer_mode: "asynchronous",
      answer_state: "answered",
      original_user_query: query.original_user_query,
      normalized_query_ref: query.query_id,
      results: [
        {
          result_id: `result_${claimId}`,
          claim_id: claimId,
          affordance_label: data.affordance_label,
          place_label: data.place_name,
          place_address: data.place_address,
          occurrence: {
            starts_at: null,
            ends_at: null,
            timezone: query.timezone,
            recurrence_label: data.recurrence_label,
          },
          access_conditions: [],
          confidence_state: data.confidence,
          freshness_state: "current",
          verification_state: "candidate",
          contradiction_state: "none",
          evidence_refs: [evidenceItemId],
          caveats: ["Information was extracted automatically from the web. Verify before relying on it."],
        },
      ],
      answer_summary: `${data.place_name} offers ${data.affordance_label}${data.recurrence_label ? ` on ${data.recurrence_label}` : ""}.`,
      next_actions: [{ action_type: "verify", label: "Verify the extracted schedule with the venue." }],
    });

    await db.insertAnswer(ctx.db, {
      answerId,
      queryId: query.query_id,
      researchJobId: jobId,
      answerMode: "asynchronous",
      answerState: "answered",
      answerJson: JSON.stringify(answer),
      generatedAt: now,
    });

    await db.updateResearchJobStatus(ctx.db, jobId, {
      status: "completed",
      resultAnswerId: answerId,
      completedAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.updateResearchJobStatus(ctx.db, jobId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
  }
}
