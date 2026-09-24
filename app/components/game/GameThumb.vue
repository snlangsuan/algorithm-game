<script setup lang="ts">
import {
  buildGoPreview,
  buildChasePreview,
  buildDinoPreview,
  buildHanoiPreview,
  buildLinePreview,
  buildMazePreview,
  buildOthelloPreview
} from '~/data/game-previews'
import { WALL as CHASE_WALL } from '~/game/chase/engine'
import { LINE_WIDTH, VIEW as LINE_VIEW } from '~/game/line/engine'
import { MUD, WALL } from '~/game/maze/engine'
import { WHITE } from '~/game/othello/engine'

import type { GameThumbKind } from '~/data/games'

const props = defineProps<{ kind: GameThumbKind }>()

const maze = computed(() => (props.kind === 'maze' ? buildMazePreview() : null))
const othello = computed(() => (props.kind === 'othello' ? buildOthelloPreview() : null))
const hanoi = computed(() => (props.kind === 'hanoi' ? buildHanoiPreview() : null))
const chase = computed(() => (props.kind === 'chase' ? buildChasePreview() : null))
const dino = computed(() => (props.kind === 'dino' ? buildDinoPreview() : null))
const line = computed(() => (props.kind === 'line' ? buildLinePreview() : null))
const go = computed(() => (props.kind === 'go' ? buildGoPreview() : null))

/** ช่องของกระดานโกะที่มีหมากอยู่ — หมากวางบนจุดตัดเส้น ไม่ใช่ในช่อง */
const goStones = computed(() => {
  const preview = go.value
  if (!preview) return []
  const out: Array<{ row: number; col: number; color: number }> = []
  for (const [index, cell] of preview.board.entries()) {
    if (cell !== 0) out.push({ row: Math.floor(index / preview.size), col: index % preview.size, color: cell })
  }
  return out
})

const toPoints = (list: Array<{ x: number; y: number }>) =>
  list.map((at) => `${at.x.toFixed(0)},${at.y.toFixed(0)}`).join(' ')

const linePath = computed(() => (line.value ? toPoints(line.value.track) : ''))
const lineTrail = computed(() => (line.value ? toPoints(line.value.trail) : ''))

/** ภาพย่อเกมวิ่ง — กรอบแคบกว่าในเกมจริง เอาเฉพาะช่วงรอบตัวละครที่กำลังลอยข้ามของ */
const DINO_VIEW = 150
const DINO_X = 40
const DINO_GROUND = 76

const dinoScene = computed(() => {
  const preview = dino.value
  if (!preview) return []

  return preview.obstacles
    .map((item) => ({ item, at: DINO_X + item.x - preview.distance }))
    .filter((row) => row.at + row.item.box.width >= 0 && row.at <= DINO_VIEW)
})

const HUNTER_COLORS = ['#ef4444', '#0ea5e9']

/** กำแพงของสนามไล่จับ — วาดทีละช่องเหมือนเขาวงกต */
const chaseWalls = computed(() => {
  const found: Array<{ row: number; col: number }> = []
  const grid = chase.value?.arena.grid ?? []

  for (const [row, line] of grid.entries()) {
    for (const [col, cell] of line.entries()) if (cell === CHASE_WALL) found.push({ row, col })
  }

  return found
})

const chasePath = computed(() =>
  (chase.value?.path ?? []).map((at) => `${at.col + 0.5},${at.row + 0.5}`).join(' ')
)

const DISK_COLORS = ['#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b']

const disks = computed(() => {
  const preview = hanoi.value
  if (!preview) return []

  const total = preview.puzzle.disks
  const pieces: Array<{ x: number; y: number; width: number; color: string; moved: boolean }> = []

  for (const [peg, tower] of preview.towers.entries()) {
    for (const [floor, size] of tower.entries()) {
      const width = 0.5 + (1.5 * (size - 1)) / Math.max(1, total - 1)

      pieces.push({
        width,
        x: peg * 2 + 1 - width / 2,
        y: 3.1 - (floor + 1) * 0.42,
        color: DISK_COLORS[Math.min(DISK_COLORS.length - 1, size - 1)] ?? '#7c3aed',
        moved: preview.last?.to === peg && floor === tower.length - 1
      })
    }
  }

  return pieces
})

const pathPoints = computed(() =>
  (maze.value?.path ?? []).map((at) => `${at.col + 0.5},${at.row + 0.5}`).join(' ')
)

const cellsOf = (test: (cell: number) => boolean) => {
  const found: Array<{ row: number; col: number }> = []
  const grid = maze.value?.maze.grid ?? []
  for (const [row, line] of grid.entries()) {
    for (const [col, cell] of line.entries()) if (test(cell)) found.push({ row, col })
  }
  return found
}

const walls = computed(() => cellsOf((cell) => cell === WALL))
const mud = computed(() => cellsOf((cell) => cell === MUD))
</script>

<template>
  <div
    class="grid place-items-center overflow-hidden rounded-xl border border-line bg-surface-muted p-2"
    aria-hidden="true"
  >
    <svg
      v-if="maze"
      :viewBox="`0 0 ${maze.maze.width} ${maze.maze.height}`"
      class="h-full w-full"
      role="presentation"
    >
      <rect :width="maze.maze.width" :height="maze.maze.height" fill="#ffffff" />

      <g shape-rendering="crispEdges">
        <rect v-for="at in mud" :key="`m${at.row}-${at.col}`" :x="at.col" :y="at.row" width="1" height="1" fill="#f6e3b4" />
        <rect v-for="at in walls" :key="`w${at.row}-${at.col}`" :x="at.col" :y="at.row" width="1" height="1" fill="#332450" />
      </g>

      <polyline
        :points="pathPoints"
        fill="none"
        stroke="#7c3aed"
        stroke-width="0.34"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <circle :cx="maze.maze.start.col + 0.5" :cy="maze.maze.start.row + 0.5" r="0.34" fill="#10b981" />
      <circle :cx="maze.maze.goal.col + 0.5" :cy="maze.maze.goal.row + 0.5" r="0.34" fill="#f59e0b" />
    </svg>

    <svg
      v-else-if="chase"
      :viewBox="`0 0 ${chase.arena.width} ${chase.arena.height}`"
      class="h-full w-full"
      role="presentation"
    >
      <rect :width="chase.arena.width" :height="chase.arena.height" fill="#ffffff" />

      <g shape-rendering="crispEdges">
        <rect
          v-for="at in chaseWalls"
          :key="`cw${at.row}-${at.col}`"
          :x="at.col"
          :y="at.row"
          width="1"
          height="1"
          fill="#332450"
        />
      </g>

      <!-- ทางที่ผู้ไล่ล่ากำลังเดินตาม -->
      <polyline
        :points="chasePath"
        fill="none"
        stroke="#ef4444"
        stroke-width="0.26"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="0.5 0.45"
        opacity="0.9"
      />

      <rect
        :x="chase.arena.exit.col + 0.22"
        :y="chase.arena.exit.row + 0.22"
        width="0.56"
        height="0.56"
        rx="0.12"
        fill="#e5e1f3"
      />

      <g v-for="gem in chase.gems" :key="`cg${gem.row}-${gem.col}`">
        <rect
          :x="gem.col + 0.35"
          :y="gem.row + 0.35"
          width="0.3"
          height="0.3"
          rx="0.05"
          fill="#f59e0b"
          :transform="`rotate(45 ${gem.col + 0.5} ${gem.row + 0.5})`"
        />
      </g>

      <circle :cx="chase.hero.col + 0.5" :cy="chase.hero.row + 0.5" r="0.36" fill="#1c1524" />

      <circle
        v-for="(hunter, index) in chase.hunters"
        :key="`ch${index}`"
        :cx="hunter.col + 0.5"
        :cy="hunter.row + 0.5"
        r="0.36"
        :fill="HUNTER_COLORS[index % HUNTER_COLORS.length]"
      />
    </svg>

    <svg v-else-if="dino" :viewBox="`0 0 ${DINO_VIEW} 96`" class="h-full w-full" role="presentation">
      <rect :width="DINO_VIEW" height="96" fill="#cfeae0" />
      <rect y="76" :width="DINO_VIEW" height="20" fill="#3f6b4a" />

      <DinoObstacle
        v-for="row in dinoScene"
        :key="row.item.id"
        :obstacle="row.item"
        :x="row.at"
        :ground-y="DINO_GROUND"
      />

      <DinoCharacter :x="DINO_X" :ground-y="DINO_GROUND" :lift="dino.height" airborne />
    </svg>

    <svg
      v-else-if="line"
      :viewBox="`0 0 ${LINE_VIEW.width} ${LINE_VIEW.height}`"
      class="h-full w-full"
      role="presentation"
    >
      <rect :width="LINE_VIEW.width" :height="LINE_VIEW.height" fill="#f7f5f0" />
      <polygon :points="linePath" fill="none" stroke="#1c1524" :stroke-width="LINE_WIDTH * 1.6" stroke-linejoin="round" />
      <polyline
        :points="lineTrail"
        fill="none"
        stroke="#8b5cf6"
        stroke-opacity="0.75"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <LineRobot :x="line.run.x" :y="line.run.y" :heading="line.run.heading" :sensors="line.run.sensors" />
    </svg>

    <svg v-else-if="hanoi" viewBox="0 0 6 3.6" class="h-full w-full" role="presentation">
      <rect width="6" height="3.6" fill="#ffffff" />

      <g>
        <rect
          v-for="peg in 3"
          :key="`rod${peg}`"
          :x="(peg - 1) * 2 + 0.96"
          y="0.5"
          width="0.08"
          height="2.6"
          rx="0.04"
          :fill="peg - 1 === hanoi.puzzle.target ? '#c4b5fd' : '#e5e1f3'"
        />
        <rect x="0.2" y="3.1" width="5.6" height="0.14" rx="0.07" fill="#332450" />
      </g>

      <g v-for="(disk, index) in disks" :key="`disk${index}`">
        <rect
          :x="disk.x"
          :y="disk.y"
          :width="disk.width"
          height="0.34"
          rx="0.12"
          :fill="disk.color"
          :stroke="disk.moved ? '#ffffff' : 'none'"
          stroke-width="0.06"
        />
      </g>
    </svg>

    <svg v-else-if="go" viewBox="-1 -1 10 10" class="h-full w-full" role="presentation">
      <rect x="-1" y="-1" width="10" height="10" rx="0.6" fill="#e9c98d" />

      <g stroke="#8a6a3a" stroke-width="0.06">
        <line v-for="n in go.size" :key="`gr${n}`" :x1="0" :y1="n - 1" :x2="go.size - 1" :y2="n - 1" />
        <line v-for="n in go.size" :key="`gc${n}`" :x1="n - 1" :y1="0" :x2="n - 1" :y2="go.size - 1" />
      </g>

      <!-- ดาว (โฮชิ) ของกระดาน 9×9 -->
      <circle v-for="spot in [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]]" :key="`h${spot[0]}-${spot[1]}`" :cx="spot[1]" :cy="spot[0]" r="0.14" fill="#8a6a3a" />

      <circle
        v-for="stone in goStones"
        :key="`s${stone.row}-${stone.col}`"
        :cx="stone.col"
        :cy="stone.row"
        r="0.42"
        :fill="stone.color === 1 ? '#241a2f' : '#f7f5fb'"
        :stroke="stone.color === 1 ? 'none' : '#c9c2e0'"
        stroke-width="0.05"
      />

      <circle
        v-if="go.last"
        :cx="go.last.col"
        :cy="go.last.row"
        r="0.16"
        :fill="goStones.find((stone) => stone.row === go!.last!.row && stone.col === go!.last!.col)?.color === 1 ? '#f7f5fb' : '#241a2f'"
      />
    </svg>

    <svg v-else-if="othello" viewBox="-0.2 -0.2 8.4 8.4" class="h-full w-full" role="presentation">
      <rect x="-0.2" y="-0.2" width="8.4" height="8.4" rx="0.5" fill="#6d28d9" />

      <template v-for="(line, row) in othello.board" :key="row">
        <g v-for="(cell, col) in line" :key="`${row}-${col}`">
          <rect :x="col + 0.06" :y="row + 0.06" width="0.88" height="0.88" rx="0.14" fill="#7c3aed" />

          <circle
            v-if="cell !== 0"
            :cx="col + 0.5"
            :cy="row + 0.5"
            r="0.36"
            :fill="cell === WHITE ? '#f4f1fc' : '#241a2f'"
          />

          <circle
            v-else-if="othello.moves.some((move) => move.row === row && move.col === col)"
            :cx="col + 0.5"
            :cy="row + 0.5"
            r="0.11"
            fill="#ffffff"
            fill-opacity="0.35"
          />

          <rect
            v-if="othello.last && othello.last.row === row && othello.last.col === col"
            :x="col + 0.06"
            :y="row + 0.06"
            width="0.88"
            height="0.88"
            rx="0.14"
            fill="none"
            stroke="#fcd34d"
            stroke-width="0.09"
          />
        </g>
      </template>
    </svg>
  </div>
</template>
