<script setup lang="ts">
import type { ChaseResult, ChaseStatus } from '~/composables/useChaseGame'
import type { Match } from '~/game/chase/engine'

const props = defineProps<{
  match: Match
  status: ChaseStatus
  result: ChaseResult | null
  tickLimit: number
  /** เวลาที่ AI ใช้คิดสะสมในรอบนี้ — ระหว่างเล่นยังไม่มี result ให้อ่าน */
  ms: number
}>()

const DASH = '–'

const total = computed(() => props.match.arena.gems.length)

const taken = computed(() => props.match.taken)

const percent = computed(() => (total.value === 0 ? 0 : Math.round((taken.value / total.value) * 100)))

const closest = computed(() =>
  Number.isFinite(props.match.closest) ? props.match.closest : null
)

const label = computed(() => {
  if (props.status === 'playing') return { text: 'กำลังวิ่ง', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'paused') return { text: 'พักอยู่', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'error') return { text: 'โปรแกรมมีปัญหา', tone: 'bg-amber-50 text-amber-800' }

  if (props.result?.outcome === 'escaped') return { text: 'หนีรอด', tone: 'bg-emerald-50 text-emerald-700' }
  if (props.result?.outcome === 'caught') return { text: 'โดนจับ', tone: 'bg-rose-50 text-rose-700' }
  if (props.result?.outcome === 'timeout') return { text: 'หมดเวลา', tone: 'bg-amber-50 text-amber-800' }

  return { text: 'ยังไม่เริ่ม', tone: 'bg-surface-sunken text-ink-muted' }
})

/** สรุปผลให้อ่านแล้วรู้ว่าจะไปแก้ฝ่ายไหนต่อ — คำแนะนำต่างกันเมื่อคนหนีเป็น AI */
const verdict = computed(() => {
  const result = props.result
  if (!result) return null

  const byAgent = result.control === 'agent'

  if (result.outcome === 'escaped') {
    if (result.closest <= 2) return 'รอดแบบเฉียดฉิว — ผู้ไล่ล่าเกือบได้ตัวแล้ว เพิ่มอีกตัวหรือเร่งความเร็วดูไหม'

    return byAgent
      ? 'AI ฝ่ายหนีชนะขาด — ลองไปแก้ฝ่ายไล่ให้แบ่งหน้าที่กันดักหน้าดู'
      : 'หนีออกมาได้สบาย ๆ — AI ฝ่ายไล่ยังกดดันไม่พอ ลองให้แบ่งหน้าที่กันดักหน้า'
  }

  if (result.outcome === 'caught') {
    return byAgent
      ? `AI ฝ่ายไล่จับ AI ฝ่ายหนีได้ตั้งแต่จังหวะที่ ${result.ticks.toLocaleString()} — ลองไปแก้ฝ่ายหนีให้รู้จักหลบมากขึ้น`
      : `โดนจับตั้งแต่จังหวะที่ ${result.ticks.toLocaleString()} — AI ฝ่ายไล่ชุดนี้ใช้ได้ ลองสลับให้ AI ฝ่ายหนีลงไปเจอเองบ้าง`
  }

  return byAgent
    ? 'ครบเวลาแล้วยังไม่จบ — ฝ่ายหนีเอาตัวรอดได้แต่เก็บของไม่ครบ ลองปรับให้มันกล้าเข้าไปเก็บมากขึ้น'
    : 'ครบเวลาแล้วยังไม่จบ — ของยังเก็บไม่หมด และ AI ก็ยังจับไม่ได้'
})
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        รอบนี้เป็นยังไง
        <UiInfo label="กติกาของเกมนี้" align="left">
          เก็บของให้ครบแล้ววิ่งออกประตู โดยไม่ให้ AI ที่เราเขียนเองจับได้
        </UiInfo>
      </p>
      <span class="rounded-full px-2 py-0.5 text-[10px] font-medium" :class="label.tone">
        {{ label.text }}
      </span>
    </div>

    <div class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">เก็บของแล้ว</span>
        <span class="font-mono tabular-nums text-ink">{{ taken }} / {{ total }}</span>
      </div>

      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          class="h-full rounded-full bg-amber-500 transition-[width] duration-150"
          :style="{ width: `${percent}%` }"
        />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          ผ่านไปกี่จังหวะ
          <UiInfo label="จังหวะคืออะไร">
            ครบ {{ tickLimit.toLocaleString() }} จังหวะแล้วหมดเวลา ถือว่าไม่มีใครชนะ
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ match.tick > 0 ? match.tick.toLocaleString() : DASH }}
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          เฉียดที่สุด
          <UiInfo label="ตัวเลขเฉียดที่สุดคืออะไร">
            ผู้ไล่ล่าเข้ามาใกล้ที่สุดกี่ช่องตลอดรอบ — ยิ่งน้อยยิ่งหวุดหวิด
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ closest === null ? DASH : closest.toLocaleString() }}<span v-if="closest !== null" class="text-xs"> ช่อง</span>
        </p>
      </div>

      <div class="col-span-2 rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          เวลาที่ AI ใช้คิดทั้งรอบ
          <UiInfo label="เวลาคิดนี้นับยังไง">
            โค้ดของ AI รันคนละเธรดกับหน้าจอ คิดนานแค่ไหนภาพก็ไม่สะดุด
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ (result ? result.ms : ms).toLocaleString() }}<span class="text-xs"> ms</span>
        </p>
      </div>
    </div>

    <p
      v-if="verdict"
      class="mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed"
      :class="result?.outcome === 'escaped' ? 'bg-emerald-50 text-emerald-800' : 'bg-primary-50 text-primary-800'"
    >
      {{ verdict }}
    </p>

  </div>
</template>
