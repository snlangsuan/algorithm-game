<script setup lang="ts">
import type { Direction } from '~/game/chase/engine'

/** ปุ่มทิศสำหรับจอสัมผัส — คีย์บอร์ดยังใช้ได้เหมือนเดิม */
const emit = defineEmits<{ turn: [dir: Direction] }>()

const BUTTONS: Array<{ dir: Direction; label: string; area: string; path: string }> = [
  { dir: 'up', label: 'ขึ้น', area: 'col-start-2 row-start-1', path: 'M12 5v14M6 11l6-6 6 6' },
  { dir: 'left', label: 'ซ้าย', area: 'col-start-1 row-start-2', path: 'M19 12H5M11 6l-6 6 6 6' },
  { dir: 'down', label: 'ลง', area: 'col-start-2 row-start-3', path: 'M12 5v14M6 13l6 6 6-6' },
  { dir: 'right', label: 'ขวา', area: 'col-start-3 row-start-2', path: 'M5 12h14M13 6l6 6-6 6' }
]
</script>

<template>
  <div class="grid grid-cols-3 grid-rows-3 gap-1.5 lg:hidden" role="group" aria-label="ปุ่มบังคับตัวเอก">
    <button
      v-for="button in BUTTONS"
      :key="button.dir"
      type="button"
      :class="[
        button.area,
        'grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface text-ink-muted shadow-soft transition-colors active:bg-primary-100 active:text-primary-700'
      ]"
      :aria-label="button.label"
      @pointerdown.prevent="emit('turn', button.dir)"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
        <path :d="button.path" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>
