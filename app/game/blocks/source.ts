/**
 * ตัดโค้ดของเมธอดหนึ่งตัวออกมาจากคลาส — ให้ปุ่ม "ดูโค้ดจริง" ของบล็อกโชว์ของที่รันจริง
 * ไม่ใช่โค้ดที่เขียนแยกไว้อธิบายแล้วค่อย ๆ เพี้ยนไปจากของจริง
 *
 * คอมเมนต์ที่อยู่ติดเหนือเมธอดติดมาด้วย เพราะมักเป็นเหตุผลว่าทำไมเขียนแบบนี้
 */

/** หาปีกกาปิดที่คู่กับปีกกาเปิดตำแหน่ง open — ข้ามข้อความในเครื่องหมายคำพูดและคอมเมนต์ */
function closing(source: string, open: number): number {
  // ปีกกาแต่ละชั้นจำไว้ว่าเปิดจาก ${ ในข้อความ `...` หรือเปิดในโค้ดปกติ
  const stack: Array<'code' | 'template'> = []
  let i = open

  while (i < source.length) {
    const char = source[i]!
    const next = source[i + 1]

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      i = end < 0 ? source.length : end
      continue
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 2
      continue
    }

    if (char === "'" || char === '"') {
      i++
      while (i < source.length && source[i] !== char) i += source[i] === '\\' ? 2 : 1
      i++
      continue
    }

    if (char === '`') {
      i = template(source, i + 1, stack)
      continue
    }

    if (char === '{') stack.push('code')

    if (char === '}') {
      const kind = stack.pop()
      if (stack.length === 0) return i
      if (kind === 'template') {
        i = template(source, i + 1, stack)
        continue
      }
    }

    i++
  }

  return -1
}

/** อ่านข้อความ `...` จนจบ หรือจนเจอ ${ ซึ่งจะกลับไปอ่านเป็นโค้ดต่อ */
function template(source: string, start: number, stack: Array<'code' | 'template'>): number {
  let i = start

  while (i < source.length) {
    const char = source[i]
    if (char === '\\') {
      i += 2
      continue
    }
    if (char === '`') return i + 1
    if (char === '$' && source[i + 1] === '{') {
      stack.push('template')
      return i + 2
    }
    i++
  }

  return i
}

/** คอมเมนต์ที่อยู่ติดเหนือบรรทัด start — หยุดที่บรรทัดว่างหรือบรรทัดโค้ด */
function leadingComment(lines: string[], start: number): number {
  let top = start
  let inBlock = false

  for (let index = start - 1; index >= 0; index--) {
    const text = lines[index]!.trim()

    if (inBlock) {
      top = index
      if (text.startsWith('/*')) inBlock = false
      continue
    }

    if (text.startsWith('//')) top = index
    else if (text.endsWith('*/')) {
      top = index
      inBlock = !text.startsWith('/*')
    } else break
  }

  return top
}

function dedent(text: string): string {
  const lines = text.split('\n')
  const widths = lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)![0].length)
  const cut = widths.length > 0 ? Math.min(...widths) : 0
  return lines.map((line) => line.slice(cut)).join('\n')
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * โค้ดของเมธอดชื่อ name ใน source — ไม่เจอได้ null
 *
 * นับเฉพาะบรรทัดที่ขึ้นต้นด้วยชื่อเมธอด (จะมี private/async/static หรือ export function นำหน้าก็ได้)
 * บรรทัดที่เรียกใช้เมธอดนั้นอยู่กลางบรรทัดจึงไม่ถูกนับผิด
 */
export function methodSource(source: string, name: string): string | null {
  const head = new RegExp(
    `^[ \\t]*(?:(?:export|function|private|protected|public|static|async|override|readonly)\\s+)*${escape(name)}\\s*(?:<[^>\\n]*>)?\\(`,
    'gm'
  )

  for (let found = head.exec(source); found; found = head.exec(source)) {
    const code = bodyAt(source, found.index, found.index + found[0].length - 1)
    if (code) return code
  }

  // ฟังก์ชันลูกศร: export const name = (...) => { ... }
  const arrow = new RegExp(`^[ \\t]*(?:export\\s+)?const\\s+${escape(name)}\\s*=\\s*(?:async\\s*)?\\(`, 'm')
  const found = arrow.exec(source)
  if (found) return arrowAt(source, found.index, found.index + found[0].length - 1)

  return null
}

/** ข้ามวงเล็บพารามิเตอร์ที่เปิดตรง paren — คืนตำแหน่งวงเล็บปิด */
function closeParen(source: string, paren: number): number {
  let depth = 0
  for (let i = paren; i < source.length; i++) {
    if (source[i] === '(') depth++
    if (source[i] === ')' && --depth === 0) return i
  }
  return -1
}

/** ตัดตั้งแต่คอมเมนต์เหนือบรรทัด start ถึงปีกกาปิดตำแหน่ง end */
function cut(source: string, start: number, end: number): string {
  const lines = source.split('\n')
  const first = source.slice(0, start).split('\n').length - 1
  const top = leadingComment(lines, first)
  const before = lines.slice(top, first).join('\n')

  return dedent((before ? `${before}\n` : '') + source.slice(start, end + 1).replace(/^\n+/, ''))
}

/**
 * เนื้อเมธอดที่เริ่มตรงนี้ — ต้องมีปีกกาเปิดตามหลังวงเล็บพารามิเตอร์ทันที (มีชนิดของค่าที่คืนคั่นได้)
 * บรรทัดที่เป็นแค่การประกาศใน interface เช่น push(value: T): void จึงไม่ถูกนับ
 */
function bodyAt(source: string, start: number, paren: number): string | null {
  const close = closeParen(source, paren)
  if (close < 0) return null

  const open = source.indexOf('{', close)
  if (open < 0 || !/^\s*(?::[^;{\n]*)?\s*$/.test(source.slice(close + 1, open))) return null

  const end = closing(source, open)
  return end < 0 ? null : cut(source, start, end)
}

/** ฟังก์ชันลูกศร — เนื้อเป็นปีกกาก็ตัดถึงปีกกาปิด เป็นนิพจน์ก็ตัดถึงสิ้นบรรทัดที่ไม่มีอะไรค้าง */
function arrowAt(source: string, start: number, paren: number): string | null {
  const close = closeParen(source, paren)
  if (close < 0) return null

  const arrow = source.indexOf('=>', close)
  if (arrow < 0) return null

  const after = source.slice(arrow + 2).match(/^\s*/)![0].length + arrow + 2
  if (source[after] === '{') {
    const end = closing(source, after)
    return end < 0 ? null : cut(source, start, end)
  }

  // นิพจน์ยาวหลายบรรทัดได้ — จบที่บรรทัดแรกที่วงเล็บทุกชนิดปิดครบ
  let depth = 0
  for (let i = after; i < source.length; i++) {
    const char = source[i]
    if ('([{'.includes(char!)) depth++
    if (')]}'.includes(char!)) depth--
    if (char === '\n' && depth <= 0) return cut(source, start, i - 1)
  }
  return cut(source, start, source.length - 1)
}
