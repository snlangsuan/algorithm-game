<script setup lang="ts">
import type { MazeStatus, MazeRunResult } from '~/composables/useMazeGame'

const props = defineProps<{
  status: MazeStatus
  result: MazeRunResult | null
  best: { solvable: boolean; cost: number; steps: number }
  cells: number
  exploredShown: number
}>()

const DASH = '–'

const coverage = computed(() =>
  props.cells === 0 ? 0 : Math.min(100, Math.round((props.exploredShown / props.cells) * 100))
)

const stepGap = computed(() => (props.result ? props.result.steps - props.best.steps : 0))
const costGap = computed(() => (props.result ? props.result.cost - props.best.cost : 0))

const gapLabel = (gap: number, unit: string) => {
  if (!props.result?.ok) return 'ยังเทียบกับเฉลยไม่ได้'
  return gap <= 0 ? 'ดีที่สุดเท่าที่เป็นไปได้' : `มากกว่าทางที่ดีที่สุด ${gap} ${unit}`
}

const gapTone = (gap: number) =>
  props.result?.ok && gap <= 0 ? 'text-emerald-600' : 'text-ink-subtle'

const target = (value: number, unit: string) =>
  props.best.solvable ? `ทางที่ดีที่สุด ${value} ${unit}` : 'แผนที่นี้ยังไปไม่ถึงทางออก'

const stepValue = computed(() => (props.result ? `${props.result.steps}` : DASH))
const costValue = computed(() => (props.result ? `${props.result.cost}` : DASH))

const stepNote = computed(() =>
  props.result ? gapLabel(stepGap.value, 'ก้าว') : target(props.best.steps, 'ก้าว')
)

const costNote = computed(() =>
  props.result ? gapLabel(costGap.value, 'หน่วย') : target(props.best.cost, 'หน่วย')
)

const exploredValue = computed(() => {
  if (props.result) return props.result.explored.toLocaleString()
  return props.exploredShown > 0 ? props.exploredShown.toLocaleString() : DASH
})

const msValue = computed(() => (props.result ? `${props.result.ms}` : DASH))
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        ผลการค้นหา
        <UiInfo label="ตัวเลขพวกนี้อ่านยังไง" align="left">
          กด "เริ่มหาทาง" เพื่อดูว่าโค้ดของเราทำได้เท่าไร แล้วเทียบกับทางที่ดีที่สุดของแผนที่นี้
        </UiInfo>
      </p>

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
      <span
        v-else
        class="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-ink-muted"
      >
        ยังไม่เริ่ม
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

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">จำนวนก้าว</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ stepValue }}</p>
        <p class="text-[10px] leading-tight" :class="gapTone(stepGap)">{{ stepNote }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">ต้นทุนรวม</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ costValue }}</p>
        <p class="text-[10px] leading-tight" :class="gapTone(costGap)">{{ costNote }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">ช่องที่สำรวจ</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ exploredValue }}</p>
        <p class="text-[10px] leading-tight text-ink-subtle">{{ coverage }}% ของแผนที่</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          เวลาที่โค้ดใช้คิด
          <UiInfo label="เวลาคิดนี้นับยังไง">ไม่รวมเวลาที่ใช้วาดภาพ นับเฉพาะตอนโค้ดของเราทำงาน</UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ msValue }}<span v-if="result" class="text-xs"> ms</span>
        </p>
      </div>
    </div>

    <p
      v-if="result && !result.ok"
      class="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800"
    >
      {{ result.message }}
    </p>
  </div>
</template>
