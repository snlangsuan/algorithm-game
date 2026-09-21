<script setup lang="ts">
import { OUTCOME_LABEL, secondsOf } from '~/game/line/engine'
import type { LineResult } from '~/composables/useLineGame'

/**
 * แผ่นสรุปตอนจบรอบ — ทับสนามไว้จนกว่าจะสั่งเอง
 * กด "ดูรอย" แล้วสนามจะค้างไว้พร้อมรอยสีม่วง ให้เห็นว่าส่ายตรงไหน หรือหลุดตรงไหน
 */
const props = defineProps<{
  result: LineResult
  /** ชื่อโปรแกรมที่ต่อไว้ ใช้บอกว่ารอบนี้ใครเป็นคนคิด */
  agentName: string
}>()

defineEmits<{ again: []; close: [] }>()

const finished = computed(() => props.result.outcome === 'finished')

const title = computed(() => (finished.value ? `ครบรอบใน ${secondsOf(props.result.time)} วินาที` : OUTCOME_LABEL[props.result.outcome]))

const pilotLabel = computed(() => (props.result.pilot === 'player' ? 'คุณขับเอง' : props.agentName))

const stats = computed(() => [
  { label: 'เวลา', value: `${secondsOf(props.result.time)} วิ` },
  { label: 'วิ่งไปได้', value: `${props.result.percent}%` },
  { label: 'ห่างเส้นเฉลี่ย', value: `${props.result.offset.toFixed(1)} px` },
  {
    label: 'ดีที่สุดของสนามนี้',
    value: props.result.record
      ? `${secondsOf(props.result.time)} วิ`
      : props.result.best === null
        ? '–'
        : `${secondsOf(props.result.best)} วิ`
  }
])
</script>

<template>
  <div class="absolute inset-0 grid place-items-center rounded-card bg-ink/55 p-3 backdrop-blur-[3px]">
    <div
      class="flex w-full max-w-lg flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-lift ring-4"
      :class="result.record ? 'ring-amber-200' : finished ? 'ring-emerald-200' : 'ring-rose-200'"
    >
      <div class="min-w-0">
        <h2 class="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          {{ title }}
          <span
            v-if="result.record"
            class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
          >
            เวลาดีที่สุดของสนามนี้
          </span>
        </h2>
        <p class="mt-1 text-xs leading-relaxed text-ink-muted">{{ result.advice }}</p>
        <p class="mt-1 truncate text-[11px] text-ink-subtle">รอบนี้: {{ pilotLabel }}</p>
      </div>

      <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div v-for="item in stats" :key="item.label" class="rounded-lg bg-surface-muted px-2.5 py-1.5 text-center">
          <dt class="text-[10px] text-ink-subtle">{{ item.label }}</dt>
          <dd class="font-mono text-sm font-semibold tabular-nums text-ink">{{ item.value }}</dd>
        </div>
      </dl>

      <div class="flex items-center gap-2">
        <UiButton size="sm" @click="$emit('again')">วิ่งอีกรอบ</UiButton>
        <UiButton size="sm" variant="outline" @click="$emit('close')">ดูรอย</UiButton>
      </div>
    </div>
  </div>
</template>
