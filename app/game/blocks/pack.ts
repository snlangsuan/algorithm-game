import { coreBlocksOf } from './core'
import type { Node, PackParsers, ParseContext } from './importer'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  register,
  type BlockCategory,
  type BlockNode,
  type BlockSpec,
  type PaletteGroup
} from './types'

/**
 * โปรแกรมหนึ่งชุด = ลำดับคำสั่งใต้หัวบล็อกแต่ละอัน
 * คีย์คือ kind ของหัวบล็อก เช่น "เมื่อถึงตาของฉัน" กับ "เมื่อจบเกม" แยกกันคนละชุด
 */
export interface BlockProgram {
  name: string
  scripts: Record<string, BlockNode[]>
}

export interface BlockPreset {
  id: string
  name: string
  description: string
  build: () => BlockProgram
}

/** ตัวเขียนโค้ดที่ตัวแปลงส่งให้เป้าหมายของแต่ละเกมใช้ */
export interface TargetWriter {
  /** เขียนหนึ่งบรรทัดตามย่อหน้าปัจจุบัน */
  push: (text: string) => void
  indent: (delta: number) => void
  /** วางลำดับคำสั่งที่ผู้เล่นต่อไว้ */
  body: () => void
}

/**
 * วิธีห่อโปรแกรมบล็อกให้กลายเป็นคลาส agent ของเกมนั้น ๆ
 * เกมใหม่แค่เขียนตัวนี้กับบล็อกเฉพาะเกม ก็ใช้ตัวแก้ไขบล็อกตัวเดียวกันได้เลย
 */
/** เมธอดหนึ่งตัวของ agent ที่ผูกกับหัวบล็อกหนึ่งอัน */
export interface TargetMethod {
  /** หัวบล็อกที่คุมเมธอดนี้ */
  hat: BlockSpec
  /** ชื่อเมธอดในคลาส เช่น 'step', 'chooseMove', 'onGameEnd' */
  name: string
  /** เขียนหัวเมธอด เรียก writer.body() ตรงที่คำสั่งของผู้เล่นควรอยู่ แล้วปิดท้าย */
  write: (writer: TargetWriter) => void
  /** ดึงเฉพาะคำสั่งของผู้เล่นออกจากตัวเมธอด (ตัดส่วนที่ระบบเติมให้ทิ้ง) */
  unwrap: (statements: Node[], ctx: ParseContext) => Node[]
  /**
   * ไม่ต้องเขียนเมธอดนี้ถ้าไม่มีบล็อกอยู่ข้างใน
   * เขาวงกตต้องใช้ เพราะ worker ดูว่า agent override solve() ไหมเพื่อเลือกโหมด
   * ถ้าเขียน solve() เปล่าทิ้งไว้ หุ่นเดินทีละก้าวจะถูกบังคับเข้าโหมดวางแผนทันที
   */
  skipWhenEmpty?: boolean
}

export interface CodeTarget {
  /** คลาสแม่ที่ agent ของเกมนั้นต้องสืบทอด เช่น MazeAgent */
  base: string
  /** ฟิลด์ของคลาส เช่น "facing = 'right'" */
  fields: string[]
  /** เมธอดตัวช่วยที่เติมท้ายคลาสให้อัตโนมัติ (ข้อความโค้ดตรง ๆ) */
  helpers: string
  /** เกมนี้มีความจำข้ามเกมไหม (คลาสแม่มี saveMemory/memory) */
  memory?: boolean
  /** เมธอดทั้งหมดที่ผู้เล่นต่อบล็อกใส่ได้ ตัวแรกคือตัวหลัก */
  methods: TargetMethod[]
}

export interface BlockPack {
  id: string
  /** หัวบล็อกทั้งหมดของเกมนี้ (ตัวแรกคือตัวหลัก) */
  hats: BlockSpec[]
  /** บล็อกเฉพาะเกม — จัดหมวดด้วย category ของบล็อกเอง */
  blocks: BlockSpec[]
  /** กล่องเครื่องมือ — ระบบจัดให้ตามหมวดมาตรฐาน เกมกำหนดเองไม่ได้ */
  palette: PaletteGroup[]
  target: CodeTarget
  presets: BlockPreset[]
  /** ตัวจับคู่โค้ดกลับเป็นบล็อกเฉพาะเกม (ชุดกลางมีให้อยู่แล้ว) */
  parsers?: PackParsers
}

export type PackInput = Omit<BlockPack, 'hats' | 'palette'>

/**
 * ลงทะเบียนบล็อกของเกม แล้วจัดกล่องเครื่องมือให้ตามหมวดมาตรฐาน
 * ทุกเกมจึงได้หมวดเดียวกัน ชื่อเดียวกัน เรียงเหมือนกัน ต่างแค่บล็อกข้างใน
 */
export function createPack(input: PackInput): BlockPack {
  const hats = input.target.methods.map((method) => method.hat)
  const blocks = [...input.blocks, ...coreBlocksOf(input.target.memory === true)]

  register([...hats, ...input.blocks])

  const palette: PaletteGroup[] = CATEGORY_ORDER.map((category: BlockCategory) => ({
    id: category,
    category,
    label: CATEGORY_LABEL[category],
    kinds: blocks
      .filter((block) => block.category === category && !block.hidden)
      .map((block) => block.kind)
  })).filter((group) => group.kinds.length > 0)

  return { ...input, hats, palette }
}

/** เติมช่องของหัวบล็อกให้ครบทุกอัน (ตัวอย่างบางชุดเขียนไว้แค่หัวเดียว) */
export function normalize(program: BlockProgram, pack: BlockPack): BlockProgram {
  return {
    name: program.name,
    scripts: Object.fromEntries(
      pack.hats.map((hat) => [hat.kind, program.scripts[hat.kind] ?? []])
    )
  }
}

/** สร้างโปรแกรมเปล่าที่มีครบทุกหัวบล็อกของเกมนั้น */
export function emptyProgram(pack: BlockPack, name = 'โปรแกรมของฉัน'): BlockProgram {
  return {
    name,
    scripts: Object.fromEntries(pack.hats.map((hat) => [hat.kind, []]))
  }
}
