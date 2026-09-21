<script setup lang="ts">
import { LEVEL_SPAN, metersOf, speedOf, toNextLevel, type Run } from '~/game/dino/engine'
import type { DinoResult, DinoStatus } from '~/composables/useDinoGame'

const props = defineProps<{
  run: Run
  status: DinoStatus
  result: DinoResult | null
  /** เวลาที่โปรแกรมใช้คิดสะสมในรอบนี้ */
  ms: number
  pilot: string
  /** สถิติของลู่นี้ในเซสชันนี้ (เมตร) */
  best: number
}>()

const DASH = '–'

const meters = computed(() => metersOf(props.run.distance))

/** วิ่งไปได้กี่ % ของระดับปัจจุบัน — เกมนี้ไม่มีเส้นชัย จึงวัดความคืบหน้าเป็นระดับแทน */
const percent = computed(() =>
  Math.round(((LEVEL_SPAN - toNextLevel(props.run.distance)) / LEVEL_SPAN) * 100)
)

const speed = computed(() => Math.round(speedOf(props.run)))

const label = computed(() => {
  if (props.status === 'playing') return { text: 'กำลังวิ่ง', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'paused') return { text: 'พักอยู่', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'error') return { text: 'โปรแกรมมีปัญหา', tone: 'bg-amber-50 text-amber-800' }

  if (props.result) return { text: 'ชนแล้ว', tone: 'bg-rose-50 text-rose-700' }

  return { text: 'ยังไม่เริ่ม', tone: 'bg-surface-sunken text-ink-muted' }
})

/** สรุปให้อ่านแล้วรู้ว่าจะไปแก้อะไรต่อ */
const verdict = computed(() => {
  const result = props.result
  if (!result) return null

  const where = `ไปได้ ${metersOf(result.distance).toLocaleString()} เมตร ถึงระดับ ${result.level} ตอนความเร็ว ${result.topSpeed} px/วิ`

  if (result.pilot === 'player') return `${where} — ${result.hit ?? ''}`

  return `${where} — ${result.hit ?? ''} ระยะที่เผื่อไว้ในกฎยังคงที่อยู่หรือเปล่า ถ้าใช่ พอลู่เร็วขึ้นมันก็สายเองทุกครั้ง`
})
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        รอบนี้เป็นยังไง
        <UiInfo label="กติกาของเกมนี้" align="left">
          วิ่งไปเรื่อย ๆ จนกว่าจะชน — ทุก ๆ 120 เมตรจะขึ้นระดับหนึ่งขั้น ลู่เร็วขึ้นและของถี่ขึ้น
          คะแนนคือระยะที่ไปได้ไกลที่สุด
        </UiInfo>
      </p>
      <span class="rounded-full px-2 py-0.5 text-[10px] font-medium" :class="label.tone">
        {{ label.text }}
      </span>
    </div>

    <div class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">วิ่งมาแล้ว · ระดับ {{ run.level }}</span>
        <span class="font-mono tabular-nums text-ink">
          {{ meters.toLocaleString() }} ม.
          <span v-if="best > 0" class="text-ink-subtle">· สถิติ {{ best.toLocaleString() }}</span>
        </span>
      </div>

      <div class="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          class="h-full rounded-full transition-[width] duration-150"
          :class="result ? 'bg-rose-400' : 'bg-emerald-500'"
          :style="{ width: `${percent}%` }"
        />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          ความเร็วตอนนี้
          <UiInfo label="ความเร็วนี้คืออะไร">
ลู่วิ่งเร็วกี่พิกเซลต่อวินาที — ยิ่งเลขนี้สูง ระยะที่ต้องเผื่อก่อนกระโดดก็ยิ่งไกล
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ speed }}<span class="text-xs"> px/วิ</span>
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">ผ่านมาแล้ว</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ run.cleared }}<span class="text-xs"> ชิ้น</span>
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">กระโดด / หมอบ</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          {{ run.jumps }} / {{ run.ducks }}
        </p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          {{ pilot === 'agent' ? 'เวลาที่บอทใช้คิด' : 'เวลาที่วิ่งมา' }}
          <UiInfo v-if="pilot === 'agent'" label="เวลาคิดนี้นับยังไง">
            โค้ดของบอทรันคนละเธรดกับหน้าจอ คิดนานแค่ไหนภาพก็ไม่สะดุด
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">
          <template v-if="pilot === 'agent'">
            {{ (result ? result.ms : ms).toLocaleString()
            }}<span class="text-xs"> ms</span>
          </template>
          <template v-else>
            {{ run.time > 0 ? run.time.toFixed(1) : DASH }}<span v-if="run.time > 0" class="text-xs"> วิ</span>
          </template>
        </p>
      </div>
    </div>

    <p
      v-if="run.ignored > 0"
      class="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800"
    >
      สั่งท่าตอนที่ยังลอยอยู่ไป {{ run.ignored.toLocaleString() }} ครั้ง —
      คำสั่งพวกนั้นตกหายไปเฉย ๆ ไม่ได้ต่อคิวไว้ให้
    </p>

    <p v-if="verdict" class="mt-2 rounded-lg bg-primary-50 px-2.5 py-2 text-[11px] leading-relaxed text-primary-800">
      {{ verdict }}
    </p>
  </div>
</template>
