/**
 * "ทำไมถึงเลือกทางนี้" ของการตัดสินใจหนึ่งครั้ง — บล็อกที่ชั่งหลายตัวเลือกแล้วเลือกหนึ่ง
 * บอกไว้ว่าแต่ละตัวเลือกได้คะแนนเท่าไร มาจากอะไรบ้าง แล้วหน้าจอเอาไปวาดทับสนามกับตาราง
 *
 * ใช้ร่วมทุกเกม — ตัวเลือกในเกมกระดานมีช่อง (at) ให้วาดลงบนช่องได้ เกมอื่นดูจากตารางอย่างเดียว
 */

export interface ReasonOption {
  /** ชื่อตัวเลือกสั้น ๆ เช่น "ขึ้น" หรือ "ช่อง (3, 4)" */
  label: string
  /** ช่องบนสนามที่ตัวเลือกนี้พาไป — มีเฉพาะเกมที่เป็นตาราง */
  at?: { row: number; col: number }
  /** ตัวเลขของตัวเลือกนี้ เรียงตาม columns — ตัวสุดท้ายคือคะแนนที่ใช้ตัดสิน */
  values: number[]
  chosen?: boolean
}

export interface Reason {
  /** คิดเรื่องอะไรอยู่ เช่น "ชั่งความปลอดภัยกับเป้าหมาย" */
  title: string
  /** หัวตารางของ values */
  columns: string[]
  options: ReasonOption[]
  /** สูตรที่ใช้รวมเป็นคะแนน */
  rule?: string
  /** ใครเป็นคนคิด — ฝ่ายไล่มีหลายตัว ใช้บอกว่าเป็นตัวไหน */
  who?: string
}

/** ตัวเลือกต่อหนึ่งการตัดสินใจ — เกินนี้ตารางยาวจนอ่านไม่ไหวอยู่แล้ว */
const MAX_OPTIONS = 24

const MAX_COLUMNS = 6

const text = (value: unknown, limit: number) => String(value ?? '').slice(0, limit)

const number = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * คัดเฉพาะส่วนที่หน้าจอใช้ — ค่าที่ส่งมาจากโค้ดของผู้เล่น จะส่งอะไรมาก็ได้
 * รูปร่างผิดก็ได้ null แทนที่จะพังทั้งเกม
 */
export function cleanReason(raw: unknown): Reason | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  if (!Array.isArray(source.options) || !Array.isArray(source.columns)) return null

  const columns = source.columns.slice(0, MAX_COLUMNS).map((column) => text(column, 40))

  const options = source.options.slice(0, MAX_OPTIONS).flatMap((item): ReasonOption[] => {
    if (!item || typeof item !== 'object') return []
    const option = item as Record<string, unknown>
    const at = option.at as Record<string, unknown> | undefined

    return [
      {
        label: text(option.label, 40),
        at:
          at && Number.isInteger(at.row) && Number.isInteger(at.col)
            ? { row: at.row as number, col: at.col as number }
            : undefined,
        values: Array.isArray(option.values)
          ? option.values.slice(0, columns.length).map(number)
          : [],
        chosen: option.chosen === true
      }
    ]
  })

  return {
    title: text(source.title, 80),
    columns,
    options,
    rule: source.rule === undefined ? undefined : text(source.rule, 200),
    who: source.who === undefined ? undefined : text(source.who, 40)
  }
}
