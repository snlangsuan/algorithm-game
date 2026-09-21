<script setup lang="ts">
import { averageOffset, lapPercent, secondsOf, speedOf, type Run } from '~/game/line/engine'
import type { LinePilot, LineResult, LineStatus } from '~/composables/useLineGame'

const props = defineProps<{
  run: Run
  status: LineStatus
  result: LineResult | null
  /** เวลาที่โปรแกรมใช้คิดสะสมในรอบนี้ */
  ms: number
  pilot: LinePilot
  /** เวลาที่ดีที่สุดของสนามนี้ในเซสชันนี้ */
  best: number | null
}>()

const DASH = '–'

const percent = computed(() => Math.floor(lapPercent(props.run)))

const speed = computed(() => Math.round(speedOf(props.run)))

const offset = computed(() => averageOffset(props.run))

const label = computed(() => {
  if (props.status === 'playing') return { text: 'กำลังวิ่ง', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'paused') return { text: 'พักอยู่', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'error') return { text: 'โปรแกรมมีปัญหา', tone: 'bg-amber-50 text-amber-800' }

  const outcome = props.result?.outcome
  if (outcome === 'finished') return { text: 'ครบรอบ', tone: 'bg-emerald-50 text-emerald-700' }
  if (outcome === 'lost') return { text: 'หลุดเส้น', tone: 'bg-rose-50 text-rose-700' }
  if (outcome === 'timeout') return { text: 'หมดเวลา', tone: 'bg-rose-50 text-rose-700' }

  return { text: 'ยังไม่เริ่ม', tone: 'bg-surface-sunken text-ink-muted' }
})
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        รอบนี้เป็นยังไง
        <UiInfo label="วัดผลยังไง" align="left">
          คะแนนคือเวลาที่ใช้ครบหนึ่งรอบ ยิ่งน้อยยิ่งดี · "ห่างเส้นเฉลี่ย" บอกว่าส่ายแค่ไหน
          หุ่นที่เกาะเส้นแนบมักเร่งกำลังได้มากกว่า
        </UiInfo>
      </p>
      <span class="rounded-full px-2 py-0.5 text-[10px] font-medium" :class="label.tone">
        {{ label.text }}
      </span>
    </div>

    <div class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">วิ่งไปแล้ว</span>
        <span class="font-mono tabular-nums text-ink">
          {{ percent }}%
          <span v-if="best !== null" class="text-ink-subtle">· ดีที่สุด {{ secondsOf(best) }} วิ</span>
        </span>
      </div>

      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          class="h-full rounded-full transition-[width] duration-150"
          :class="result && result.outcome !== 'finished' ? 'bg-rose-400' : 'bg-emerald-500'"
          :style="{ width: `${percent}%` }"
        />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">เวลา</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ secondsOf(run.time) }}<span class="text-xs"> วิ</span>
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">ความเร็วตอนนี้</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ speed }}<span class="text-xs"> px/วิ</span>
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          ห่างเส้นเฉลี่ย
          <UiInfo label="ตัวเลขนี้คืออะไร">
            กึ่งกลางตัวหุ่นห่างจากกึ่งกลางเส้นดำเฉลี่ยกี่พิกเซลตลอดรอบ — เส้นกว้าง 12 พิกเซล
            ถ้าเลขนี้เกิน 6 แปลว่าตัวหุ่นส่ายออกนอกเส้นบ่อย
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ run.samples > 0 ? offset.toFixed(1) : DASH }}<span v-if="run.samples > 0" class="text-xs"> px</span>
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          {{ pilot === 'agent' ? 'เวลาที่บอทใช้คิด' : 'ห่างเส้นมากสุด' }}
          <UiInfo v-if="pilot === 'agent'" label="เวลาคิดนี้นับยังไง">
            โค้ดของบอทรันคนละเธรดกับหน้าจอ คิดนานแค่ไหนภาพก็ไม่สะดุด
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          <template v-if="pilot === 'agent'">
            {{ (result ? result.ms : ms).toLocaleString() }}<span class="text-xs"> ms</span>
          </template>
          <template v-else>
            {{ run.samples > 0 ? run.offsetMax.toFixed(0) : DASH }}<span v-if="run.samples > 0" class="text-xs"> px</span>
          </template>
        </p>
      </div>
    </div>

    <p
      v-if="result"
      class="mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed"
      :class="result.outcome === 'finished' ? 'bg-emerald-50 text-emerald-800' : 'bg-primary-50 text-primary-800'"
    >
      {{ result.advice }}
    </p>
  </div>
</template>
