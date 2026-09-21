<script setup lang="ts">
import { SPEEDS } from '~/game/maze/pace'
import type { MazeStatus } from '~/composables/useMazeGame'

defineProps<{ status: MazeStatus; starting: boolean; solvable: boolean }>()

const speed = defineModel<number>('speed', { required: true })
const showOptimal = defineModel<boolean>('showOptimal', { required: true })

const emit = defineEmits<{ run: []; pause: []; resume: []; stop: []; reset: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-2.5 shadow-soft">
    <div class="flex items-center gap-2">
      <UiButton
        v-if="status === 'running'"
        size="sm"
        variant="secondary"
        @click="emit('pause')"
      >
        พัก
      </UiButton>

      <UiButton v-else-if="status === 'paused'" size="sm" @click="emit('resume')">เล่นต่อ</UiButton>

      <UiButton v-else size="sm" :disabled="starting || !solvable" @click="emit('run')">
        {{ starting ? 'กำลังโหลดโค้ด…' : status === 'idle' ? 'เริ่มหาทาง' : 'รันอีกครั้ง' }}
      </UiButton>

      <UiButton
        v-if="status === 'running' || status === 'paused'"
        size="sm"
        variant="outline"
        @click="emit('stop')"
      >
        หยุด
      </UiButton>

      <button
        type="button"
        title="ล้างผลการค้นหา"
        class="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700"
        @click="emit('reset')"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4.5" aria-hidden="true">
          <path d="M20 11a8 8 0 10-2.3 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M20 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
      :class="showOptimal ? 'bg-emerald-50 text-emerald-700' : 'text-ink-muted hover:text-primary-700'"
      @click="showOptimal = !showOptimal"
    >
      <span class="size-1.5 rounded-full" :class="showOptimal ? 'bg-emerald-500' : 'bg-line-strong'" />
      เฉลย
    </button>

    <div class="ml-auto flex items-center gap-1.5">
      <span class="hidden text-[11px] text-ink-subtle xl:inline">ความเร็ว</span>
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
