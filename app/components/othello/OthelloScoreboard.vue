<script setup lang="ts">
import { BLACK, WHITE, type DiscCount, type Player } from '~/game/othello/engine'
import type { GameStatus, SideConfig } from '~/composables/useOthelloGame'

const props = defineProps<{
  sides: Record<Player, SideConfig>

  names: Record<Player, string>
  scores: DiscCount
  current: Player
  status: GameStatus
  thinking: Player | null
  winner: Player | null
  turn: number
}>()

const playing = computed(() => props.status === 'playing')

const caption = computed(() => {
  if (props.status === 'setup') return 'เลือกผู้เล่นแล้วกดเริ่ม'
  if (props.status === 'paused') return 'พักอยู่ · กดเล่นต่อ'
  if (props.status === 'error') return 'มีข้อผิดพลาด'
  if (props.status === 'finished') return props.winner ? `ฝ่าย${props.winner === BLACK ? 'ดำ' : 'ขาว'}ชนะ` : 'เสมอกัน'
  return `ตาที่ ${props.turn} · ฝ่าย${props.current === BLACK ? 'ดำ' : 'ขาว'}เดิน`
})

const blackShare = computed(() => {
  const total = props.scores.black + props.scores.white
  return total === 0 ? 50 : (props.scores.black / total) * 100
})
</script>

<template>
  <div class="rounded-card border border-line bg-surface px-2 py-2 shadow-soft">
    <div class="flex items-center gap-1">
      <OthelloPlayerCard
        :player="BLACK"
        :config="sides[BLACK]"
      :name="names[BLACK]"
        :active="playing && current === BLACK"
        :thinking="thinking === BLACK"
      />

      <div class="flex shrink-0 items-baseline gap-1.5 px-1">
        <span
          class="text-2xl font-semibold tabular-nums transition-colors"
          :class="playing && current === BLACK ? 'text-primary-700' : 'text-ink'"
        >
          {{ scores.black }}
        </span>
        <span class="text-sm text-ink-subtle">:</span>
        <span
          class="text-2xl font-semibold tabular-nums transition-colors"
          :class="playing && current === WHITE ? 'text-primary-700' : 'text-ink'"
        >
          {{ scores.white }}
        </span>
      </div>

      <OthelloPlayerCard
        :player="WHITE"
        :config="sides[WHITE]"
      :name="names[WHITE]"
        :active="playing && current === WHITE"
        :thinking="thinking === WHITE"
        align="right"
      />
    </div>

    <div class="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-line">
      <div
        class="bg-gradient-to-r from-[#1c1524] to-[#413354] transition-all duration-500 ease-out"
        :style="{ width: `${blackShare}%` }"
      />
      <div class="flex-1 bg-primary-200 transition-all duration-500 ease-out" />
    </div>

    <p class="mt-1.5 text-center text-[11px] font-medium text-ink-muted">{{ caption }}</p>
  </div>
</template>
