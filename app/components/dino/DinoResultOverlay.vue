<script setup lang="ts">
import { metersOf } from '~/game/dino/engine'
import type { DinoResult } from '~/composables/useDinoGame'

/**
 * แผ่นสรุปตอนจบรอบ — ทับลู่ไว้จนกว่าจะสั่งเอง
 *
 * ลู่เป็นการ์ดเตี้ย ๆ แผ่นนี้จึงต้องเป็นแถบแนวนอนที่สูงไม่เกินลู่
 * ถ้าทำเป็นกล่องสี่เหลี่ยมกลางจอแบบเกมอื่น มันจะล้นออกนอกการ์ดจนปุ่มถูกบีบจนอ่านไม่ออก
 */
const props = defineProps<{
  result: DinoResult
  /** ชื่อโปรแกรมที่ต่อไว้ ใช้บอกว่ารอบนี้ใครเป็นคนคิด */
  agentName: string
}>()

defineEmits<{ again: []; close: [] }>()

const record = computed(() => props.result.record)

const meters = computed(() => metersOf(props.result.distance))

const bestMeters = computed(() => metersOf(props.result.best))

const story = computed(() => {
  const { time, topSpeed, hit, level } = props.result

  const run = `วิ่งได้ ${meters.value.toLocaleString()} เมตร ถึงระดับ ${level} ใน ${time.toFixed(1)} วินาที (เร็วสุด ${topSpeed} px/วิ)`
  return `${run} — ${hit ?? ''}`
})

const pilotLabel = computed(() =>
  props.result.pilot === 'player' ? 'คุณบังคับเอง' : props.agentName
)

const stats = computed(() => [
  { label: 'ระยะทาง', value: `${meters.value.toLocaleString()} ม.` },
  { label: 'ระดับ', value: String(props.result.level) },
  { label: 'ผ่านสิ่งกีดขวาง', value: String(props.result.cleared) },
  {
    label: 'สถิติของลู่นี้',
    value: record.value ? `${meters.value.toLocaleString()} ม.` : `${bestMeters.value.toLocaleString()} ม.`
  }
])
</script>

<template>
  <div class="absolute inset-0 grid place-items-center rounded-card bg-ink/55 p-3 backdrop-blur-[3px]">
    <div
      class="flex w-full max-w-2xl flex-col gap-2.5 rounded-card border border-line bg-surface p-4 shadow-lift ring-4"
      :class="record ? 'ring-amber-200' : 'ring-rose-200'"
    >
      <div class="flex min-w-0 items-start gap-3">
        <svg viewBox="0 0 24 24" fill="none" class="size-9 shrink-0 text-rose-500" aria-hidden="true">
          <path d="M12 8v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
          <path
            d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>

        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            ชนซะแล้ว
            <span
              v-if="record"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
            >
              สถิติใหม่ของลู่นี้
            </span>
          </h2>
          <p class="mt-0.5 text-xs leading-relaxed text-ink-muted">{{ story }}</p>
          <p class="mt-0.5 truncate text-[11px] text-ink-subtle">รอบนี้: {{ pilotLabel }}</p>
        </div>
      </div>

      <dl class="flex shrink-0 gap-2">
        <div v-for="item in stats" :key="item.label" class="rounded-lg bg-surface-muted px-2.5 py-1.5 text-center">
          <dt class="text-[10px] text-ink-subtle">{{ item.label }}</dt>
          <dd class="font-mono text-sm font-semibold tabular-nums text-ink">{{ item.value }}</dd>
        </div>
      </dl>

      <div class="flex shrink-0 items-center gap-2">
        <UiButton size="sm" @click="$emit('again')">วิ่งอีกรอบ</UiButton>
        <UiButton size="sm" variant="outline" @click="$emit('close')">ดูลู่</UiButton>
      </div>
    </div>
  </div>
</template>
