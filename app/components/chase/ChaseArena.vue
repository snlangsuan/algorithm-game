<script setup lang="ts">
import { WALL, exitOpen, type Match, type Point } from '~/game/chase/engine'
import {
  EXIT_OPEN_COLOR,
  EXIT_SHUT_COLOR,
  GEM_COLOR,
  HERO_COLOR,
  LOOK_HUNTER,
  LOOK_RUNNER,
  WALL_COLOR,
  hunterColor
} from '~/game/chase/palette'
import type { ChaseStatus } from '~/composables/useChaseGame'
import type { Reason } from '~/game/shared/reason'

/**
 * สนามไล่จับ — วาดด้วย SVG แล้วให้ CSS เลื่อนตัวละครระหว่างช่อง
 *
 * ทุกตัวขยับทีละช่องเป๊ะ ๆ ตามจังหวะเกม ส่วนที่ลื่นไหลคือการเลื่อนภาพเท่านั้น
 * ช่องสีจาง ๆ คือทางที่ AI แต่ละฝ่ายกำลังคิดถึง — ม่วงคือฝ่ายไล่ เขียวคือฝ่ายหนี
 */
const props = withDefaults(
  defineProps<{
    match: Match
    /** ช่องที่ AI ฝ่ายไล่เปิดดูตอนคิดจังหวะล่าสุด */
    hunterLooked: Point[]
    /** ช่องที่ AI ฝ่ายหนีเปิดดู — ว่างเปล่าเมื่อคนเล่นบังคับเอง */
    runnerLooked?: Point[]
    /** หนึ่งจังหวะกินเวลากี่มิลลิวินาที */
    duration: number
    status: ChaseStatus
    /** ปิดป้ายบอกสถานะ — ใช้ตอนเอาสนามไปวางเป็นภาพประกอบในหน้าความรู้ */
    quiet?: boolean
    /** ตัวเลือกที่ AI ชั่งก่อนเดินจังหวะล่าสุด — เขียนคะแนนลงบนช่อง */
    reasons?: Reason[]
  }>(),
  { runnerLooked: () => [], quiet: false, reasons: () => [] }
)

/** ตัวผี: หัวโค้ง ตัวตรง ชายกระโปรงหยัก */
const GHOST =
  'M -0.34 0.32 L -0.34 -0.04 A 0.34 0.34 0 0 1 0.34 -0.04 L 0.34 0.32 L 0.17 0.18 L 0 0.32 L -0.17 0.18 Z'

const arena = computed(() => props.match.arena)

const walls = computed(() => {
  const found: Point[] = []

  for (const [row, line] of arena.value.grid.entries()) {
    for (const [col, cell] of line.entries()) if (cell === WALL) found.push({ row, col })
  }

  return found
})

/** ช่องซ้ำ ๆ ที่ AI เปิดดู รวมเป็นช่องละก้อน จะได้ไม่วาดทับกันเป็นร้อยชั้น */
const unique = (cells: Point[]): Point[] => {
  const seen = new Set<string>()
  const list: Point[] = []

  for (const cell of cells) {
    const id = `${cell.row},${cell.col}`
    if (seen.has(id)) continue

    seen.add(id)
    list.push(cell)
  }

  return list
}

const hunterThinking = computed(() => unique(props.hunterLooked))
const runnerThinking = computed(() => unique(props.runnerLooked))

/** คะแนนบนช่อง — ใช้ตัวเลขตัวสุดท้ายของแต่ละตัวเลือก ซึ่งเป็นตัวที่ใช้ตัดสินจริง */
const scores = computed(() =>
  props.reasons.flatMap((reason, which) =>
    reason.options.flatMap((option) =>
      option.at
        ? [
            {
              key: `${which}-${option.at.row}-${option.at.col}`,
              at: option.at,
              value: option.values[option.values.length - 1] ?? 0,
              chosen: option.chosen === true
            }
          ]
        : []
    )
  )
)

const scoreText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

const open = computed(() => exitOpen(props.match))

const caught = computed(() => props.match.over === 'caught')

/** ช่องที่เกิดการจับ — วงแหวนแดงเต้นอยู่ตรงนั้นจนกว่าจะเริ่มรอบใหม่ */
const catchSpot = computed(() => props.match.caughtAt)

const eyes = (facing: string) => {
  const shift = { up: [0, -0.1], down: [0, 0.1], left: [-0.1, 0], right: [0.1, 0] }[facing] ?? [0, 0]
  return { dx: shift[0]!, dy: shift[1]! }
}

const at = (cell: Point) => `transform: translate(${cell.col + 0.5}px, ${cell.row + 0.5}px)`

/** ป้ายสั้น ๆ ระหว่างเล่น — ตอนจบรอบไม่ต้องมี เพราะมีแผ่นสรุปทับอยู่แล้ว */
const hint = computed(() => {
  if (props.quiet) return null
  if (props.status === 'idle') return 'กดปุ่มลูกศรเพื่อเริ่มวิ่ง'
  if (props.status === 'paused') return 'พักอยู่ — กดเว้นวรรคเพื่อเล่นต่อ'
  return null
})
</script>

<template>
  <!--
    สนามกว้างเท่าคอลัมน์ แต่ห้ามสูงเกินจอ ไม่งั้นต้องเลื่อนหาตัวเองตอนกำลังเล่น
    ทุกสนามเตี้ยกว่ากว้างอยู่แล้ว เพดานความสูงจึงแปลงกลับเป็นเพดานความกว้างได้ตรง ๆ
  -->
  <div
    class="relative mx-auto w-full"
    :style="{ maxWidth: `calc((100vh - 15rem) * ${arena.width / arena.height})` }"
  >
    <svg
      :viewBox="`0 0 ${arena.width} ${arena.height}`"
      class="block w-full rounded-xl bg-white shadow-lift ring-1 transition-shadow"
      :class="caught ? 'ring-4 ring-rose-400' : 'ring-line'"
      :style="{ '--step': `${duration}ms` }"
      role="img"
      :aria-label="`สนาม ${arena.name} — เก็บของแล้ว ${match.taken} จาก ${arena.gems.length} ชิ้น`"
    >
      <rect :width="arena.width" :height="arena.height" fill="#ffffff" />

      <g shape-rendering="crispEdges">
        <rect
          v-for="cell in hunterThinking"
          :key="`th${cell.row}-${cell.col}`"
          :x="cell.col"
          :y="cell.row"
          width="1"
          height="1"
          :fill="LOOK_HUNTER"
        />

        <rect
          v-for="cell in runnerThinking"
          :key="`tr${cell.row}-${cell.col}`"
          :x="cell.col"
          :y="cell.row"
          width="1"
          height="1"
          :fill="LOOK_RUNNER"
          opacity="0.75"
        />

        <rect
          v-for="cell in walls"
          :key="`w${cell.row}-${cell.col}`"
          :x="cell.col"
          :y="cell.row"
          width="1"
          height="1"
          :fill="WALL_COLOR"
        />
      </g>

      <!-- ประตูหนี เปิดเมื่อเก็บของครบ -->
      <g :style="at(arena.exit)">
        <rect
          x="-0.36"
          y="-0.36"
          width="0.72"
          height="0.72"
          rx="0.14"
          :fill="open ? EXIT_OPEN_COLOR : EXIT_SHUT_COLOR"
          :stroke="open ? '#047857' : '#c9c2e0'"
          stroke-width="0.06"
        />
        <path
          v-if="open"
          d="M -0.16 0.02 L -0.04 0.15 L 0.18 -0.13"
          fill="none"
          stroke="#ffffff"
          stroke-width="0.09"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>

      <!-- ของที่ต้องเก็บ -->
      <g v-for="gem in match.gems" :key="`g${gem.row}-${gem.col}`" :style="at(gem)">
        <rect
          x="-0.15"
          y="-0.15"
          width="0.3"
          height="0.3"
          rx="0.05"
          :fill="GEM_COLOR"
          transform="rotate(45)"
        />
      </g>

      <!-- คะแนนที่ AI ให้แต่ละทาง — ทางที่เลือกมีวงเขียวล้อม -->
      <g v-for="score in scores" :key="score.key" :style="at(score.at)" class="pointer-events-none">
        <rect
          x="-0.42"
          y="-0.42"
          width="0.84"
          height="0.84"
          rx="0.16"
          :fill="score.chosen ? '#d1fae5' : '#ffffff'"
          fill-opacity="0.85"
          :stroke="score.chosen ? '#059669' : '#c9c2e0'"
          :stroke-width="score.chosen ? 0.08 : 0.03"
        />
        <text
          y="0.11"
          text-anchor="middle"
          font-size="0.32"
          font-weight="700"
          :fill="score.chosen ? '#065f46' : '#5c5370'"
        >
          {{ scoreText(score.value) }}
        </text>
      </g>

      <!-- จุดที่โดนจับ — วงแหวนแดงเต้นค้างไว้ให้เห็นว่าเกิดตรงไหน -->
      <g v-if="caught && catchSpot" :style="at(catchSpot)">
        <circle class="catch-ring" r="0.46" fill="none" stroke="#e11d48" stroke-width="0.12" />
      </g>

      <!-- ผู้ไล่ล่า — ตัวที่จับได้จะมีขอบขาวหนาขึ้นมา -->
      <g
        v-for="hunter in match.hunters"
        :key="`h${hunter.index}`"
        class="token"
        :style="at(hunter.at)"
      >
        <path
          :d="GHOST"
          :fill="hunterColor(hunter.index)"
          :stroke="caught && match.caughtBy === hunter.index ? '#ffffff' : 'none'"
          stroke-width="0.08"
        />
        <circle :cx="eyes(hunter.facing).dx - 0.12" :cy="eyes(hunter.facing).dy - 0.08" r="0.08" fill="#ffffff" />
        <circle :cx="eyes(hunter.facing).dx + 0.12" :cy="eyes(hunter.facing).dy - 0.08" r="0.08" fill="#ffffff" />
        <text y="0.33" text-anchor="middle" font-size="0.22" fill="#ffffff" font-weight="700">
          {{ hunter.index + 1 }}
        </text>
      </g>

      <!-- คนหนี วาดทีหลังผู้ไล่ล่าเสมอ ตอนโดนจับจะได้ยังเห็นตัวอยู่บนสุด -->
      <g class="token" :style="at(match.hero)">
        <circle r="0.36" :fill="caught ? '#8b7aa3' : HERO_COLOR" :stroke="caught ? '#ffffff' : 'none'" stroke-width="0.07" />

        <template v-if="caught">
          <path
            d="M -0.17 -0.17 L -0.05 -0.05 M -0.05 -0.17 L -0.17 -0.05"
            stroke="#ffffff"
            stroke-width="0.055"
            stroke-linecap="round"
          />
          <path
            d="M 0.05 -0.17 L 0.17 -0.05 M 0.17 -0.17 L 0.05 -0.05"
            stroke="#ffffff"
            stroke-width="0.055"
            stroke-linecap="round"
          />
          <path
            d="M -0.13 0.17 Q 0 0.06 0.13 0.17"
            fill="none"
            stroke="#ffffff"
            stroke-width="0.055"
            stroke-linecap="round"
          />
        </template>

        <template v-else>
          <circle :cx="eyes(match.facing).dx - 0.11" :cy="eyes(match.facing).dy - 0.08" r="0.07" fill="#ffffff" />
          <circle :cx="eyes(match.facing).dx + 0.11" :cy="eyes(match.facing).dy - 0.08" r="0.07" fill="#ffffff" />
        </template>
      </g>
    </svg>

    <div
      v-if="hint"
      class="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center"
    >
      <span class="rounded-full bg-ink/80 px-4 py-1.5 text-sm font-semibold text-white shadow-lift">
        {{ hint }}
      </span>
    </div>

    <slot />
  </div>
</template>

<style scoped>
/* ตัวละครเลื่อนระหว่างช่องให้ลื่นตา ส่วนตำแหน่งจริงยังเป็นช่องเต็ม ๆ เสมอ */
.token {
  transition: transform var(--step, 200ms) linear;
}

/* ค่าเริ่มต้นของ SVG อ้างกรอบทั้งภาพ ถ้าไม่บอกว่าให้อ้างกรอบของตัวเอง วงแหวนจะไปเต้นกลางสนาม */
.catch-ring {
  animation: catch-pulse 1.1s ease-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes catch-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.55);
  }
  70% {
    opacity: 0;
    transform: scale(1.5);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .token {
    transition: none;
  }

  .catch-ring {
    animation: none;
    opacity: 0.9;
  }
}
</style>
