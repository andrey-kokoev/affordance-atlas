<script setup lang="ts">
withDefaults(defineProps<{
  tone?: "success" | "danger" | "info" | "neutral";
  shape?: "pill" | "rounded";
  uppercase?: boolean;
}>(), {
  tone: "neutral",
  shape: "pill",
  uppercase: false,
});

const toneClasses = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-border text-text-subtle",
};
const shapeClasses = {
  pill: "rounded-full px-2 py-1 text-sm max-md:text-xs",
  rounded: "rounded-sm px-1.5 py-0.5 text-xs",
};
</script>

<template>
  <span :class="[toneClasses[tone], shapeClasses[shape], uppercase ? 'uppercase' : '']">
    <slot />
  </span>
</template>
