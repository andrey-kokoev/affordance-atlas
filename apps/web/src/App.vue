<script setup lang="ts">
import { computed } from "vue";
import { AvailabilityClaimSchema } from "@affordance-atlas/domain";

const sampleClaimResult = computed(() =>
  AvailabilityClaimSchema.safeParse({
    claim_id: "claim_demo",
    claim_type: "availability_claim",
    schema_version: "0.2.0",
    lifecycle: {
      verification_state: "active",
      created_at: "2026-06-16T12:00:00-05:00",
      updated_at: "2026-06-16T12:00:00-05:00",
      last_verified_at: "2026-06-16T12:00:00-05:00",
    },
    assertion: {
      affordance: {
        affordance_id: "aff_catholic_mass",
        canonical_label: "Catholic Mass",
        category: "religious_service",
        subtype: "catholic_mass",
      },
      place: {
        place_id: "place_demo",
        canonical_name: "Demo Parish Church",
        place_type: "church",
        address: "123 Main St, Exampletown, NY",
        latitude: null,
        longitude: null,
        parent_place_id: null,
      },
      service_area: null,
      time_scope: {
        kind: "recurrence",
        timezone: "America/New_York",
        starts_at: null,
        ends_at: null,
        recurrence_rule: "FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0",
        recurrence_label: "Sundays at 10:00 AM",
        exception_rules: ["holiday schedules may override ordinary Sunday schedule"],
      },
      claim_validity: {
        valid_from: null,
        valid_through: null,
        validity_basis: "no explicit source validity window",
      },
      access_conditions: [
        {
          condition_type: "walk_in_allowed",
          value: true,
          confidence: "probable",
          evidence_item_ids: ["ev_demo"],
        },
      ],
    },
    evidence: {
      evidence_items: [
        {
          evidence_item_id: "ev_demo",
          evidence_source_id: "src_demo",
          source_class: "official_primary",
          item_class: "webpage",
          source_type: "official_website",
          source_locator: "https://example.invalid/mass-times",
          retrieved_at: "2026-06-16T12:00:00-05:00",
          published_at: null,
          observed_at: null,
          evidence_span: "Sunday Mass 10:00 AM",
          extracted_text: "Sunday Mass 10:00 AM",
          authority_level: "official",
          freshness_state: "current",
          artifact_ref: null,
        },
      ],
      evidence_summary: "Official parish page lists Sunday Mass at 10:00 AM.",
    },
    assessments: {
      confidence: {
        state: "high_confidence",
        score: null,
        basis: ["official primary source", "specific recurrence", "source retrieved recently"],
      },
      freshness_state: "current",
      contradiction_state: "none",
    },
    provenance: {
      extraction_method: "manual",
      extracted_by: null,
      extraction_run_id: null,
      normalized_by: null,
      normalization_run_id: null,
    },
    contradiction: {
      contradiction_state: "none",
      contradicted_by_claim_ids: [],
      notes: null,
    },
  }),
);
</script>

<template>
  <main>
    <h1>Affordance Atlas</h1>
    <p>Closed-loop spatiotemporal affordance availability resolver.</p>
    <section>
      <h2>Zod domain schema check</h2>
      <pre>{{ sampleClaimResult.success ? "sample claim valid" : sampleClaimResult.error.message }}</pre>
    </section>
  </main>
</template>
