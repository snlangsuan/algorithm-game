import { generate } from '~/game/blocks/codegen'
import { emptyProgram, normalize, type BlockPack, type BlockProgram } from '~/game/blocks/pack'
import {
  cloneBlock,
  contains,
  createBlock,
  detach,
  findBlock,
  insertStatement,
  locate,
  setInput
} from '~/game/blocks/program'
import { findSpec, type BlockId, type BlockNode } from '~/game/blocks/types'
import {
  useBlockDrag,
  type BlockEditorApi,
  type DragPayload,
  type StatementTarget
} from '~/composables/useBlockEditor'
import { MINE_PREFIX, useProgramLibrary } from '~/composables/useProgramLibrary'

interface EditorDeps {
  program: BlockProgram
  locked: Ref<boolean>
  dragging: Ref<DragPayload | null>
  touched: () => void
}

function takeDragged(deps: EditorDeps, parent: BlockId | null): BlockNode | null {
  const payload = deps.dragging.value
  if (!payload) return null

  if (payload.source === 'palette') return createBlock(payload.kind)
  if (!payload.id) return null

  const node = findBlock(deps.program, payload.id)
  if (node && parent && contains(node, parent)) return null

  return detach(deps.program, payload.id)
}

function dropIndex(deps: EditorDeps, target: StatementTarget): number {
  const payload = deps.dragging.value
  const from = payload?.id ? locate(deps.program, payload.id) : null

  if (!from || from.parent !== target.parent || from.name !== target.name) return target.index

  return from.index < target.index ? target.index - 1 : target.index
}

function createEditorApi(deps: EditorDeps): BlockEditorApi {
  const { program, locked, touched } = deps

  return {
    dropStatement(target) {
      if (locked.value) return

      const index = dropIndex(deps, target)
      const node = takeDragged(deps, target.parent)
      if (!node) return

      insertStatement(program, { ...target, index }, node)
      touched()
    },

    dropInput(target) {
      if (locked.value) return

      const node = takeDragged(deps, target.parent)
      if (!node) return

      setInput(program, target, node)
      touched()
    },

    remove(id) {
      if (locked.value) return

      detach(program, id)
      touched()
    },

    duplicate(id) {
      if (locked.value) return

      const node = findBlock(program, id)
      const at = locate(program, id)
      if (!node || !at) return

      insertStatement(program, { ...at, index: at.index + 1 }, cloneBlock(node))
      touched()
    },

    setField(node, name, value) {
      if (locked.value) return

      node.fields[name] = value
      touched()
    },

    unpack(id) {
      if (locked.value) return

      const node = findBlock(program, id)
      const at = locate(program, id)
      const unpack = node ? findSpec(node.kind)?.unpack : undefined
      if (!node || !at || !unpack) return

      detach(program, id)
      unpack(node).forEach((part, offset) => insertStatement(program, { ...at, index: at.index + offset }, part))
      touched()
    }
  }
}

export interface BlockProgramOptions {
  /** โปรแกรมในคลังถูกลบ — ส่งกุญแจของมัน (programKey) มาให้เกมเก็บกวาดของที่ผูกไว้ เช่นความจำ */
  onRemove?: (key: string) => void
}

export function useBlockProgram(
  pack: BlockPack,
  defaultPresetId: string,
  onChange?: () => void,
  options: BlockProgramOptions = {}
) {
  const first = pack.presets.find((preset) => preset.id === defaultPresetId) ?? pack.presets[0]

  const presetId = ref(first?.id ?? '')

  const locked = ref(true)

  const program = reactive<BlockProgram>(emptyProgram(pack))
  if (first) Object.assign(program, normalize(first.build(), pack))

  const generated = computed(() => generate(program, pack))

  const { dragging } = useBlockDrag()

  const library = useProgramLibrary(pack)

  /** แก้เมื่อไรก็บันทึกลงคลังทันที — ตัวอย่างสำเร็จรูปแก้ไม่ได้ จึงไม่มีอะไรต้องบันทึก */
  const touched = () => {
    if (!locked.value && program.libraryId) library.save(program.libraryId, program)
    onChange?.()
  }

  function replaceProgram(next: BlockProgram, asPreset = false): void {
    if (!asPreset) locked.value = false
    const ready = normalize(next, pack)
    program.name = ready.name

    for (const key of Object.keys(program.scripts)) delete program.scripts[key]
    Object.assign(program.scripts, ready.scripts)

    touched()
  }

  /** เปิดโปรแกรมจากคลัง — เป็นของเราเอง แก้ต่อได้เลย */
  function openMine(id: string): void {
    const entry = library.find(id)
    if (!entry) return

    presetId.value = ''
    program.libraryId = id
    replaceProgram(entry.program)
  }

  /** รับได้ทั้งรหัสตัวอย่าง และ "mine:<รหัส>" ของโปรแกรมในคลัง — ดรอปดาวน์ส่งมาทางเดียวกัน */
  function usePreset(id: string): void {
    if (id.startsWith(MINE_PREFIX)) {
      openMine(id.slice(MINE_PREFIX.length))
      return
    }

    const preset = pack.presets.find((item) => item.id === id)
    if (!preset) return

    presetId.value = id
    locked.value = true
    program.libraryId = undefined
    replaceProgram(preset.build(), true)
  }

  /** ใส่โปรแกรมลงคลังเป็นช่องใหม่ แล้วให้มันเป็นโปรแกรมที่กำลังแก้อยู่ */
  function adopt(next: BlockProgram): void {
    presetId.value = ''
    program.libraryId = library.add(next)
    replaceProgram(next)
  }

  function cloneForEditing(): void {
    if (!locked.value) return

    locked.value = false
    presetId.value = ''
    program.name = `สำเนาของ ${program.name}`
    program.libraryId = library.add(program)
    touched()
  }

  /** เริ่มโปรแกรมใหม่ว่าง ๆ — มีแต่หัวบล็อก แก้ได้ทันทีไม่ต้องคัดลอกก่อน */
  function newProgram(): void {
    adopt(emptyProgram(pack))
  }

  /** ใช้โปรแกรมที่อ่านมาจากไฟล์ — ถือเป็นโปรแกรมของผู้เล่น ไม่ใช่ตัวอย่าง จึงแก้ต่อได้เลย */
  function loadProgram(next: BlockProgram): void {
    adopt(next)
  }

  /** กุญแจประจำโปรแกรม — เกมใช้ผูกของอื่นกับโปรแกรมนี้ เช่นความจำข้ามรอบ */
  const programKey = computed(() =>
    presetId.value || (program.libraryId ? `${MINE_PREFIX}${program.libraryId}` : 'mine')
  )

  /** ลบโปรแกรมออกจากคลัง — ถ้าเป็นตัวที่เปิดอยู่ ก็กลับไปที่ตัวอย่างตั้งต้น */
  function removeProgram(id = program.libraryId): void {
    if (!id) return

    library.remove(id)
    options.onRemove?.(`${MINE_PREFIX}${id}`)
    if (program.libraryId === id && first) usePreset(first.id)
  }

  const api = createEditorApi({ program, locked, dragging, touched })

  const blockAtLine = (line: number | null): BlockId | null =>
    line === null ? null : (generated.value.blockOf[line] ?? null)

  function blockCounts(lines: Record<number, number>): Record<BlockId, number> {
    const counts: Record<BlockId, number> = {}

    for (const [id, line] of Object.entries(generated.value.lineOf)) {
      const hits = lines[line]
      if (hits) counts[id] = hits
    }

    return counts
  }

  return {
    pack,
    presetId,
    locked: readonly(locked),
    cloneForEditing,
    program,
    generated,
    api,
    usePreset,
    replaceProgram,
    newProgram,
    loadProgram,
    removeProgram,
    programKey,
    library: library.entries,
    blockAtLine,
    blockCounts,
    rename: (name: string) => {
      if (locked.value) return
      program.name = name
      touched()
    }
  }
}
