<script setup lang="ts">
import type { SideKind } from '~/composables/useOthelloGame'

defineProps<{ black: SideKind; white: SideKind; disabled?: boolean }>()

const emit = defineEmits<{ select: [black: SideKind, white: SideKind] }>()

const presets: Array<{ label: string; black: SideKind; white: SideKind }> = [
  { label: 'คน vs คน', black: 'human', white: 'human' },
  { label: 'คน vs บอท', black: 'human', white: 'code' },
  { label: 'บอท vs คน', black: 'code', white: 'human' },
  { label: 'บอท vs บอท', black: 'code', white: 'code' }
]

const dotClass = (kind: SideKind, dark: boolean) => {
  if (kind === 'code') return dark ? 'bg-ink' : 'bg-primary-400'
  return dark ? 'bg-ink/30' : 'bg-line-strong'
}
</script>

<template>
  <div class="grid grid-cols-2 gap-1.5">
    <button
      v-for="preset in presets"
      :key="preset.label"
      type="button"
      :disabled="disabled"
      class="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      :class="
        black === preset.black && white === preset.white
          ? 'border-primary-300 bg-primary-50 text-primary-700'
          : 'border-line bg-surface text-ink-muted hover:border-primary-200 hover:text-primary-700'
      "
      @click="emit('select', preset.black, preset.white)"
    >
      <span class="size-2 rounded-full" :class="dotClass(preset.black, true)" />
      {{ preset.label }}
      <span class="size-2 rounded-full" :class="dotClass(preset.white, false)" />
    </button>
  </div>
</template>
