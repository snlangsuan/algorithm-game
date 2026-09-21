import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'

const PEGS: SelectOption[] = [
  { value: 'start', label: 'หมุดเริ่มต้น' },
  { value: 'goal', label: 'หมุดเป้าหมาย' },
  { value: 'spare', label: 'หมุดพัก' },
  { value: 'a', label: 'หมุด ก' },
  { value: 'b', label: 'หมุด ข' },
  { value: 'c', label: 'หมุด ค' }
]

const SIDES: SelectOption[] = [
  { value: 'right', label: 'ขวา' },
  { value: 'left', label: 'ซ้าย' }
]

const HAT: BlockSpec = {
  kind: 'hanoi.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาย้าย',
  hint: 'ระบบอ่านบล็อกที่ต่อไว้ข้างล่างนี้ทุกตา บล็อกย้ายตัวแรกที่ทำงานคือตานั้น',
  parts: [{ type: 'text', text: 'เมื่อถึงตาย้าย' }],
  emit: () => {}
}

const PLAN_HAT: BlockSpec = {
  kind: 'hanoi.on-plan',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อวางแผนการย้าย',
  hint: 'ทำงานครั้งเดียวก่อนเริ่มย้าย — ใช้บล็อกหมวดวางแผนตรงนี้',
  parts: [{ type: 'text', text: 'เมื่อวางแผนการย้าย' }],
  emit: () => {}
}

const PLAN_BLOCKS: BlockSpec[] = [
  {
    kind: 'hanoi.plan-start',
    shape: 'statement',
    category: 'action',
    title: 'เริ่มวางแผน',
    hint: 'ล้างกองงาน แล้วใส่งานใหญ่ที่สุดเข้าไป — ย้ายจานทุกใบไปหมุดเป้าหมาย',
    parts: [{ type: 'text', text: 'เริ่มวางแผนจากงานใหญ่ทั้งกอง' }],
    emit: (node, ctx) => ctx.line(node, 'this.planStart()')
  },
  {
    kind: 'hanoi.plan-take',
    shape: 'statement',
    category: 'action',
    title: 'หยิบงานจากกอง',
    hint: 'เอางานบนสุดของกองออกมาเป็น "งานที่กำลังทำ"',
    parts: [{ type: 'text', text: 'หยิบงานบนสุดออกจากกอง' }],
    emit: (node, ctx) => ctx.line(node, 'this.planTake()')
  },
  {
    kind: 'hanoi.plan-move',
    shape: 'statement',
    category: 'action',
    title: 'ย้ายจานของงานนี้',
    hint: 'จดตาย้ายของงานที่กำลังทำลงในแผน (ใช้กับงานที่เหลือจานใบเดียว)',
    parts: [{ type: 'text', text: 'จดตาย้ายของงานนี้ลงในแผน' }],
    emit: (node, ctx) => ctx.line(node, 'this.planMove()')
  },
  {
    kind: 'hanoi.plan-split',
    shape: 'statement',
    category: 'action',
    title: 'แตกงานนี้เป็นงานย่อย',
    hint: 'ย้าย n−1 ใบไปพักก่อน · ย้ายใบล่างสุดไปเป้าหมาย · แล้วย้าย n−1 ใบตามไป — หัวใจของการแบ่งแล้วพิชิต',
    parts: [{ type: 'text', text: 'แตกงานนี้เป็นสามงานย่อย' }],
    emit: (node, ctx) => ctx.line(node, 'this.planSplit()')
  },
  {
    kind: 'hanoi.plan-answer',
    shape: 'statement',
    category: 'action',
    title: 'ตอบแผนที่วางไว้',
    hint: 'ส่งลำดับการย้ายทั้งชุดกลับให้เครื่องย้ายตาม',
    parts: [{ type: 'text', text: 'ตอบลำดับการย้ายที่วางไว้' }],
    emit: (node, ctx) => ctx.line(node, 'return this.planAnswer()')
  },
  {
    kind: 'hanoi.plan-open',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'กองงานยังไม่ว่าง',
    parts: [{ type: 'text', text: 'กองงานยังไม่ว่าง' }],
    emit: () => 'this.planOpen()'
  },
  {
    kind: 'hanoi.plan-single',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'งานนี้เหลือจานใบเดียว',
    hint: 'งานที่เล็กจนแตกต่อไม่ได้แล้ว — ย้ายได้เลยตรง ๆ',
    parts: [{ type: 'text', text: 'งานนี้เหลือจานใบเดียว' }],
    emit: () => 'this.planSingle()'
  },
  {
    kind: 'hanoi.plan-size',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนจานของงานนี้',
    parts: [{ type: 'text', text: 'จำนวนจานของงานนี้' }],
    emit: () => 'this.planSize()'
  },
  {
    kind: 'hanoi.plan-count',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนตาที่วางไว้แล้ว',
    parts: [{ type: 'text', text: 'จำนวนตาที่วางไว้แล้ว' }],
    emit: () => 'this.planCount()'
  }
]

const BLOCKS: BlockSpec[] = [
  {
    kind: 'hanoi.move',
    shape: 'statement',
    category: 'action',
    title: 'ย้ายจาน',
    hint: 'ย้ายจานบนสุดหนึ่งใบ แล้วจบตานี้ — ถ้าผิดกติกาจะถูกฟ้องทันที',
    parts: [
      { type: 'text', text: 'ย้ายจานจาก' },
      { type: 'field', name: 'from', options: PEGS },
      { type: 'text', text: 'ไป' },
      { type: 'field', name: 'to', options: PEGS }
    ],
    emit: (node, ctx) =>
      ctx.line(
        node,
        `return this.play(${quote(ctx.field(node, 'from'))}, ${quote(ctx.field(node, 'to'))})`
      )
  },
  {
    kind: 'hanoi.slide',
    shape: 'statement',
    category: 'action',
    title: 'ย้ายจานเล็กสุด',
    hint: 'ย้ายจานเล็กที่สุดไปหมุดถัดไปในทิศเดิมเสมอ — ครึ่งแรกของกฎสลับตา',
    parts: [
      { type: 'text', text: 'ย้ายจานเล็กสุดไปหมุดถัดไปทาง' },
      { type: 'field', name: 'side', options: SIDES }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.slide(${quote(ctx.field(node, 'side'))})`)
  },
  {
    kind: 'hanoi.forced',
    shape: 'statement',
    category: 'action',
    title: 'ย้ายตาที่เหลืออยู่ตาเดียว',
    hint: 'ถ้าไม่แตะจานเล็กสุด จะมีตาที่ถูกกติกาเหลือแค่ตาเดียวเสมอ — ครึ่งหลังของกฎสลับตา',
    parts: [{ type: 'text', text: 'ย้ายตาที่ถูกกติกาซึ่งไม่ใช่จานเล็กสุด' }],
    emit: (node, ctx) => ctx.line(node, 'return this.forced()')
  },
  {
    kind: 'hanoi.stop',
    shape: 'statement',
    category: 'action',
    title: 'หยุดย้าย',
    parts: [{ type: 'text', text: 'หยุดย้าย' }],
    emit: (node, ctx) => ctx.line(node, 'return null')
  },
  {
    kind: 'hanoi.can-move',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ย้ายได้ตามกติกา',
    hint: 'มีจานให้ยก และจานที่ยกเล็กกว่าจานบนสุดของหมุดปลายทาง',
    parts: [
      { type: 'text', text: 'ย้ายจาก' },
      { type: 'field', name: 'from', options: PEGS },
      { type: 'text', text: 'ไป' },
      { type: 'field', name: 'to', options: PEGS },
      { type: 'text', text: 'ได้' }
    ],
    emit: (node, ctx) =>
      `this.canPlay(${quote(ctx.field(node, 'from'))}, ${quote(ctx.field(node, 'to'))})`
  },
  {
    kind: 'hanoi.top',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จานบนสุดของหมุด',
    hint: 'ขนาดของจานบนสุด — 0 แปลว่าหมุดนั้นว่าง',
    parts: [
      { type: 'text', text: 'จานบนสุดของ' },
      { type: 'field', name: 'peg', options: PEGS }
    ],
    emit: (node, ctx) => `this.topOf(${quote(ctx.field(node, 'peg'))})`
  },
  {
    kind: 'hanoi.count',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนจานบนหมุด',
    parts: [
      { type: 'text', text: 'จำนวนจานบน' },
      { type: 'field', name: 'peg', options: PEGS }
    ],
    emit: (node, ctx) => `this.heightOf(${quote(ctx.field(node, 'peg'))})`
  },
  {
    kind: 'hanoi.empty',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'หมุดว่าง',
    parts: [
      { type: 'field', name: 'peg', options: PEGS },
      { type: 'text', text: 'ว่าง' }
    ],
    emit: (node, ctx) => `this.isEmpty(${quote(ctx.field(node, 'peg'))})`
  },
  {
    kind: 'hanoi.has-smallest',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'จานเล็กสุดอยู่บนหมุดนี้',
    parts: [
      { type: 'text', text: 'จานเล็กสุดอยู่บน' },
      { type: 'field', name: 'peg', options: PEGS }
    ],
    emit: (node, ctx) => `this.hasSmallest(${quote(ctx.field(node, 'peg'))})`
  },
  {
    kind: 'hanoi.turn',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตาที่เท่าไร',
    hint: 'ตาแรกคือ 1 — ใช้แยกตาคี่กับตาคู่',
    parts: [{ type: 'text', text: 'ตาที่เท่าไร' }],
    emit: () => 'this.here.move'
  },
  {
    kind: 'hanoi.disks',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนจานทั้งหมด',
    parts: [{ type: 'text', text: 'จำนวนจานทั้งหมด' }],
    emit: () => 'this.here.disks'
  },
  {
    kind: 'hanoi.solved',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ย้ายครบแล้ว',
    parts: [{ type: 'text', text: 'จานอยู่ครบที่หมุดเป้าหมายแล้ว' }],
    emit: () => 'this.done()'
  }
]

const HELPERS = `
  // ---------- ตัวช่วยของบล็อกวางแผน ----------
  // งานหนึ่งชิ้น = { n จานที่ต้องย้าย, from ต้นทาง, to ปลายทาง, via หมุดพัก }
  // ทุกตัวปลอดภัยแม้ยังไม่ได้ "เริ่มวางแผน" — จะไม่ทำอะไรแทนที่จะพัง

  planStart() {
    this.plan = {
      tasks: [
        { n: this.here.disks, from: this.here.source, to: this.here.target, via: this.here.spare }
      ],
      at: null,
      moves: []
    }
  }

  planOpen() {
    return Boolean(this.plan) && this.plan.tasks.length > 0
  }

  planTake() {
    if (!this.plan) return
    const task = this.plan.tasks.pop()
    if (task) this.plan.at = task
  }

  planSize() {
    return this.plan && this.plan.at ? this.plan.at.n : 0
  }

  planSingle() {
    return Boolean(this.plan && this.plan.at) && this.plan.at.n === 1
  }

  planMove() {
    if (!this.plan || !this.plan.at) return
    const task = this.plan.at
    this.plan.moves.push({ from: task.from, to: task.to })
    this.visit(task.from, task.to)
  }

  // งาน n ใบ = ย้าย n-1 ใบไปพัก, ย้ายใบล่างสุดไปเป้าหมาย, แล้วย้าย n-1 ใบตามไป
  // กองงานหยิบตัวบนสุดก่อน จึงใส่กลับลำดับ งานที่ต้องทำก่อนจะได้อยู่บนสุด
  planSplit() {
    if (!this.plan || !this.plan.at) return

    const task = this.plan.at

    // งานที่เหลือใบเดียวแตกต่อไม่ได้แล้ว ย้ายเลย กันไม่ให้วนไม่จบ
    if (task.n <= 1) {
      this.planMove()
      return
    }

    this.plan.tasks.push({ n: task.n - 1, from: task.via, to: task.to, via: task.from })
    this.plan.tasks.push({ n: 1, from: task.from, to: task.to, via: task.via })
    this.plan.tasks.push({ n: task.n - 1, from: task.from, to: task.via, via: task.to })
  }

  planCount() {
    return this.plan ? this.plan.moves.length : 0
  }

  planAnswer() {
    return this.plan ? this.plan.moves : []
  }

  // ---------- ตัวช่วยของบล็อกย้ายทีละตา ----------

  // แปลงชื่อหมุดบนบล็อกให้เป็นหมายเลขหมุดจริง
  peg(name) {
    if (name === 'start') return this.here.source
    if (name === 'goal') return this.here.target
    if (name === 'spare') return this.here.spare
    if (name === 'b') return 1
    if (name === 'c') return 2
    return 0
  }

  play(from, to) {
    return { from: this.peg(from), to: this.peg(to) }
  }

  topOf(name) {
    return this.top(this.here.towers, this.peg(name))
  }

  heightOf(name) {
    return this.height(this.here.towers, this.peg(name))
  }

  isEmpty(name) {
    return this.empty(this.here.towers, this.peg(name))
  }

  canPlay(from, to) {
    return this.legal(this.here.towers, this.peg(from), this.peg(to))
  }

  hasSmallest(name) {
    return this.topOf(name) === 1
  }

  done() {
    return this.height(this.here.towers, this.here.target) === this.here.disks
  }

  // จานเล็กสุดขยับไปหมุดถัดไปในทิศเดิมทุกครั้ง
  slide(side) {
    const at = this.smallest(this.here.towers)
    if (at < 0) return null
    return { from: at, to: this.next(at, side) }
  }

  // ถ้าไม่แตะจานเล็กสุด ตาที่ถูกกติกาจะเหลือแค่ตาเดียวเสมอ
  forced() {
    const skip = this.smallest(this.here.towers)

    for (const ตา of this.moves(this.here.towers)) {
      if (ตา.from === skip || ตา.to === skip) continue
      return ตา
    }

    return null
  }`

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

const odd = (value: BlockNode) =>
  compare(block('math-fn', { fn: 'mod' }, { left: value, right: number(2) }), 'eq', number(1))

const even = (value: BlockNode) =>
  compare(block('math-fn', { fn: 'mod' }, { left: value, right: number(2) }), 'eq', number(0))

const PLAN_STATEMENTS: Array<[string, string]> = [
  ['planStart', 'hanoi.plan-start'],
  ['planTake', 'hanoi.plan-take'],
  ['planMove', 'hanoi.plan-move'],
  ['planSplit', 'hanoi.plan-split']
]

const PLAN_VALUES: Array<[string, string]> = [
  ['planOpen', 'hanoi.plan-open'],
  ['planSingle', 'hanoi.plan-single'],
  ['planSize', 'hanoi.plan-size'],
  ['planCount', 'hanoi.plan-count']
]

const PEG_VALUES: Array<[string, string]> = [
  ['topOf', 'hanoi.top'],
  ['heightOf', 'hanoi.count'],
  ['isEmpty', 'hanoi.empty'],
  ['hasSmallest', 'hanoi.has-smallest']
]

const STATEMENT_PARSERS: Matcher[] = [
  ...PLAN_STATEMENTS.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        node.type === 'ExpressionStatement' && ctx.call(node.expression, name) ? ctx.make(kind) : null
  ),

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'planAnswer') ? ctx.make('hanoi.plan-answer') : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (!back) return null

    const args = ctx.call(back, 'play')
    if (!args) return null

    const from = ctx.str(args[0]!)
    const to = ctx.str(args[1]!)
    return from && to ? ctx.make('hanoi.move', { from, to }) : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (!back) return null

    const args = ctx.call(back, 'slide')
    const side = args ? ctx.str(args[0]!) : null
    return side ? ctx.make('hanoi.slide', { side }) : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'forced') ? ctx.make('hanoi.forced') : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (back === undefined) return null
    if (back === null) return ctx.make('hanoi.stop')
    return back.type === 'Literal' && back.value === null ? ctx.make('hanoi.stop') : null
  }
]

const VALUE_PARSERS: Matcher[] = [
  ...PLAN_VALUES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        ctx.call(node, name) ? ctx.make(kind) : null
  ),
  (node, ctx) => (ctx.call(node, 'done') ? ctx.make('hanoi.solved') : null),
  ...PEG_VALUES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) => {
        const args = ctx.call(node, name)
        const peg = args ? ctx.str(args[0]!) : null
        return peg ? ctx.make(kind, { peg }) : null
      }
  ),
  (node, ctx) => {
    const args = ctx.call(node, 'canPlay')
    if (!args) return null

    const from = ctx.str(args[0]!)
    const to = ctx.str(args[1]!)
    return from && to ? ctx.make('hanoi.can-move', { from, to }) : null
  },
  (node, ctx) => (ctx.thisProp(node, 'here', 'move') ? ctx.make('hanoi.turn') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'disks') ? ctx.make('hanoi.disks') : null)
]

function unwrap(statements: Node[], ctx: ParseContext): Node[] {
  const list = statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

  const last = list[list.length - 1]
  if (
    last?.type === 'ReturnStatement' &&
    last.argument?.type === 'Literal' &&
    last.argument.value === null
  ) {
    list.pop()
  }

  return list
}

function unwrapPlan(statements: Node[], ctx: ParseContext): Node[] {
  return statements.filter((node, index) => {
    if (node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here')) return false

    const back = ctx.returned(node)
    if (back && ctx.call(back, 'planAnswer') && index === statements.length - 1) return false

    return true
  })
}

/**
 * ชื่อไทยของคำสั่งที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง"
 *
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว (watch() ใน agent.worker.ts) ยอดจึงมาฟรี
 * ตรงนี้แค่เลือกว่าตัวไหนคือ "งาน" ที่ควรให้เห็น แล้วตั้งชื่อให้อ่านออก
 * เมธอดที่ไม่อยู่ในนี้ยังถูกนับ แต่ไม่ถูกแสดง
 */
export const WORK_LABEL: Record<string, string> = {
  // วางแผนทั้งชุด
  planTake: 'หยิบงานจากกอง',
  planSplit: 'แตกงานเป็นงานย่อย',
  planMove: 'จดตาย้ายลงแผน',
  // ย้ายทีละตา
  slide: 'ย้ายจานเล็กสุด',
  forced: 'ย้ายตาที่เหลืออยู่ตาเดียว',
  play: 'ย้ายจานตามที่สั่ง',
  // มองกอง
  moves: 'ไล่ดูตาที่ถูกกติกา',
  smallest: 'หาว่าจานเล็กสุดอยู่หมุดไหน',
  canPlay: 'ตรวจว่าย้ายได้ไหม',
  topOf: 'ดูจานบนสุดของหมุด',
  heightOf: 'นับจานบนหมุด',
  hasSmallest: 'ดูว่าจานเล็กสุดอยู่หมุดนี้ไหม',
  isEmpty: 'ดูว่าหมุดว่างไหม',
  done: 'เช็กว่าย้ายครบหรือยัง'
}

export const HANOI_PACK = createPack({
  id: 'hanoi',
  blocks: [...BLOCKS, ...PLAN_BLOCKS],
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'HanoiAgent',
    fields: [],
    helpers: HELPERS,
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
          writer.push('// อ่านจนจบแล้วไม่เจอบล็อกที่สั่งย้าย ก็จบรอบตรงนี้')
          writer.push('return null')
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: PLAN_HAT,
        name: 'solve',
        unwrap: unwrapPlan,

        skipWhenEmpty: true,
        write: (writer) => {
          writer.push('solve(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.push('')
          writer.body()
          writer.push('')
          writer.push('// เผื่อลืมบล็อก "ตอบลำดับการย้ายที่วางไว้" ก็ตอบให้ตอนจบอยู่ดี')
          writer.push('return this.planAnswer()')
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    {
      id: 'starter',
      name: 'เริ่มต้น',
      description:
        'ย้ายจานเล็กสุดไปทางขวาทุกตา — จานเล็กวนอยู่สามหมุดไม่จบสักที เพราะขาดอีกครึ่งของกฎ คือตาคู่ต้องย้ายจานอื่น ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'hanoi.on-turn': [block('hanoi.slide', { side: 'right' })]
        }
      })
    },
    {
      id: 'recursive',
      name: 'แบ่งแล้วพิชิต',
      description:
        'งานใหญ่หนึ่งชิ้นถูกแตกเป็นงานเล็กแบบเดียวกันสามชิ้นไปเรื่อย ๆ จนเหลือจานใบเดียวที่ย้ายได้ทันที — ได้คำตอบที่สั้นที่สุดเท่าที่เป็นไปได้เสมอ',
      build: (): BlockProgram => ({
        name: 'แบ่งแล้วพิชิต',
        scripts: {
          'hanoi.on-plan': [
            block('hanoi.plan-start'),
            block(
              'while',
              {},
              { cond: block('hanoi.plan-open') },
              {
                do: [
                  block('hanoi.plan-take'),
                  block(
                    'if-else',
                    {},
                    { cond: block('hanoi.plan-single') },
                    { then: [block('hanoi.plan-move')], else: [block('hanoi.plan-split')] }
                  )
                ]
              }
            ),
            block('hanoi.plan-answer')
          ]
        }
      })
    },
    {
      id: 'iterative',
      name: 'กฎสลับตา',
      description:
        'ไม่ต้องวางแผนล่วงหน้าเลย ตาคี่ย้ายจานเล็กสุดไปทางเดิมเสมอ ตาคู่ย้ายตาที่เหลืออยู่ตาเดียว — ได้จำนวนตาเท่ากับแบ่งแล้วพิชิตเป๊ะ',
      build: (): BlockProgram => ({
        name: 'กฎสลับตา',
        scripts: {
          'hanoi.on-turn': [
            block(
              'if-else',
              {},
              { cond: odd(block('hanoi.turn')) },
              {
                then: [

                  block(
                    'if-else',
                    {},
                    { cond: even(block('hanoi.disks')) },
                    {
                      then: [block('hanoi.slide', { side: 'right' })],
                      else: [block('hanoi.slide', { side: 'left' })]
                    }
                  )
                ],
                else: [block('hanoi.forced')]
              }
            )
          ]
        }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'recursive'
