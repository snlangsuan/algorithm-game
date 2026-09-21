<script setup lang="ts">
import type { ChaseResult } from '~/composables/useChaseGame'
import { hunterColor } from '~/game/chase/palette'

/**
 * แผ่นสรุปตอนจบรอบ — ทับสนามไว้จนกว่าจะสั่งเอง
 *
 * จงใจให้เกมค้างตรงนี้ ไม่วิ่งต่อทันที เพราะจังหวะที่โดนจับคือจังหวะที่ต้องดูให้ทัน
 * ว่าใครเป็นคนจับ และตอนนั้นเราเหลือของอีกกี่ชิ้น
 */
const props = defineProps<{
  result: ChaseResult
  /** ชื่อโปรแกรมของแต่ละฝ่าย ใช้บอกว่ารอบนี้ใครเป็นคนคิด */
  hunterName: string
  runnerName: string
}>()

defineEmits<{ again: []; close: [] }>()

const caught = computed(() => props.result.outcome === 'caught')

const tone = computed(() => {
  if (props.result.outcome === 'escaped') {
    return {
      ring: 'ring-emerald-200',
      badge: 'bg-emerald-50 text-emerald-700',
      title: 'หนีออกมาได้',
      lead: 'จบรอบ'
    }
  }

  if (caught.value) {
    return {
      ring: 'ring-rose-200',
      badge: 'bg-rose-50 text-rose-700',
      title: 'คนหนีถูกจับแล้ว',
      lead: 'จบรอบ'
    }
  }

  return {
    ring: 'ring-amber-200',
    badge: 'bg-amber-50 text-amber-800',
    title: 'หมดเวลา',
    lead: 'จบรอบ'
  }
})

const catcherColor = computed(() =>
  props.result.caughtBy === null ? '#7c3aed' : hunterColor(props.result.caughtBy)
)

const story = computed(() => {
  const { outcome, ticks, taken, total, caughtBy, closest } = props.result

  if (outcome === 'caught') {
    return `ผู้ไล่ล่าตัวที่ ${(caughtBy ?? 0) + 1} จับได้ตอนจังหวะที่ ${ticks.toLocaleString()} — ตอนนั้นเก็บของไปแล้ว ${taken} จาก ${total} ชิ้น`
  }

  if (outcome === 'escaped') {
    return `เก็บของครบ ${total} ชิ้นแล้วออกประตูได้ใน ${ticks.toLocaleString()} จังหวะ — ตอนที่เฉียดที่สุด ผู้ไล่ล่าห่างแค่ ${closest} ช่อง`
  }

  return `ครบ ${ticks.toLocaleString()} จังหวะแล้วยังไม่จบ — เก็บของไป ${taken} จาก ${total} ชิ้น และยังไม่ถูกจับ`
})

const controlLabel = computed(() =>
  props.result.control === 'player' ? 'คุณบังคับเอง' : props.runnerName
)
</script>

<template>
  <div class="absolute inset-0 grid place-items-center rounded-xl bg-ink/55 p-4 backdrop-blur-[3px]">
    <div class="w-full max-w-sm rounded-card border border-line bg-surface p-5 text-center shadow-lift ring-4" :class="tone.ring">
      <p class="text-[11px] font-medium uppercase tracking-widest text-ink-subtle">{{ tone.lead }}</p>

      <!-- ตัวที่จับได้ โผล่มาเต็มตัวตรงนี้ จะได้รู้ทันทีว่าโดนใคร -->
      <div class="mt-3 grid place-items-center">
        <svg v-if="caught" viewBox="-0.6 -0.6 1.2 1.2" class="size-16" aria-hidden="true">
          <path
            d="M -0.34 0.32 L -0.34 -0.04 A 0.34 0.34 0 0 1 0.34 -0.04 L 0.34 0.32 L 0.17 0.18 L 0 0.32 L -0.17 0.18 Z"
            :fill="catcherColor"
          />
          <circle cx="-0.12" cy="-0.08" r="0.08" fill="#ffffff" />
          <circle cx="0.12" cy="-0.08" r="0.08" fill="#ffffff" />
        </svg>

        <svg v-else-if="result.outcome === 'escaped'" viewBox="0 0 24 24" fill="none" class="size-14 text-emerald-600" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="2" />
          <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>

        <svg v-else viewBox="0 0 24 24" fill="none" class="size-14 text-amber-500" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>

      <h2 class="mt-3 text-2xl font-semibold tracking-tight text-ink">{{ tone.title }}</h2>

      <p class="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-ink-muted">{{ story }}</p>

      <dl class="mt-4 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-surface-muted px-2 py-2">
          <dt class="text-[10px] text-ink-subtle">จังหวะ</dt>
          <dd class="font-mono text-base font-semibold tabular-nums text-ink">{{ result.ticks.toLocaleString() }}</dd>
        </div>
        <div class="rounded-lg bg-surface-muted px-2 py-2">
          <dt class="text-[10px] text-ink-subtle">เก็บของ</dt>
          <dd class="font-mono text-base font-semibold tabular-nums text-ink">{{ result.taken }}/{{ result.total }}</dd>
        </div>
        <div class="rounded-lg bg-surface-muted px-2 py-2">
          <dt class="text-[10px] text-ink-subtle">เฉียดที่สุด</dt>
          <dd class="font-mono text-base font-semibold tabular-nums text-ink">{{ result.closest }}</dd>
        </div>
      </dl>

      <p class="mt-3 text-[11px] leading-relaxed text-ink-subtle">
        ฝ่ายไล่: <span class="text-ink">{{ hunterName }}</span>
        <span class="mx-1.5">·</span>
        ฝ่ายหนี: <span class="text-ink">{{ controlLabel }}</span>
      </p>

      <div class="mt-5 flex items-center gap-2">
        <UiButton block @click="$emit('again')">เล่นอีกรอบ</UiButton>
        <UiButton variant="outline" @click="$emit('close')">ดูสนาม</UiButton>
      </div>

      <p class="mt-2 text-[10px] text-ink-subtle">กดเว้นวรรคก็เริ่มรอบใหม่ได้</p>
    </div>
  </div>
</template>
