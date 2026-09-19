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
import type { BlockId } from '~/game/blocks/types'
import { useBlockDrag, type BlockEditorApi } from '~/composables/useBlockEditor'

/**
 * โปรแกรมบล็อกหนึ่งชุด พร้อมโค้ดที่แปลงได้และคำสั่งแก้ไขทั้งหมด
 * เกมไหนก็เรียกใช้ได้ ต่างกันแค่ pack ที่ส่งเข้ามา
 *
 * @param onChange เรียกทุกครั้งที่โปรแกรมเปลี่ยน (เกมมักใช้ล้างผลรันเดิมทิ้ง)
 */
export function useBlockProgram(pack: BlockPack, defaultPresetId: string, onChange?: () => void) {
  const first = pack.presets.find((preset) => preset.id === defaultPresetId) ?? pack.presets[0]

  const presetId = ref(first?.id ?? '')

  /**
   * ตัวอย่างสำเร็จรูปแก้ไม่ได้ — ต้องกด "คัดลอกไปแก้" ก่อน
   * กันไม่ให้เด็กแก้ตัวอย่างจนพังแล้วหาทางกลับไม่เจอ และตัวอย่างจะได้เป็นของอ้างอิงเสมอ
   */
  const locked = ref(true)

  // ต้องมีช่องของทุกหัวบล็อกตั้งแต่แรก ไม่งั้นหย่อนบล็อกลงหัวที่ตัวอย่างไม่ได้ใช้จะไม่มีที่เก็บ
  const program = reactive<BlockProgram>(emptyProgram(pack))
  if (first) Object.assign(program, normalize(first.build(), pack))

  /** โค้ดที่แปลงจากบล็อก พร้อมตารางว่าบล็อกไหนอยู่บรรทัดไหน */
  const generated = computed(() => generate(program, pack))

  const { dragging } = useBlockDrag()

  const touched = () => onChange?.()

  function replaceProgram(next: BlockProgram, asPreset = false): void {
    if (!asPreset) locked.value = false
    const ready = normalize(next, pack)
    program.name = ready.name

    // เคลียร์สคริปต์เดิมทิ้งก่อน เผื่อหัวบล็อกที่เคยมีหายไป
    for (const key of Object.keys(program.scripts)) delete program.scripts[key]
    Object.assign(program.scripts, ready.scripts)

    touched()
  }

  function usePreset(id: string): void {
    const preset = pack.presets.find((item) => item.id === id)
    if (!preset) return

    presetId.value = id
    locked.value = true
    replaceProgram(preset.build(), true)
  }

  /** คัดลอกตัวอย่างที่ใช้อยู่เป็นโปรแกรมของตัวเอง แล้วปลดล็อกให้แก้ได้ */
  function cloneForEditing(): void {
    if (!locked.value) return

    locked.value = false
    presetId.value = ''
    program.name = `สำเนาของ ${program.name}`
    touched()
  }

  /** บล็อกที่กำลังลาก — สร้างใหม่จากกล่องเครื่องมือ หรือถอดออกมาจากที่เดิม */
  function takeDragged(parent: BlockId | null): ReturnType<typeof createBlock> | null {
    const payload = dragging.value
    if (!payload) return null

    if (payload.source === 'palette') return createBlock(payload.kind)
    if (!payload.id) return null

    // ห้ามหย่อนบล็อกลงในตัวเอง ไม่งั้นต้นไม้จะขาดออกจากกัน
    const node = findBlock(program, payload.id)
    if (node && parent && contains(node, parent)) return null

    return detach(program, payload.id)
  }

  const api: BlockEditorApi = {
    dropStatement(target) {
      if (locked.value) return
      const payload = dragging.value
      const from = payload?.id ? locate(program, payload.id) : null

      const node = takeDragged(target.parent)
      if (!node) return

      // ย้ายลงข้างล่างในลิสต์เดียวกัน ตำแหน่งจะเลื่อนขึ้นหนึ่งช่องหลังถอดออก
      const index =
        from && from.parent === target.parent && from.name === target.name && from.index < target.index
          ? target.index - 1
          : target.index

      insertStatement(program, { ...target, index }, node)
      touched()
    },

    dropInput(target) {
      if (locked.value) return
      const node = takeDragged(target.parent)
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
    }
  }

  /** บล็อกที่โค้ดบรรทัดนั้นมาจาก (null ถ้าเป็นบรรทัดของตัวช่วยที่ระบบเติมให้) */
  const blockAtLine = (line: number | null): BlockId | null =>
    line === null ? null : (generated.value.blockOf[line] ?? null)

  /** จำนวนครั้งที่แต่ละบล็อกทำงาน แปลงจากตัวนับบรรทัด */
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
    blockAtLine,
    blockCounts,
    rename: (name: string) => {
      if (locked.value) return
      program.name = name
      touched()
    }
  }
}
