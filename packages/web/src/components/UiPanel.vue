<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "panel" | "card" | "subtle";
}>(), {
  variant: "panel",
});

const variantClasses = {
  panel: "rounded-md bg-surface-subtle p-3 shadow-panel",
  card: "rounded-md bg-surface p-2 shadow-card",
  subtle: "rounded-md border border-border bg-surface-subtle p-3",
};
</script>

<template>
  <div :class="variantClasses[variant]">
    <slot />
  </div>
</template>
