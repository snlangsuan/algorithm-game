/**
 * แกนกลางของระบบบล็อก — ใช้ร่วมกันทุกเกม
 *
 * บล็อกหนึ่งตัวแปลงเป็นโค้ดหนึ่งบรรทัดเสมอ หน้าจอจึงย้อนจาก "บรรทัดที่กำลังรัน"
 * กลับมาไฮไลต์บล็อกที่กำลังทำงานได้ และผู้เล่นกดดูโค้ดที่บล็อกแปลงออกมาได้ตลอด
 */

export type BlockId = string

/** วิธีเขียนโปรแกรมของผู้เล่น — ต่อบล็อก หรือพิมพ์โค้ดเอง */
export type AuthorMode = 'blocks' | 'code'

/**
 * 'hat'       = หัวโปรแกรม (เมื่อ...) มีได้ตัวเดียวและอยู่บนสุด
 * 'statement' = คำสั่ง ต่อกันเป็นลำดับ
 * 'value'     = ค่า/เงื่อนไข เสียบลงในช่อง
 */
export type BlockShape = 'hat' | 'statement' | 'value'

/**
 * หมวดของบล็อก — ทุกเกมใช้ชุดเดียวกันนี้เสมอ
 * ชื่อหมวด ลำดับ และสี จึงเหมือนกันหมด ต่างกันแค่บล็อกข้างในที่เป็นคำศัพท์ของเกมนั้น
 */
export type BlockCategory = 'event' | 'action' | 'sense' | 'control' | 'data'

/**
 * ชนิดของค่า — ใช้บอกว่าบล็อกแคปซูลตัวไหนเสียบลงรูไหนได้
 * 'check' = คำตอบใช่/ไม่ใช่, 'number' = ตัวเลข, 'string' = ข้อความ, 'any' = อะไรก็ได้
 */
export type ValueType = 'check' | 'number' | 'string' | 'any'

export const VALUE_LABEL: Record<ValueType, string> = {
  check: 'เงื่อนไข (ใช่/ไม่ใช่)',
  number: 'ตัวเลข',
  string: 'ข้อความ',
  any: 'ค่าอะไรก็ได้'
}

/** ค่าชนิดนี้เสียบลงรูที่ต้องการชนิดนั้นได้ไหม */
export const fits = (value: ValueType, slot: ValueType): boolean =>
  value === 'any' || slot === 'any' || value === slot

/** ชื่อหมวดที่โชว์ในกล่องเครื่องมือ — ตายตัว ห้ามให้เกมตั้งเอง */
export const CATEGORY_LABEL: Record<BlockCategory, string> = {
  event: 'เมื่อ…',
  action: 'สั่งให้ทำ',
  sense: 'สิ่งที่มองเห็น',
  control: 'เงื่อนไข / ทำซ้ำ',
  data: 'ตัวเลข / ข้อความ / ตัวแปร'
}

/** ลำดับหมวดในกล่องเครื่องมือ — ตายตัวทุกเกม */
export const CATEGORY_ORDER: BlockCategory[] = ['action', 'sense', 'control', 'data']

export interface BlockNode {
  id: BlockId
  kind: string
  /** ค่าที่เลือกจากดรอปดาวน์หรือช่องกรอก */
  fields: Record<string, string | number>
  /** ช่องเสียบบล็อกค่า */
  inputs: Record<string, BlockNode | null>
  /** ลำดับคำสั่งข้างใน */
  bodies: Record<string, BlockNode[]>
}

export interface SelectOption {
  value: string
  label: string
}

/** ชิ้นส่วนที่เรียงกันเป็นหน้าตาของบล็อก */
export type BlockPart =
  | { type: 'text'; text: string }
  | { type: 'field'; name: string; options: SelectOption[] }
  | { type: 'number'; name: string }
  /** ช่องพิมพ์ข้อความอิสระ */
  | { type: 'string'; name: string; placeholder?: string }
  /** ช่องพิมพ์โค้ดดิบ สำหรับบล็อกที่ห่อโค้ดซึ่งยังไม่มีบล็อกรองรับ */
  | { type: 'code'; name: string }
  | { type: 'input'; name: string; placeholder: string; accepts?: ValueType }
  | { type: 'body'; name: string; label?: string }

export interface EmitContext {
  /** โค้ดของบล็อกค่าที่เสียบอยู่ในช่องนี้ */
  value: (node: BlockNode, slot: string, fallback: string) => string
  /** ค่าจากดรอปดาวน์/ช่องกรอก */
  field: (node: BlockNode, name: string) => string
  /** เขียนหนึ่งบรรทัดแล้วผูกเลขบรรทัดไว้กับบล็อกนี้ */
  line: (node: BlockNode, text: string) => void
  /** เขียนบรรทัดที่ไม่ผูกกับบล็อกไหน เช่น วงเล็บปิด */
  raw: (text: string) => void
  /** ไล่เขียนคำสั่งข้างในบล็อก */
  body: (node: BlockNode, name: string) => void
  indent: (delta: number) => void
}

export interface BlockSpec {
  kind: string
  shape: BlockShape
  category: BlockCategory
  /** บล็อกค่าตัวนี้ให้ค่าชนิดไหน (ใช้เฉพาะ shape = 'value') */
  value?: ValueType
  /** ข้อความบนบล็อก ใช้เป็นชื่อในกล่องเครื่องมือด้วย */
  title: string
  parts: BlockPart[]
  hint?: string
  /**
   * ไม่ต้องโชว์ในกล่องเครื่องมือ (แต่ยังลงทะเบียนไว้ให้ใช้งานได้ตามปกติ)
   * ใช้กับบล็อกที่ระบบสร้างให้เองเท่านั้น เช่น "โค้ดของฉัน" ที่เกิดตอนอ่านโค้ดกลับเป็นบล็อก
   */
  hidden?: boolean
  emit: (node: BlockNode, ctx: EmitContext) => string | void
}

export interface PaletteGroup {
  id: string
  label: string
  category: BlockCategory
  kinds: string[]
}

/**
 * สีประจำหมวด ใช้ทั้งบนบล็อกและในกล่องเครื่องมือ
 * peg คือสีล้วนของบล็อก ใช้วาดเดือยที่สวมกับบล็อกถัดไป
 */
export const CATEGORY_STYLE: Record<BlockCategory, { block: string; chip: string; peg: string }> = {
  event: {
    block: 'bg-yellow-500 text-white ring-yellow-600',
    chip: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    peg: 'bg-yellow-500'
  },
  action: {
    block: 'bg-primary-600 text-white ring-primary-700',
    chip: 'bg-primary-50 text-primary-700 ring-primary-200',
    peg: 'bg-primary-600'
  },
  control: {
    block: 'bg-amber-500 text-white ring-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    peg: 'bg-amber-500'
  },
  sense: {
    block: 'bg-sky-600 text-white ring-sky-700',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200',
    peg: 'bg-sky-600'
  },
  data: {
    block: 'bg-emerald-600 text-white ring-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    peg: 'bg-emerald-600'
  }
}

// ---------- ทะเบียนบล็อกกลาง ----------

const REGISTRY = new Map<string, BlockSpec>()

/** ลงทะเบียนบล็อก — ชุดกลางกับของแต่ละเกมมาเข้าที่เดียวกัน (ชื่อ kind ของเกมใส่ชื่อเกมนำหน้า) */
export function register(specs: BlockSpec[]): void {
  for (const spec of specs) REGISTRY.set(spec.kind, spec)
}

export const findSpec = (kind: string): BlockSpec | undefined => REGISTRY.get(kind)

/**
 * ทำข้อความให้เป็นสตริงในโค้ด JS
 * ต้องหนี \\ ก่อน ' เสมอ ไม่งั้นข้อความที่มี \\ จะทำให้โค้ดที่ได้พัง
 */
export const quote = (value: string) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

/** บล็อกที่ห่อโค้ดดิบไว้ ใช้ตอนแปลงโค้ดกลับเป็นบล็อกแล้วเจอส่วนที่ยังไม่มีบล็อกรองรับ */
export const RAW_STATEMENT = 'raw-code'
export const RAW_VALUE = 'raw-value'
