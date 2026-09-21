import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'

/**
 * ชุดบล็อกของหุ่นเดินตามเส้น — สั่งได้อย่างเดียวคือกำลังมอเตอร์สองข้าง
 *
 * ของสำคัญที่สุดในกล่องนี้คือบล็อก "ตำแหน่งเส้น" ซึ่งบอกเป็นตัวเลขว่าเส้นเบี่ยงไปทางไหนแค่ไหน
 * กฎที่ดูแค่ว่าเซนเซอร์ "เห็นหรือไม่เห็น" เลี้ยวได้แค่สุดทางหรือไม่เลี้ยวเลย
 * ส่วนกฎที่ใช้ตัวเลขนี้ เลี้ยวแรงหรือเบาได้ตามที่เบี่ยงจริง — นั่นคือหัวใจของตัวควบคุม P และ PID
 */

/** เซนเซอร์ห้าตัวเรียงจากซ้ายไปขวาของตัวหุ่น — ค่าเป็นลำดับที่ agent ใช้ */
const SENSORS: SelectOption[] = [
  { value: '0', label: 'ซ้ายสุด' },
  { value: '1', label: 'ซ้าย' },
  { value: '2', label: 'กลาง' },
  { value: '3', label: 'ขวา' },
  { value: '4', label: 'ขวาสุด' }
]

const COLORS: SelectOption[] = [
  { value: 'red', label: 'แดง' },
  { value: 'black', label: 'ดำ' }
]

const HAT: BlockSpec = {
  kind: 'line.on-tick',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงเวลาตัดสินใจ',
  hint: 'ทำงาน 30 ครั้งต่อวินาที — บล็อกสั่งมอเตอร์ตัวแรกที่ทำงานคือคำสั่งของครั้งนั้น',
  parts: [{ type: 'text', text: 'เมื่อถึงเวลาตัดสินใจ' }],
  emit: () => {}
}

const BLOCKS: BlockSpec[] = [
  {
    kind: 'line.drive',
    shape: 'statement',
    category: 'action',
    title: 'ตั้งมอเตอร์ซ้าย/ขวา',
    hint: 'กำลังของแต่ละล้อ −100 ถึง 100 — ล้อขวาแรงกว่าก็เลี้ยวซ้าย ติดลบคือหมุนถอยหลัง สองล้อสวนทางกันคือหมุนอยู่กับที่',
    parts: [
      { type: 'text', text: 'ตั้งมอเตอร์ ซ้าย' },
      { type: 'input', name: 'left', placeholder: 'กำลัง', accepts: 'number' },
      { type: 'text', text: 'ขวา' },
      { type: 'input', name: 'right', placeholder: 'กำลัง', accepts: 'number' }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `return this.drive(${ctx.value(node, 'left', '0')}, ${ctx.value(node, 'right', '0')})`)
  },
  {
    kind: 'line.steer',
    shape: 'statement',
    category: 'action',
    title: 'วิ่งแล้วเลี้ยว',
    hint: 'วิ่งไปข้างหน้าด้วยกำลังที่ให้ แล้วเลี้ยวเท่ากับค่าที่สอง — บวกคือเลี้ยวขวา ลบคือเลี้ยวซ้าย ใส่ "ตำแหน่งเส้น" ลงช่องเลี้ยวได้ตรง ๆ',
    parts: [
      { type: 'text', text: 'วิ่งกำลัง' },
      { type: 'input', name: 'speed', placeholder: 'กำลัง', accepts: 'number' },
      { type: 'text', text: 'เลี้ยว' },
      { type: 'input', name: 'turn', placeholder: 'ค่าเลี้ยว', accepts: 'number' }
    ],
    emit: (node, ctx) =>
      ctx.line(node, `return this.steer(${ctx.value(node, 'speed', '0')}, ${ctx.value(node, 'turn', '0')})`)
  },
  {
    kind: 'line.stop',
    shape: 'statement',
    category: 'action',
    title: 'หยุด',
    hint: 'ปิดมอเตอร์ทั้งสองข้าง — หุ่นไถลต่ออีกนิดก่อนหยุดสนิท เพราะมอเตอร์ค่อย ๆ ผ่อนแรง',
    parts: [{ type: 'text', text: 'หยุด' }],
    emit: (node, ctx) => ctx.line(node, 'return this.stop()')
  },
  {
    kind: 'line.position',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตำแหน่งเส้น',
    hint: 'เส้นอยู่ตรงไหนใต้แถวเซนเซอร์ — -100 ใต้ตัวซ้ายสุด · 0 ตรงกลางพอดี · 100 ใต้ตัวขวาสุด · หลุดเส้นแล้วจะตอบสุดขอบฝั่งที่เห็นเส้นครั้งสุดท้าย',
    parts: [{ type: 'text', text: 'ตำแหน่งเส้น' }],
    emit: () => 'this.here.position'
  },
  {
    kind: 'line.sees',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เซนเซอร์เห็นเส้น',
    hint: 'ค่าที่อ่านได้ตั้งแต่ 50 ขึ้นไปถือว่าเห็น — ตอบได้แค่ใช่หรือไม่ใช่ ไม่บอกว่าเห็นแค่ขอบหรือเห็นเต็ม ๆ',
    parts: [
      { type: 'text', text: 'เซนเซอร์' },
      { type: 'field', name: 'sensor', options: SENSORS },
      { type: 'text', text: 'เห็นเส้น' }
    ],
    emit: (node, ctx) => `this.sees(${ctx.field(node, 'sensor')})`
  },
  {
    kind: 'line.sensor',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ค่าเซนเซอร์',
    hint: '0 คือพื้นขาว 100 คือเส้นดำเต็ม ๆ ค่ากลาง ๆ คือเซนเซอร์คร่อมขอบเส้นอยู่',
    parts: [
      { type: 'text', text: 'ค่าเซนเซอร์' },
      { type: 'field', name: 'sensor', options: SENSORS }
    ],
    emit: (node, ctx) => `this.sensor(${ctx.field(node, 'sensor')})`
  },
  {
    kind: 'line.sees-color',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เห็นเส้นสี',
    hint: 'มีเซนเซอร์ตัวไหนเห็นเส้นสีนี้อยู่บ้าง — เส้นแดงคือโซนที่ห้ามวิ่งเร็วเกิน 120 px/วิ (กำลังราว 40) เห็นเมื่อไรต้องชะลอทันที เพราะมอเตอร์ผ่อนแรงช้า',
    parts: [
      { type: 'text', text: 'เห็นเส้นสี' },
      { type: 'field', name: 'color', options: COLORS }
    ],
    emit: (node, ctx) => `this.seesColor(${quote(ctx.field(node, 'color'))})`
  },
  {
    kind: 'line.lost',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'หลุดเส้น',
    hint: 'ไม่มีเซนเซอร์ตัวไหนเห็นเส้นเลย — ตัวหุ่นอาจยังอยู่ใกล้เส้น แต่แถวเซนเซอร์เลยออกไปแล้ว',
    parts: [{ type: 'text', text: 'หลุดเส้น' }],
    emit: () => 'this.here.lost'
  },
  {
    kind: 'line.speed',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ความเร็วตอนนี้',
    hint: 'ตัวหุ่นวิ่งเร็วกี่พิกเซลต่อวินาที — มอเตอร์ค่อย ๆ ไล่ตามคำสั่ง จึงไม่เท่ากับที่เพิ่งสั่งไปทันที',
    parts: [{ type: 'text', text: 'ความเร็วตอนนี้' }],
    emit: () => 'this.here.speed'
  },
  {
    kind: 'line.progress',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'วิ่งไปแล้วกี่เปอร์เซ็นต์ของรอบ',
    parts: [{ type: 'text', text: 'วิ่งไปแล้วกี่ % ของรอบ' }],
    emit: () => 'this.here.progress'
  },
  {
    kind: 'line.time',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'เวลาที่ผ่านไป',
    hint: 'วินาทีในเกมตั้งแต่ออกตัว — ตัวเลขนี้คือคะแนนของรอบ ยิ่งน้อยยิ่งดี',
    parts: [{ type: 'text', text: 'เวลาที่ผ่านไป' }],
    emit: () => 'this.here.time'
  }
]

function block(
  kind: string,
  fields: Record<string, string | number> = {},
  inputs: Record<string, BlockNode | null> = {},
  bodies: Record<string, BlockNode[]> = {}
): BlockNode {
  const node = createBlock(kind)
  Object.assign(node.fields, fields)
  Object.assign(node.inputs, inputs)
  Object.assign(node.bodies, bodies)
  return node
}

const number = (value: number) => block('number', { value })

const math = (left: BlockNode, op: string, right: BlockNode) => block('math', { op }, { left, right })

const ifElse = (cond: BlockNode, then: BlockNode[], otherwise: BlockNode[]) =>
  block('if-else', {}, { cond }, { then, else: otherwise })

const readVar = (name: string) => block('var-get', { name })

const setVar = (name: string, value: BlockNode) => block('set-var', { name }, { value })

const sees = (sensor: number) => block('line.sees', { sensor: String(sensor) })

const drive = (left: number, right: number) => block('line.drive', {}, { left: number(left), right: number(right) })

const steer = (speed: BlockNode, turn: BlockNode) => block('line.steer', {}, { speed, turn })

const position = () => block('line.position')

const compare = (left: BlockNode, op: string, right: BlockNode) => block('compare', { op }, { left, right })

const ifDo = (cond: BlockNode, then: BlockNode[]) => block('if', {}, { cond }, { then })

const SENSOR_CALLS: Array<[string, string]> = [
  ['sees', 'line.sees'],
  ['sensor', 'line.sensor']
]

const HERE_VALUES: Array<[string, string]> = [
  ['position', 'line.position'],
  ['lost', 'line.lost'],
  ['speed', 'line.speed'],
  ['progress', 'line.progress'],
  ['time', 'line.time']
]

/** บล็อกสั่งมอเตอร์ที่รับสองค่า — ชื่อเมธอด ชนิดบล็อก และชื่อช่องสองช่อง */
const TWO_INPUTS: Array<[string, string, string, string]> = [
  ['drive', 'line.drive', 'left', 'right'],
  ['steer', 'line.steer', 'speed', 'turn']
]

const STATEMENT_PARSERS: Matcher[] = [
  ...TWO_INPUTS.map<Matcher>(
    ([name, kind, first, second]) =>
      (node, ctx) => {
        const back = ctx.returned(node)
        if (!back) return null

        const args = ctx.call(back, name)
        if (!args || args.length !== 2) return null

        return ctx.make(kind, {}, { [first]: ctx.value(args[0]!), [second]: ctx.value(args[1]!) })
      }
  ),
  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'stop') ? ctx.make('line.stop') : null
  }
]

const VALUE_PARSERS: Matcher[] = [
  ...SENSOR_CALLS.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) => {
        const args = ctx.call(node, name)
        const sensor = args ? ctx.num(args[0]!) : null
        return sensor === null ? null : ctx.make(kind, { sensor: String(sensor) })
      }
  ),
  (node, ctx) => {
    const args = ctx.call(node, 'seesColor')
    const color = args ? ctx.str(args[0]!) : null
    return color ? ctx.make('line.sees-color', { color }) : null
  },
  ...HERE_VALUES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        ctx.thisProp(node, 'here', name) ? ctx.make(kind) : null
  )
]

/**
 * ตัดบรรทัดที่ codegen เขียนให้เองออก ก่อนอ่านโค้ดกลับเป็นบล็อก
 * คือบรรทัดรับสภาพสนาม กับบรรทัด "ใช้กำลังเดิมต่อ" ปิดท้ายที่ใส่ไว้เผื่อโปรแกรมอ่านจนจบแล้วไม่เจอคำสั่ง
 */
function unwrap(statements: Node[], ctx: ParseContext): Node[] {
  const list = statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

  const last = list[list.length - 1]
  const back = last ? ctx.returned(last) : undefined
  if (back === null || (back?.type === 'Literal' && back.value === null)) list.pop()

  return list
}

/**
 * ชื่อไทยของงานที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง"
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว ตรงนี้แค่เลือกว่าตัวไหนควรให้เห็น
 */
export const WORK_LABEL: Record<string, string> = {
  drive: 'ตั้งมอเตอร์ตรง ๆ',
  steer: 'วิ่งแล้วเลี้ยว',
  stop: 'หยุด',
  sensor: 'อ่านค่าเซนเซอร์',
  sees: 'ดูว่าเซนเซอร์เห็นเส้นไหม',
  seesColor: 'ดูสีของเส้น'
}

export const LINE_PACK = createPack({
  id: 'line',
  blocks: BLOCKS,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'LineAgent',
    fields: [],
    helpers: '',
    methods: [
      {
        hat: HAT,
        name: 'step',
        unwrap,
        write: (writer) => {
          writer.push('step(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.push('')
          writer.body()
          writer.push('')
          writer.push('// อ่านจนจบแล้วไม่เจอบล็อกสั่งมอเตอร์ ก็ใช้กำลังเดิมต่อไป')
          writer.push('return null')
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    {
      id: 'starter',
      name: 'เห็นเส้นทางซ้ายก็เลี้ยวซ้าย',
      description:
        'ดูเซนเซอร์ตัวซ้ายตัวเดียว เห็นเส้นก็เลี้ยวซ้าย ไม่เห็นก็วิ่งตรง — ครบรอบสนามวงรีได้ เพราะวงรีเลี้ยวซ้ายอย่างเดียวทั้งสนาม แต่พอเจอโค้งขวาครั้งแรก มันไม่มีกฎให้เลี้ยวขวาเลย ก็วิ่งตรงหลุดเส้นไป ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'line.on-tick': [ifElse(sees(1), [drive(10, 50)], [drive(50, 50)])]
        }
      })
    },
    {
      id: 'bang-bang',
      name: 'เลี้ยวสุดทางเมื่อเห็นเส้น (bang-bang)',
      description:
        'เซนเซอร์ซ้ายสุดกับขวาสุดคร่อมเส้นไว้สองข้าง ตัวไหนเห็นเส้นก็หมุนตัวเข้าหาฝั่งนั้นเต็มแรง ไม่เห็นทั้งคู่ก็วิ่งตรง — คำสั่งมีแค่ "เลี้ยวสุด" กับ "ไม่เลี้ยวเลย" หุ่นจึงส่ายเป็นฟันเลื่อยไปตลอดทาง',
      build: (): BlockProgram => ({
        name: 'เลี้ยวสุดทางเมื่อเห็นเส้น',
        scripts: {
          'line.on-tick': [
            ifElse(sees(0), [drive(-50, 50)], [ifElse(sees(4), [drive(50, -50)], [drive(50, 50)])])
          ]
        }
      })
    },
    {
      id: 'proportional',
      name: 'เลี้ยวตามระยะที่เบี่ยง (P control)',
      description:
        'ไม่ถามว่าเห็นหรือไม่เห็น แต่ถามว่าเส้นเบี่ยงไปทางไหน "แค่ไหน" แล้วเลี้ยวแรงตามนั้น — เบี่ยงนิดเดียวก็เลี้ยวนิดเดียว เบี่ยงมากก็เลี้ยวมาก บล็อกเดียวทั้งโปรแกรม',
      build: (): BlockProgram => ({
        name: 'เลี้ยวตามระยะที่เบี่ยง',
        scripts: {
          'line.on-tick': [steer(number(60), math(position(), 'mul', number(0.5)))]
        }
      })
    },
    {
      id: 'pd',
      name: 'ดูทั้งระยะและทิศที่กำลังเบี่ยง (PD control)',
      description:
        'เพิ่มจากแบบ P อีกหนึ่งอย่าง: จำตำแหน่งเส้นของครั้งก่อนไว้ใน ข แล้วดูว่าครั้งนี้เปลี่ยนไปเท่าไร (ก) ถ้าเส้นกำลังวิ่งกลับเข้ากลางอยู่แล้วก็ผ่อนการเลี้ยวลงก่อนจะเลย — หุ่นจึงไม่ส่ายเลยเส้น และเร่งกำลังได้ถึง 90',
      build: (): BlockProgram => ({
        name: 'ดูทั้งระยะและทิศที่กำลังเบี่ยง',
        scripts: {
          'line.on-tick': [
            // ก = เส้นขยับไปเท่าไรตั้งแต่ครั้งก่อน · ข = ตำแหน่งเส้นของครั้งนี้ เก็บไว้เทียบครั้งหน้า
            setVar('a', math(position(), 'sub', readVar('b'))),
            setVar('b', position()),
            steer(
              number(90),
              math(math(readVar('b'), 'mul', number(0.7)), 'add', math(readVar('a'), 'mul', number(5)))
            )
          ]
        }
      })
    },
    {
      id: 'switching',
      name: 'สลับพฤติกรรมตามสถานการณ์ (state machine)',
      description:
        'ตัวที่ผ่านสนามโจทย์ยากได้ทุกสนาม — ปกติวิ่งแบบ PD แต่มีสองกรณีพิเศษที่แทรกเข้ามาก่อน: เห็นเส้นแดงก็ลดกำลังเหลือ 30 และหลุดเส้นตอนที่เส้นอยู่นิ่ง ๆ ตรงกลางมานานเกิน 10 ครั้ง แปลว่าเส้นขาด ไม่ใช่เลี้ยวไม่ทัน ก็วิ่งตรงข้ามไป · ค นับว่าเส้นอยู่นิ่งมากี่ครั้งแล้ว',
      build: (): BlockProgram => ({
        name: 'สลับพฤติกรรมตามสถานการณ์',
        scripts: {
          'line.on-tick': [
            // หลุดเส้นทั้งที่ก่อนหน้านั้นเส้นนิ่งอยู่กลางตัวมานาน — เส้นขาด วิ่งตรงข้ามไปเลย
            ifDo(block('and', {}, { left: block('line.lost'), right: compare(readVar('c'), 'gt', number(10)) }), [
              steer(number(60), number(0))
            ]),
            // ค = เส้นอยู่นิ่ง ๆ ใกล้กลางตัวมากี่ครั้งติดกันแล้ว
            ifElse(
              compare(block('math-one', { fn: 'abs' }, { value: position() }), 'gt', number(30)),
              [setVar('c', number(0))],
              [block('change-var', { name: 'c' }, { value: number(1) })]
            ),
            // ก = ค่าเลี้ยวแบบ PD · ข = ตำแหน่งเส้นของครั้งนี้ เก็บไว้เทียบครั้งหน้า
            setVar(
              'a',
              math(math(math(position(), 'sub', readVar('b')), 'mul', number(5)), 'add', math(position(), 'mul', number(0.7)))
            ),
            setVar('b', position()),
            ifElse(block('line.sees-color', { color: 'red' }), [steer(number(30), readVar('a'))], [steer(number(80), readVar('a'))])
          ]
        }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'bang-bang'
