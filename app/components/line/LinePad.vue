<script setup lang="ts">
import type { LineKeys } from '~/composables/useLineGame'

/** ปุ่มบังคับสำหรับจอสัมผัส — กดค้างเหมือนปุ่มลูกศร คีย์บอร์ดยังใช้ได้เหมือนเดิม */
const emit = defineEmits<{ press: [key: keyof LineKeys, on: boolean] }>()

const BUTTONS: Array<{ key: keyof LineKeys; label: string; path: string }> = [
  { key: 'left', label: 'เลี้ยวซ้าย', path: 'M15 6l-6 6 6 6' },
  { key: 'up', label: 'วิ่ง', path: 'M12 19V5M6 11l6-6 6 6' },
  { key: 'right', label: 'เลี้ยวขวา', path: 'M9 6l6 6-6 6' }
]
</script>

<template>
  <div class="flex items-center justify-center gap-3 lg:hidden" role="group" aria-label="ปุ่มบังคับหุ่น">
    <button
      v-for="button in BUTTONS"
      :key="button.key"
      type="button"
      class="flex h-14 flex-1 touch-none items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-sm font-medium text-ink-muted shadow-soft transition-colors active:bg-primary-100 active:text-primary-700"
      @pointerdown.prevent="emit('press', button.key, true)"
      @pointerup.prevent="emit('press', button.key, false)"
      @pointercancel.prevent="emit('press', button.key, false)"
      @pointerleave="emit('press', button.key, false)"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
        <path :d="button.path" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ button.label }}
    </button>
  </div>
</template>
