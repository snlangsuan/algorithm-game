<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { countProgram } from '~/game/blocks/program'

/**
 * เลือกอัลกอริทึมที่จะให้บอทใช้ — อยู่ในแท็บตั้งค่าของแต่ละเกม
 * เลือกที่นี่ ส่วนการแก้บล็อกอยู่ที่ตัวโปรแกรมเอง (ปุ่ม "แก้บล็อก")
 */
const props = defineProps<{
  pack: BlockPack
  program: BlockProgram
  presetId: string
  /** ยังเป็นตัวอย่างสำเร็จรูปอยู่ (ยังไม่ได้คัดลอกไปแก้) */
  locked?: boolean
  disabled?: boolean
  /** ซ่อนชื่อหัวข้อ เวลาเอาไปวางในการ์ดที่มีหัวอยู่แล้ว */
  bare?: boolean
}>()

const emit = defineEmits<{ preset: [id: string] }>()

/** คัดลอกแล้วจะไม่ตรงกับตัวอย่างไหน ต้องมีตัวเลือกของโปรแกรมตัวเองไว้ให้ค่าไม่ค้าง */
const MINE = '__mine__'

const options = computed(() => {
  const presets = props.pack.presets.map((preset) => ({ value: preset.id, label: preset.name }))
  return props.presetId ? presets : [{ value: MINE, label: props.program.name }, ...presets]
})

const selected = computed({
  get: () => props.presetId || MINE,
  set: (value: string) => {
    if (value !== MINE) emit('preset', value)
  }
})

const description = computed(
  () => props.pack.presets.find((preset) => preset.id === props.presetId)?.description ?? ''
)

const total = computed(() => countProgram(props.program))
</script>

<template>
  <div :class="bare ? 'space-y-2' : 'space-y-2 rounded-xl bg-surface-muted p-3'">
    <UiSelect
      v-model="selected"
      :label="bare ? undefined : 'อัลกอริทึมที่ใช้'"
      :options="options"
      :disabled="disabled"
    />

    <p v-if="description" class="text-[11px] leading-relaxed text-ink-subtle">{{ description }}</p>

    <p class="text-[11px] text-ink-subtle">
      {{ total }} บล็อก ·
      <template v-if="locked">ตัวอย่างสำเร็จรูป — คัดลอกก่อนถึงแก้ได้</template>
      <template v-else>โปรแกรมของคุณ แก้ได้เลย</template>
    </p>
  </div>
</template>
