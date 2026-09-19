<script setup lang="ts">
import type { MazeStatus, RunResult } from '~/composables/useMazeGame'

const props = defineProps<{
  status: MazeStatus
  result: RunResult | null
  best: { solvable: boolean; cost: number; steps: number }
  cells: number
  exploredShown: number
}>()

/** สัดส่วนของแผนที่ที่โค้ดเปิดดูไปแล้ว */
const coverage = computed(() =>
  props.cells === 0 ? 0 : Math.min(100, Math.round((props.exploredShown / props.cells) * 100))
)

const stepGap = computed(() => (props.result ? props.result.steps - props.best.steps : 0))
const costGap = computed(() => (props.result ? props.result.cost - props.best.cost : 0))

/** เทียบกับเฉลยได้เฉพาะรอบที่เดินถึงทางออกจริง */
const gapLabel = (gap: number, unit: string) => {
  if (!props.result?.ok) return 'ยังเทียบกับเฉลยไม่ได้'
  return gap <= 0 ? 'ดีที่สุดเท่าที่เป็นไปได้' : `มากกว่าทางที่ดีที่สุด ${gap} ${unit}`
}

const gapTone = (gap: number) =>
  props.result?.ok && gap <= 0 ? 'text-emerald-600' : 'text-ink-subtle'
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold text-ink">ผลการค้นหา</p>

      <span
        v-if="result"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'"
      >
        {{ result.ok ? 'ถึงทางออก' : 'ยังไปไม่ถึง' }}
      </span>
      <span
        v-else-if="status === 'running' || status === 'paused'"
        class="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700"
      >
        {{ status === 'paused' ? 'พักอยู่' : 'กำลังค้นหา' }}
      </span>
    </div>

    <div v-if="status === 'running' || status === 'paused'" class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">สำรวจแล้ว</span>
        <span class="font-mono tabular-nums text-ink">
          {{ exploredShown.toLocaleString() }} ช่อง · {{ coverage }}% ของแผนที่
        </span>
      </div>

      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div class="h-full rounded-full bg-primary-500 transition-[width] duration-150" :style="{ width: `${coverage}%` }" />
      </div>
    </div>

    <template v-if="result">
      <div class="mt-2.5 grid grid-cols-2 gap-2">
        <div class="rounded-lg bg-surface px-2.5 py-2">
          <p class="text-[10px] text-ink-subtle">จำนวนก้าว</p>
          <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ result.steps }}</p>
          <p class="text-[10px] leading-tight" :class="gapTone(stepGap)">
            {{ gapLabel(stepGap, 'ก้าว') }}
          </p>
        </div>

        <div class="rounded-lg bg-surface px-2.5 py-2">
          <p class="text-[10px] text-ink-subtle">ต้นทุนรวม</p>
          <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ result.cost }}</p>
          <p class="text-[10px] leading-tight" :class="gapTone(costGap)">
            {{ gapLabel(costGap, 'หน่วย') }}
          </p>
        </div>

        <div class="rounded-lg bg-surface px-2.5 py-2">
          <p class="text-[10px] text-ink-subtle">ช่องที่สำรวจ</p>
          <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ result.explored.toLocaleString() }}</p>
          <p class="text-[10px] leading-tight text-ink-subtle">{{ coverage }}% ของแผนที่</p>
        </div>

        <div class="rounded-lg bg-surface px-2.5 py-2">
          <p class="text-[10px] text-ink-subtle">เวลาที่โค้ดใช้คิด</p>
          <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ result.ms }}<span class="text-xs"> ms</span></p>
          <p class="text-[10px] leading-tight text-ink-subtle">ไม่รวมเวลาที่ใช้วาดภาพ</p>
        </div>
      </div>

      <p
        v-if="!result.ok"
        class="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800"
      >
        {{ result.message }}
      </p>
    </template>

    <p v-else-if="status === 'idle'" class="mt-2 text-[11px] leading-relaxed text-ink-subtle">
      ทางที่ดีที่สุดของแผนที่นี้คือ
      <span class="font-mono tabular-nums text-ink">{{ best.steps }}</span> ก้าว
      ต้นทุน <span class="font-mono tabular-nums text-ink">{{ best.cost }}</span>
      — กด "เริ่มหาทาง" เพื่อดูว่าโค้ดของเราทำได้เท่าไร
    </p>
  </div>
</template>
