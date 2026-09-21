import { coreBlocksOf } from './core'
import { emptyProgram, type BlockPack, type BlockProgram } from './pack'
import { createBlock } from './program'
import { findSpec, type BlockNode, type BlockPart } from './types'

/**
 * ส่งโปรแกรมบล็อกออกเป็นไฟล์ และอ่านกลับเข้ามา
 *
 * ไฟล์ที่อ่านเข้ามาเชื่อไม่ได้ — อาจแก้ด้วยมือ มาจากเกมอื่น หรือเป็นไฟล์เสียก็ได้
 * จึงไม่เอาก้อนที่อ่านได้มาใช้ตรง ๆ แต่สร้างบล็อกใหม่ทีละตัวจากสเปกของเกมนี้
 * แล้วคัดลอกมาเฉพาะค่าที่สเปกยอมรับ ช่องไหนผิดรูปก็ใช้ค่าตั้งต้นของบล็อกนั้นแทน
 * ผลคือโปรแกรมที่อ่านเข้ามาได้ ต่อด้วยมือในตัวต่อบล็อกได้เหมือนกันทุกประการ
 */

export const PROGRAM_FORMAT = 'algorithm-game/blocks'

export const MEMORY_FORMAT = 'algorithm-game/memory'

const VERSION = 1

/** เกมเก็บความจำลงเครื่องได้ไม่เกินเท่านี้ต่อโปรแกรม — ตรงกับที่ตัวเกมตั้งไว้ */
export const MEMORY_LIMIT = 256 * 1024

/** ไฟล์ใหญ่เกินนี้ไม่อ่าน — โปรแกรมบล็อกจริง ๆ ไม่มีทางใหญ่ขนาดนี้ */
export const FILE_LIMIT = 1024 * 1024

/** บล็อกทั้งโปรแกรมไม่เกินเท่านี้ และซ้อนกันลึกไม่เกินเท่านี้ชั้น */
const NODE_LIMIT = 5000
const DEPTH_LIMIT = 60

export interface ProgramFile {
  format: typeof PROGRAM_FORMAT
  version: number
  /** เกมที่เขียนโปรแกรมนี้ — อ่านเข้าเกมอื่นไม่ได้ เพราะคำศัพท์บล็อกคนละชุด */
  game: string
  savedAt: string
  program: BlockProgram
}

export type ReadResult<T> = { ok: true; value: T; note?: string } | { ok: false; message: string }

/** ชื่อไฟล์ที่อ่านได้และไม่มีตัวอักษรต้องห้ามของระบบไฟล์ */
export function fileName(name: string, suffix: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return `${safe || 'program'}.${suffix}.json`
}

export function exportProgram(program: BlockProgram, pack: BlockPack): string {
  const file: ProgramFile = {
    format: PROGRAM_FORMAT,
    version: VERSION,
    game: pack.id,
    savedAt: new Date().toISOString(),
    program: { name: program.name, scripts: program.scripts }
  }

  return JSON.stringify(file, null, 2)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseJson(text: string): ReadResult<Record<string, unknown>> {
  if (text.length > FILE_LIMIT) return { ok: false, message: 'ไฟล์ใหญ่เกินไป (เกิน 1 MB)' }

  try {
    const data: unknown = JSON.parse(text)
    return isRecord(data) ? { ok: true, value: data } : { ok: false, message: 'ไฟล์ไม่ได้อยู่ในรูปแบบที่อ่านได้' }
  } catch {
    return { ok: false, message: 'อ่านไฟล์ไม่ออก — ไม่ใช่ไฟล์ JSON' }
  }
}

/** บล็อกที่เกมนี้รู้จัก — หัวบล็อกไม่นับ เพราะหัวบล็อกเป็นกุญแจของ scripts ไม่ได้อยู่ในตัวโปรแกรม */
function knownKinds(pack: BlockPack): Set<string> {
  return new Set([...pack.blocks, ...coreBlocksOf(pack.target.memory === true)].map((spec) => spec.kind))
}

interface Rebuild {
  known: Set<string>
  count: number
  dropped: number
}

/**
 * สร้างบล็อกใหม่จากก้อนที่อ่านได้ — คืน null ถ้าบล็อกนี้ใช้ไม่ได้ (ไม่รู้จัก หรือรูปร่างผิดที่)
 * รหัสบล็อกสร้างใหม่หมด ไม่เอาของในไฟล์ จะได้ไม่ชนกับบล็อกที่มีอยู่แล้ว
 */
function rebuild(raw: unknown, shape: 'statement' | 'value', state: Rebuild, depth: number): BlockNode | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') {
    state.dropped++
    return null
  }

  const spec = findSpec(raw.kind)
  if (!spec || !state.known.has(raw.kind) || spec.shape !== shape) {
    state.dropped++
    return null
  }

  if (depth > DEPTH_LIMIT || ++state.count > NODE_LIMIT) throw new Error('โปรแกรมในไฟล์ใหญ่หรือซ้อนลึกเกินไป')

  const node = createBlock(raw.kind)
  const source: RawParts = {
    fields: isRecord(raw.fields) ? raw.fields : {},
    inputs: isRecord(raw.inputs) ? raw.inputs : {},
    bodies: isRecord(raw.bodies) ? raw.bodies : {}
  }

  for (const part of spec.parts) copyPart(node, part, source, state, depth)

  return node
}

interface RawParts {
  fields: Record<string, unknown>
  inputs: Record<string, unknown>
  bodies: Record<string, unknown>
}

/** คัดลอกช่องเดียวจากก้อนที่อ่านได้ ลงบล็อกที่สร้างใหม่ — ค่าที่สเปกไม่ยอมรับจะถูกข้าม ใช้ค่าตั้งต้นแทน */
function copyPart(node: BlockNode, part: BlockPart, source: RawParts, state: Rebuild, depth: number): void {
  switch (part.type) {
    case 'field': {
      // ค่าของช่องเลือกถูกเขียนลงโค้ดตรง ๆ (เช่นชื่อตัวแปร) — ยอมรับเฉพาะตัวเลือกที่มีอยู่จริงเท่านั้น
      const value = source.fields[part.name]
      if (part.options.some((option) => option.value === value)) node.fields[part.name] = value as string
      return
    }
    case 'number': {
      const value = Number(source.fields[part.name])
      if (Number.isFinite(value)) node.fields[part.name] = value
      return
    }
    case 'string':
    case 'code': {
      const value = source.fields[part.name]
      if (typeof value === 'string' && value.length <= 10_000) node.fields[part.name] = value
      return
    }
    case 'input': {
      const child = source.inputs[part.name]
      node.inputs[part.name] = child ? rebuild(child, 'value', state, depth + 1) : null
      return
    }
    case 'body': {
      const list = source.bodies[part.name]
      node.bodies[part.name] = Array.isArray(list) ? rebuildList(list, state, depth + 1) : []
      return
    }
  }
}

const rebuildList = (list: unknown[], state: Rebuild, depth: number): BlockNode[] =>
  list.map((item) => rebuild(item, 'statement', state, depth)).filter((item) => item !== null)

const nameOf = (raw: unknown): string =>
  typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 80) : 'โปรแกรมที่นำเข้า'

/** อ่านไฟล์โปรแกรมบล็อกของเกมนี้ — บล็อกที่ใช้ไม่ได้ถูกตัดทิ้ง และบอกไว้ใน note ว่าตัดไปกี่ตัว */
export function readProgramFile(text: string, pack: BlockPack): ReadResult<BlockProgram> {
  const parsed = parseJson(text)
  if (!parsed.ok) return parsed

  const data = parsed.value
  if (data.format !== PROGRAM_FORMAT) return { ok: false, message: 'ไฟล์นี้ไม่ใช่ไฟล์โปรแกรมบล็อก' }
  if (data.game !== pack.id) {
    return { ok: false, message: `ไฟล์นี้เป็นโปรแกรมของเกมอื่น (${String(data.game)}) — บล็อกคนละชุดกัน ใช้ในเกมนี้ไม่ได้` }
  }

  const program = isRecord(data.program) ? data.program : null
  const scripts = program && isRecord(program.scripts) ? program.scripts : null
  if (!program || !scripts) return { ok: false, message: 'ไฟล์ไม่มีโปรแกรมอยู่ข้างใน' }

  const name = nameOf(program.name)
  const result = emptyProgram(pack, name)
  const state: Rebuild = { known: knownKinds(pack), count: 0, dropped: 0 }

  try {
    for (const hat of pack.hats) {
      const list = scripts[hat.kind]
      if (!Array.isArray(list)) continue
      result.scripts[hat.kind] = rebuildList(list, state, 0)
    }
  } catch (caught) {
    return { ok: false, message: caught instanceof Error ? caught.message : String(caught) }
  }

  if (state.count === 0) return { ok: false, message: 'ไฟล์นี้ไม่มีบล็อกที่ใช้ได้เลยสักตัว' }

  return {
    ok: true,
    value: result,
    note: state.dropped > 0 ? `ตัดบล็อกที่เกมนี้ไม่รู้จักหรือวางผิดที่ออก ${state.dropped} ตัว` : undefined
  }
}

// ---------- ความจำข้ามรอบ ----------

export interface MemoryFile {
  format: typeof MEMORY_FORMAT
  version: number
  game: string
  /** ความจำของโปรแกรมไหน — แค่บอกไว้ให้คนอ่าน ตอนนำเข้าไม่ได้บังคับให้ตรง */
  program: string
  savedAt: string
  memory: Record<string, unknown>
}

export function exportMemory(memory: Record<string, unknown>, game: string, program: string): string {
  const file: MemoryFile = {
    format: MEMORY_FORMAT,
    version: VERSION,
    game,
    program,
    savedAt: new Date().toISOString(),
    memory
  }

  return JSON.stringify(file, null, 2)
}

/** อ่านไฟล์ความจำ — ต้องเป็นของเกมเดียวกัน ส่วนเนื้อในเป็นอะไรก็ได้ที่โปรแกรมเคยบันทึกไว้ */
export function readMemoryFile(
  text: string,
  game: string,
  program: string
): ReadResult<Record<string, unknown>> {
  const parsed = parseJson(text)
  if (!parsed.ok) return parsed

  const data = parsed.value
  if (data.format !== MEMORY_FORMAT) return { ok: false, message: 'ไฟล์นี้ไม่ใช่ไฟล์ความจำ' }
  if (data.game !== game) return { ok: false, message: `ไฟล์นี้เป็นความจำของเกมอื่น (${String(data.game)})` }
  if (!isRecord(data.memory)) return { ok: false, message: 'ไฟล์ไม่มีความจำอยู่ข้างใน' }
  if (JSON.stringify(data.memory).length > MEMORY_LIMIT) {
    return { ok: false, message: 'ความจำในไฟล์ใหญ่เกินกว่าที่เกมเก็บได้ (เกิน 256 KB)' }
  }

  return {
    ok: true,
    value: data.memory,
    note:
      typeof data.program === 'string' && data.program !== program
        ? `ไฟล์นี้บันทึกจากโปรแกรม "${data.program}" ซึ่งไม่ใช่โปรแกรมที่เลือกอยู่ — ถ้าโปรแกรมอ่านความจำคนละแบบ ผลอาจแปลก ๆ`
        : undefined
  }
}

/** ให้เบราว์เซอร์ดาวน์โหลดข้อความเป็นไฟล์ */
export function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** เปิดหน้าต่างเลือกไฟล์ แล้วคืนข้อความในไฟล์ — ผู้ใช้กดยกเลิกก็คืน null */
export function pickTextFile(): Promise<ReadResult<string> | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      if (file.size > FILE_LIMIT) return resolve({ ok: false, message: 'ไฟล์ใหญ่เกินไป (เกิน 1 MB)' })

      try {
        resolve({ ok: true, value: await file.text() })
      } catch {
        resolve({ ok: false, message: 'เปิดไฟล์ไม่ได้' })
      }
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
