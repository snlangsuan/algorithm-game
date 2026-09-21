<script setup lang="ts">
import { SPEEDS } from '~/game/chase/pace'
import type { ChaseStatus, HeroControl } from '~/composables/useChaseGame'

defineProps<{ status: ChaseStatus; starting: boolean; control: HeroControl }>()

const speed = defineModel<number>('speed', { required: true })

const emit = defineEmits<{ start: []; pause: []; resume: []; stop: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-2.5 shadow-soft">
    <div class="flex items-center gap-2">
      <UiButton v-if="status === 'playing'" size="sm" variant="secondary" @click="emit('pause')">
        พัก
      </UiButton>

      <UiButton v-else-if="status === 'paused'" size="sm" @click="emit('resume')">เล่นต่อ</UiButton>

      <UiButton v-else size="sm" :disabled="starting" @click="emit('start')">
        {{ starting ? 'กำลังโหลดโค้ด…' : status === 'idle' ? 'เริ่มเล่น' : 'เล่นอีกครั้ง' }}
      </UiButton>

      <UiButton
        v-if="status === 'playing' || status === 'paused'"
        size="sm"
        variant="outline"
        @click="emit('stop')"
      >
        หยุด
      </UiButton>
    </div>

    <p class="hidden text-[11px] leading-tight text-ink-subtle sm:block">
      {{
        control === 'player'
          ? 'บังคับด้วยปุ่มลูกศรหรือ W A S D · เว้นวรรคเพื่อพัก'
          : 'AI ทั้งสองฝ่ายเดินเอง · เว้นวรรคเพื่อพัก'
      }}
    </p>

    <UiInfo label="ในสนามมีอะไรบ้าง" align="left">
      เพชรคือของที่ต้องเก็บให้ครบ ประตูถึงจะเปิด · ช่องสีม่วงจางคือทางที่ AI ฝ่ายไล่กำลังคิด
      ช่องสีเขียวจางคือทางที่ AI ฝ่ายหนีกำลังคิด · ผู้ไล่ล่าทุกตัวใช้บล็อกชุดเดียวกัน
      แยกกันด้วยหมายเลขตัว
    </UiInfo>

    <div class="ml-auto flex items-center gap-1.5">
      <span class="hidden text-[11px] text-ink-subtle xl:inline">ความเร็วเกม</span>
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
