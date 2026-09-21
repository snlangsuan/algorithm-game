<script setup lang="ts">
import { PEG_LABEL, type Hanoi, type Move, type Towers } from '~/game/hanoi/engine'

const props = withDefaults(
  defineProps<{
    puzzle: Hanoi
    towers: Towers

    last?: Move | null

    duration?: number
  }>(),
  { last: null, duration: 150 }
)

const VIEW = { width: 360, height: 196 }
const BASE_Y = 152
const ROD_TOP = 16
const DISK_HEIGHT = 12
const DISK_MIN = 34
const DISK_MAX = 104

const PEG_X = [60, 180, 300]

const DISK_COLORS = [
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#7c3aed'
]

interface Piece {
  size: number
  x: number
  y: number
  width: number
  color: string
  moved: boolean
}

const pieces = computed<Piece[]>(() => {
  const total = props.puzzle.disks
  const span = Math.max(1, total - 1)
  const list: Piece[] = []

  for (const [peg, tower] of props.towers.entries()) {
    for (const [floor, size] of tower.entries()) {
      const width = DISK_MIN + ((DISK_MAX - DISK_MIN) * (size - 1)) / span

      list.push({
        size,
        width,
        x: (PEG_X[peg] ?? 0) - width / 2,
        y: BASE_Y - (floor + 1) * DISK_HEIGHT,
        color: DISK_COLORS[Math.min(DISK_COLORS.length - 1, size - 1)] ?? '#7c3aed',
        moved: props.last?.to === peg && floor === tower.length - 1
      })
    }
  }

  return list.sort((a, b) => a.size - b.size)
})

const roleOf = (peg: number): string => {
  if (peg === props.puzzle.source) return 'เริ่มต้น'
  if (peg === props.puzzle.target) return 'เป้าหมาย'
  return 'พัก'
}

const style = computed(() => ({ transition: `transform ${props.duration}ms ease-out` }))
</script>

<template>
  <div class="rounded-xl bg-white p-3 shadow-lift ring-1 ring-line">
    <svg :viewBox="`0 0 ${VIEW.width} ${VIEW.height}`" class="block w-full" role="img"
      :aria-label="`หอคอยฮานอย ${puzzle.disks} ใบ`">
      <g>
        <rect
          v-for="(x, peg) in PEG_X"
          :key="`rod-${peg}`"
          :x="x - 3"
          :y="ROD_TOP"
          width="6"
          :height="BASE_Y - ROD_TOP"
          rx="3"
          :fill="peg === puzzle.target ? '#c4b5fd' : '#e5e1f3'"
        />
        <rect :x="10" :y="BASE_Y" :width="VIEW.width - 20" height="8" rx="4" fill="#332450" />
      </g>

      <g
        v-for="piece in pieces"
        :key="piece.size"
        :transform="`translate(${piece.x}, ${piece.y})`"
        :style="style"
      >
        <rect
          :width="piece.width"
          :height="DISK_HEIGHT - 2"
          rx="5"
          :fill="piece.color"
          :stroke="piece.moved ? '#ffffff' : 'rgba(28, 21, 36, 0.12)'"
          :stroke-width="piece.moved ? 2 : 1"
        />
        <text
          v-if="piece.width >= 44"
          :x="piece.width / 2"
          :y="DISK_HEIGHT / 2 + 1.5"
          text-anchor="middle"
          font-size="7"
          fill="#ffffff"
          font-weight="600"
        >
          {{ piece.size }}
        </text>
      </g>

      <g v-for="(x, peg) in PEG_X" :key="`label-${peg}`">
        <text :x="x" :y="BASE_Y + 26" text-anchor="middle" font-size="12" font-weight="600" fill="#1c1524">
          {{ PEG_LABEL[peg] }}
        </text>
        <text :x="x" :y="BASE_Y + 38" text-anchor="middle" font-size="9" fill="#6b6480">
          {{ roleOf(peg) }}
        </text>
      </g>
    </svg>
  </div>
</template>
