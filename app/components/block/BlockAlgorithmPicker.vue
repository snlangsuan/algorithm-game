<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { countProgram } from '~/game/blocks/program'
import { UNSAVED_CHOICE, useProgramChoices } from '~/composables/useProgramLibrary'

const props = defineProps<{
  pack: BlockPack
  program: BlockProgram
  presetId: string

  locked?: boolean
  disabled?: boolean

  bare?: boolean
}>()

const emit = defineEmits<{ preset: [id: string] }>()

const choices = useProgramChoices(() => ({ pack: props.pack, program: props.program, presetId: props.presetId }))

const options = choices.options

const selected = computed({
  get: () => choices.current.value,
  set: (value: string) => {
    if (value !== UNSAVED_CHOICE && value !== choices.current.value) emit('preset', value)
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

    <!-- คำอธิบายตัวอย่างยาวหลายบรรทัด แต่อ่านรอบเดียวก็พอ จึงเก็บไว้หลังไอคอน -->
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] text-ink-subtle">
        {{ total }} บล็อก ·
        <template v-if="locked">ตัวอย่างสำเร็จรูป</template>
        <template v-else>โปรแกรมของคุณ</template>
      </p>

      <UiInfo v-if="description" label="อัลกอริทึมนี้ทำงานยังไง">{{ description }}</UiInfo>
    </div>
  </div>
</template>
