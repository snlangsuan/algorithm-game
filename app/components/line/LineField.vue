<script setup lang="ts">
import {
  LINE_WIDTH,
  SENSOR_AHEAD,
  VIEW,
  lapPercent,
  paintRuns,
  secondsOf,
  type Run
} from '~/game/line/engine'
import type { LineStatus } from '~/composables/useLineGame'

/**
 * สนามมองจากด้านบน — เส้นดำ รอยที่หุ่นวิ่งผ่านมา และตัวหุ่น วาดใน SVG ที่ใช้พิกัดเดียวกับกติกา
 * รอยสีม่วงคือหัวใจของภาพนี้ เพราะมันบอกว่าวิธีเลี้ยวแบบไหนส่ายแค่ไหน ซึ่งดูจากตัวหุ่นอย่างเดียวไม่ออก
 */
const props = withDefaults(
  defineProps<{
    run: Run
    status: LineStatus
    /** เซนเซอร์ที่โปรแกรมเปิดดูล่าสุด */
    watched?: number[]
    /** เวลาที่ดีที่สุดของสนามนี้ (วินาที) — null คือยังไม่มี */
    best?: number | null
    /** ปิดป้ายบอกสถานะ — ใช้ตอนเอาสนามไปวางเป็นภาพประกอบในหน้าความรู้ */
    quiet?: boolean
  }>(),
  { watched: () => [], best: null, quiet: false }
)

const floorId = useId()

/** สีจริงของเส้นแต่ละแบบ — เส้นขาดวาดเป็นจุดจาง ๆ ให้คนเห็นว่าทางไปต่อทางไหน ทั้งที่เซนเซอร์มองไม่เห็น */
const STROKE = { black: '#1c1524', red: '#e11d48', gap: '#cbc3b3' } as const

const trackRuns = computed(() =>
  paintRuns(props.run.track).map((run, index) => ({
    key: index,
    paint: run.paint,
    d: `M ${run.points.map((at) => `${at.x.toFixed(1)} ${at.y.toFixed(1)}`).join(' L ')}`
  }))
)

const trailPoints = computed(() =>
  [...props.run.trail, { x: props.run.x, y: props.run.y }]
    .map((at) => `${at.x.toFixed(1)},${at.y.toFixed(1)}`)
    .join(' ')
)

/** เส้นเริ่ม/เส้นชัย — ขวางเส้นดำตรงจุดออกตัว */
const startLine = computed(() => {
  const track = props.run.track
  const from = track.points[0]!
  const to = track.points[track.along.findIndex((along) => along >= SENSOR_AHEAD)]!
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return { x: from.x, y: from.y, angle }
})

const over = computed(() => props.run.over)

const hint = computed(() => {
  if (props.quiet) return null
  if (props.status === 'idle') return 'กดเว้นวรรคเพื่อเริ่มวิ่ง'
  if (props.status === 'paused') return 'พักอยู่ — กดเว้นวรรคเพื่อวิ่งต่อ'
  return null
})

const percent = computed(() => Math.floor(lapPercent(props.run)))
</script>

<template>
  <div
    class="relative isolate w-full overflow-hidden rounded-card bg-[#f7f5f0] shadow-lift ring-1 transition-shadow"
    :class="
      over === 'finished' ? 'ring-4 ring-emerald-400' : over ? 'ring-4 ring-rose-400' : 'ring-line'
    "
    :style="{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }"
  >
    <svg
      class="absolute inset-0 h-full w-full"
      :viewBox="`0 0 ${VIEW.width} ${VIEW.height}`"
      role="img"
      :aria-label="`${run.course.name} — วิ่งไปแล้ว ${percent} เปอร์เซ็นต์ของรอบ ใน ${secondsOf(run.time)} วินาที`"
    >
      <defs>
        <pattern :id="floorId" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e7e2d8" stroke-width="1" />
        </pattern>
      </defs>

      <rect :width="VIEW.width" :height="VIEW.height" :fill="`url(#${floorId})`" />

      <path
        v-for="piece in trackRuns"
        :key="piece.key"
        :d="piece.d"
        fill="none"
        :stroke="STROKE[piece.paint]"
        :stroke-width="piece.paint === 'gap' ? 3 : LINE_WIDTH"
        :stroke-dasharray="piece.paint === 'gap' ? '2 7' : undefined"
        :stroke-linecap="piece.paint === 'gap' ? 'round' : 'butt'"
        :stroke-linejoin="run.course.smooth ? 'round' : 'miter'"
      />

      <!-- เส้นเริ่ม ลายตาหมากรุก -->
      <g :transform="`translate(${startLine.x} ${startLine.y}) rotate(${startLine.angle})`">
        <rect x="-3" y="-22" width="6" height="44" fill="#ffffff" stroke="#1c1524" stroke-width="1" />
        <rect v-for="row in 4" :key="row" x="-3" :y="-22 + (row - 1) * 11" width="6" height="5.5" fill="#1c1524" />
      </g>

      <polyline
        :points="trailPoints"
        fill="none"
        stroke="#8b5cf6"
        stroke-opacity="0.6"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <LineRobot
        :x="run.x"
        :y="run.y"
        :heading="run.heading"
        :sensors="run.sensors"
        :watched="watched"
        :stopped="over === 'lost' || over === 'timeout'"
      />
    </svg>

    <!-- เวลามุมซ้ายบน — คะแนนของเกมนี้ ยิ่งน้อยยิ่งดี -->
    <div
      class="pointer-events-none absolute left-3 top-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-soft"
    >
      <span class="font-mono text-base font-bold tabular-nums text-ink sm:text-lg">{{ secondsOf(run.time) }}</span>
      <span class="ml-0.5 text-[10px]">วิ</span>
      <span class="mx-1.5 text-ink-subtle">·</span>
      <span class="font-mono font-bold tabular-nums text-primary-700">{{ percent }}%</span>
      <span class="text-[10px]"> ของรอบ</span>
    </div>

    <div
      v-if="best !== null && !quiet"
      class="pointer-events-none absolute right-3 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-ink-muted shadow-soft"
    >
      ดีที่สุด <span class="font-mono font-bold tabular-nums text-emerald-700">{{ secondsOf(best) }}</span> วิ
    </div>

    <div v-if="hint" class="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
      <span class="rounded-full bg-ink/85 px-4 py-2 text-center text-sm font-semibold text-white shadow-lift">
        {{ hint }}
      </span>
    </div>

    <slot />
  </div>
</template>
