<script setup lang="ts">
import { BOARD_SIZE, findMove, type Board, type Move } from '~/game/othello/engine'

const props = withDefaults(
  defineProps<{
    board: Board
    validMoves: Move[]
    lastMove: { row: number; col: number } | null
    interactive?: boolean
  }>(),
  { interactive: false }
)

const emit = defineEmits<{ play: [row: number, col: number] }>()

const columns = Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(97 + index))
const rows = Array.from({ length: BOARD_SIZE }, (_, index) => index + 1)

const isPlayable = (row: number, col: number) =>
  props.interactive && Boolean(findMove(props.validMoves, row, col))

const isHinted = (row: number, col: number) => Boolean(findMove(props.validMoves, row, col))

const isLast = (row: number, col: number) =>
  props.lastMove?.row === row && props.lastMove?.col === col

const onCell = (row: number, col: number) => {
  if (!isPlayable(row, col)) return
  emit('play', row, col)
}
</script>

<template>
  <div class="w-full max-w-[min(78vh,560px)] select-none">
    <div class="grid grid-cols-[1.25rem_1fr] gap-1">
      <div />
      <div class="grid grid-cols-8 px-1">
        <span v-for="column in columns" :key="column" class="text-center text-[11px] font-medium text-ink-subtle">
          {{ column }}
        </span>
      </div>

      <div class="grid grid-rows-8 py-1">
        <span v-for="row in rows" :key="row" class="flex items-center justify-center text-[11px] font-medium text-ink-subtle">
          {{ row }}
        </span>
      </div>

      <div class="grid aspect-square grid-cols-8 gap-1 rounded-2xl bg-primary-700 p-1 shadow-lift">
        <template v-for="(line, rowIndex) in board" :key="rowIndex">
          <button
            v-for="(cell, colIndex) in line"
            :key="`${rowIndex}-${colIndex}`"
            type="button"
            :disabled="!isPlayable(rowIndex, colIndex)"
            :aria-label="`ช่อง ${columns[colIndex]}${rowIndex + 1}`"
            class="group relative grid place-items-center rounded-md bg-primary-600/90 transition-colors duration-150"
            :class="[
              isPlayable(rowIndex, colIndex) ? 'cursor-pointer hover:bg-primary-500' : 'cursor-default',
              isLast(rowIndex, colIndex) ? 'ring-2 ring-inset ring-amber-300' : ''
            ]"
            @click="onCell(rowIndex, colIndex)"
          >
            <OthelloDisc v-if="cell !== 0" :player="cell" />

            <span
              v-else-if="isHinted(rowIndex, colIndex)"
              class="size-[26%] rounded-full transition-all duration-150"
              :class="interactive ? 'bg-white/60 group-hover:size-[40%]' : 'bg-white/25'"
            />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
