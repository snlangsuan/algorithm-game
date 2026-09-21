<script setup lang="ts">
import { COURSES, type Course } from '~/game/dino/engine'
import type { Pilot } from '~/composables/useDinoGame'

/**
 * ของที่ตั้งก่อนเริ่มวิ่ง — เลือกลู่ไว้ซ้าย เลือกว่าใครบังคับไว้ขวา
 * สองอย่างนี้เปลี่ยนตอนกำลังวิ่งไม่ได้ เพราะเปลี่ยนแล้วรอบที่ค้างอยู่ก็ใช้ไม่ได้แล้ว
 */
const props = defineProps<{
  course: Course
  pilot: Pilot
  /** ชื่อโปรแกรมที่ต่อไว้ — บอกไว้ว่ากดให้บอทเล่นแล้วจะได้ตัวไหน */
  agentName: string
  disabled?: boolean
}>()

const emit = defineEmits<{ course: [id: string]; pilot: [value: Pilot] }>()

const courseOptions = COURSES.map((item) => ({ value: item.id, label: item.name }))

const courseId = computed({
  get: () => props.course.id,
  set: (value: string) => emit('course', value)
})

const PILOTS: Array<{ value: Pilot; label: string }> = [
  { value: 'player', label: 'เล่นเอง' },
  { value: 'agent', label: 'ให้บอทเล่น' }
]
</script>

<template>
  <div class="grid gap-x-5 gap-y-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2">
    <div>
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        เลือกลู่
        <UiInfo label="ลู่นี้เป็นยังไง" align="left">{{ course.note }}</UiInfo>
      </p>

      <UiSelect v-model="courseId" class="mt-2" :options="courseOptions" :disabled="disabled" />

      <p class="mt-2 text-[11px] leading-relaxed text-ink-subtle">
        ไม่มีเส้นชัย วิ่งจนกว่าจะชน · ออกตัวที่
        <span class="font-mono tabular-nums text-ink">{{ course.startSpeed }}</span> px/วิ
        แล้วเร็วขึ้น {{ course.speedStep }} ทุก ๆ {{ course.speedEvery }} พิกเซล ไม่มีเพดาน
      </p>
    </div>

    <div>
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        ใครบังคับไดโน
        <UiInfo label="สองโหมดนี้ต่างกันยังไง" align="left">
          เล่นเองคือกดปุ่มเอง บล็อกที่ต่อไว้จะพักอยู่เฉย ๆ ·
          ให้บอทเล่นคือโปรแกรมที่ต่อไว้ตัดสินใจทุกจังหวะแทนเรา · แก้บล็อกเมื่อไรระบบจะสลับไปโหมดบอทให้เอง
        </UiInfo>
      </p>

      <div class="mt-2 flex rounded-full bg-surface p-0.5">
        <button
          v-for="item in PILOTS"
          :key="item.value"
          type="button"
          class="flex-1 rounded-full py-1.5 text-[11px] font-medium transition-colors"
          :class="pilot === item.value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          :disabled="disabled"
          @click="emit('pilot', item.value)"
        >
          {{ item.label }}
        </button>
      </div>

      <p class="mt-2 truncate text-[11px] text-ink-subtle">
        โปรแกรมที่ต่อไว้: <span class="text-ink">{{ agentName }}</span>
      </p>
    </div>
  </div>
</template>
