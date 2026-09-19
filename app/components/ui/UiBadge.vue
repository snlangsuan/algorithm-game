<script setup lang="ts">
type Tone = 'primary' | 'neutral' | 'success' | 'warning'

withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'primary' })

const tones: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
  neutral: 'bg-surface-sunken text-ink-muted ring-line-strong',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200'
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
    :class="tones[tone]"
  >
    <slot />
  </span>
</template>
