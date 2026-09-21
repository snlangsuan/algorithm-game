<script setup lang="ts">
import { SPEEDS } from '~/game/dino/pace'
import type { DinoStatus, Pilot } from '~/composables/useDinoGame'

defineProps<{ status: DinoStatus; starting: boolean; pilot: Pilot }>()

const speed = defineModel<number>('speed', { required: true })

const emit = defineEmits<{ start: []; pause: []; resume: []; stop: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-2.5 shadow-soft">
    <div class="flex items-center gap-2">
      <UiButton v-if="status === 'playing'" size="sm" variant="secondary" @click="emit('pause')">
        พัก
      </UiButton>

      <UiButton v-else-if="status === 'paused'" size="sm" @click="emit('resume')">วิ่งต่อ</UiButton>

      <UiButton v-else size="sm" :disabled="starting" @click="emit('start')">
        {{ starting ? 'กำลังโหลดโค้ด…' : status === 'idle' ? 'เริ่มวิ่ง' : 'วิ่งอีกครั้ง' }}
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
        pilot === 'player'
          ? 'เว้นวรรค = กระโดด · ลูกศรลงค้างไว้ = หมอบ'
          : 'บอทคิดเองทุกจังหวะ'
      }}
    </p>

    <UiInfo label="ในลู่นี้มีอะไรบ้าง" align="left">
      ของบนพื้น (ถัง ตอไม้ ก้อนหิน) ต้องกระโดดข้าม · นกบินเรี่ยพื้นต้องกระโดด บินสูงหมอบลอดได้ ฝูงสองตัวกระโดดไม่พ้น ต้องหมอบ ·
      เกมนี้ไม่มีเส้นชัย วิ่งไปเรื่อย ๆ จนกว่าจะชน ทุกระดับลู่เร็วขึ้นและของถี่ขึ้น ·
      กรอบประสีม่วงคือชิ้นที่โปรแกรมกำลังจ้องอยู่ตอนนั้น
    </UiInfo>

    <div class="ml-auto flex items-center gap-1.5">
      <span class="hidden text-[11px] text-ink-subtle xl:inline">ความเร็วภาพ</span>
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
