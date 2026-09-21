<script setup lang="ts">
import { BLACK, type DiscCount, type Player } from '~/game/othello/engine'
import type { SideConfig } from '~/composables/useOthelloGame'

const props = defineProps<{
  winner: Player | null
  scores: DiscCount
  sides: Record<Player, SideConfig>

  names: Record<Player, string>
}>()

defineEmits<{ restart: [] }>()

const title = computed(() => {
  if (!props.winner) return 'เสมอกัน'
  return `ฝ่าย${props.winner === BLACK ? 'ดำ' : 'ขาว'}ชนะ`
})

const subtitle = computed(() => {
  if (!props.winner) return 'คะแนนเท่ากันพอดี'
  const side = props.sides[props.winner]
  return side.kind === 'human' ? 'ผู้เล่นคน' : props.names[props.winner]
})
</script>

<template>
  <div class="absolute inset-0 grid place-items-center rounded-2xl bg-ink/40 p-4 backdrop-blur-[3px]">
    <div class="w-full max-w-xs rounded-card border border-line bg-surface p-6 text-center shadow-lift">
      <p class="text-xs font-medium uppercase tracking-widest text-primary-600">จบเกม</p>
      <h2 class="mt-2 text-xl font-semibold text-ink">{{ title }}</h2>
      <p class="mt-1 text-sm text-ink-muted">{{ subtitle }}</p>

      <div class="mt-5 flex items-center justify-center gap-4">
        <div class="flex items-center gap-2">
          <span class="size-5 rounded-full bg-gradient-to-br from-[#413354] to-[#1c1524]" />
          <span class="text-2xl font-semibold tabular-nums text-ink">{{ scores.black }}</span>
        </div>
        <span class="text-sm text-ink-subtle">:</span>
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold tabular-nums text-ink">{{ scores.white }}</span>
          <span class="size-5 rounded-full border border-line-strong bg-white" />
        </div>
      </div>

      <UiButton block class="mt-6" @click="$emit('restart')">เล่นอีกรอบ</UiButton>
    </div>
  </div>
</template>
