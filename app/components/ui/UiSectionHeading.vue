<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    description?: string
    align?: 'left' | 'center'
  }>(),
  { align: 'left' }
)
</script>

<template>
  <div :class="align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'">
    <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-widest text-primary-600">
      {{ eyebrow }}
    </p>
    <h2 class="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{{ title }}</h2>
    <p v-if="description" class="mt-3 text-sm leading-relaxed text-ink-muted">{{ description }}</p>
  </div>
</template>
