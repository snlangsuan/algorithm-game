<script setup lang="ts">
import type { Figure } from '~/data/algorithm-figures'

const props = defineProps<{ figure: Figure }>()

/** วาดเส้นทางเต็มเส้นทันที ไม่ต้องเล่นอนิเมชัน — นี่เป็นภาพนิ่ง ไม่ใช่การรัน */
const walkShown = computed(() =>
  props.figure.kind === 'maze' ? Math.max(props.figure.path.length - 1, 0) : 0
)
</script>

<template>
  <figure>
    <div class="rounded-2xl border border-line bg-surface-muted p-3 sm:p-5">
      <MazeGrid
        v-if="figure.kind === 'maze'"
        :maze="figure.maze"
        :explored="figure.explored"
        :explored-shown="figure.explored.length"
        :path="figure.path"
        :walk-shown="walkShown"
        :optimal="figure.optimal"
        :show-optimal="figure.optimal.length > 1"
        optimal-on-top
        :max-height="340"
      />

      <div v-else class="mx-auto w-full max-w-[22rem]">
        <OthelloBoard :board="figure.board" :valid-moves="figure.moves" :last-move="figure.last" />
      </div>
    </div>

    <figcaption class="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
      {{ figure.caption }}
    </figcaption>
  </figure>
</template>
