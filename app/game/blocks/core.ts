import { RAW_STATEMENT, RAW_VALUE, quote, register, type BlockSpec, type SelectOption } from './types'

/** บล็อกที่ใช้ได้เฉพาะเกมที่มีความจำข้ามเกม */
const MEMORY_KINDS = new Set(['remember', 'recall', 'forget'])

/**
 * บล็อกชุดกลาง — เงื่อนไข ทำซ้ำ ตรรกะ ตัวเลข ตัวแปร
 * ทุกเกมได้ชุดนี้ไปใช้เหมือนกันหมด ต่างกันแค่บล็อกเฉพาะเกมที่เติมเข้าไป
 */

export const VARIABLES: SelectOption[] = [
  { value: 'a', label: 'ก' },
  { value: 'b', label: 'ข' },
  { value: 'c', label: 'ค' }
]

const COMPARISONS: SelectOption[] = [
  { value: 'lt', label: 'น้อยกว่า' },
  { value: 'lte', label: 'ไม่เกิน' },
  { value: 'eq', label: 'เท่ากับ' },
  { value: 'ne', label: 'ไม่เท่ากับ' },
  { value: 'gte', label: 'ไม่น้อยกว่า' },
  { value: 'gt', label: 'มากกว่า' }
]

/** ฟังก์ชันคณิตที่ใช้บ่อย รวมไว้ในบล็อกเดียวแล้วเลือกจากดรอปดาวน์ */
const FUNCTIONS: SelectOption[] = [
  { value: 'mod', label: 'เศษจากการหาร' },
  { value: 'min', label: 'ค่าที่น้อยกว่า' },
  { value: 'max', label: 'ค่าที่มากกว่า' },
  { value: 'pow', label: 'ยกกำลัง' }
]

const SINGLE: SelectOption[] = [
  { value: 'abs', label: 'ค่าสัมบูรณ์' },
  { value: 'round', label: 'ปัดเศษ' },
  { value: 'floor', label: 'ปัดลง' },
  { value: 'ceil', label: 'ปัดขึ้น' },
  { value: 'sqrt', label: 'รากที่สอง' }
]

const BOOLEANS: SelectOption[] = [
  { value: 'true', label: 'จริง' },
  { value: 'false', label: 'เท็จ' }
]

const MATH: SelectOption[] = [
  { value: 'add', label: '+' },
  { value: 'sub', label: '−' },
  { value: 'mul', label: '×' },
  { value: 'div', label: '÷' }
]

const COMPARE_OPS: Record<string, string> = {
  lt: '<',
  lte: '<=',
  eq: '===',
  ne: '!==',
  gte: '>=',
  gt: '>'
}
const MATH_OPS: Record<string, string> = { add: '+', sub: '-', mul: '*', div: '/' }

export const CORE_BLOCKS: BlockSpec[] = [
  {
    kind: RAW_STATEMENT,
    shape: 'statement',
    category: 'data',
    hidden: true,
    title: 'โค้ดของฉัน',
    hint: 'ใส่โค้ด JavaScript ตรง ๆ — ใช้ตอนที่ยังไม่มีบล็อกรองรับสิ่งที่อยากทำ',
    parts: [
      { type: 'text', text: 'โค้ด' },
      { type: 'code', name: 'code' }
    ],
    emit: (node, ctx) => {
      const source = String(node.fields.code ?? '').split('\n')
      const first = source.shift() ?? ''

      ctx.line(node, first)
      for (const line of source) ctx.raw(line)
    }
  },
  {
    kind: RAW_VALUE,
    shape: 'value',
    value: 'any',
    category: 'data',
    hidden: true,
    title: 'ค่าจากโค้ด',
    hint: 'นิพจน์ JavaScript ตรง ๆ เช่น state.turn * 2',
    parts: [{ type: 'code', name: 'code' }],
    emit: (node) => String(node.fields.code ?? '0')
  },
  {
    kind: 'if',
    shape: 'statement',
    category: 'control',
    title: 'ถ้า',
    hint: 'ทำคำสั่งข้างในเฉพาะตอนที่เงื่อนไขเป็นจริง',
    parts: [
      { type: 'text', text: 'ถ้า' },
      { type: 'input', name: 'cond', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'text', text: 'แล้ว' },
      { type: 'body', name: 'then' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `if (${ctx.value(node, 'cond', 'false')}) {`)
      ctx.indent(1)
      ctx.body(node, 'then')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'if-else',
    shape: 'statement',
    category: 'control',
    title: 'ถ้า / ไม่งั้น',
    hint: 'เงื่อนไขจริงทำอย่างหนึ่ง ไม่จริงทำอีกอย่าง',
    parts: [
      { type: 'text', text: 'ถ้า' },
      { type: 'input', name: 'cond', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'text', text: 'แล้ว' },
      { type: 'body', name: 'then' },
      { type: 'body', name: 'else', label: 'ไม่งั้น' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `if (${ctx.value(node, 'cond', 'false')}) {`)
      ctx.indent(1)
      ctx.body(node, 'then')
      ctx.indent(-1)
      ctx.raw('} else {')
      ctx.indent(1)
      ctx.body(node, 'else')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'repeat',
    shape: 'statement',
    category: 'control',
    title: 'ทำซ้ำ',
    parts: [
      { type: 'text', text: 'ทำซ้ำ' },
      { type: 'number', name: 'times' },
      { type: 'text', text: 'ครั้ง' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `for (let รอบ = 0; รอบ < ${Number(ctx.field(node, 'times')) || 0}; รอบ++) {`)
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'while',
    shape: 'statement',
    category: 'control',
    title: 'ทำซ้ำตราบใดที่',
    hint: 'ระวังเงื่อนไขที่ไม่มีวันเป็นเท็จ — โปรแกรมที่วนไม่จบจะถูกตัดเมื่อคิดนานเกินไป',
    parts: [
      { type: 'text', text: 'ทำซ้ำตราบใดที่' },
      { type: 'input', name: 'cond', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `while (${ctx.value(node, 'cond', 'false')}) {`)
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },

  {
    kind: 'repeat-until',
    shape: 'statement',
    category: 'control',
    title: 'ทำซ้ำจนกว่า',
    hint: 'ทำไปเรื่อย ๆ จนกว่าเงื่อนไขจะเป็นจริง',
    parts: [
      { type: 'text', text: 'ทำซ้ำจนกว่า' },
      { type: 'input', name: 'cond', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `while (!(${ctx.value(node, 'cond', 'true')})) {`)
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'for-each',
    shape: 'statement',
    category: 'control',
    title: 'สำหรับแต่ละค่าในลิสต์',
    hint: 'หยิบค่าในลิสต์มาทีละตัว ใส่ไว้ในตัวแปรที่เลือก แล้วทำคำสั่งข้างใน',
    parts: [
      { type: 'text', text: 'เอาแต่ละค่าในลิสต์' },
      { type: 'field', name: 'list', options: VARIABLES },
      { type: 'text', text: 'ใส่' },
      { type: 'field', name: 'item', options: VARIABLES },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(
        node,
        `for (this.vars.${ctx.field(node, 'item')} of this.list('${ctx.field(node, 'list')}')) {`
      )
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },

  // ----- ตรรกะ -----
  {
    kind: 'not',
    shape: 'value',
    value: 'check',
    category: 'control',
    title: 'ไม่',
    parts: [
      { type: 'text', text: 'ไม่' },
      { type: 'input', name: 'value', placeholder: 'เงื่อนไข', accepts: 'check' }
    ],
    emit: (node, ctx) => `!(${ctx.value(node, 'value', 'false')})`
  },
  {
    kind: 'and',
    shape: 'value',
    value: 'check',
    category: 'control',
    title: 'และ',
    parts: [
      { type: 'input', name: 'left', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'text', text: 'และ' },
      { type: 'input', name: 'right', placeholder: 'เงื่อนไข', accepts: 'check' }
    ],
    emit: (node, ctx) => `(${ctx.value(node, 'left', 'false')} && ${ctx.value(node, 'right', 'false')})`
  },
  {
    kind: 'or',
    shape: 'value',
    value: 'check',
    category: 'control',
    title: 'หรือ',
    parts: [
      { type: 'input', name: 'left', placeholder: 'เงื่อนไข', accepts: 'check' },
      { type: 'text', text: 'หรือ' },
      { type: 'input', name: 'right', placeholder: 'เงื่อนไข', accepts: 'check' }
    ],
    emit: (node, ctx) => `(${ctx.value(node, 'left', 'false')} || ${ctx.value(node, 'right', 'false')})`
  },

  {
    kind: 'bool',
    shape: 'value',
    value: 'check',
    category: 'control',
    title: 'จริง / เท็จ',
    parts: [{ type: 'field', name: 'value', options: BOOLEANS }],
    emit: (node, ctx) => (ctx.field(node, 'value') === 'true' ? 'true' : 'false')
  },

  // ----- ตัวเลขและตัวแปร -----
  {
    kind: 'number',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'ตัวเลข',
    parts: [{ type: 'number', name: 'value' }],
    emit: (node, ctx) => String(Number(ctx.field(node, 'value')) || 0)
  },
  {
    kind: 'text',
    shape: 'value',
    value: 'string',
    category: 'data',
    title: 'ข้อความ',
    hint: 'ข้อความตายตัว เช่น ใช้พิมพ์บอกว่าโปรแกรมทำอะไรอยู่',
    parts: [{ type: 'string', name: 'value', placeholder: 'ข้อความ' }],
    emit: (node, ctx) => quote(ctx.field(node, 'value'))
  },
  {
    kind: 'join',
    shape: 'value',
    value: 'string',
    category: 'data',
    title: 'ต่อข้อความ',
    hint: 'เอาสองค่ามาต่อกันเป็นข้อความเดียว เช่น "ก้าวที่ " ต่อกับ ค่าของ ก',
    parts: [
      { type: 'input', name: 'left', placeholder: 'ข้อความ' },
      { type: 'text', text: 'ต่อกับ' },
      { type: 'input', name: 'right', placeholder: 'ค่า' }
    ],
    // ใช้ template literal ไม่ใช่ + เพราะตอนอ่านโค้ดกลับจะได้แยกออกจากบล็อก "คำนวณ" (บวก)
    emit: (node, ctx) =>
      `\`\${${ctx.value(node, 'left', "''")}}\${${ctx.value(node, 'right', "''")}}\``
  },
  {
    kind: 'compare',
    shape: 'value',
    value: 'check',
    category: 'control',
    title: 'เปรียบเทียบ',
    parts: [
      { type: 'input', name: 'left', placeholder: 'ค่า' },
      { type: 'field', name: 'op', options: COMPARISONS },
      { type: 'input', name: 'right', placeholder: 'ค่า' }
    ],
    emit: (node, ctx) =>
      `(${ctx.value(node, 'left', '0')} ${COMPARE_OPS[ctx.field(node, 'op')] ?? '==='} ${ctx.value(node, 'right', '0')})`
  },
  {
    kind: 'math',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'คำนวณ',
    parts: [
      { type: 'input', name: 'left', placeholder: 'ตัวเลข', accepts: 'number' },
      { type: 'field', name: 'op', options: MATH },
      { type: 'input', name: 'right', placeholder: 'ตัวเลข', accepts: 'number' }
    ],
    emit: (node, ctx) =>
      `(${ctx.value(node, 'left', '0')} ${MATH_OPS[ctx.field(node, 'op')] ?? '+'} ${ctx.value(node, 'right', '0')})`
  },
  {
    kind: 'math-fn',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'ฟังก์ชันสองค่า',
    parts: [
      { type: 'field', name: 'fn', options: FUNCTIONS },
      { type: 'text', text: 'ของ' },
      { type: 'input', name: 'left', placeholder: 'ตัวเลข', accepts: 'number' },
      { type: 'text', text: 'กับ' },
      { type: 'input', name: 'right', placeholder: 'ตัวเลข', accepts: 'number' }
    ],
    emit: (node, ctx) => {
      const left = ctx.value(node, 'left', '0')
      const right = ctx.value(node, 'right', '1')

      switch (ctx.field(node, 'fn')) {
        case 'mod':
          return `(${left} % ${right})`
        case 'min':
          return `Math.min(${left}, ${right})`
        case 'max':
          return `Math.max(${left}, ${right})`
        default:
          return `Math.pow(${left}, ${right})`
      }
    }
  },
  {
    kind: 'math-one',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'ฟังก์ชันค่าเดียว',
    parts: [
      { type: 'field', name: 'fn', options: SINGLE },
      { type: 'text', text: 'ของ' },
      { type: 'input', name: 'value', placeholder: 'ตัวเลข', accepts: 'number' }
    ],
    emit: (node, ctx) => `Math.${ctx.field(node, 'fn')}(${ctx.value(node, 'value', '0')})`
  },
  {
    kind: 'random',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'สุ่มตัวเลข',
    parts: [
      { type: 'text', text: 'สุ่ม' },
      { type: 'number', name: 'min' },
      { type: 'text', text: 'ถึง' },
      { type: 'number', name: 'max' }
    ],
    emit: (node, ctx) => {
      const min = Number(ctx.field(node, 'min')) || 0
      const span = Math.max(1, (Number(ctx.field(node, 'max')) || 0) - min + 1)
      return min === 0
        ? `Math.floor(Math.random() * ${span})`
        : `(Math.floor(Math.random() * ${span}) + ${min})`
    }
  },
  {
    kind: 'set-var',
    shape: 'statement',
    category: 'data',
    title: 'ตั้งค่าตัวแปร',
    hint: 'ค่าของตัวแปรอยู่ข้ามตา จำอะไรไว้ใช้ตาหน้าก็ได้',
    parts: [
      { type: 'text', text: 'ตั้งค่า' },
      { type: 'field', name: 'name', options: VARIABLES },
      { type: 'text', text: 'เป็น' },
      { type: 'input', name: 'value', placeholder: 'ค่า' }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `this.vars.${ctx.field(node, 'name')} = ${ctx.value(node, 'value', '0')}`)
  },
  {
    kind: 'change-var',
    shape: 'statement',
    category: 'data',
    title: 'เพิ่มค่าตัวแปร',
    parts: [
      { type: 'text', text: 'เพิ่มค่า' },
      { type: 'field', name: 'name', options: VARIABLES },
      { type: 'text', text: 'อีก' },
      { type: 'input', name: 'value', placeholder: 'ค่า' }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `this.vars.${ctx.field(node, 'name')} += ${ctx.value(node, 'value', '1')}`)
  },
  {
    kind: 'list-clear',
    shape: 'statement',
    category: 'data',
    title: 'ล้างลิสต์',
    hint: 'ทำให้ตัวแปรนั้นกลายเป็นลิสต์ว่าง',
    parts: [
      { type: 'text', text: 'ล้างลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) => ctx.line(node, `this.vars.${ctx.field(node, 'name')} = []`)
  },
  {
    kind: 'list-push',
    shape: 'statement',
    category: 'data',
    title: 'เพิ่มค่าเข้าลิสต์',
    parts: [
      { type: 'text', text: 'เพิ่ม' },
      { type: 'input', name: 'value', placeholder: 'ค่า' },
      { type: 'text', text: 'เข้าลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `this.list('${ctx.field(node, 'name')}').push(${ctx.value(node, 'value', '0')})`)
  },
  {
    kind: 'list-length',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'จำนวนค่าในลิสต์',
    parts: [
      { type: 'text', text: 'จำนวนค่าในลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) => `this.list('${ctx.field(node, 'name')}').length`
  },
  {
    kind: 'list-item',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'ค่าลำดับที่',
    hint: 'ค่าตัวแรกของลิสต์คือลำดับที่ 1',
    parts: [
      { type: 'text', text: 'ค่าลำดับที่' },
      { type: 'input', name: 'index', placeholder: 'ลำดับ', accepts: 'number' },
      { type: 'text', text: 'ของลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) =>
      `this.at('${ctx.field(node, 'name')}', ${ctx.value(node, 'index', '1')})`
  },
  {
    kind: 'list-has',
    shape: 'value',
    value: 'check',
    category: 'data',
    title: 'ลิสต์มีค่านี้',
    parts: [
      { type: 'text', text: 'ลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES },
      { type: 'text', text: 'มีค่า' },
      { type: 'input', name: 'value', placeholder: 'ค่า' }
    ],
    emit: (node, ctx) =>
      `this.list('${ctx.field(node, 'name')}').includes(${ctx.value(node, 'value', '0')})`
  },
  {
    kind: 'list-put',
    shape: 'statement',
    category: 'data',
    title: 'แก้ค่าในลิสต์',
    hint: 'เปลี่ยนค่าลำดับที่ระบุของลิสต์ (ลำดับแรกคือ 1)',
    parts: [
      { type: 'text', text: 'ตั้งค่าลำดับที่' },
      { type: 'input', name: 'index', placeholder: 'ลำดับ', accepts: 'number' },
      { type: 'text', text: 'ของลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES },
      { type: 'text', text: 'เป็น' },
      { type: 'input', name: 'value', placeholder: 'ค่า' }
    ],
    emit: (node, ctx) =>
      ctx.line(
        node,
        `this.put('${ctx.field(node, 'name')}', ${ctx.value(node, 'index', '1')}, ${ctx.value(node, 'value', '0')})`
      )
  },
  {
    kind: 'remember',
    shape: 'statement',
    category: 'data',
    title: 'จำไว้ข้ามเกม',
    hint: 'บันทึกค่าลงเครื่อง เกมหน้าเปิดมาก็ยังอยู่',
    parts: [
      { type: 'text', text: 'จำ' },
      { type: 'input', name: 'value', placeholder: 'ค่า' },
      { type: 'text', text: 'ไว้ในช่อง' },
      { type: 'field', name: 'slot', options: VARIABLES }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `this.remember('${ctx.field(node, 'slot')}', ${ctx.value(node, 'value', '0')})`)
  },
  {
    kind: 'recall',
    shape: 'value',
    value: 'any',
    category: 'data',
    title: 'ค่าที่จำไว้',
    hint: 'ค่าที่เคยจำไว้ข้ามเกม (ยังไม่เคยจำจะได้ 0)',
    parts: [
      { type: 'text', text: 'ค่าที่จำไว้ในช่อง' },
      { type: 'field', name: 'slot', options: VARIABLES }
    ],
    emit: (node, ctx) => `this.recall('${ctx.field(node, 'slot')}')`
  },
  {
    kind: 'forget',
    shape: 'statement',
    category: 'data',
    title: 'ลืมทั้งหมด',
    parts: [{ type: 'text', text: 'ลืมความจำทั้งหมด' }],
    emit: (node, ctx) => ctx.line(node, 'this.saveMemory({})')
  },
  {
    kind: 'log',
    shape: 'statement',
    category: 'action',
    title: 'พิมพ์ลงคอนโซล',
    hint: 'ส่งค่าไปแสดงในแผงคอนโซล ใช้ดูว่าโปรแกรมคิดอะไรอยู่',
    parts: [
      { type: 'text', text: 'พิมพ์' },
      { type: 'input', name: 'value', placeholder: 'ค่า' },
      { type: 'text', text: 'ลงคอนโซล' }
    ],
    emit: (node, ctx) => ctx.line(node, `this.print(${ctx.value(node, 'value', "''")})`)
  },
  {
    kind: 'var-get',
    shape: 'value',
    value: 'number',
    category: 'data',
    title: 'ค่าของตัวแปร',
    parts: [
      { type: 'text', text: 'ค่าของ' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) => `this.vars.${ctx.field(node, 'name')}`
  }
]

/** บล็อกกลางที่เกมนั้นใช้ได้ — เกมที่มีความจำข้ามเกมจะได้บล็อก "จำไว้" เพิ่มมาด้วย */
export function coreBlocksOf(memory: boolean): BlockSpec[] {
  return memory ? CORE_BLOCKS : CORE_BLOCKS.filter((block) => !MEMORY_KINDS.has(block.kind))
}

/**
 * ตัวช่วยกลางที่ทุกเกมได้ไปเหมือนกัน — ทำให้บล็อกลิสต์ใช้งานได้
 * โดยไม่ต้องตั้งค่าตัวแปรให้เป็นลิสต์ก่อน
 */
export const CORE_HELPERS = `
  // ---------- ตัวช่วยกลาง ----------

  // อ่านตัวแปรเป็นลิสต์ ถ้ายังไม่ใช่ลิสต์จะเปลี่ยนให้เป็นลิสต์ว่างก่อน
  list(name) {
    if (!Array.isArray(this.vars[name])) this.vars[name] = []
    return this.vars[name]
  }

  // ค่าลำดับที่ n ของลิสต์ (เริ่มนับจาก 1) ไม่มีก็คืน 0
  at(name, index) {
    return this.list(name)[Math.trunc(index) - 1] ?? 0
  }

  // ส่งค่าไปแสดงในแผงคอนโซลของเกม
  print(value) {
    __log(value)
  }

  // แก้ค่าลำดับที่ n ของลิสต์
  put(name, index, value) {
    const spot = Math.trunc(index) - 1
    if (spot >= 0) this.list(name)[spot] = value
  }

  // ---------- ความจำข้ามเกม ----------

  // จำค่าลงเครื่อง เกมหน้าเปิดมาก็ยังอยู่
  remember(slot, value) {
    const box = { ...(this.memory ?? {}) }
    box[slot] = value
    box.label = 'จำไว้ ' + Object.keys(box).filter((key) => key !== 'label').length + ' ช่อง'
    this.saveMemory(box)
  }

  // อ่านค่าที่จำไว้ (คืนสำเนา จะได้แก้ต่อโดยไม่กระทบของที่เก็บไว้)
  recall(slot) {
    const value = this.memory?.[slot]
    if (Array.isArray(value)) return [...value]
    return value ?? 0
  }`

register(CORE_BLOCKS)
