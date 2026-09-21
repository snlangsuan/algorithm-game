<script setup lang="ts">
import type { EditTool } from '~/composables/useMazeGame'

defineProps<{ disabled?: boolean }>()

const tool = defineModel<EditTool>('tool', { required: true })

const tools: Array<{ value: EditTool; label: string }> = [
  { value: 'none', label: 'ปิด' },
  { value: 'wall', label: 'กำแพง' },
  { value: 'mud', label: 'โคลน' },
  { value: 'floor', label: 'ลบ' },
  { value: 'start', label: 'จุดเริ่ม' },
  { value: 'goal', label: 'ทางออก' }
]
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
      วาดแผนที่เอง
      <UiInfo label="ใช้เครื่องมือวาดยังไง" align="left">
        เลือกเครื่องมือแล้วคลิกหรือลากบนแผนที่ได้เลย
      </UiInfo>
    </p>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="item in tools"
        :key="item.value"
        type="button"
        :disabled="disabled"
        class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
        :class="
          tool === item.value
            ? 'bg-primary-600 text-white shadow-soft'
            : 'bg-surface text-ink-muted ring-1 ring-line hover:text-primary-700'
        "
        @click="tool = item.value"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
