<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { BLOCK_EDITOR, useBlockDrag, type BlockEditorApi } from '~/composables/useBlockEditor'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  pack: BlockPack
  program: BlockProgram
  api: BlockEditorApi
  presetId: string
  title?: string
  /** ตัวอย่างสำเร็จรูป — ดูได้แต่แก้ไม่ได้จนกว่าจะคัดลอก */
  locked?: boolean
}>()

const emit = defineEmits<{ preset: [id: string]; rename: [name: string]; clone: [] }>()

provide(BLOCK_EDITOR, props.api)

const { dragging } = useBlockDrag()

/** คัดลอกแล้วจะไม่ตรงกับตัวอย่างไหนอีก จึงต้องมีตัวเลือกของโปรแกรมตัวเองไว้ให้ค่าไม่ค้าง */
const MINE = '__mine__'

const presetOptions = computed(() => {
  const options = props.pack.presets.map((preset) => ({ value: preset.id, label: preset.name }))
  return props.presetId ? options : [{ value: MINE, label: props.program.name }, ...options]
})

const selected = ref(props.presetId || MINE)

watch(open, (value) => {
  if (value) selected.value = props.presetId || MINE
})

watch(
  () => props.presetId,
  (value) => {
    selected.value = value || MINE
  }
)

watch(selected, (value) => {
  if (value !== MINE && value !== props.presetId) emit('preset', value)
})

const description = computed(
  () => props.pack.presets.find((preset) => preset.id === props.presetId)?.description ?? ''
)

function onTrash() {
  const id = dragging.value?.id
  if (id) props.api.remove(id)
}
</script>

<template>
  <UiModal
    v-model="open"
    full
    :title="title ?? 'ต่อบล็อกเป็นโปรแกรม'"
    description="บล็อกสี่เหลี่ยมมีเดือย = คำสั่ง ต่อกันลงมาใต้หัว &quot;เมื่อ…&quot; · บล็อกแคปซูล = ค่า เสียบลงในช่องของคำสั่งอีกที"
  >
    <div class="flex h-[60vh] flex-col gap-3 sm:flex-row sm:gap-4">
      <div class="h-56 shrink-0 sm:h-auto sm:w-60">
        <BlockPalette :pack="pack" :disabled="locked" @trash="onTrash" />
      </div>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <!-- ตัวอย่างสำเร็จรูปแก้ไม่ได้ ต้องคัดลอกก่อน จะได้ไม่แก้ตัวอย่างจนพังแล้วกลับไม่ได้ -->
        <div
          v-if="locked"
          class="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-4 shrink-0 text-amber-600" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="2" />
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>

          <p class="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-900">
            นี่คือตัวอย่างสำเร็จรูป แก้ไม่ได้ — กดคัดลอกเพื่อสร้างโปรแกรมของตัวเองที่แก้ได้
          </p>

          <UiButton size="sm" @click="emit('clone')">คัดลอกไปแก้</UiButton>
        </div>

        <label class="flex items-center gap-2">
          <span class="shrink-0 text-xs text-ink-muted">ชื่อโปรแกรม</span>
          <input
            :value="program.name"
            :disabled="locked"
            class="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-primary-400 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted"
            @input="emit('rename', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <BlockScript class="min-h-0 flex-1" :pack="pack" :program="program" :editable="!locked" />
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <div class="w-48 shrink-0">
            <UiSelect v-model="selected" :options="presetOptions" />
          </div>
          <p class="min-w-0 flex-1 truncate text-[11px] text-ink-subtle">{{ description }}</p>
        </div>

        <UiButton size="sm" @click="open = false">เสร็จแล้ว</UiButton>
      </div>
    </template>
  </UiModal>
</template>
