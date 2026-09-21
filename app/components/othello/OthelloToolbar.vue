<script setup lang="ts">
import { SPEEDS } from '~/game/othello/pace'
import type { GameStatus } from '~/composables/useOthelloGame'

defineProps<{ status: GameStatus; canUndo: boolean; starting: boolean; showSpeed: boolean }>()

const speed = defineModel<number>('speed', { required: true })

const emit = defineEmits<{ start: []; pause: []; resume: []; undo: []; reset: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-2.5 shadow-soft">
    <div class="flex items-center gap-2">
      <UiButton v-if="status === 'setup'" size="sm" :disabled="starting" @click="emit('start')">
        {{ starting ? 'กำลังโหลดโปรแกรม…' : 'เริ่มเกม' }}
      </UiButton>

      <UiButton v-else-if="status === 'playing'" size="sm" variant="secondary" @click="emit('pause')">
        พัก
      </UiButton>

      <UiButton v-else-if="status === 'paused'" size="sm" @click="emit('resume')">เล่นต่อ</UiButton>

      <UiButton v-else size="sm" :disabled="starting" @click="emit('start')">เริ่มเกมใหม่</UiButton>

      <button
        type="button"
        title="ย้อนหนึ่งตา"
        :disabled="!canUndo"
        class="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700 disabled:pointer-events-none disabled:opacity-40"
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4.5" aria-hidden="true">
          <path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 9h10a6 6 0 010 12h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <button
        type="button"
        title="ล้างกระดาน"
        class="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700"
        @click="emit('reset')"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4.5" aria-hidden="true">
          <path d="M20 11a8 8 0 10-2.3 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M20 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <div v-if="showSpeed" class="ml-auto flex items-center gap-1.5">
      <span class="hidden text-[11px] text-ink-subtle xl:inline">จังหวะบอท</span>
      <div class="flex rounded-full bg-surface-sunken p-0.5">
        <button
          v-for="option in SPEEDS"
          :key="option.value"
          type="button"
          class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          :class="speed === option.value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          @click="speed = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
