<script setup lang="ts">
defineProps<{ to: string }>()
</script>

<template>
  <NuxtLink
    :to="to"
    active-class="text-primary-700 bg-primary-50"
    class="rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-primary-50 hover:text-primary-700"
  >
    <slot />
  </NuxtLink>
</template>
