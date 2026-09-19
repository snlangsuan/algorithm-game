<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="flex h-14 items-center justify-between gap-4 border-b border-line bg-surface px-4 sm:px-6">
    <AppLogo />
    <p v-if="title" class="hidden text-sm font-medium text-ink-muted sm:block">{{ title }}</p>
    <UiButton to="/" variant="ghost" size="sm">ออก</UiButton>
  </div>
</template>
