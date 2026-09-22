<script setup lang="ts">
import type { Course } from '~/game/line/engine'

/**
 * ของที่ตั้งก่อนเริ่มวิ่ง — เลือกสนาม (โปรแกรมที่ขับหุ่นเลือกได้ที่แผงด้านขวาอยู่แล้ว)
 * เปลี่ยนสนามตอนกำลังวิ่งไม่ได้ เพราะเปลี่ยนแล้วรอบที่ค้างอยู่ก็ใช้ไม่ได้แล้ว
 */
const props = defineProps<{
  course: Course
  /** สนามทั้งหมดที่เลือกได้ รวมสนามที่วาดเอง */
  courses: Course[]
  disabled?: boolean
}>()

const emit = defineEmits<{ course: [id: string]; draw: []; edit: [] }>()

const groupOf = (item: Course): string =>
  item.custom ? 'สนามของฉัน' : item.challenge ? 'โจทย์ยาก' : 'สนามพื้นฐาน'

const courseOptions = computed(() =>
  props.courses.map((item) => ({ value: item.id, label: item.name, group: groupOf(item) }))
)

const courseId = computed({
  get: () => props.course.id,
  set: (value: string) => emit('course', value)
})
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
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
</template>
