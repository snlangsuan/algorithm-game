<script setup lang="ts">
import { BLACK, type DiscCount, type Player } from '~/game/othello/engine'
import type { GameStatus } from '~/composables/useOthelloGame'

const props = defineProps<{
  status: GameStatus
  scores: DiscCount
  winner: Player | null
  turn: number

  moves: number
  names: Record<Player, string>
}>()

const label = computed(() => {
  if (props.status === 'finished') return props.winner ? 'จบเกมแล้ว' : 'เสมอกัน'
  if (props.status === 'playing') return 'กำลังเล่น'
  if (props.status === 'paused') return 'พักอยู่'
  if (props.status === 'error') return 'มีข้อผิดพลาด'
  return 'ยังไม่เริ่ม'
})

const tone = computed(() => {
  if (props.status === 'finished') return 'bg-emerald-50 text-emerald-700'
  if (props.status === 'error') return 'bg-amber-50 text-amber-800'
  if (props.status === 'playing' || props.status === 'paused') return 'bg-primary-100 text-primary-700'
  return 'bg-surface-sunken text-ink-muted'
})

const filled = computed(() => 64 - props.scores.empty)

const share = computed(() => {
  const total = props.scores.black + props.scores.white
  return total === 0 ? 50 : Math.round((props.scores.black / total) * 100)
})

const margin = computed(() => Math.abs(props.scores.black - props.scores.white))
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold text-ink">สรุปเกม</p>
      <span class="rounded-full px-2 py-0.5 text-[10px] font-medium" :class="tone">{{ label }}</span>
    </div>

    <div class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">ลงหมากไปแล้ว</span>
        <span class="font-mono tabular-nums text-ink">{{ filled }} / 64 ช่อง</span>
      </div>

      <div class="flex h-1.5 overflow-hidden rounded-full bg-line">
        <div class="h-full bg-[#2e2440] transition-[width] duration-300" :style="{ width: `${share}%` }" />
        <div class="h-full flex-1 bg-white ring-1 ring-inset ring-line-strong" />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="truncate text-[10px] text-ink-subtle">ดำ · {{ names[BLACK] }}</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ scores.black }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="truncate text-[10px] text-ink-subtle">ขาว · {{ names[2 as Player] }}</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ scores.white }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">ตาที่</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ turn }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">{{ status === 'finished' ? 'ชนะขาด' : 'ตาที่ลงได้' }}</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ status === 'finished' ? margin : moves }}
        </p>
      </div>
    </div>
  </div>
</template>
