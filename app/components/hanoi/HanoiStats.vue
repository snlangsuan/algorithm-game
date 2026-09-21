<script setup lang="ts">
import type { HanoiStatus, HanoiRunResult } from '~/composables/useHanoiGame'

const props = defineProps<{
  status: HanoiStatus
  result: HanoiRunResult | null

  best: number

  exploredShown: number

  movesShown: number
}>()

const DASH = '–'

const planned = computed(() =>
  props.best === 0 ? 0 : Math.min(100, Math.round((props.exploredShown / props.best) * 100))
)

const gap = computed(() => (props.result ? props.result.moves - props.best : 0))

const gapLabel = computed(() => {
  if (!props.result) return `เฉลยอยู่ที่ ${props.best.toLocaleString()} ตา`
  if (!props.result.ok) return 'ยังเทียบกับเฉลยไม่ได้'
  return gap.value <= 0 ? 'น้อยที่สุดเท่าที่เป็นไปได้' : `มากกว่าเฉลย ${gap.value.toLocaleString()} ตา`
})

const gapTone = computed(() => (props.result?.ok && gap.value <= 0 ? 'text-emerald-600' : 'text-ink-subtle'))

const moveValue = computed(() => {
  if (props.result) return props.result.moves.toLocaleString()
  return props.movesShown > 0 ? props.movesShown.toLocaleString() : DASH
})

const bestValue = computed(() => (props.result ? props.result.best : props.best).toLocaleString())

const msValue = computed(() => (props.result ? `${props.result.ms}` : DASH))
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        ผลการย้าย
        <UiInfo label="ตัวเลขพวกนี้อ่านยังไง" align="left">
          กด "เริ่มย้าย" เพื่อดูว่าโปรแกรมของเราใช้กี่ตา แล้วเทียบกับเฉลยที่น้อยที่สุดของโจทย์นี้
        </UiInfo>
      </p>

      <span
        v-if="result"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'"
      >
        {{ result.ok ? 'ย้ายครบแล้ว' : 'ยังย้ายไม่ครบ' }}
      </span>
      <span
        v-else-if="status === 'running' || status === 'paused'"
        class="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700"
      >
        {{ status === 'paused' ? 'พักอยู่' : 'กำลังทำงาน' }}
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
        <span class="text-ink-muted">{{ exploredShown > 0 ? 'วางแผนไว้แล้ว' : 'ย้ายไปแล้ว' }}</span>
        <span class="font-mono tabular-nums text-ink">
          {{ (exploredShown > 0 ? exploredShown : movesShown).toLocaleString() }} ตา
        </span>
      </div>

      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          class="h-full rounded-full bg-primary-500 transition-[width] duration-150"
          :style="{ width: `${exploredShown > 0 ? planned : Math.min(100, Math.round((movesShown / Math.max(1, best)) * 100))}%` }"
        />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">จำนวนตาที่ย้าย</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ moveValue }}</p>
        <p class="text-[10px] leading-tight" :class="gapTone">{{ gapLabel }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          เฉลยของโจทย์นี้
          <UiInfo label="เฉลยนี้มาจากไหน">น้อยกว่านี้ไม่ได้ พิสูจน์ทางคณิตศาสตร์ไว้แล้ว</UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ bestValue }}</p>
      </div>

      <div class="col-span-2 rounded-lg bg-surface px-2.5 py-2">
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
