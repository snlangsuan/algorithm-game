<script setup lang="ts">
import { pegName, type Move } from '~/game/hanoi/engine'

const props = withDefaults(defineProps<{ moves: Move[]; limit?: number }>(), { limit: 24 })

const text = (move: Move) => `${pegName(move.from)}→${pegName(move.to)}`

const head = computed(() => props.moves.slice(0, props.limit).map(text))
const tail = computed(() =>
  props.moves.length > props.limit ? props.moves.slice(-4).map(text) : []
)
</script>

<template>
  <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
    <p class="text-[11px] font-semibold text-emerald-800">
      เฉลยของโจทย์นี้ — {{ moves.length.toLocaleString() }} ตา ซึ่งน้อยที่สุดเท่าที่เป็นไปได้
    </p>

    <div class="mt-1.5 flex flex-wrap items-center gap-1">
      <span
        v-for="(move, index) in head"
        :key="index"
        class="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-emerald-900 ring-1 ring-emerald-200"
      >
        {{ move }}
      </span>

      <template v-if="tail.length > 0">
        <span class="px-1 font-mono text-[10px] text-emerald-700">…</span>
        <span
          v-for="(move, index) in tail"
          :key="`tail-${index}`"
          class="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-emerald-900 ring-1 ring-emerald-200"
        >
          {{ move }}
        </span>
      </template>
    </div>
  </div>
</template>
