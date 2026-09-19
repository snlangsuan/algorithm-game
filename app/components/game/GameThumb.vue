<script setup lang="ts">
import { buildMazePreview, buildOthelloPreview } from '~/data/game-previews'
import { MUD, WALL } from '~/game/maze/engine'
import { WHITE } from '~/game/othello/engine'

/**
 * ภาพย่อของเกมในรายการ "เลือกเกม" — วาดเป็น SVG จากข้อมูลที่เอนจินจริงคำนวณให้
 * ไม่ใช้ MazeGrid/OthelloBoard ตรง ๆ เพราะสองตัวนั้นทำมาเพื่อกระดานขนาดเล่นจริง
 * (แคนวาสที่วัดความกว้างเอง, ปุ่ม 64 ปุ่ม, ตัวอักษรพิกัด) ย่อลงมาเหลือไม่กี่ร้อยพิกเซลแล้วอ่านไม่ออก
 *
 * สีทุกตัวยกมาจากกระดานจริง ภาพย่อกับของจริงจะได้เป็นภาพเดียวกันในสายตา
 */
const props = defineProps<{ kind: 'maze' | 'othello' }>()

const maze = computed(() => (props.kind === 'maze' ? buildMazePreview() : null))
const othello = computed(() => (props.kind === 'othello' ? buildOthelloPreview() : null))

/** เส้นทางเป็นจุดกึ่งกลางช่อง ต่อเป็น polyline เส้นเดียว */
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
    <!-- เขาวงกต: กำแพง โคลน แล้วทับด้วยเฉลยของแผนที่ -->
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

    <!-- Othello: กระดานกลางเกม พร้อมจุดบอกใบ้ตาที่ลงได้ของฝ่ายที่ถึงคิว -->
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
