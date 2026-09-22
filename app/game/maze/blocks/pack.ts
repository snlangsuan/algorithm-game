import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'
import { MAZE_EXPLAIN } from './explain'

const SIDES: SelectOption[] = [
  { value: 'ahead', label: 'ข้างหน้า' },
  { value: 'hand-right', label: 'ทางขวามือ' },
  { value: 'hand-left', label: 'ทางซ้ายมือ' },
  { value: 'behind', label: 'ข้างหลัง' },
  { value: 'up', label: 'ด้านบน' },
  { value: 'right', label: 'ด้านขวา' },
  { value: 'down', label: 'ด้านล่าง' },
  { value: 'left', label: 'ด้านซ้าย' }
]

const DIRECTIONS: SelectOption[] = [
  { value: 'up', label: 'บน' },
  { value: 'right', label: 'ขวา' },
  { value: 'down', label: 'ล่าง' },
  { value: 'left', label: 'ซ้าย' }
]

const TURNS: SelectOption[] = [
  { value: 'right', label: 'ขวา' },
  { value: 'left', label: 'ซ้าย' },
  { value: 'back', label: 'กลับหลัง' }
]

const HAT: BlockSpec = {
  kind: 'maze.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาเดิน',
  hint: 'ระบบอ่านบล็อกที่ต่อไว้ข้างล่างนี้ทุกตา',
  parts: [{ type: 'text', text: 'เมื่อถึงตาเดิน' }],
  emit: () => {}
}

const PLAN_HAT: BlockSpec = {
  kind: 'maze.on-plan',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อวางแผนเส้นทาง',
  hint: 'ทำงานครั้งเดียวก่อนออกเดิน เห็นแผนที่ทั้งใบ — ใช้บล็อกหมวดวางแผนตรงนี้',
  parts: [{ type: 'text', text: 'เมื่อวางแผนเส้นทาง' }],
  emit: () => {}
}

const HAT_START: BlockSpec = {
  kind: 'maze.on-start',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อเริ่มรอบ',
  hint: 'ทำครั้งเดียวก่อนออกเดิน — เหมาะกับการโหลดสิ่งที่จำไว้จากรอบก่อน',
  parts: [{ type: 'text', text: 'เมื่อเริ่มรอบ' }],
  emit: () => {}
}

const HAT_FINISH: BlockSpec = {
  kind: 'maze.on-finish',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อจบรอบ',
  hint: 'ทำครั้งเดียวตอนรอบจบ ไม่ว่าจะถึงทางออกหรือไม่ — เหมาะกับการจำสิ่งที่ได้ผลไว้ใช้รอบหน้า เช่นทิ้งกลิ่นของมด',
  parts: [{ type: 'text', text: 'เมื่อจบรอบ' }],
  emit: () => {}
}

const ANT_MODES: SelectOption[] = [
  { value: 'scent', label: 'สุ่มตามกลิ่น' },
  { value: 'strongest', label: 'กลิ่นแรงที่สุด' }
]

/** บล็อกของฝูงมด (ACO) — กลิ่นถูกจำไว้ข้ามรอบเอง ใช้คู่กับหัวบล็อก "เมื่อถึงตาเดิน" กับ "เมื่อจบรอบ" */
const ANT_BLOCKS: BlockSpec[] = [
  {
    kind: 'maze.ant-walk',
    shape: 'statement',
    category: 'action',
    title: 'มด: เดินตามกลิ่น',
    hint: 'มดเห็นแค่ช่องข้าง ๆ ตัว — "สุ่มตามกลิ่น" ให้ทางที่กลิ่นฟีโรโมนแรง ถูก (ไม่ใช่โคลน) และยังไม่เคยเหยียบ มีโอกาสถูกเลือกมากกว่า · "กลิ่นแรงที่สุด" ไม่สุ่ม ใช้ดูว่าฝูงจำทางไหนไว้',
    parts: [
      { type: 'text', text: 'มด: เดินไปทางที่' },
      { type: 'field', name: 'mode', options: ANT_MODES }
    ],
    emit: (node, ctx) => ctx.line(node, `return (this.facing = this.antStep(${quote(ctx.field(node, 'mode'))}))`)
  },
  {
    kind: 'maze.ant-scent',
    shape: 'statement',
    category: 'data',
    title: 'มด: ทิ้งกลิ่น',
    hint: 'ถ้ามดตัวนี้ถึงทางออก ตัดวงวนออกจากทางที่มันเดินมา แล้วทิ้งกลิ่นตามทางนั้น ทางยิ่งถูกกลิ่นยิ่งแรง — กลิ่นเก่าระเหยไปทุกรอบ ใช้ในหัวบล็อก "เมื่อจบรอบ"',
    parts: [{ type: 'text', text: 'มด: ทิ้งกลิ่นตามทางที่เดินมา' }],
    emit: (node, ctx) => ctx.line(node, 'this.antLayScent()')
  }
]

const PLAN_BLOCKS: BlockSpec[] = [
  {
    kind: 'maze.plan-start',
    shape: 'statement',
    category: 'action',
    title: 'เริ่มวางแผน',
    hint: 'ล้างคิวแล้วใส่ช่องเริ่มต้นเข้าไป ต้องทำก่อนบล็อกวางแผนตัวอื่นเสมอ',
    parts: [{ type: 'text', text: 'เริ่มวางแผนจากช่องเริ่มต้น' }],
    emit: (node, ctx) => ctx.line(node, 'this.planStart()')
  },
  {
    kind: 'maze.plan-take',
    shape: 'statement',
    category: 'action',
    title: 'หยิบช่องจากคิว',
    hint: 'เอาช่องที่ลำดับดีที่สุดออกจากคิวมาเป็น "ช่องที่กำลังดู"',
    parts: [{ type: 'text', text: 'หยิบช่องที่ดีที่สุดออกจากคิว' }],
    emit: (node, ctx) => ctx.line(node, 'this.planTake()')
  },
  {
    kind: 'maze.plan-push',
    shape: 'statement',
    category: 'action',
    title: 'ใส่เพื่อนบ้านเข้าคิว',
    hint: 'ค่าที่ใส่ในช่องนี้คือสิ่งที่ทำให้ BFS, Dijkstra และ A* ต่างกัน',
    parts: [
      { type: 'text', text: 'ใส่เพื่อนบ้านเข้าคิว ด้วยลำดับ' },
      { type: 'input', name: 'priority', placeholder: 'ตัวเลข', accepts: 'number' }
    ],
    emit: (node, ctx) => ctx.line(node, `this.planPush(${ctx.value(node, 'priority', '0')})`)
  },
  {
    kind: 'maze.plan-answer',
    shape: 'statement',
    category: 'action',
    title: 'ตอบเส้นทาง',
    hint: 'ส่งเส้นทางที่วางไว้กลับให้หุ่นเดินตาม',
    parts: [{ type: 'text', text: 'ตอบเส้นทางที่วางไว้' }],
    emit: (node, ctx) => ctx.line(node, 'return this.planAnswer()')
  },
  {
    kind: 'maze.plan-each',
    shape: 'statement',
    category: 'control',
    title: 'สำหรับเพื่อนบ้านแต่ละช่อง',
    hint: 'ไล่ดูช่องที่เดินต่อจากช่องที่กำลังดูได้ ทีละช่อง',
    parts: [
      { type: 'text', text: 'สำหรับเพื่อนบ้านแต่ละช่องของช่องที่กำลังดู' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, 'for (const เพื่อนบ้าน of this.planNeighbors()) {')
      ctx.indent(1)
      ctx.raw('this.planFocus(เพื่อนบ้าน)')
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'maze.plan-open',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'คิวยังไม่ว่าง',
    parts: [{ type: 'text', text: 'คิวยังไม่ว่าง' }],
    emit: () => 'this.planOpen()'
  },
  {
    kind: 'maze.plan-at-goal',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ช่องที่กำลังดูคือทางออก',
    parts: [{ type: 'text', text: 'ช่องที่กำลังดูคือทางออก' }],
    emit: () => 'this.planAtGoal()'
  },
  {
    kind: 'maze.plan-seen',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เพื่อนบ้านนี้เคยเจอแล้ว',
    parts: [{ type: 'text', text: 'เพื่อนบ้านนี้เคยเจอแล้ว' }],
    emit: () => 'this.planSeen()'
  },
  {
    kind: 'maze.plan-cost',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ราคาถึงเพื่อนบ้าน',
    hint: 'ราคารวมจากช่องเริ่มต้นมาถึงเพื่อนบ้านช่องนี้ นับโคลนแพงกว่าพื้นปกติ',
    parts: [{ type: 'text', text: 'ราคาที่จ่ายมาถึงเพื่อนบ้าน' }],
    emit: () => 'this.planCost()'
  },
  {
    kind: 'maze.plan-steps',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนก้าวถึงเพื่อนบ้าน',
    hint: 'นับเป็นจำนวนก้าวเปล่า ๆ ไม่สนว่าช่องไหนแพงกว่าช่องไหน',
    parts: [{ type: 'text', text: 'จำนวนก้าวถึงเพื่อนบ้าน' }],
    emit: () => 'this.planSteps()'
  },
  {
    kind: 'maze.plan-left',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะตรงถึงทางออก',
    hint: 'ระยะแบบเดินตามแนวตั้งฉากจากเพื่อนบ้านถึงทางออก ใช้เป็นตัวเดาของ A*',
    parts: [{ type: 'text', text: 'ระยะตรงจากเพื่อนบ้านถึงทางออก' }],
    emit: () => 'this.planLeft()'
  }
]

const BLOCKS: BlockSpec[] = [
  {
    kind: 'maze.walk',
    shape: 'statement',
    category: 'action',
    title: 'เดินหน้า',
    hint: 'ก้าวไปหนึ่งช่องตามทิศที่หันอยู่ แล้วจบตานี้',
    parts: [{ type: 'text', text: 'เดินหน้า' }],
    emit: (node, ctx) => ctx.line(node, 'return this.facing')
  },
  {
    kind: 'maze.walk-dir',
    shape: 'statement',
    category: 'action',
    title: 'เดินไปทาง',
    hint: 'หันไปทางนั้นแล้วก้าวหนึ่งช่อง จบตานี้',
    parts: [
      { type: 'text', text: 'เดินไปทาง' },
      { type: 'field', name: 'dir', options: DIRECTIONS }
    ],
    emit: (node, ctx) => ctx.line(node, `return (this.facing = ${quote(ctx.field(node, 'dir'))})`)
  },
  {
    kind: 'maze.turn',
    shape: 'statement',
    category: 'action',
    title: 'หัน',
    hint: 'หมุนตัวอยู่กับที่ ยังไม่นับเป็นก้าว',
    parts: [
      { type: 'text', text: 'หัน' },
      { type: 'field', name: 'side', options: TURNS }
    ],
    emit: (node, ctx) => {
      const side = ctx.field(node, 'side')
      if (side === 'back') {
        ctx.line(node, "this.facing = this.turn(this.turn(this.facing, 'right'), 'right')")
        return
      }
      ctx.line(node, `this.facing = this.turn(this.facing, ${quote(side)})`)
    }
  },
  {
    kind: 'maze.face',
    shape: 'statement',
    category: 'action',
    title: 'หันไปทาง',
    parts: [
      { type: 'text', text: 'หันไปทาง' },
      { type: 'field', name: 'dir', options: DIRECTIONS }
    ],
    emit: (node, ctx) => ctx.line(node, `this.facing = ${quote(ctx.field(node, 'dir'))}`)
  },
  {
    kind: 'maze.mark',
    shape: 'statement',
    category: 'action',
    title: 'ระบายสีช่องนี้',
    hint: 'ทำเครื่องหมายช่องที่ยืนอยู่ ไว้ดูว่าเดินผ่านตรงไหนมาบ้าง',
    parts: [{ type: 'text', text: 'ระบายสีช่องนี้' }],
    emit: (node, ctx) => ctx.line(node, 'this.visit(this.here.position.row, this.here.position.col)')
  },
  {
    kind: 'maze.stop',
    shape: 'statement',
    category: 'action',
    title: 'หยุดเดิน',
    parts: [{ type: 'text', text: 'หยุดเดิน' }],
    emit: (node, ctx) => ctx.line(node, 'return null')
  },
  {
    kind: 'maze.blocked',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เป็นกำแพง',
    parts: [
      { type: 'text', text: 'เป็นกำแพง' },
      { type: 'field', name: 'side', options: SIDES }
    ],
    emit: (node, ctx) => `this.blocked(${quote(ctx.field(node, 'side'))})`
  },
  {
    kind: 'maze.muddy',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เป็นโคลน',
    parts: [
      { type: 'text', text: 'เป็นโคลน' },
      { type: 'field', name: 'side', options: SIDES }
    ],
    emit: (node, ctx) => `this.muddy(${quote(ctx.field(node, 'side'))})`
  },
  {
    kind: 'maze.stepped',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เคยเหยียบแล้ว',
    parts: [
      { type: 'text', text: 'เคยเหยียบช่อง' },
      { type: 'field', name: 'side', options: SIDES }
    ],
    emit: (node, ctx) => `this.stepped(${quote(ctx.field(node, 'side'))})`
  },
  {
    kind: 'maze.footprints',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'รอยเท้าของช่อง',
    hint: 'จำนวนครั้งที่เคยเหยียบช่องนั้น',
    parts: [
      { type: 'text', text: 'รอยเท้าของช่อง' },
      { type: 'field', name: 'side', options: SIDES }
    ],
    emit: (node, ctx) => `this.footprints(${quote(ctx.field(node, 'side'))})`
  },
  {
    kind: 'maze.at-goal',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ยืนอยู่ที่ทางออก',
    parts: [{ type: 'text', text: 'ยืนอยู่ที่ทางออก' }],
    emit: () => 'this.same(this.here.position, this.here.goal)'
  },
  {
    kind: 'maze.goal-side',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ทางออกอยู่ทาง',
    parts: [
      { type: 'text', text: 'ทางออกอยู่ทาง' },
      { type: 'field', name: 'dir', options: DIRECTIONS }
    ],
    emit: (node, ctx) => `this.goalSide(${quote(ctx.field(node, 'dir'))})`
  },
  {
    kind: 'maze.distance',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะถึงทางออก',
    parts: [{ type: 'text', text: 'ระยะถึงทางออก' }],
    emit: () => 'this.manhattan(this.here.position, this.here.goal)'
  },
  {
    kind: 'maze.steps',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ก้าวที่เดินมาแล้ว',
    parts: [{ type: 'text', text: 'ก้าวที่เดินมาแล้ว' }],
    emit: () => 'this.here.step'
  }
]

const RETRIES = 8

const HELPERS = `
  // ---------- ตัวช่วยของบล็อกวางแผนเส้นทาง ----------
  // ทุกตัวปลอดภัยแม้ยังไม่ได้ "เริ่มวางแผน" — จะไม่ทำอะไรแทนที่จะพัง

  planStart() {
    const start = this.here.start
    this.plan = {
      queue: this.heap(),
      from: new Map(),
      cost: new Map(),
      steps: new Map(),
      best: new Map(),
      at: start,
      near: null
    }
    const id = this.key(start)
    this.plan.cost.set(id, 0)
    this.plan.steps.set(id, 0)
    this.plan.from.set(id, null)
    this.plan.queue.push(start, 0)
  }

  planOpen() {
    return Boolean(this.plan) && this.plan.queue.size > 0
  }

  planTake() {
    if (!this.plan) return
    const cell = this.plan.queue.pop()
    if (cell) {
      this.plan.at = cell
      this.visit(cell)
    }
  }

  planAtGoal() {
    return Boolean(this.plan) && this.same(this.plan.at, this.here.goal)
  }

  planNeighbors() {
    if (!this.plan) return []
    return this.neighbors(this.here.grid, this.plan.at.row, this.plan.at.col)
  }

  planFocus(cell) {
    if (this.plan) this.plan.near = cell
  }

  planSeen() {
    if (!this.plan || !this.plan.near) return false
    return this.plan.from.has(this.key(this.plan.near))
  }

  planCost() {
    if (!this.plan || !this.plan.near) return 0
    const paid = this.plan.cost.get(this.key(this.plan.at)) ?? 0
    return paid + this.cost(this.here.grid, this.plan.near.row, this.plan.near.col)
  }

  planSteps() {
    if (!this.plan || !this.plan.near) return 0
    return (this.plan.steps.get(this.key(this.plan.at)) ?? 0) + 1
  }

  planLeft() {
    if (!this.plan || !this.plan.near) return 0
    return this.manhattan(this.plan.near, this.here.goal)
  }

  // ใส่เข้าคิวเฉพาะตอนที่ลำดับดีกว่าที่เคยได้ ลืมเช็ค "เคยเจอแล้ว" ก็ยังวนไม่จบ
  // ตัดสินจากลำดับที่ผู้เล่นใส่มา จึงใช้ได้เหมือนกันหมดทั้ง BFS (นับก้าว), Dijkstra (ราคา) และ A* (ราคา+ระยะ)
  planPush(priority) {
    if (!this.plan || !this.plan.near) return

    const id = this.key(this.plan.near)
    const rank = Number(priority) || 0
    const best = this.plan.best.get(id)
    if (best !== undefined && rank >= best) return

    this.plan.best.set(id, rank)
    this.plan.cost.set(id, this.planCost())
    this.plan.steps.set(id, this.planSteps())
    this.plan.from.set(id, this.plan.at)
    this.plan.queue.push({ row: this.plan.near.row, col: this.plan.near.col }, rank)
  }

  planAnswer() {
    if (!this.plan) return null
    return this.rebuild(this.plan.from, this.here.goal)
  }

  // ---------- ตัวช่วยของบล็อก ----------

  // แปลงทิศแบบอิงตัวเรา (ข้างหน้า/ขวามือ) ให้เป็นทิศบนแผนที่
  toward(side) {
    if (side === 'ahead') return this.facing
    if (side === 'hand-right') return this.turn(this.facing, 'right')
    if (side === 'hand-left') return this.turn(this.facing, 'left')
    if (side === 'behind') return this.turn(this.turn(this.facing, 'right'), 'right')
    return side
  }

  near(side) {
    return this.ahead(this.here.position, this.toward(side))
  }

  blocked(side) {
    const cell = this.near(side)
    return !this.walkable(this.here.grid, cell.row, cell.col)
  }

  muddy(side) {
    const cell = this.near(side)
    if (!this.walkable(this.here.grid, cell.row, cell.col)) return false
    return this.cost(this.here.grid, cell.row, cell.col) > 1
  }

  footprints(side) {
    const cell = this.near(side)
    return this.here.visits[this.key(cell.row, cell.col)] ?? 0
  }

  stepped(side) {
    return this.footprints(side) > 0
  }

  goalSide(dir) {
    const me = this.here.position
    const goal = this.here.goal
    if (dir === 'up') return goal.row < me.row
    if (dir === 'down') return goal.row > me.row
    if (dir === 'left') return goal.col < me.col
    return goal.col > me.col
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

const not = (value: BlockNode) => block('not', {}, { value })
const and = (left: BlockNode, right: BlockNode) => block('and', {}, { left, right })
const wall = (side: string) => block('maze.blocked', { side })
const turn = (side: string) => block('maze.turn', { side })
const walk = () => block('maze.walk')
const number = (value: number) => block('number', { value })
const readVar = (name: string) => block('var-get', { name })
const footprints = (side: string) => block('maze.footprints', { side })
const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

const planWith = (name: string, priority: BlockNode): BlockProgram => ({
  name,
  scripts: {
    'maze.on-plan': [
      block('maze.plan-start'),
      block(
        'while',
        {},
        { cond: block('maze.plan-open') },
        {
          do: [
            block('maze.plan-take'),
            block('if', {}, { cond: block('maze.plan-at-goal') }, { then: [block('maze.plan-answer')] }),
            block(
              'maze.plan-each',
              {},
              {},
              {
                do: [
                  block(
                    'if',
                    {},
                    { cond: not(block('maze.plan-seen')) },
                    { then: [block('maze.plan-push', {}, { priority })] }
                  )
                ]
              }
            )
          ]
        }
      ),
      block('maze.plan-answer')
    ]
  }
})

const keepIfFewer = (side: string, code: number) =>
  block(
    'if',
    {},
    { cond: and(not(wall(side)), compare(footprints(side), 'lt', readVar('a'))) },
    {
      then: [
        block('set-var', { name: 'a' }, { value: footprints(side) }),
        block('set-var', { name: 'b' }, { value: number(code) })
      ]
    }
  )

const turnIfChosen = (code: number, side: string) =>
  block('if', {}, { cond: compare(readVar('b'), 'eq', number(code)) }, { then: [turn(side)] })

const PLAN_STATEMENTS: Array<[string, string]> = [
  ['planStart', 'maze.plan-start'],
  ['planTake', 'maze.plan-take']
]

const PLAN_VALUES: Array<[string, string]> = [
  ['planOpen', 'maze.plan-open'],
  ['planAtGoal', 'maze.plan-at-goal'],
  ['planSeen', 'maze.plan-seen'],
  ['planCost', 'maze.plan-cost'],
  ['planSteps', 'maze.plan-steps'],
  ['planLeft', 'maze.plan-left']
]

const STATEMENT_PARSERS: Matcher[] = [
  (node, ctx) => (node.type === 'ExpressionStatement' && ctx.call(node.expression, 'antLayScent') ? ctx.make('maze.ant-scent') : null),
  (node, ctx) => {
    const back = ctx.returned(node)
    if (!back || back.type !== 'AssignmentExpression' || !ctx.thisProp(back.left, 'facing')) return null
    const args = ctx.call(back.right, 'antStep')
    const mode = args ? ctx.str(args[0]!) : null
    return mode && ANT_MODES.some((option) => option.value === mode) ? ctx.make('maze.ant-walk', { mode }) : null
  },
  ...PLAN_STATEMENTS.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        node.type === 'ExpressionStatement' && ctx.call(node.expression, name) ? ctx.make(kind) : null
  ),

  (node, ctx) => {
    if (node.type !== 'ExpressionStatement') return null
    const args = ctx.call(node.expression, 'planPush')
    return args ? ctx.make('maze.plan-push', {}, { priority: ctx.value(args[0]!) }) : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'planAnswer') ? ctx.make('maze.plan-answer') : null
  },

  (node, ctx) => {
    if (node.type !== 'ForOfStatement') return null
    if (!ctx.call(node.right, 'planNeighbors')) return null

    const inner = (node.body?.body ?? []).filter(
      (item: Node) =>
        !(item.type === 'ExpressionStatement' && ctx.call(item.expression, 'planFocus'))
    )

    return ctx.make('maze.plan-each', {}, {}, { do: inner.flatMap((item: Node) => ctx.body(item)) })
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (back === undefined) return null

    if (back === null) return ctx.make('maze.stop')

    if (back.type === 'Literal') {
      if (back.value === null) return ctx.make('maze.stop')

      const dir = ctx.str(back)
      return dir && DIRECTIONS.some((option) => option.value === dir)
        ? ctx.make('maze.walk-dir', { dir })
        : null
    }

    if (ctx.thisProp(back, 'facing')) return ctx.make('maze.walk')

    if (back.type === 'AssignmentExpression' && ctx.thisProp(back.left, 'facing')) {
      const dir = ctx.str(back.right)
      if (dir) return ctx.make('maze.walk-dir', { dir })
    }

    return null
  },
  (node, ctx) => {
    if (node.type !== 'ExpressionStatement') return null

    const assign = node.expression
    if (assign?.type !== 'AssignmentExpression' || !ctx.thisProp(assign.left, 'facing')) return null

    const dir = ctx.str(assign.right)
    if (dir) return ctx.make('maze.face', { dir })

    const outer = ctx.call(assign.right, 'turn')
    if (!outer) return null

    const inner = ctx.call(outer[0]!, 'turn')
    if (inner) return ctx.make('maze.turn', { side: 'back' })

    const side = ctx.str(outer[1]!)
    return side ? ctx.make('maze.turn', { side }) : null
  },
  (node, ctx) => {
    if (node.type !== 'ExpressionStatement') return null
    return ctx.call(node.expression, 'visit') ? ctx.make('maze.mark') : null
  }
]

const VALUE_PARSERS: Matcher[] = [
  ...PLAN_VALUES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        ctx.call(node, name) ? ctx.make(kind) : null
  ),
  ...(['blocked', 'muddy', 'stepped', 'footprints'] as const).map<Matcher>(
    (name) => (node, ctx) => {
      const args = ctx.call(node, name)
      const side = args ? ctx.str(args[0]!) : null
      return side ? ctx.make(`maze.${name === 'blocked' ? 'blocked' : name}`, { side }) : null
    }
  ),
  (node, ctx) => {
    const args = ctx.call(node, 'goalSide')
    const dir = args ? ctx.str(args[0]!) : null
    return dir ? ctx.make('maze.goal-side', { dir }) : null
  },
  (node, ctx) => (ctx.call(node, 'same') ? ctx.make('maze.at-goal') : null),
  (node, ctx) => (ctx.call(node, 'manhattan') ? ctx.make('maze.distance') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'step') ? ctx.make('maze.steps') : null)
]

function unwrapPlan(statements: Node[], ctx: ParseContext): Node[] {
  return statements.filter((node) => {
    if (node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here')) return false

    const back = ctx.returned(node)
    if (back && ctx.call(back, 'planAnswer') && node === statements[statements.length - 1]) return false

    return true
  })
}

/** ตัดบรรทัดที่ codegen เขียนให้เองในหัวบล็อกเริ่มรอบ/จบรอบออก ก่อนอ่านโค้ดกลับเป็นบล็อก */
const unwrapHere = (statements: Node[], ctx: ParseContext): Node[] =>
  statements.filter(
    (node) =>
      !(
        node.type === 'ExpressionStatement' &&
        (ctx.thisProp(node.expression?.left, 'here') || ctx.thisProp(node.expression?.left, 'result'))
      )
  )

function unwrap(statements: Node[], ctx: ParseContext): Node[] {
  const retry = statements.find(
    (node) => node.type === 'ForStatement' && node.test?.right?.value === RETRIES
  )

  if (retry) return retry.body?.body ?? []

  return statements.filter((node) => {
    if (node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here')) return false
    if (node.type === 'ReturnStatement' && !node.argument) return false
    if (node.type === 'ReturnStatement' && node.argument?.type === 'Literal' && node.argument.value === null) {
      return false
    }
    return true
  })
}

export const MAZE_PACK = createPack({
  id: 'maze',
  blocks: [...BLOCKS, ...ANT_BLOCKS, ...PLAN_BLOCKS],
  explain: MAZE_EXPLAIN,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'MazeAgent',
    fields: [`facing = 'right'`],
    helpers: HELPERS,
    memory: true,
    methods: [
      {
        hat: HAT_START,
        name: 'onStart',
        // ไม่ได้ต่ออะไรไว้ก็ไม่ต้องเขียนเมธอดเปล่า ๆ ให้รก
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
        hat: HAT_FINISH,
        name: 'onFinish',
        skipWhenEmpty: true,
        unwrap: unwrapHere,
        write: (writer) => {
          writer.push('onFinish(result) {')
          writer.indent(1)
          writer.push('this.result = result')
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
          writer.push(`// หันแล้วยังไม่ได้เดิน ก็วนอ่านโปรแกรมใหม่อีกรอบ (ไม่เกิน ${RETRIES} รอบต่อหนึ่งตา)`)
          writer.push(`for (let รอบ = 0; รอบ < ${RETRIES}; รอบ++) {`)
          writer.indent(1)
          writer.body()
          writer.indent(-1)
          writer.push('}')
          writer.push('')
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
          writer.push('// เผื่อลืมบล็อก "ตอบเส้นทางที่วางไว้" ก็ตอบให้ตอนจบอยู่ดี')
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
      description: 'เดินหน้าไปเรื่อย ๆ ชนกำแพงก็หันขวา — ยังไปไม่ถึงทางออก ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'maze.on-turn': [
          block('maze.mark'),
          block('if-else', {}, { cond: not(wall('ahead')) }, { then: [walk()], else: [turn('right')] })
          ]
        }
      })
    },
    {
      id: 'dfs',
      name: 'DFS ค้นลึกก่อน',
      description:
        'โครงเดียวกับ BFS เป๊ะ ต่างแค่ใส่ลบข้างหน้า "จำนวนก้าว" — พอลำดับกลับด้าน คิวก็หยิบช่องที่ลึกที่สุดก่อน มันจึงมุดไปทางเดียวจนสุดก่อนถอยกลับ เปิดดูน้อยกว่ามาก แต่ไม่รับประกันว่าเส้นทางจะสั้นที่สุด',
      build: (): BlockProgram =>
        planWith(
          'DFS ของฉัน',
          block(
            'math',
            { op: 'sub' },
            { left: number(0), right: block('maze.plan-steps') }
          )
        )
    },
    {
      id: 'bfs',
      name: 'BFS ค้นทีละชั้น',
      description:
        'แผ่ออกเป็นวงทีละชั้นจนเจอทางออก — ใส่คิวด้วย "จำนวนก้าว" จึงได้ทางที่ก้าวน้อยที่สุด แต่ไม่สนว่าเหยียบโคลนไปกี่ช่อง',
      build: (): BlockProgram => planWith('BFS ของฉัน', block('maze.plan-steps'))
    },
    {
      id: 'dijkstra',
      name: 'Dijkstra เลี่ยงโคลน',
      description:
        'โครงเดียวกับ BFS เป๊ะ ต่างแค่บล็อกเดียว — เปลี่ยนจาก "จำนวนก้าว" เป็น "ราคาที่จ่ายมา" ซึ่งนับโคลนแพงกว่า จึงอ้อมเลี่ยงโคลนเป็น',
      build: (): BlockProgram => planWith('Dijkstra ของฉัน', block('maze.plan-cost'))
    },
    {
      id: 'astar',
      name: 'A* มีเข็มทิศ',
      description:
        'เพิ่มบล็อกเดียวจาก Dijkstra — บวก "ระยะตรงถึงทางออก" เข้าไปในลำดับ ทำให้พุ่งไปทางเป้าหมาย สำรวจน้อยลงมาก',
      build: (): BlockProgram =>
        planWith(
          'A* ของฉัน',
          block(
            'math',
            { op: 'add' },
            { left: block('maze.plan-cost'), right: block('maze.plan-left') }
          )
        )
    },
    {
      id: 'wall',
      name: 'เลาะกำแพงขวา',
      description: 'เอามือขวาแตะกำแพงแล้วเดินไปเรื่อย ๆ ไม่ต้องจำแผนที่เลยสักช่อง',
      build: (): BlockProgram => ({
        name: 'เลาะกำแพงขวา',
        scripts: {
          'maze.on-turn': [
          block('maze.mark'),
          block(
            'if-else',
            {},
            { cond: not(wall('hand-right')) },
            {
              then: [turn('right'), walk()],
              else: [
                block(
                  'if-else',
                  {},
                  { cond: not(wall('ahead')) },
                  { then: [walk()], else: [turn('left')] }
                )
              ]
            }
          )
          ]
        }
      })
    },
    {
      id: 'mouse',
      name: 'หนูหาทาง (รอยเท้าน้อยสุด)',
      description: 'ดูทั้งสี่ทางแล้วเลือกทางที่เคยเหยียบน้อยที่สุด โดยจำค่าไว้ในตัวแปร',
      build: (): BlockProgram => ({
        name: 'หนูหาทาง',
        scripts: {
          'maze.on-turn': [
          block('maze.mark'),
          block('set-var', { name: 'a' }, { value: number(99) }),
          block('set-var', { name: 'b' }, { value: number(9) }),
          keepIfFewer('ahead', 0),
          keepIfFewer('hand-right', 1),
          keepIfFewer('hand-left', 2),
          keepIfFewer('behind', 3),
          block('if', {}, { cond: compare(readVar('b'), 'eq', number(9)) }, { then: [block('maze.stop')] }),
          turnIfChosen(1, 'right'),
          turnIfChosen(2, 'left'),
          turnIfChosen(3, 'back'),
          walk()
          ]
        }
      })
    },
    {
      id: 'random',
      name: 'สุ่มเดิน',
      description: 'เดินหน้าเรื่อย ๆ แต่สุ่มเลี้ยวเป็นครั้งคราว ชนกำแพงก็เลี้ยว',
      build: (): BlockProgram => ({
        name: 'สุ่มเดิน',
        scripts: {
          'maze.on-turn': [
          block('maze.mark'),
          block(
            'if',
            {},
            {
              cond: block(
                'or',
                {},
                { left: wall('ahead'), right: compare(block('random', { min: 0, max: 4 }), 'eq', number(0)) }
              )
            },
            {
              then: [
                block(
                  'if-else',
                  {},
                  { cond: compare(block('random', { min: 0, max: 1 }), 'eq', number(0)) },
                  { then: [turn('right')], else: [turn('left')] }
                )
              ]
            }
          ),
          block('if', {}, { cond: not(wall('ahead')) }, { then: [walk()] })
          ]
        }
      })
    },
    {
      id: 'ants',
      name: 'ฝูงมดหาทาง (ACO)',
      description:
        'มดไม่มีแผนที่ เห็นแค่ช่องข้าง ๆ กับกลิ่นที่มดตัวก่อน ๆ ทิ้งไว้ ทุกตาสุ่มเลือกทางโดยทางที่กลิ่นแรง ไม่ใช่โคลน และยังไม่เคยเหยียบ มีโอกาสมากกว่า ถึงทางออกแล้วทิ้งกลิ่นตามทางที่เดินมา (ตัดวงวนออกก่อน) ทางยิ่งถูกกลิ่นยิ่งแรง — กด "ฝึก" ปล่อยมดทีละร้อยตัว แล้วเปลี่ยนบล็อกเป็น "กลิ่นแรงที่สุด" ดูทางที่ฝูงเลือก · ลองกับเขาวงกตแบบมีทางวน (braid) ที่มีหลายทางให้เลือก',
      build: (): BlockProgram => ({
        name: 'ฝูงมดหาทาง (ACO)',
        scripts: {
          'maze.on-turn': [block('maze.ant-walk', { mode: 'scent' })],
          'maze.on-finish': [block('maze.ant-scent')]
        }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'wall'
