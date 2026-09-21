import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'

/**
 * ชุดบล็อกของเกมวิ่งหลบ — มีท่าให้สั่งแค่สามท่า แต่ "ตอนไหน" คือทั้งหมดของโจทย์
 *
 * ของสำคัญที่สุดในกล่องนี้คือบล็อก "ความเร็วตอนนี้" กับ "อีกกี่วินาทีจะถึงตัว"
 * เพราะลู่เร่งความเร็วขึ้นเรื่อย ๆ กฎที่เผื่อระยะเป็นพิกเซลตายตัวจะสายเกินไปเองเมื่อวิ่งเร็วขึ้น
 */

/** ชิ้นที่เท่าไรนับจากตัวเรา — ใช้ร่วมกันทุกบล็อกที่ถามถึงสิ่งกีดขวาง */
const RANKS: SelectOption[] = [
  { value: '1', label: 'ชิ้นที่อยู่ข้างหน้าสุด' },
  { value: '2', label: 'ชิ้นถัดไปอีกชิ้น' }
]

const KINDS: SelectOption[] = [
  { value: 'ground', label: 'ของบนพื้น' },
  { value: 'bird', label: 'นก' }
]

const HAT: BlockSpec = {
  kind: 'dino.on-tick',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงเวลาตัดสินใจ',
  hint: 'ทำงาน 30 ครั้งต่อวินาที — บล็อกสั่งท่าตัวแรกที่ทำงานคือท่าของครั้งนั้น',
  parts: [{ type: 'text', text: 'เมื่อถึงเวลาตัดสินใจ' }],
  emit: () => {}
}

const HAT_START: BlockSpec = {
  kind: 'dino.on-start',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อเริ่มวิ่ง',
  hint: 'ทำครั้งเดียวก่อนออกวิ่ง — เหมาะกับการโหลดสิ่งที่จำไว้จากรอบก่อน',
  parts: [{ type: 'text', text: 'เมื่อเริ่มวิ่ง' }],
  emit: () => {}
}

const HAT_FINISH: BlockSpec = {
  kind: 'dino.on-finish',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อชน',
  hint: 'ทำครั้งเดียวหลังชน — "วิ่งมาแล้วกี่พิกเซล" ตรงนี้คือคะแนนของรอบนั้น เหมาะกับการจำสิ่งที่ได้ผลไว้ใช้รอบหน้า',
  parts: [{ type: 'text', text: 'เมื่อชน' }],
  emit: () => {}
}

const BLOCKS: BlockSpec[] = [
  {
    kind: 'dino.jump',
    shape: 'statement',
    category: 'action',
    title: 'กระโดด',
    hint: 'ดีดตัวขึ้นแล้วตกลงมาตามแรงโน้มถ่วง ลอยอยู่ราว 0.6 วินาที — สั่งตอนของมาถึงตัวพอดีคือสายไปแล้ว',
    parts: [{ type: 'text', text: 'กระโดด' }],
    emit: (node, ctx) => ctx.line(node, `return this.act(${quote('jump')})`)
  },
  {
    kind: 'dino.duck',
    shape: 'statement',
    category: 'action',
    title: 'หมอบ',
    hint: 'เตี้ยลงครึ่งตัวจนกว่าจะสั่งลุก ลอดนกที่บินสูงได้ — แต่ของบนพื้นกับนกที่บินเรี่ยพื้นยังชนเต็ม ๆ',
    parts: [{ type: 'text', text: 'หมอบ' }],
    emit: (node, ctx) => ctx.line(node, `return this.act(${quote('duck')})`)
  },
  {
    kind: 'dino.dash',
    shape: 'statement',
    category: 'action',
    title: 'วิ่งต่อ',
    hint: 'ไม่ทำอะไรเป็นพิเศษ — และถ้ากำลังหมอบอยู่ก็ลุกขึ้นยืน',
    parts: [{ type: 'text', text: 'วิ่งต่อ' }],
    emit: (node, ctx) => ctx.line(node, `return this.act(${quote('run')})`)
  },
  {
    kind: 'dino.time-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'อีกกี่วินาทีจะถึงตัว',
    hint: 'เอาระยะหารด้วยความเร็วให้แล้ว — ตัวเลขนี้ความหมายไม่เปลี่ยนตอนลู่เร่งความเร็ว',
    parts: [
      { type: 'text', text: 'อีกกี่วินาที' },
      { type: 'field', name: 'rank', options: RANKS },
      { type: 'text', text: 'จะถึงตัว' }
    ],
    emit: (node, ctx) => `this.timeTo(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.gap',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะถึงสิ่งกีดขวาง',
    hint: 'นับเป็นพิกเซล — 0 คือถึงตัวพอดี มองไม่เห็นอะไรเลยก็คืนระยะสายตา',
    parts: [
      { type: 'text', text: 'ระยะถึง' },
      { type: 'field', name: 'rank', options: RANKS }
    ],
    emit: (node, ctx) => `this.gap(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.is',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'สิ่งกีดขวางชนิดไหน',
    hint: 'บอกแค่ว่าเป็นนกหรือของบนพื้น — นกบินสูงต่ำไม่เท่ากัน รู้ว่าเป็นนกยังไม่พอจะเลือกท่า ต้องดูด้วยว่าลอดใต้มันได้ไหม',
    parts: [
      { type: 'field', name: 'rank', options: RANKS },
      { type: 'text', text: 'เป็น' },
      { type: 'field', name: 'kind', options: KINDS }
    ],
    emit: (node, ctx) => `this.is(${ctx.field(node, 'rank')}, ${quote(ctx.field(node, 'kind'))})`
  },
  {
    kind: 'dino.under',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ลอดใต้สิ่งกีดขวางได้',
    hint: 'หมอบแล้วลอดใต้ชิ้นนั้นได้ไหม — ได้ก็หมอบ ไม่ได้ก็ต้องกระโดด นกที่บินเรี่ยพื้นลอดไม่ได้ ฝูงสองตัวกระโดดไม่พ้น',
    parts: [
      { type: 'text', text: 'ลอดใต้' },
      { type: 'field', name: 'rank', options: RANKS },
      { type: 'text', text: 'ได้' }
    ],
    emit: (node, ctx) => `this.under(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.bottom',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ความสูงจากพื้นของสิ่งกีดขวาง',
    hint: 'ขอบล่างของมันลอยสูงจากพื้นกี่พิกเซล — 0 คือติดพื้น ตอนหมอบหัวเราสูง 11',
    parts: [
      { type: 'text', text: 'ความสูงจากพื้นของ' },
      { type: 'field', name: 'rank', options: RANKS }
    ],
    emit: (node, ctx) => `this.bottom(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.speed',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ความเร็วตอนนี้',
    hint: 'ลู่วิ่งเร็วกี่พิกเซลต่อวินาที — เลขนี้โตขึ้นเรื่อย ๆ ระหว่างวิ่ง และเป็นหัวใจของเกมนี้',
    parts: [{ type: 'text', text: 'ความเร็วตอนนี้' }],
    emit: () => 'this.here.speed'
  },
  {
    kind: 'dino.air-time',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'กระโดดหนึ่งครั้งลอยกี่วินาที',
    hint: 'ค่าคงที่ของตัวเรา ไม่เปลี่ยนตามความเร็วของลู่ — เทียบกับ "อีกกี่วินาทีจะถึงตัว" ได้ตรง ๆ',
    parts: [{ type: 'text', text: 'กระโดดหนึ่งครั้งลอยกี่วินาที' }],
    emit: () => 'this.here.airTime'
  },
  {
    kind: 'dino.width',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ความกว้างของสิ่งกีดขวาง',
    parts: [
      { type: 'text', text: 'ความกว้างของ' },
      { type: 'field', name: 'rank', options: RANKS }
    ],
    emit: (node, ctx) => `this.width(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.height',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ความสูงของสิ่งกีดขวาง',
    parts: [
      { type: 'text', text: 'ความสูงของ' },
      { type: 'field', name: 'rank', options: RANKS }
    ],
    emit: (node, ctx) => `this.height(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.seen',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'มองเห็นสิ่งกีดขวาง',
    parts: [
      { type: 'text', text: 'มองเห็น' },
      { type: 'field', name: 'rank', options: RANKS }
    ],
    emit: (node, ctx) => `this.seen(${ctx.field(node, 'rank')})`
  },
  {
    kind: 'dino.airborne',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'กำลังลอยอยู่',
    hint: 'ลอยอยู่จะสั่งท่าอะไรก็ไม่มีผล ต้องรอลงพื้นก่อน',
    parts: [{ type: 'text', text: 'กำลังลอยอยู่' }],
    emit: () => 'this.here.airborne'
  },
  {
    kind: 'dino.up',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตอนนี้ลอยสูงกี่พิกเซล',
    parts: [{ type: 'text', text: 'ตอนนี้ลอยสูงกี่พิกเซล' }],
    emit: () => 'this.here.height'
  },
  {
    kind: 'dino.distance',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'วิ่งมาแล้วกี่พิกเซล',
    parts: [{ type: 'text', text: 'วิ่งมาแล้วกี่พิกเซล' }],
    emit: () => 'this.here.distance'
  },
  {
    kind: 'dino.level',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระดับตอนนี้',
    hint: 'ยิ่งระดับสูง ลู่ยิ่งเร็วและของยิ่งถี่ — เกมนี้ไม่มีเส้นชัย วิ่งจนกว่าจะชน',
    parts: [{ type: 'text', text: 'ระดับตอนนี้' }],
    emit: () => 'this.here.level'
  },
  {
    kind: 'dino.cleared',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผ่านสิ่งกีดขวางมาแล้วกี่ชิ้น',
    parts: [{ type: 'text', text: 'ผ่านสิ่งกีดขวางมาแล้วกี่ชิ้น' }],
    emit: () => 'this.here.cleared'
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

const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

const math = (left: BlockNode, op: string, right: BlockNode) =>
  block('math', { op }, { left, right })

const ifElse = (cond: BlockNode, then: BlockNode[], otherwise: BlockNode[]) =>
  block('if-else', {}, { cond }, { then, else: otherwise })

const ifDo = (cond: BlockNode, then: BlockNode[]) => block('if', {}, { cond }, { then })

const random = (min: number, max: number) => block('random', { min, max })

const readVar = (name: string) => block('var-get', { name })

const gene = (index: BlockNode) => block('list-item', { name: 'a' }, { index })

/** ยีนตัวที่ index (หน่วยเป็นร้อยส่วนของวินาที) แปลงกลับเป็นวินาที */
const seconds = (index: number) => math(gene(number(index)), 'div', number(100))

/** ลอดใต้ชิ้นหน้าสุดได้ก็หมอบ ไม่ได้ก็กระโดด — ท่อนที่ตัวอย่างสองชุดใช้ร่วมกัน */
const dodge = () => ifElse(block('dino.under', { rank: '1' }), [block('dino.duck')], [block('dino.jump')])

const ACTIONS: Array<[string, string]> = [
  ['jump', 'dino.jump'],
  ['duck', 'dino.duck'],
  ['run', 'dino.dash']
]

const RANK_CALLS: Array<[string, string]> = [
  ['gap', 'dino.gap'],
  ['timeTo', 'dino.time-to'],
  ['width', 'dino.width'],
  ['height', 'dino.height'],
  ['seen', 'dino.seen'],
  ['under', 'dino.under'],
  ['bottom', 'dino.bottom']
]

const HERE_VALUES: Array<[string, string]> = [
  ['speed', 'dino.speed'],
  ['airTime', 'dino.air-time'],
  ['airborne', 'dino.airborne'],
  ['height', 'dino.up'],
  ['distance', 'dino.distance'],
  ['level', 'dino.level'],
  ['cleared', 'dino.cleared']
]

const STATEMENT_PARSERS: Matcher[] = [
  ...ACTIONS.map<Matcher>(
    ([action, kind]) =>
      (node, ctx) => {
        const back = ctx.returned(node)
        if (!back) return null

        const args = ctx.call(back, 'act')
        const value = args ? ctx.str(args[0]!) : null
        return value === action ? ctx.make(kind) : null
      }
  )
]

const VALUE_PARSERS: Matcher[] = [
  ...RANK_CALLS.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) => {
        const args = ctx.call(node, name)
        const rank = args ? ctx.num(args[0]!) : null
        return rank === null ? null : ctx.make(kind, { rank: String(rank) })
      }
  ),
  (node, ctx) => {
    const args = ctx.call(node, 'is')
    if (!args) return null

    const rank = ctx.num(args[0]!)
    const kind = ctx.str(args[1]!)
    return rank !== null && kind ? ctx.make('dino.is', { rank: String(rank), kind }) : null
  },
  ...HERE_VALUES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        ctx.thisProp(node, 'here', name) ? ctx.make(kind) : null
  )
]

/** ตัดบรรทัดรับสภาพลู่ที่ codegen เขียนให้เองออก — ใช้กับหัวบล็อกเริ่มวิ่งและชน */
const unwrapHere = (statements: Node[], ctx: ParseContext): Node[] =>
  statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

/**
 * ตัดบรรทัดที่ codegen เขียนให้เองออก ก่อนอ่านโค้ดกลับเป็นบล็อก
 * คือบรรทัดรับสภาพลู่ กับบรรทัด "วิ่งต่อ" ปิดท้ายที่ใส่ไว้เผื่อโปรแกรมอ่านจนจบแล้วไม่เจอท่า
 */
function unwrap(statements: Node[], ctx: ParseContext): Node[] {
  const list = statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

  const last = list[list.length - 1]
  const back = last ? ctx.returned(last) : undefined
  const args = back ? ctx.call(back, 'act') : null
  if (args && ctx.str(args[0]!) === 'run') list.pop()

  return list
}

/**
 * ชื่อไทยของงานที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง"
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว ตรงนี้แค่เลือกว่าตัวไหนควรให้เห็น
 */
export const WORK_LABEL: Record<string, string> = {
  act: 'สั่งท่าให้ตัวละคร',
  look: 'เปิดดูสิ่งกีดขวาง',
  gap: 'วัดระยะถึงสิ่งกีดขวาง',
  timeTo: 'คิดเวลาที่เหลือก่อนชน',
  is: 'ดูว่าชิ้นนั้นเป็นอะไร',
  width: 'ดูความกว้าง',
  height: 'ดูความสูง',
  seen: 'ดูว่ามีอะไรอยู่ข้างหน้าไหม',
  under: 'ดูว่าลอดใต้ได้ไหม',
  bottom: 'ดูความสูงจากพื้น'
}

export const DINO_PACK = createPack({
  id: 'dino',
  blocks: BLOCKS,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'DinoAgent',
    fields: [],
    helpers: '',
    memory: true,
    methods: [
      {
        hat: HAT_START,
        name: 'onStart',
        // ไม่ได้ต่ออะไรไว้ก็ไม่ต้องเขียนเมธอดเปล่า ๆ ให้รก — โปรแกรมส่วนใหญ่ใช้แค่หัวบล็อกตัดสินใจ
        skipWhenEmpty: true,
        unwrap: unwrapHere,
        write: (writer) => {
          writer.push('onStart(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      },
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
          writer.push('// อ่านจนจบแล้วไม่เจอบล็อกสั่งท่า ก็วิ่งต่อไปเฉย ๆ')
          writer.push(`return this.act('run')`)
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: HAT_FINISH,
        name: 'onFinish',
        skipWhenEmpty: true,
        unwrap: unwrapHere,
        write: (writer) => {
          writer.push('onFinish(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    {
      id: 'starter',
      name: 'ใกล้แล้วค่อยกระโดด',
      description:
        'กระโดดเมื่อของเหลือระยะไม่เกิน 70 พิกเซล — รอดสบายตอนวิ่งช้า แต่พอลู่เร่งความเร็วขึ้น 70 พิกเซลก็เหลือเวลาไม่ถึงหนึ่งในสิบวินาที กว่าจะลอยขึ้นก็ชนไปแล้ว และยังไม่เคยดูเลยว่าข้างหน้าลอดใต้ได้หรือต้องกระโดด ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'dino.on-tick': [
            ifDo(compare(block('dino.gap', { rank: '1' }), 'lte', number(70)), [block('dino.jump')])
          ]
        }
      })
    },
    {
      id: 'reflex',
      name: 'เผื่อระยะตามความเร็ว (reflex agent)',
      description:
        'กฎเดียวกันทุกครั้งที่ตัดสินใจ แต่ระยะที่เผื่อไว้ไม่ใช่เลขตายตัว — เอาความเร็วตอนนั้นคูณ 0.3 วินาที พอลู่เร็วขึ้น ระยะเผื่อก็ขยายตามเอง แล้วค่อยดูว่าลอดใต้มันได้ไหม ได้ก็หมอบ ไม่ได้ก็กระโดด',
      build: (): BlockProgram => ({
        name: 'เผื่อระยะตามความเร็ว',
        scripts: {
          'dino.on-tick': [
            ifDo(
              compare(
                block('dino.gap', { rank: '1' }),
                'lte',
                math(block('dino.speed'), 'mul', number(0.3))
              ),
              [dodge()]
            )
          ]
        }
      })
    },
    {
      id: 'countdown',
      name: 'นับเวลาถึงจุดชน (TTC)',
      description:
        'เลิกคิดเป็นระยะทางไปเลย แล้วถามคำถามเดียวว่า "อีกกี่วินาทีมันจะถึงตัว" — เหลือไม่เกิน 0.3 วินาทีเมื่อไรก็หลบ (ลอดใต้ได้ก็หมอบ ไม่ได้ก็กระโดด) ความเร็วจะเปลี่ยนยังไงกฎนี้ก็ไม่ต้องแก้',
      build: (): BlockProgram => ({
        name: 'นับเวลาถึงจุดชน',
        scripts: {
          'dino.on-tick': [
            ifDo(compare(block('dino.time-to', { rank: '1' }), 'lte', number(0.3)), [dodge()])
          ]
        }
      })
    },
    {
      id: 'evolve',
      name: 'วิวัฒนาการหาจังหวะ (GA)',
      description:
        'ไม่บอกเลยว่าควรหลบตอนเหลือกี่วินาที ให้โปรแกรมหาเอง — จำยีนไว้สองตัว คือจังหวะกระโดดกับจังหวะหมอบลอด (หน่วยเป็นร้อยส่วนของวินาที) ทุกรอบสุ่มแก้ยีนหนึ่งตัวนิดหน่อย วิ่งจนชน แล้วเทียบระยะกับแชมป์ ไกลกว่าก็ยึดเป็นแชมป์แทน — กด "ฝึก" ให้มันวิ่งรัว ๆ หลายสิบรอบแล้วดูระยะไต่ขึ้นเอง',
      build: (): BlockProgram => ({
        name: 'วิวัฒนาการหาจังหวะ (GA)',
        scripts: {
          'dino.on-start': [
            block('set-var', { name: 'a' }, { value: block('recall', { slot: 'a' }) }),
            // รอบแรกยังไม่มีแชมป์ — สุ่มยีนตั้งต้นให้ทั้งสองตัว ระหว่าง 0.05 ถึง 0.40 วินาที
            ifDo(compare(block('list-length', { name: 'a' }), 'lt', number(2)), [
              block('list-clear', { name: 'a' }),
              block('repeat', { times: 2 }, {}, { do: [block('list-push', { name: 'a' }, { value: random(5, 40) })] })
            ]),
            // กลายพันธุ์ทีละยีน ขยับไม่เกิน 0.08 วินาที
            // วัดแล้ว: สุ่มตั้งต้นกว้างถึง 0.60 วินาที ราวหนึ่งในสี่ของการทดลองติดอยู่บน "ที่ราบ"
            // (กระโดดเร็วเกินทุกค่าได้ราว 50 ม. เท่ากันหมด) ไม่หลุดเลยใน 40 รอบ · ไม่เกิน 0.40 หลุดได้ทุกครั้ง
            block('set-var', { name: 'c' }, { value: random(1, 2) }),
            block(
              'list-put',
              { name: 'a' },
              {
                index: readVar('c'),
                value: block(
                  'math-fn',
                  { fn: 'max' },
                  { left: number(1), right: math(gene(readVar('c')), 'add', random(-8, 8)) }
                )
              }
            )
          ],
          'dino.on-tick': [
            ifElse(
              block('dino.under', { rank: '1' }),
              [ifDo(compare(block('dino.time-to', { rank: '1' }), 'lte', seconds(2)), [block('dino.duck')])],
              [ifDo(compare(block('dino.time-to', { rank: '1' }), 'lte', seconds(1)), [block('dino.jump')])]
            )
          ],
          // ไม่มีใครวิ่งไกลกว่าบาร์ ก็ลดบาร์ลง 10%
          //
          // แต่ละรอบสุ่มลู่ใหม่ ระยะจึงมีโชคปนอยู่เยอะ ถ้าบาร์ขึ้นอย่างเดียว พอฟลุกวิ่งไกลไว้ครั้งเดียว
          // แชมป์ก็จะไม่มีวันถูกแทนอีกเลย ให้บาร์ไหลลงได้ ยีนที่ดีจริงจะกลับมาชนะซ้ำเอง
          'dino.on-finish': [
            ifElse(
              compare(block('dino.distance'), 'gt', block('recall', { slot: 'b' })),
              [
                block('remember', { slot: 'a' }, { value: readVar('a') }),
                block('remember', { slot: 'b' }, { value: block('dino.distance') })
              ],
              [
                block(
                  'remember',
                  { slot: 'b' },
                  { value: math(block('recall', { slot: 'b' }), 'mul', number(0.9)) }
                )
              ]
            )
          ]
        }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'reflex'
