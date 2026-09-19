<script setup lang="ts">
import type { TabItem } from '~/components/ui/UiTabs.vue'

/**
 * แผงควบคุมด้านขวา — ทุกเกมเรียงเหมือนกันหมด
 *
 *   1. การ์ดสรุปผล
 *   2. เนื้อหาตั้งค่าเกม (เลือกอัลกอริทึมอยู่ในนี้ด้วย)
 *
 * เกมที่ยังต้องแบ่งหลายหน้าส่ง tabs เข้ามาได้ ถ้าไม่ส่งก็โชว์ slot เดียวรวด
 */
defineProps<{ tabs?: TabItem[] }>()

const tab = defineModel<string>('tab', { required: false, default: '' })
</script>

<template>
  <div>
    <slot name="summary" />

    <div v-if="tabs?.length" class="mt-3">
      <UiTabs v-model="tab" :tabs="tabs" />
    </div>

    <div class="mt-3 space-y-2.5 lg:max-h-[calc(100vh-24rem)] lg:overflow-y-auto">
      <slot v-if="tabs?.length" :name="tab" />
      <slot v-else />
    </div>
  </div>
</template>
