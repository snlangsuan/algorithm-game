<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { BLOCK_EDITOR, useBlockDrag, type BlockEditorApi } from '~/composables/useBlockEditor'
import { countProgram } from '~/game/blocks/program'
import { UNSAVED_CHOICE, useProgramChoices } from '~/composables/useProgramLibrary'
import { downloadText, exportProgram, fileName, pickTextFile, readProgramFile } from '~/game/blocks/transfer'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  pack: BlockPack
  program: BlockProgram
  api: BlockEditorApi
  presetId: string
  title?: string

  locked?: boolean
}>()

const emit = defineEmits<{
  preset: [id: string]
  rename: [name: string]
  clone: []
  /** เริ่มโปรแกรมใหม่ว่าง ๆ */
  create: []
  /** ใช้โปรแกรมที่อ่านมาจากไฟล์ */
  load: [program: BlockProgram]
  /** ลบโปรแกรมนี้ออกจากคลังของฉัน */
  remove: []
}>()

/**
 * ส่งต่อไปที่ api ตัวปัจจุบันทุกครั้ง — provide ทำครั้งเดียวตอนสร้าง แต่หน้าที่มีสองฝ่าย (ไล่จับ)
 * สลับ api ได้โดยไม่สร้างตัวแก้ใหม่ ถ้าส่ง props.api ตรง ๆ บล็อกของฝ่ายที่สลับมาจะแก้ไม่ติดเลย
 */
provide(BLOCK_EDITOR, {
  dropStatement: (target) => props.api.dropStatement(target),
  dropInput: (target) => props.api.dropInput(target),
  remove: (id) => props.api.remove(id),
  duplicate: (id) => props.api.duplicate(id),
  setField: (node, name, value) => props.api.setField(node, name, value),
  unpack: (id) => props.api.unpack(id)
})

const { dragging } = useBlockDrag()

const choices = useProgramChoices(() => ({ pack: props.pack, program: props.program, presetId: props.presetId }))

const presetOptions = choices.options

const selected = computed({
  get: () => choices.current.value,
  set: (value: string) => {
    if (value !== UNSAVED_CHOICE && value !== choices.current.value) emit('preset', value)
  }
})

const description = computed(
  () => props.pack.presets.find((preset) => preset.id === props.presetId)?.description ?? ''
)

/** ข้อความสั้น ๆ หลังนำเข้า/ส่งออก — บอกว่าสำเร็จ หรือทำไมไม่สำเร็จ */
const notice = ref<{ tone: 'ok' | 'warn'; text: string } | null>(null)

watch(open, (value) => {
  if (value) notice.value = null
})

/**
 * โปรแกรมที่ต่อเองอยู่จะถูกแทนที่ — ถามก่อนถ้ามีบล็อกอยู่แล้ว
 * ตัวอย่างสำเร็จรูปไม่ต้องถาม เพราะเลือกกลับมาจากช่องตัวอย่างได้เสมอ
 */
function confirmReplace(action: string): boolean {
  if (props.locked || countProgram(props.program) === 0) return true
  return window.confirm(`${action}แล้ว "${props.program.name}" ที่ต่อไว้จะหายไป — ส่งออกเก็บไว้ก่อนได้ถ้ายังอยากเก็บ ต่อเลยไหม?`)
}

function create() {
  if (!confirmReplace('เริ่มโปรแกรมใหม่')) return
  emit('create')
  notice.value = { tone: 'ok', text: 'เริ่มโปรแกรมใหม่แล้ว — ลากบล็อกจากกล่องเครื่องมือมาต่อใต้หัว "เมื่อ…" ได้เลย' }
}

function exportFile() {
  downloadText(exportProgram(props.program, props.pack), fileName(props.program.name, 'blocks'))
  notice.value = { tone: 'ok', text: `ส่งออก "${props.program.name}" เป็นไฟล์แล้ว` }
}

async function importFile() {
  const picked = await pickTextFile()
  if (!picked) return
  if (!picked.ok) {
    notice.value = { tone: 'warn', text: picked.message }
    return
  }

  const read = readProgramFile(picked.value, props.pack)
  if (!read.ok) {
    notice.value = { tone: 'warn', text: read.message }
    return
  }

  if (!confirmReplace('นำเข้า')) return
  emit('load', read.value)
  notice.value = {
    tone: read.note ? 'warn' : 'ok',
    text: `นำเข้า "${read.value.name}" แล้ว${read.note ? ` · ${read.note}` : ''}`
  }
}

function remove() {
  const name = props.program.name
  if (!window.confirm(`ลบ "${name}" ออกจากโปรแกรมของฉัน? ลบแล้วเอากลับมาไม่ได้ — ส่งออกเก็บไว้ก่อนได้ถ้ายังอยากเก็บ`)) return

  emit('remove')
  notice.value = { tone: 'ok', text: `ลบ "${name}" แล้ว` }
}

/** ปุ่มไอคอนบนแถบเครื่องมือ — ชื่อเต็มขึ้นตอนชี้ และโปรแกรมอ่านหน้าจออ่านจาก aria-label */
const tools = computed(() =>
  [
    { id: 'new', label: 'โปรแกรมใหม่ (ว่างเปล่า)', show: true, run: create },
    { id: 'import', label: 'นำเข้าโปรแกรมจากไฟล์', show: true, run: importFile },
    { id: 'export', label: 'ส่งออกโปรแกรมนี้เป็นไฟล์', show: !props.locked, run: exportFile },
    { id: 'delete', label: 'ลบโปรแกรมนี้', show: !props.locked && !!props.program.libraryId, run: remove }
  ].filter((tool) => tool.show)
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
        <div
          v-if="locked"
          class="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-4 shrink-0 text-amber-600" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="2" />
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>

          <p class="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-900">ตัวอย่างสำเร็จรูป</p>

          <UiButton size="sm" @click="emit('clone')">คัดลอกไปแก้</UiButton>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="tool in tools"
            :key="tool.id"
            type="button"
            :title="tool.label"
            :aria-label="tool.label"
            class="grid size-8 place-items-center rounded-lg border transition-colors"
            :class="
              tool.id === 'delete'
                ? 'border-line bg-surface text-ink-subtle hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                : 'border-line bg-surface text-ink-muted hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
            "
            @click="tool.run"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true">
              <template v-if="tool.id === 'new'">
                <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
                <path d="M14 3v5h5M12 11v6M9 14h6" />
              </template>
              <template v-else-if="tool.id === 'import'">
                <path d="M12 3v12M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </template>
              <template v-else-if="tool.id === 'export'">
                <path d="M12 15V3M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </template>
              <template v-else>
                <path d="M4 7h16M10 11v6M14 11v6" />
                <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3" />
              </template>
            </svg>
          </button>

          <p
            v-if="notice"
            role="status"
            class="min-w-0 flex-1 truncate text-[11px]"
            :class="notice.tone === 'ok' ? 'text-ink-subtle' : 'text-amber-700'"
            :title="notice.text"
          >
            {{ notice.text }}
          </p>
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
