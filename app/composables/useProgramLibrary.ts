import { computed, reactive, toRaw } from 'vue'
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { exportProgram, readProgramFile } from '~/game/blocks/transfer'

/**
 * คลัง "โปรแกรมของฉัน" — โปรแกรมที่สร้างใหม่ คัดลอกจากตัวอย่าง หรือนำเข้าจากไฟล์ เก็บลงเครื่องแยกตามเกม
 *
 * แก้บล็อกเมื่อไรก็บันทึกทับทันที ปิดหน้าไปแล้วเปิดใหม่ของก็ยังอยู่ และลบทิ้งได้ทีละอัน
 * ตอนโหลดกลับขึ้นมา ทุกโปรแกรมผ่านตัวตรวจชุดเดียวกับการนำเข้าไฟล์ เพราะของในเครื่องก็แก้ด้วยมือได้เหมือนกัน
 */

export interface LibraryEntry {
  id: string
  name: string
  program: BlockProgram
  updatedAt: number
}

const PREFIX = 'blocks:library:'

/** เกมเดียวกันใช้คลังก้อนเดียวกันทั้งหน้า — เช่นโอเทลโลสองฝั่งเห็นโปรแกรมของฉันชุดเดียวกัน */
const shelves = new Map<string, LibraryEntry[]>()

let counter = 0
const nextId = (): string => `p${Date.now().toString(36)}${(++counter).toString(36)}`

/** สำเนาแบบข้อมูลล้วน — ของในคลังต้องไม่ผูกกับโปรแกรมที่กำลังแก้อยู่ */
const snapshot = (program: BlockProgram): BlockProgram =>
  JSON.parse(JSON.stringify({ name: program.name, scripts: toRaw(program).scripts }))

function storage(): Storage | null {
  try {
    return typeof localStorage === 'object' ? localStorage : null
  } catch {
    return null
  }
}

function load(pack: BlockPack): LibraryEntry[] {
  try {
    const raw = storage()?.getItem(PREFIX + pack.id)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []

    const entries: LibraryEntry[] = []
    for (const item of list as Array<Partial<LibraryEntry>>) {
      if (typeof item?.id !== 'string' || !item.program) continue

      const read = readProgramFile(exportProgram(item.program, pack), pack)
      // โปรแกรมว่าง (เพิ่งกดสร้างใหม่ยังไม่ได้ต่ออะไร) ตัวตรวจจะตอบว่าไม่มีบล็อก — ก็ยังเก็บไว้ได้
      const program = read.ok ? read.value : { name: String(item.program.name ?? 'โปรแกรมของฉัน'), scripts: {} }
      entries.push({ id: item.id, name: program.name, program, updatedAt: Number(item.updatedAt) || 0 })
    }
    return entries
  } catch {
    return []
  }
}

export function useProgramLibrary(pack: BlockPack) {
  let entries = shelves.get(pack.id)
  if (!entries) {
    entries = reactive(load(pack)) as LibraryEntry[]
    shelves.set(pack.id, entries)
  }
  const list = entries

  const persist = () => {
    try {
      storage()?.setItem(PREFIX + pack.id, JSON.stringify(list))
    } catch {
      // เครื่องเต็มหรือโหมดส่วนตัว — ของยังอยู่ในหน้านี้ แค่ไม่รอดการปิดหน้า
    }
  }

  return {
    entries: list,

    find: (id: string): LibraryEntry | undefined => list.find((entry) => entry.id === id),

    /** เก็บโปรแกรมใหม่เข้าคลัง แล้วคืนรหัสของมัน */
    add(program: BlockProgram): string {
      const id = nextId()
      list.push({ id, name: program.name, program: snapshot(program), updatedAt: Date.now() })
      persist()
      return id
    },

    save(id: string, program: BlockProgram): void {
      const entry = list.find((item) => item.id === id)
      if (!entry) return

      entry.name = program.name
      entry.program = snapshot(program)
      entry.updatedAt = Date.now()
      persist()
    },

    remove(id: string): void {
      const index = list.findIndex((item) => item.id === id)
      if (index < 0) return

      list.splice(index, 1)
      persist()
    }
  }
}

/** ค่าในดรอปดาวน์ของโปรแกรมในคลัง — แยกจากรหัสตัวอย่างด้วยคำนำหน้า */
export const MINE_PREFIX = 'mine:'

/** ตัวเลือกชั่วคราวของโปรแกรมที่ยังไม่ได้อยู่ในคลัง (เช่นเครื่องเก็บของไม่ได้) */
export const UNSAVED_CHOICE = '__mine__'

/**
 * ตัวเลือกในดรอปดาวน์ "อัลกอริทึมที่ใช้" — ตัวอย่างสำเร็จรูปก่อน แล้วตามด้วยโปรแกรมของฉันในคลัง
 * ใช้ร่วมกันทั้งแผงข้างและในหน้าต่างต่อบล็อก สองที่จะได้โชว์ตรงกันเสมอ
 */
export function useProgramChoices(
  source: () => { pack: BlockPack; program: BlockProgram; presetId: string }
) {
  const options = computed(() => {
    const { pack, program, presetId } = source()
    const mine = useProgramLibrary(pack).entries

    const list = [
      ...pack.presets.map((preset) => ({ value: preset.id, label: preset.name, group: 'ตัวอย่างสำเร็จรูป' })),
      ...mine.map((entry) => ({ value: `${MINE_PREFIX}${entry.id}`, label: entry.name, group: 'โปรแกรมของฉัน' }))
    ]

    return presetId || program.libraryId ? list : [{ value: UNSAVED_CHOICE, label: program.name }, ...list]
  })

  const current = computed(() => {
    const { program, presetId } = source()
    return presetId || (program.libraryId ? `${MINE_PREFIX}${program.libraryId}` : UNSAVED_CHOICE)
  })

  return { options, current }
}
