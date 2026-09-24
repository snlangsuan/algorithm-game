<script setup lang="ts">
import type { Figure } from '~/data/algorithm-figures'

const props = defineProps<{ figure: Figure }>()

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

      <div v-else-if="figure.kind === 'chase'" class="mx-auto w-full max-w-[34rem]">
        <ChaseArena
          quiet
          :match="figure.match"
          :hunter-looked="figure.looked"
          :runner-looked="figure.runnerLooked ?? []"
          :duration="0"
          status="idle"
        />
      </div>

      <div v-else-if="figure.kind === 'runner'" class="mx-auto w-full max-w-[40rem]">
        <DinoTrack quiet :run="figure.run" status="paused" :watched="figure.watched" />
      </div>

      <div v-else-if="figure.kind === 'line'" class="mx-auto w-full max-w-[40rem]">
        <LineField quiet :run="figure.run" status="over" :watched="figure.watched" />
      </div>

      <div v-else-if="figure.kind === 'go'" class="mx-auto w-full max-w-[24rem]">
        <GoBoard
          :position="figure.position"
          :last-move="figure.last"
          disabled
          :show-coords="false"
        />
      </div>

      <div v-else-if="figure.kind === 'othello'" class="mx-auto w-full max-w-[22rem]">
        <OthelloBoard :board="figure.board" :valid-moves="figure.moves" :last-move="figure.last" />
      </div>

      <div v-else class="mx-auto w-full max-w-[30rem]">
        <HanoiBoard
          :puzzle="figure.puzzle"
          :towers="figure.towers"
          :last="figure.last"
          :duration="0"
        />
      </div>
    </div>

    <figcaption class="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
      {{ figure.caption }}
    </figcaption>
  </figure>
</template>
