export type BlockId = string

export type AuthorMode = 'blocks' | 'code'

export type BlockShape = 'hat' | 'statement' | 'value'

export type BlockCategory = 'event' | 'action' | 'sense' | 'control' | 'data'

export type ValueType = 'check' | 'number' | 'string' | 'any'

export const VALUE_LABEL: Record<ValueType, string> = {
  check: 'เงื่อนไข (ใช่/ไม่ใช่)',
  number: 'ตัวเลข',
  string: 'ข้อความ',
  any: 'ค่าอะไรก็ได้'
}

export const fits = (value: ValueType, slot: ValueType): boolean =>
  value === 'any' || slot === 'any' || value === slot

export const CATEGORY_LABEL: Record<BlockCategory, string> = {
  event: 'เมื่อ…',
  action: 'สั่งให้ทำ',
  sense: 'สิ่งที่มองเห็น',
  control: 'เงื่อนไข / ทำซ้ำ',
  data: 'ตัวเลข / ข้อความ / ตัวแปร'
}

export const CATEGORY_ORDER: BlockCategory[] = ['action', 'sense', 'control', 'data']

export interface BlockNode {
  id: BlockId
  kind: string

  fields: Record<string, string | number>

  inputs: Record<string, BlockNode | null>

  bodies: Record<string, BlockNode[]>
}

export interface SelectOption {
  value: string
  label: string
}

export type BlockPart =
  | { type: 'text'; text: string }
  | { type: 'field'; name: string; options: SelectOption[] }
  | { type: 'number'; name: string }

  | { type: 'string'; name: string; placeholder?: string }

  | { type: 'code'; name: string }
  | { type: 'input'; name: string; placeholder: string; accepts?: ValueType }
  | { type: 'body'; name: string; label?: string }

export interface EmitContext {

  value: (node: BlockNode, slot: string, fallback: string) => string

  field: (node: BlockNode, name: string) => string

  line: (node: BlockNode, text: string) => void

  raw: (text: string) => void

  body: (node: BlockNode, name: string) => void
  indent: (delta: number) => void
}

/**
 * เปิดกล่องดำของบล็อกหนึ่งตัว — อ่านจากบนลงล่างแล้วต้องเขียนตามเองได้
 *
 * เขียนเป็นภาษาคน ไม่ใช่ภาษาโค้ด ตัวเลขที่ตั้งไว้ในบล็อกต้องบอกหมดว่าเท่าไรและทำไม
 */
export interface BlockExplain {
  /** ใจความในหนึ่งถึงสองประโยค — บล็อกนี้แก้ปัญหาอะไร ด้วยความคิดแบบไหน */
  idea: string
  /** ทำอะไรทีละขั้น ทุกครั้งที่บล็อกทำงาน */
  steps: string[]
  /** สูตรหรือกติกาการเลือก ถ้ามี — แสดงเป็นบรรทัดเด่น */
  rule?: string
  /** ตัวเลขที่ฝังอยู่ในบล็อก ค่าเท่าไร และทำไมถึงเป็นค่านั้น */
  knobs?: Array<{ name: string; value: string; why: string }>
  /** ตรงไหนที่บล็อกนี้พลาดได้ — ให้รู้ว่าเมื่อไรควรเลือกบล็อกอื่น */
  weakness?: string
  /** ชื่อเมธอดที่ทำงานจริง — ปุ่ม "ดูโค้ดจริง" ดึงโค้ดของเมธอดเหล่านี้มาให้ดู */
  code?: string[]
  /** slug ของหน้าความรู้ใน /learn ที่อธิบายเรื่องนี้ละเอียดกว่า */
  learn?: string
  /** บอกว่าแกะกล่องแล้วจะได้บล็อกย่อยหน้าตาแบบไหน — ใส่เฉพาะบล็อกที่มี unpack */
  unpacks?: string
}

export interface BlockSpec {
  kind: string
  shape: BlockShape
  category: BlockCategory

  value?: ValueType

  title: string
  parts: BlockPart[]
  hint?: string

  /** คำอธิบายเต็มว่าข้างในบล็อกคิดยังไง — บล็อกที่ซ่อนอัลกอริทึมไว้ต้องมี ไม่งั้นเด็กเห็นแค่กล่องดำ */
  explain?: BlockExplain

  /** ชุดบล็อกที่บล็อกนี้สังกัด — createPack เติมให้ ใช้หาโค้ดจริงของบล็อก */
  pack?: string

  /**
   * แกะกล่อง — บล็อกย่อยที่ทำงานเหมือนบล็อกนี้ทุกประการ ให้เด็กเห็นข้างในแล้วแก้ต่อเองได้
   * ต้องได้ผลเหมือนเดิมเป๊ะทุกก้าว (มีเทสต์เทียบ) ไม่ใช่แค่ "คล้าย ๆ"
   */
  unpack?: (node: BlockNode) => BlockNode[]

  hidden?: boolean
  emit: (node: BlockNode, ctx: EmitContext) => string | void
}

export interface PaletteGroup {
  id: string
  label: string
  category: BlockCategory
  kinds: string[]
}

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

const REGISTRY = new Map<string, BlockSpec>()

export function register(specs: BlockSpec[]): void {
  for (const spec of specs) REGISTRY.set(spec.kind, spec)
}

export const findSpec = (kind: string): BlockSpec | undefined => REGISTRY.get(kind)

export const quote = (value: string) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

export const RAW_STATEMENT = 'raw-code'
export const RAW_VALUE = 'raw-value'
