<script setup lang="ts">
withDefaults(defineProps<{
  as?: "a" | "button";
  variant?: "primary" | "secondary" | "danger" | "info";
  size?: "xs" | "sm";
  type?: "button" | "submit" | "reset";
}>(), {
  as: "button",
  variant: "secondary",
  size: "sm",
  type: "button",
});

const baseClass = "inline-flex cursor-pointer items-center justify-center rounded-md text-sm";
const variantClasses = {
  primary: "border-0 bg-primary text-primary-text hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted",
  secondary: "border border-border-strong bg-surface text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55",
  danger: "border border-danger bg-surface text-danger hover:bg-danger-soft",
  info: "border border-info-border bg-surface text-info hover:bg-info-muted",
};
const sizeClasses = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-2",
};
</script>

<template>
  <component :is="as" :type="as === 'button' ? type : undefined" :class="[baseClass, variantClasses[variant], sizeClasses[size]]">
    <slot />
  </component>
</template>
