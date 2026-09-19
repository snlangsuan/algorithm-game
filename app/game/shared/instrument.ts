import { parse } from 'acorn'
import type { Node } from 'acorn'

/**
 * แทรกตัวนับบรรทัดลงในโค้ดของผู้เล่น เพื่อให้หน้าจอบอกได้ว่ากำลังรันบรรทัดไหน
 *
 * แทรกเฉพาะ "หน้าคำสั่งที่อยู่ในบล็อก" เท่านั้น (body ของ Program / { ... } / case)
 * ตำแหน่งพวกนี้แทรกคำสั่งเพิ่มได้เสมอโดยไม่เปลี่ยนความหมายของโค้ด
 * ส่วนที่แทรกไม่ได้ เช่น `if (x)` ที่ไม่มีปีกกา หรือกลางนิพจน์ จะถูกข้ามไป
 *
 * ตัวมาร์กเกอร์ไม่มีการขึ้นบรรทัดใหม่ เลขบรรทัดจึงตรงกับโค้ดต้นฉบับที่ผู้เล่นเห็น
 */
export interface Instrumented {
  code: string
  /** แทรกสำเร็จไหม — ถ้าโค้ดมี syntax error จะคืนโค้ดเดิมและ ok = false */
  ok: boolean
  /** บรรทัดที่มีมาร์กเกอร์ ใช้บอกหน้าจอว่าบรรทัดไหน "นับได้" */
  lines: number[]
}

interface Mark {
  index: number
  line: number
}

const STATEMENT = /(?:Statement|Declaration)$/

/** ไล่เก็บตำแหน่งเริ่มต้นของทุกคำสั่งที่อยู่ในบล็อก */
function collect(node: unknown, marks: Mark[], seen: Set<unknown>): void {
  if (!node || typeof node !== 'object') return
  if (seen.has(node)) return
  seen.add(node)

  if (Array.isArray(node)) {
    for (const child of node) collect(child, marks, seen)
    return
  }

  const current = node as Node & Record<string, unknown>
  if (typeof current.type !== 'string') return

  // body ของ Program / BlockStatement / StaticBlock และ consequent ของ case
  const blocks: unknown[] = []
  if (current.type === 'Program' || current.type === 'BlockStatement' || current.type === 'StaticBlock') {
    blocks.push(current.body)
  } else if (current.type === 'SwitchCase') {
    blocks.push(current.consequent)
  }

  for (const block of blocks) {
    if (!Array.isArray(block)) continue

    for (const item of block) {
      const statement = item as Node | undefined
      if (!statement || !STATEMENT.test(statement.type)) continue
      if (!statement.loc) continue

      marks.push({ index: statement.start, line: statement.loc.start.line })
    }
  }

  for (const key of Object.keys(current)) {
    if (key === 'loc' || key === 'range' || key === 'parent') continue
    collect(current[key], marks, seen)
  }
}

export function instrument(source: string, marker: string): Instrumented {
  try {
    const ast = parse(source, {
      ecmaVersion: 'latest',
      locations: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true
    })

    const marks: Mark[] = []
    collect(ast, marks, new Set())

    if (marks.length === 0) return { code: source, ok: true, lines: [] }

    // แทรกจากท้ายไปหน้า ตำแหน่งที่ยังไม่ได้แทรกจะได้ไม่เลื่อน
    marks.sort((a, b) => b.index - a.index)

    let code = source
    const lines = new Set<number>()

    for (const mark of marks) {
      code = `${code.slice(0, mark.index)}${marker}(${mark.line});${code.slice(mark.index)}`
      lines.add(mark.line)
    }

    return { code, ok: true, lines: [...lines].sort((a, b) => a - b) }
  } catch {
    // โค้ดผิดไวยากรณ์ — ปล่อยผ่านไปให้ new Function() เป็นคนฟ้อง จะได้ข้อความที่ผู้เล่นอ่านรู้เรื่องกว่า
    return { code: source, ok: false, lines: [] }
  }
}
