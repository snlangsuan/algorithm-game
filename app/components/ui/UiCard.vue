<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    interactive?: boolean
  }>(),
  { interactive: false }
)
</script>

<template>
  <div
    class="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-soft transition-all duration-200"
    :class="interactive ? 'hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift' : ''"
  >
    <div v-if="$slots.media" class="mb-4">
      <slot name="media" />
    </div>

    <header v-if="title || subtitle || $slots.header" class="mb-3">
      <slot name="header">
        <h3 v-if="title" class="text-base font-semibold text-ink">{{ title }}</h3>
        <p v-if="subtitle" class="mt-1 text-sm text-ink-muted">{{ subtitle }}</p>
      </slot>
    </header>

    <div class="flex-1 text-sm leading-relaxed text-ink-muted">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="mt-5 border-t border-line pt-4">
      <slot name="footer" />
    </footer>
  </div>
</template>
