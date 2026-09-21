<script setup lang="ts">
import { SPEEDS } from '~/game/line/pace'
import type { LinePilot, LineStatus } from '~/composables/useLineGame'

defineProps<{ status: LineStatus; starting: boolean; pilot: LinePilot }>()

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
          ? 'ลูกศรขึ้น = วิ่ง · ซ้าย/ขวา = เลี้ยว (กดค้าง)'
          : 'บอทคิดเอง 30 ครั้งต่อวินาที'
      }}
    </p>

    <UiInfo label="กติกาของสนามนี้" align="left">
      วิ่งให้ครบหนึ่งรอบเร็วที่สุด โดยตัวหุ่นห่างจากเส้นไม่เกิน 60 พิกเซล — เกินนั้นถือว่าหลุดเส้น ·
      เกิน 90 วินาทีก็หมดเวลา · รอยสีม่วงคือทางที่หุ่นวิ่งจริง ยิ่งส่ายยิ่งช้า ·
      ความเร็วภาพเปลี่ยนแค่ความเร็วที่ดู เวลาต่อรอบเท่าเดิมเสมอ
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
