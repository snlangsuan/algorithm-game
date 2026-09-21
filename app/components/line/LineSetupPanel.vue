<script setup lang="ts">
import type { Course } from '~/game/line/engine'
import type { LinePilot } from '~/composables/useLineGame'

/**
 * ของที่ตั้งก่อนเริ่มวิ่ง — เลือกสนามไว้ซ้าย เลือกว่าใครบังคับไว้ขวา
 * สองอย่างนี้เปลี่ยนตอนกำลังวิ่งไม่ได้ เพราะเปลี่ยนแล้วรอบที่ค้างอยู่ก็ใช้ไม่ได้แล้ว
 */
const props = defineProps<{
  course: Course
  /** สนามทั้งหมดที่เลือกได้ รวมสนามที่วาดเอง */
  courses: Course[]
  pilot: LinePilot
  /** ชื่อโปรแกรมที่ต่อไว้ — บอกไว้ว่ากดให้บอทวิ่งแล้วจะได้ตัวไหน */
  agentName: string
  disabled?: boolean
}>()

const emit = defineEmits<{ course: [id: string]; pilot: [value: LinePilot]; draw: []; edit: [] }>()

const groupOf = (item: Course): string =>
  item.custom ? 'สนามของฉัน' : item.challenge ? 'โจทย์ยาก' : 'สนามพื้นฐาน'

const courseOptions = computed(() =>
  props.courses.map((item) => ({ value: item.id, label: item.name, group: groupOf(item) }))
)

const courseId = computed({
  get: () => props.course.id,
  set: (value: string) => emit('course', value)
})

const PILOTS: Array<{ value: LinePilot; label: string }> = [
  { value: 'agent', label: 'ให้บอทวิ่ง' },
  { value: 'player', label: 'ขับเอง' }
]
</script>

<template>
  <div class="grid gap-x-5 gap-y-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2">
    <div>
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        เลือกสนาม
        <UiInfo label="สนามนี้เป็นยังไง" align="left">{{ course.note }}</UiInfo>
      </p>

      <UiSelect v-model="courseId" class="mt-2" :options="courseOptions" :disabled="disabled" />

      <p class="mt-2 text-[11px] leading-relaxed text-ink-subtle">{{ course.note }}</p>

      <div class="mt-2 flex flex-wrap gap-2">
        <UiButton size="sm" variant="outline" :disabled="disabled" @click="emit('draw')">วาดสนามเอง</UiButton>
        <UiButton v-if="course.custom" size="sm" variant="outline" :disabled="disabled" @click="emit('edit')">
          แก้สนามนี้
        </UiButton>
      </div>
    </div>

    <div>
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        ใครบังคับหุ่น
        <UiInfo label="สองโหมดนี้ต่างกันยังไง" align="left">
          ให้บอทวิ่งคือโปรแกรมที่ต่อไว้อ่านเซนเซอร์แล้วสั่งมอเตอร์เองทุกจังหวะ ·
          ขับเองคือกดปุ่มลูกศรค้างไว้ บล็อกที่ต่อไว้จะพักอยู่เฉย ๆ — ลองขับเองดูแล้วจะรู้ว่าเกาะเส้นให้เร็วนั้นยากแค่ไหน
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
