import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'
import { RUNNER_EXPLAIN } from './runner-explain'

/**
 * ชุดบล็อกของ "คนหนี" — สนามเดียวกับฝ่ายไล่ แต่คิดคนละเรื่อง
 * ฝ่ายไล่ถามว่าจะไปหาเขายังไง ฝ่ายหนีถามว่าจะไปให้ถึงของโดยไม่โดนจับยังไง
 */

const TARGETS: SelectOption[] = [
  { value: 'goal', label: 'เป้าหมายตอนนี้' },
  { value: 'gem', label: 'ของชิ้นที่ใกล้ฉันที่สุด' },
  { value: 'exit', label: 'ประตูหนี' },
  { value: 'hunter', label: 'ผู้ไล่ล่าที่ใกล้ที่สุด' },
  { value: 'safe', label: 'ช่องที่ไกลผู้ไล่ล่าที่สุดในสนาม' },
  { value: 'home', label: 'จุดเริ่มของฉัน' }
]

const DIRS: SelectOption[] = [
  { value: 'up', label: 'ขึ้น' },
  { value: 'right', label: 'ขวา' },
  { value: 'down', label: 'ลง' },
  { value: 'left', label: 'ซ้าย' }
]

const HAT: BlockSpec = {
  kind: 'runner.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาเดินของคนหนี',
  hint: 'ทำงานทุกจังหวะที่คนหนีได้เดิน — ใช้เฉพาะตอนตั้งให้ AI เป็นคนบังคับ ถ้าเล่นเองบล็อกชุดนี้จะพักไว้',
  parts: [{ type: 'text', text: 'เมื่อถึงตาเดินของคนหนี' }],
  emit: () => {}
}

const BLOCKS: BlockSpec[] = [
  {
    kind: 'runner.walk',
    shape: 'statement',
    category: 'action',
    title: 'เดินไปทาง',
    hint: 'เดินหนึ่งช่องแล้วจบตานี้ — ชนกำแพงก็ยืนอยู่กับที่',
    parts: [
      { type: 'text', text: 'เดินไปทาง' },
      { type: 'field', name: 'dir', options: DIRS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.go(${quote(ctx.field(node, 'dir'))})`)
  },
  {
    kind: 'runner.head-to',
    shape: 'statement',
    category: 'action',
    title: 'เดินตามทางที่สั้นที่สุดไปหา',
    hint: 'ทางที่เร็วที่สุด แต่ไม่ได้ดูเลยว่าระหว่างทางมีใครดักอยู่ไหม',
    parts: [
      { type: 'text', text: 'เดินตามทางที่สั้นที่สุดไปหา' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.stepTo(${quote(ctx.field(node, 'target'))})`)
  },
  {
    kind: 'runner.dodge',
    shape: 'statement',
    category: 'action',
    title: 'หนีให้ห่างผู้ไล่ล่าที่สุด',
    hint: 'เลือกช่องข้าง ๆ ที่ผู้ไล่ล่าที่ใกล้ที่สุดต้องเดินมาไกลที่สุด — เสมอกันค่อยเลือกช่องที่ใกล้เป้าหมายกว่า',
    parts: [{ type: 'text', text: 'หนีให้ห่างผู้ไล่ล่าที่สุด' }],
    emit: (node, ctx) => ctx.line(node, 'return this.dodge()')
  },
  {
    kind: 'runner.safe-step',
    shape: 'statement',
    category: 'action',
    title: 'เดินทางที่ปลอดภัยที่สุดโดยยังเข้าใกล้',
    hint: 'ชั่งสองอย่างพร้อมกันในก้าวเดียว — เข้าใกล้เป้าหมาย กับอยู่ให้ห่างผู้ไล่ล่า (แรงผลักออกฤทธิ์เมื่อเข้ามาใกล้กว่า 3 ช่อง)',
    parts: [
      { type: 'text', text: 'เดินทางที่ปลอดภัยที่สุดโดยยังเข้าใกล้' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.safeStep(${quote(ctx.field(node, 'target'))})`),
    // ข้างในคือ: ลองทุกช่องข้าง ๆ → ให้คะแนน −ก้าวถึงเป้า − อันตราย × 2 → เดินไปช่องที่คะแนนสูงสุด
    unpack: (node) => {
      const target = String(node.fields.target ?? 'goal')
      const danger = block(
        'math-fn',
        { fn: 'max' },
        { left: number(0), right: math(number(3), 'sub', block('runner.try-hunter')) }
      )
      const score = math(
        math(number(0), 'sub', block('runner.try-to', { target })),
        'sub',
        math(danger, 'mul', number(2))
      )

      return [
        block('runner.each-step', {}, {}, { do: [block('runner.try-score', {}, { value: score })] }),
        block('runner.go-best')
      ]
    }
  },
  {
    kind: 'runner.each-step',
    shape: 'statement',
    category: 'control',
    title: 'ลองทุกช่องข้าง ๆ ที่เดินไปได้',
    hint: 'ทำคำสั่งข้างในกับช่องข้าง ๆ ทีละช่อง (ขึ้น ขวา ลง ซ้าย) — ข้างในใช้ "ช่องที่ลอง" ได้',
    parts: [
      { type: 'text', text: 'ลองทุกช่องข้าง ๆ ที่เดินไปได้ ทีละช่อง' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, 'for (const ช่องที่ลอง of this.tryStart()) {')
      ctx.indent(1)
      ctx.raw('this.tryCell(ช่องที่ลอง)')
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'runner.try-score',
    shape: 'statement',
    category: 'action',
    title: 'ให้คะแนนช่องที่ลอง',
    hint: 'จดคะแนนของช่องนี้ไว้ — ช่องที่คะแนนสูงสุดคือช่องที่จะเดินไป (เท่ากันเอาช่องที่ลองก่อน)',
    parts: [
      { type: 'text', text: 'ให้คะแนนช่องที่ลอง' },
      { type: 'input', name: 'value', placeholder: 'คะแนน', accepts: 'number' }
    ],
    emit: (node, ctx) => ctx.line(node, `this.tryScore(${ctx.value(node, 'value', '0')})`)
  },
  {
    kind: 'runner.go-best',
    shape: 'statement',
    category: 'action',
    title: 'เดินไปช่องที่คะแนนสูงสุด',
    hint: 'ใช้ต่อจาก "ลองทุกช่องข้าง ๆ" — เดินไปช่องที่ได้คะแนนสูงสุด ถ้ายังไม่ได้ลองเลยจะยืนอยู่กับที่',
    parts: [{ type: 'text', text: 'เดินไปช่องที่คะแนนสูงสุด' }],
    emit: (node, ctx) => ctx.line(node, 'return this.tryBest()')
  },
  {
    kind: 'runner.wander',
    shape: 'statement',
    category: 'action',
    title: 'เดินสุ่มไปทางที่ว่าง',
    parts: [{ type: 'text', text: 'เดินสุ่มไปทางที่ว่าง' }],
    emit: (node, ctx) => ctx.line(node, 'return this.wander()')
  },
  {
    kind: 'runner.hold',
    shape: 'statement',
    category: 'action',
    title: 'ยืนรออยู่กับที่',
    parts: [{ type: 'text', text: 'ยืนรออยู่กับที่' }],
    emit: (node, ctx) => ctx.line(node, 'return null')
  },
  {
    kind: 'runner.can-walk',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'เดินไปทางนั้นได้',
    parts: [
      { type: 'text', text: 'เดินไปทาง' },
      { type: 'field', name: 'dir', options: DIRS },
      { type: 'text', text: 'ได้' }
    ],
    emit: (node, ctx) => `this.canGo(${quote(ctx.field(node, 'dir'))})`
  },
  {
    kind: 'runner.steps-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะเดินจริงจากฉันถึง',
    hint: 'นับเป็นช่องที่ต้องเดินจริง อ้อมกำแพงแล้ว — ใช้กับผู้ไล่ล่าเพื่อดูว่าใกล้เกินไปหรือยัง',
    parts: [
      { type: 'text', text: 'ระยะเดินจริงจากฉันถึง' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => `this.distanceTo(${quote(ctx.field(node, 'target'))})`
  },
  {
    kind: 'runner.try-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ก้าวจากช่องที่ลองถึง',
    hint: 'ระยะเดินจริงจากช่องที่กำลังลองไปถึงเป้าหมาย — ไปไม่ถึงได้ 99 · ใช้ในบล็อก "ลองทุกช่องข้าง ๆ"',
    parts: [
      { type: 'text', text: 'ก้าวจากช่องที่ลองถึง' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => `this.tryDistance(${quote(ctx.field(node, 'target'))})`
  },
  {
    kind: 'runner.try-hunter',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผู้ไล่ล่าห่างช่องที่ลองกี่ก้าว',
    hint: 'ระยะเดินจริงจากผู้ไล่ล่าตัวที่ใกล้ที่สุดถึงช่องที่กำลังลอง · ใช้ในบล็อก "ลองทุกช่องข้าง ๆ"',
    parts: [{ type: 'text', text: 'ผู้ไล่ล่าห่างช่องที่ลองกี่ก้าว' }],
    emit: () => 'this.tryThreat()'
  },
  {
    kind: 'runner.seen',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'มีผู้ไล่ล่ามองเห็นฉันอยู่',
    hint: 'เห็นเมื่ออยู่แถวหรือหลักเดียวกันและไม่มีกำแพงคั่น',
    parts: [{ type: 'text', text: 'มีผู้ไล่ล่ามองเห็นฉันอยู่' }],
    emit: () => 'this.seen()'
  },
  {
    kind: 'runner.hunters',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผู้ไล่ล่ามีกี่ตัว',
    parts: [{ type: 'text', text: 'ผู้ไล่ล่ามีกี่ตัว' }],
    emit: () => 'this.here.hunters.length'
  },
  {
    kind: 'runner.gems-left',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ของที่ยังไม่ได้เก็บ',
    parts: [{ type: 'text', text: 'ของที่ยังไม่ได้เก็บ' }],
    emit: () => 'this.gemsLeft()'
  },
  {
    kind: 'runner.exit-open',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ประตูหนีเปิดแล้ว',
    hint: 'เปิดเมื่อเก็บของครบ — ก่อนหน้านั้นวิ่งไปที่ประตูก็ออกไม่ได้',
    parts: [{ type: 'text', text: 'ประตูหนีเปิดแล้ว' }],
    emit: () => 'this.here.exitOpen'
  },
  {
    kind: 'runner.tick',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผ่านไปกี่จังหวะแล้ว',
    parts: [{ type: 'text', text: 'ผ่านไปกี่จังหวะแล้ว' }],
    emit: () => 'this.here.tick'
  }
]

const HELPERS = `
  // ---------- ตัวช่วยของบล็อกฝ่ายหนี ----------
  // this.here คือสิ่งที่คนหนีมองเห็นในจังหวะนั้น · this.here.me คือตัวเราเอง

  // เป้าหมายตอนนี้ — ของที่ใกล้ที่สุดถ้ายังเก็บไม่ครบ ครบแล้วคือประตูหนี
  goalNow() {
    return this.here.gems.length > 0 ? this.nearestGem() : this.here.exit
  }

  nearestGem() {
    const ที่นี่ = this.here
    let ใกล้สุด = ที่นี่.exit
    let ระยะ = Infinity

    for (const ของ of ที่นี่.gems) {
      const ห่าง = this.manhattan(ที่นี่.me, ของ)
      if (ห่าง < ระยะ) {
        ระยะ = ห่าง
        ใกล้สุด = ของ
      }
    }

    return ใกล้สุด
  }

  nearestHunter() {
    const ที่นี่ = this.here
    let ใกล้สุด = ที่นี่.exit
    let ระยะ = Infinity

    for (const ผู้ไล่ล่า of ที่นี่.hunters) {
      const ห่าง = this.manhattan(ที่นี่.me, ผู้ไล่ล่า)
      if (ห่าง < ระยะ) {
        ระยะ = ห่าง
        ใกล้สุด = ผู้ไล่ล่า
      }
    }

    return ใกล้สุด
  }

  // ระยะจากผู้ไล่ล่าที่ใกล้ที่สุดถึงทุกช่องในสนาม — คิดรอบเดียวแล้วถามกี่ช่องก็ได้
  threat() {
    const ตาราง = this.here.hunters.map((ผู้ไล่ล่า) => this.field(this.here.grid, ผู้ไล่ล่า))

    return (ช่อง) => {
      let ใกล้สุด = 99

      for (const แผ่น of ตาราง) {
        const ระยะ = แผ่น[ช่อง.row][ช่อง.col]
        if (ระยะ >= 0 && ระยะ < ใกล้สุด) ใกล้สุด = ระยะ
      }

      return ใกล้สุด
    }
  }

  // ช่องที่ผู้ไล่ล่าต้องเดินมาไกลที่สุดในสนาม — ที่หลบที่ปลอดภัยที่สุดถ้าจำเป็นต้องถอย
  safestCell() {
    const ที่นี่ = this.here
    const ระยะจากผู้ไล่ล่า = this.threat()

    let ดีที่สุด = ที่นี่.me
    let คะแนน = -1

    for (let row = 0; row < ที่นี่.height; row++) {
      for (let col = 0; col < ที่นี่.width; col++) {
        if (!this.walkable(ที่นี่.grid, row, col)) continue

        const ห่าง = ระยะจากผู้ไล่ล่า({ row, col })
        if (ห่าง > คะแนน) {
          คะแนน = ห่าง
          ดีที่สุด = { row, col }
        }
      }
    }

    return ดีที่สุด
  }

  spot(target) {
    if (target === 'gem') return this.nearestGem()
    if (target === 'exit') return this.here.exit
    if (target === 'hunter') return this.nearestHunter()
    if (target === 'safe') return this.safestCell()
    if (target === 'home') return this.here.me.home

    return this.goalNow()
  }

  go(dir) {
    return dir
  }

  canGo(dir) {
    const ช่องหน้า = this.stepInto(this.here.me, dir)
    return this.walkable(this.here.grid, ช่องหน้า.row, ช่องหน้า.col)
  }

  stepTo(target) {
    const หมาย = this.spot(target)
    const ทาง = this.pathTo(this.here.grid, this.here.me, หมาย)
    if (ทาง.length < 2) return null

    for (const ช่อง of ทาง) this.visit(ช่อง)
    const เลือก = this.towards(this.here.me, ทาง[1])

    // ระยะจากเป้าหมายถึงทุกช่อง คิดรอบเดียวแล้วอ่านช่องข้าง ๆ — ไว้บอกว่าทำไมทางนี้สั้นที่สุด
    const ระยะ = this.field(this.here.grid, หมาย)
    this.reason({
      title: 'เดินตามทางที่สั้นที่สุด',
      rule: 'เลือกช่องที่เหลือก้าวถึงเป้าหมายน้อยที่สุด',
      columns: ['ก้าวถึงเป้า'],
      options: this.neighbors(this.here.grid, this.here.me).map((ช่อง) => ({
        label: this.dirName(ช่อง.dir),
        at: ช่อง,
        values: [ระยะ[ช่อง.row][ช่อง.col]],
        chosen: ช่อง.dir === เลือก
      }))
    })

    return เลือก
  }

  // ชื่อทิศภาษาไทย ใช้เขียนตารางเหตุผล
  dirName(dir) {
    return { up: 'ขึ้น', right: 'ขวา', down: 'ลง', left: 'ซ้าย' }[dir] ?? dir
  }

  // ถอยออกห่างอย่างเดียว ไม่สนเป้าหมาย นอกจากตอนที่หลายทางปลอดภัยเท่ากัน
  dodge() {
    const ระยะจากผู้ไล่ล่า = this.threat()
    const หมาย = this.goalNow()
    const ตัวเลือก = []

    let เลือก = null
    let ปลอดภัยสุด = -1
    let ใกล้เป้าสุด = Infinity

    for (const ช่อง of this.neighbors(this.here.grid, this.here.me)) {
      const ปลอดภัย = ระยะจากผู้ไล่ล่า(ช่อง)
      const ถึงเป้า = this.pathLength(this.here.grid, ช่อง, หมาย)
      ตัวเลือก.push({ ช่อง, values: [ปลอดภัย, ถึงเป้า] })

      if (ปลอดภัย > ปลอดภัยสุด || (ปลอดภัย === ปลอดภัยสุด && ถึงเป้า < ใกล้เป้าสุด)) {
        ปลอดภัยสุด = ปลอดภัย
        ใกล้เป้าสุด = ถึงเป้า
        เลือก = ช่อง.dir
      }
    }

    this.visit(this.here.me)
    this.reason({
      title: 'ถอยให้ห่างผู้ไล่ล่า',
      rule: 'เลือกช่องที่ห่างผู้ไล่ล่ามากที่สุด\\nเสมอกัน → เลือกช่องที่ใกล้เป้าหมายกว่า',
      columns: ['ห่างผู้ไล่ล่า', 'ก้าวถึงเป้า'],
      options: ตัวเลือก.map((ตัว) => ({
        label: this.dirName(ตัว.ช่อง.dir),
        at: ตัว.ช่อง,
        values: ตัว.values,
        chosen: ตัว.ช่อง.dir === เลือก
      }))
    })
    return เลือก
  }

  // ชั่งน้ำหนักสองแรงในก้าวเดียว: เป้าหมายดึงเข้า ผู้ไล่ล่าผลักออก
  //
  // แรงผลักต้องจางหายเมื่ออยู่ไกล ไม่งั้นมันจะเอาแต่ถอยจนไม่ยอมเข้าใกล้ของเลย
  // ห่างเกิน 3 ช่องถือว่าไม่มีแรงผลัก เหลือแต่แรงดึงของเป้าหมาย
  // (ลองรัศมี 3–6 กับน้ำหนัก 2–3 ครบทุกคู่บนสนามจริงแล้ว คู่นี้ติดหลุมน้อยที่สุด)
  safeStep(target) {
    const ระยะจากผู้ไล่ล่า = this.threat()
    const หมาย = this.spot(target)
    const กริด = this.here.grid

    let เลือก = null
    let คะแนนดีสุด = -Infinity
    const ตัวเลือก = []

    for (const ช่อง of this.neighbors(กริด, this.here.me)) {
      const ห่างผู้ไล่ล่า = ระยะจากผู้ไล่ล่า(ช่อง)
      const อันตราย = Math.max(0, 3 - ห่างผู้ไล่ล่า)
      const ถึงเป้า = this.pathLength(กริด, ช่อง, หมาย)
      const ก้าว = ถึงเป้า < 0 ? 99 : ถึงเป้า
      const คะแนน = -ก้าว - อันตราย * 2
      ตัวเลือก.push({ ช่อง, values: [ก้าว, ห่างผู้ไล่ล่า, อันตราย, คะแนน] })

      if (คะแนน > คะแนนดีสุด) {
        คะแนนดีสุด = คะแนน
        เลือก = ช่อง.dir
      }

      this.visit(ช่อง)
    }

    // บอกหน้าจอว่าชั่งอะไรไปบ้าง — สนามเขียนคะแนนลงบนช่อง ตารางแยกให้เห็นว่ามาจากไหน
    this.reason({
      title: 'ชั่งความปลอดภัยกับเป้าหมาย',
      rule: 'อันตราย = max(0, 3 − ห่างผู้ไล่ล่า)\\nคะแนน = −ก้าวถึงเป้า − อันตราย × 2',
      columns: ['ก้าวถึงเป้า', 'ห่างผู้ไล่ล่า', 'อันตราย', 'คะแนน'],
      options: ตัวเลือก.map((ตัว) => ({
        label: this.dirName(ตัว.ช่อง.dir),
        at: ตัว.ช่อง,
        values: ตัว.values,
        chosen: ตัว.ช่อง.dir === เลือก
      }))
    })

    return เลือก
  }

  // ---------- ลองทีละช่อง: บล็อกย่อยของ "เดินทางที่ปลอดภัยที่สุด" ----------

  // เริ่มรอบลอง — วัดครั้งเดียวว่าผู้ไล่ล่าคุมพื้นที่ไหน แล้วคืนช่องข้าง ๆ ที่เดินได้ให้วนลองทีละช่อง
  tryStart() {
    this.ลอง = {
      ระยะจากผู้ไล่ล่า: this.threat(),
      ช่อง: null,
      วัด: {},
      ตัวเลือก: [],
      ดีสุด: null,
      คะแนนดีสุด: -Infinity
    }
    return this.neighbors(this.here.grid, this.here.me)
  }

  tryCell(ช่อง) {
    this.ลอง.ช่อง = ช่อง
    this.ลอง.วัด = {}
    this.visit(ช่อง)
  }

  // ก้าวจากช่องที่ลองถึงเป้าหมาย — ไปไม่ถึงนับเป็น 99 จะได้ไม่ถูกเลือก
  tryDistance(target) {
    if (!this.ลอง?.ช่อง) return 99
    const ระยะ = this.pathLength(this.here.grid, this.ลอง.ช่อง, this.spot(target))
    const ก้าว = ระยะ < 0 ? 99 : ระยะ
    this.ลอง.วัด['ก้าวถึงเป้า'] = ก้าว
    return ก้าว
  }

  tryThreat() {
    if (!this.ลอง?.ช่อง) return 99
    const ห่าง = this.ลอง.ระยะจากผู้ไล่ล่า(this.ลอง.ช่อง)
    this.ลอง.วัด['ห่างผู้ไล่ล่า'] = ห่าง
    return ห่าง
  }

  // จดคะแนน — สูงกว่าที่ดีที่สุดเดิมจริง ๆ ถึงเปลี่ยน เท่ากันเก็บช่องที่ลองก่อนไว้
  tryScore(คะแนน) {
    if (!this.ลอง?.ช่อง) return
    this.ลอง.ตัวเลือก.push({ ช่อง: this.ลอง.ช่อง, วัด: this.ลอง.วัด, คะแนน })

    if (คะแนน > this.ลอง.คะแนนดีสุด) {
      this.ลอง.คะแนนดีสุด = คะแนน
      this.ลอง.ดีสุด = this.ลอง.ช่อง
    }
  }

  // เดินไปช่องที่คะแนนสูงสุด แล้วบอกหน้าจอว่าแต่ละช่องได้เท่าไร วัดอะไรไปบ้าง
  tryBest() {
    const ลอง = this.ลอง
    this.ลอง = null
    if (!ลอง) return null

    const หัวข้อ = [...new Set(ลอง.ตัวเลือก.flatMap((ตัว) => Object.keys(ตัว.วัด)))]
    this.reason({
      title: 'ลองทุกช่องข้าง ๆ แล้วเลือกคะแนนสูงสุด',
      columns: [...หัวข้อ, 'คะแนน'],
      options: ลอง.ตัวเลือก.map((ตัว) => ({
        label: this.dirName(ตัว.ช่อง.dir),
        at: ตัว.ช่อง,
        values: [...หัวข้อ.map((ชื่อ) => ตัว.วัด[ชื่อ] ?? 0), ตัว.คะแนน],
        chosen: ตัว.ช่อง === ลอง.ดีสุด
      }))
    })

    return ลอง.ดีสุด ? ลอง.ดีสุด.dir : null
  }

  wander() {
    const ทางที่ไปได้ = this.neighbors(this.here.grid, this.here.me)
    if (ทางที่ไปได้.length === 0) return null

    const ทางกลับ = this.opposite(this.here.me.facing)
    const ไปข้างหน้า = ทางที่ไปได้.filter((ช่อง) => ช่อง.dir !== ทางกลับ)
    const ตัวเลือก = ไปข้างหน้า.length > 0 ? ไปข้างหน้า : ทางที่ไปได้

    return ตัวเลือก[Math.floor(Math.random() * ตัวเลือก.length)].dir
  }

  distanceTo(target) {
    const ระยะ = this.pathLength(this.here.grid, this.here.me, this.spot(target))
    return ระยะ < 0 ? 999 : ระยะ
  }

  seen() {
    for (const ผู้ไล่ล่า of this.here.hunters) {
      if (this.sight(this.here.grid, ผู้ไล่ล่า, this.here.me)) return true
    }

    return false
  }

  gemsLeft() {
    return this.here.gems.length
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

const math = (left: BlockNode, op: string, right: BlockNode) => block('math', { op }, { left, right })

const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

const ifElse = (cond: BlockNode, then: BlockNode[], otherwise: BlockNode[]) =>
  block('if-else', {}, { cond }, { then, else: otherwise })

const MOVE_CALLS: Array<[string, string, string]> = [
  ['go', 'runner.walk', 'dir'],
  ['stepTo', 'runner.head-to', 'target'],
  ['safeStep', 'runner.safe-step', 'target']
]

const SENSE_CALLS: Array<[string, string, string]> = [
  ['canGo', 'runner.can-walk', 'dir'],
  ['distanceTo', 'runner.steps-to', 'target'],
  ['tryDistance', 'runner.try-to', 'target']
]

const PLAIN_SENSES: Array<[string, string]> = [
  ['tryThreat', 'runner.try-hunter'],
  ['seen', 'runner.seen'],
  ['gemsLeft', 'runner.gems-left']
]

const STATEMENT_PARSERS: Matcher[] = [
  (node, ctx) => {
    if (node.type !== 'ForOfStatement' || !ctx.call(node.right, 'tryStart')) return null

    const inner = (node.body?.body ?? []).filter(
      (item: Node) => !(item.type === 'ExpressionStatement' && ctx.call(item.expression, 'tryCell'))
    )
    return ctx.make('runner.each-step', {}, {}, { do: inner.flatMap((item: Node) => ctx.body(item)) })
  },

  (node, ctx) => {
    if (node.type !== 'ExpressionStatement') return null
    const args = ctx.call(node.expression, 'tryScore')
    return args ? ctx.make('runner.try-score', {}, { value: args[0] ? ctx.value(args[0]) : null }) : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'tryBest') ? ctx.make('runner.go-best') : null
  },

  ...MOVE_CALLS.map<Matcher>(
    ([name, kind, field]) =>
      (node, ctx) => {
        const back = ctx.returned(node)
        if (!back) return null

        const args = ctx.call(back, name)
        const value = args ? ctx.str(args[0]!) : null
        return value ? ctx.make(kind, { [field]: value }) : null
      }
  ),

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'dodge') ? ctx.make('runner.dodge') : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'wander') ? ctx.make('runner.wander') : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (back === undefined) return null
    if (back === null) return ctx.make('runner.hold')
    return back.type === 'Literal' && back.value === null ? ctx.make('runner.hold') : null
  }
]

const VALUE_PARSERS: Matcher[] = [
  ...SENSE_CALLS.map<Matcher>(
    ([name, kind, field]) =>
      (node, ctx) => {
        const args = ctx.call(node, name)
        const value = args ? ctx.str(args[0]!) : null
        return value ? ctx.make(kind, { [field]: value }) : null
      }
  ),
  ...PLAIN_SENSES.map<Matcher>(
    ([name, kind]) =>
      (node, ctx) =>
        ctx.call(node, name) ? ctx.make(kind) : null
  ),
  (node, ctx) =>
    node?.type === 'MemberExpression' &&
    node.property?.name === 'length' &&
    ctx.thisProp(node.object, 'here', 'hunters')
      ? ctx.make('runner.hunters')
      : null,
  (node, ctx) => (ctx.thisProp(node, 'here', 'exitOpen') ? ctx.make('runner.exit-open') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'tick') ? ctx.make('runner.tick') : null)
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

/** ชื่อไทยของงานที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง" ของฝ่ายหนี */
export const WORK_LABEL: Record<string, string> = {
  stepTo: 'หาทางที่สั้นที่สุดแล้วก้าวตาม',
  safeStep: 'ชั่งความปลอดภัยกับเป้าหมาย',
  tryStart: 'เริ่มลองช่องข้าง ๆ',
  tryDistance: 'วัดก้าวจากช่องที่ลองถึงเป้าหมาย',
  tryThreat: 'วัดว่าผู้ไล่ล่าห่างช่องที่ลองแค่ไหน',
  tryBest: 'เลือกช่องที่คะแนนสูงสุด',
  dodge: 'ถอยให้ห่างผู้ไล่ล่า',
  wander: 'เดินสุ่ม',
  threat: 'วัดว่าผู้ไล่ล่าคุมพื้นที่ไหนอยู่',
  safestCell: 'หาที่หลบที่ปลอดภัยที่สุด',
  nearestGem: 'หาของชิ้นที่ใกล้ที่สุด',
  nearestHunter: 'ดูว่าผู้ไล่ล่าที่ใกล้ที่สุดอยู่ไหน',
  pathLength: 'วัดระยะเดินจริง',
  seen: 'ดูว่ามีใครมองเห็นเราไหม',
  distanceTo: 'ดูว่าฉันห่างเป้าหมายแค่ไหน'
}

export const RUNNER_PACK = createPack({
  id: 'runner',
  blocks: BLOCKS,
  explain: RUNNER_EXPLAIN,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'ChaseAgent',
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
          writer.push('// อ่านจนจบแล้วไม่เจอบล็อกที่สั่งเดิน ก็ยืนอยู่กับที่')
          writer.push('return null')
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    {
      id: 'collector',
      name: 'เก็บของอย่างเดียว',
      description:
        'พุ่งไปที่ของชิ้นที่ใกล้ที่สุดเสมอ แล้วออกประตูเมื่อครบ — ไม่เคยเหลียวดูผู้ไล่ล่าเลยสักครั้ง จึงเดินชนเข้าให้เองบ่อย ๆ ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'runner.on-turn': [block('runner.head-to', { target: 'goal' })]
        }
      })
    },
    {
      id: 'evade',
      name: 'ใกล้ก็หนีก่อน',
      description:
        'ปกติเดินไปเก็บของตามปกติ แต่พอผู้ไล่ล่าเข้ามาใกล้กว่า 4 ช่องเมื่อไร ทิ้งงานแล้วถอยก่อนทันที พ้นระยะแล้วค่อยกลับไปทำงานต่อ',
      build: (): BlockProgram => ({
        name: 'ใกล้ก็หนีก่อน',
        scripts: {
          'runner.on-turn': [
            ifElse(
              compare(block('runner.steps-to', { target: 'hunter' }), 'lte', number(4)),
              [block('runner.dodge')],
              [block('runner.head-to', { target: 'goal' })]
            )
          ]
        }
      })
    },
    {
      id: 'field',
      name: 'ชั่งน้ำหนักทุกก้าว',
      description:
        'ไม่มีสวิตช์หนี/ไม่หนี แต่ให้ทุกก้าวชั่งสองอย่างพร้อมกัน คือเข้าใกล้เป้าหมายกับอยู่ห่างผู้ไล่ล่า — ได้ทางอ้อมที่เลี่ยงผู้ไล่ล่าไปเองโดยไม่ต้องสั่ง',
      build: (): BlockProgram => ({
        name: 'ชั่งน้ำหนักทุกก้าว',
        scripts: {
          'runner.on-turn': [
            ifElse(
              block('runner.exit-open'),
              [block('runner.safe-step', { target: 'exit' })],
              [block('runner.safe-step', { target: 'gem' })]
            )
          ]
        }
      })
    }
  ]
})

export const DEFAULT_RUNNER_PRESET_ID = 'evade'
