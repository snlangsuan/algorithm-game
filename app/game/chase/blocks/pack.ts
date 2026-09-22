import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'
import { CHASE_EXPLAIN } from './explain'

/** ช่องเป้าหมายที่บล็อก "เดินไปหา…" เล็งได้ */
const TARGETS: SelectOption[] = [
  { value: 'hero', label: 'ตัวเอก' },
  { value: 'ahead', label: 'ช่องข้างหน้าตัวเอก' },
  { value: 'gem', label: 'ของชิ้นที่ตัวเอกจะเก็บต่อไป' },
  { value: 'exit', label: 'ประตูหนี' },
  { value: 'home', label: 'จุดเกิดของฉัน' },
  { value: 'mate', label: 'เพื่อนร่วมทีมที่ใกล้ที่สุด' }
]

const DIRS: SelectOption[] = [
  { value: 'up', label: 'ขึ้น' },
  { value: 'right', label: 'ขวา' },
  { value: 'down', label: 'ลง' },
  { value: 'left', label: 'ซ้าย' }
]

const HAT: BlockSpec = {
  kind: 'chase.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาเดินของผู้ไล่ล่า',
  hint: 'ผู้ไล่ล่าทุกตัวใช้บล็อกชุดนี้ร่วมกัน ระบบเรียกทีละตัว — แยกหน้าที่กันเองได้ด้วยบล็อก "ฉันเป็นผู้ไล่ล่าตัวที่"',
  parts: [{ type: 'text', text: 'เมื่อถึงตาเดินของผู้ไล่ล่า' }],
  emit: () => {}
}

const BLOCKS: BlockSpec[] = [
  {
    kind: 'chase.walk',
    shape: 'statement',
    category: 'action',
    title: 'เดินไปทาง',
    hint: 'เดินหนึ่งช่องแล้วจบตานี้ — ถ้าทางนั้นเป็นกำแพงจะยืนอยู่กับที่ และมีข้อความบอกในคอนโซล',
    parts: [
      { type: 'text', text: 'เดินไปทาง' },
      { type: 'field', name: 'dir', options: DIRS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.go(${quote(ctx.field(node, 'dir'))})`)
  },
  {
    kind: 'chase.chase-path',
    shape: 'statement',
    category: 'action',
    title: 'เดินตามทางที่สั้นที่สุดไปหา',
    hint: 'หาทางที่สั้นที่สุดในสนามจริง (อ้อมกำแพงเป็น) แล้วก้าวไปหนึ่งช่องตามทางนั้น',
    parts: [
      { type: 'text', text: 'เดินตามทางที่สั้นที่สุดไปหา' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.stepTo(${quote(ctx.field(node, 'target'))})`)
  },
  {
    kind: 'chase.spread-step',
    shape: 'statement',
    category: 'action',
    title: 'เดินเข้าหาโดยไม่เบียดเพื่อน',
    hint: 'ไปทางที่สั้นที่สุดเหมือนกัน แต่ถ้ามีหลายทางที่สั้นเท่ากัน จะเลือกทางที่ห่างเพื่อนที่สุด — หลายตัวจึงไม่เดินซ้อนกันเป็นแถวเดียว',
    parts: [
      { type: 'text', text: 'เดินเข้าหา' },
      { type: 'field', name: 'target', options: TARGETS },
      { type: 'text', text: 'โดยไม่เบียดเพื่อน' }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.spreadTo(${quote(ctx.field(node, 'target'))})`)
  },
  {
    kind: 'chase.flock',
    shape: 'statement',
    category: 'action',
    title: 'ว่ายแบบฝูงปลา',
    hint: 'กฎฝูงปลาของ Reynolds บวกการไล่เหยื่อ — ทุกทางที่เดินได้ถูกให้คะแนน: ใกล้เป้าตามทางเดินจริงยิ่งดี · "แยก" หักคะแนนช่องที่เบียดเพื่อน · "เรียง" ให้คะแนนเพิ่มถ้าไปทางเดียวกับที่เพื่อนหัน · "รวม" หักคะแนนถ้าห่างกึ่งกลางของฝูง แล้วเดินไปทางที่คะแนนดีที่สุด',
    parts: [
      { type: 'text', text: 'ว่ายแบบฝูงปลาเข้าหา' },
      { type: 'field', name: 'target', options: TARGETS },
      { type: 'text', text: 'แยก' },
      { type: 'input', name: 'separate', placeholder: 'น้ำหนัก', accepts: 'number' },
      { type: 'text', text: 'เรียง' },
      { type: 'input', name: 'align', placeholder: 'น้ำหนัก', accepts: 'number' },
      { type: 'text', text: 'รวม' },
      { type: 'input', name: 'gather', placeholder: 'น้ำหนัก', accepts: 'number' }
    ],
    emit: (node, ctx) =>
      ctx.line(
        node,
        `return this.flockTo(${quote(ctx.field(node, 'target'))}, ${ctx.value(node, 'separate', '0')}, ${ctx.value(node, 'align', '0')}, ${ctx.value(node, 'gather', '0')})`
      )
  },
  {
    kind: 'chase.chase-straight',
    shape: 'statement',
    category: 'action',
    title: 'เดินเข้าหาแบบตรงที่สุด',
    hint: 'เลือกช่องข้าง ๆ ที่ระยะเส้นตรงใกล้เป้าหมายที่สุด — เร็วแต่ติดกำแพงแล้วไปต่อไม่เป็น',
    parts: [
      { type: 'text', text: 'เดินเข้าหา' },
      { type: 'field', name: 'target', options: TARGETS },
      { type: 'text', text: 'แบบตรงที่สุด' }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.stepToward(${quote(ctx.field(node, 'target'))})`)
  },
  {
    kind: 'chase.wander',
    shape: 'statement',
    category: 'action',
    title: 'เดินสุ่มไปทางที่ว่าง',
    hint: 'สุ่มทางที่เดินได้ โดยพยายามไม่ย้อนกลับทางเดิม',
    parts: [{ type: 'text', text: 'เดินสุ่มไปทางที่ว่าง' }],
    emit: (node, ctx) => ctx.line(node, 'return this.wander()')
  },
  {
    kind: 'chase.hold',
    shape: 'statement',
    category: 'action',
    title: 'ยืนรออยู่กับที่',
    hint: 'ไม่เดินในจังหวะนี้ — ใช้ตอนเฝ้าจุดสำคัญ',
    parts: [{ type: 'text', text: 'ยืนรออยู่กับที่' }],
    emit: (node, ctx) => ctx.line(node, 'return null')
  },
  {
    kind: 'chase.can-walk',
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
    kind: 'chase.steps-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะเดินจริงจากฉันถึง',
    hint: 'นับเป็นจำนวนช่องที่ต้องเดินจริง อ้อมกำแพงแล้ว — ไม่ใช่ระยะตรง',
    parts: [
      { type: 'text', text: 'ระยะเดินจริงจากฉันถึง' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => `this.distanceTo(${quote(ctx.field(node, 'target'))})`
  },
  {
    kind: 'chase.straight-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะเส้นตรงจากฉันถึง',
    hint: 'นับแถวบวกหลัก ไม่สนกำแพง — ถูกกว่าตรงที่คิดเร็ว แต่หลอกได้ง่ายเมื่อมีกำแพงขวาง',
    parts: [
      { type: 'text', text: 'ระยะเส้นตรงจากฉันถึง' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => `this.straightTo(${quote(ctx.field(node, 'target'))})`
  },
  {
    kind: 'chase.hero-steps-to',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ระยะเดินจริงจากตัวเอกถึง',
    hint: 'มองจากมุมของตัวเอก — ใช้ตอบคำถามว่า "อีกกี่ก้าวเขาจะถึงประตู" แล้วชิงไปดักก่อน',
    parts: [
      { type: 'text', text: 'ระยะเดินจริงจากตัวเอกถึง' },
      { type: 'field', name: 'target', options: TARGETS }
    ],
    emit: (node, ctx) => `this.heroDistanceTo(${quote(ctx.field(node, 'target'))})`
  },
  {
    kind: 'chase.sees',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ฉันมองเห็นตัวเอก',
    hint: 'เห็นเมื่ออยู่แถวหรือหลักเดียวกัน และไม่มีกำแพงคั่นกลาง',
    parts: [{ type: 'text', text: 'ฉันมองเห็นตัวเอก' }],
    emit: () => 'this.sees()'
  },
  {
    kind: 'chase.hero-is',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ตัวเอกอยู่ทางนั้น',
    hint: 'เทียบแถวกับหลักตรง ๆ — ตัวเอกอาจอยู่ทั้งทางขึ้นและทางขวาพร้อมกันได้',
    parts: [
      { type: 'text', text: 'ตัวเอกอยู่ทาง' },
      { type: 'field', name: 'dir', options: DIRS }
    ],
    emit: (node, ctx) => `this.heroIs(${quote(ctx.field(node, 'dir'))})`
  },
  {
    kind: 'chase.my-number',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ฉันเป็นผู้ไล่ล่าตัวที่',
    hint: 'ตัวแรกคือ 1 — โปรแกรมชุดเดียวกันจึงแยกหน้าที่กันได้ด้วยเลขนี้',
    parts: [{ type: 'text', text: 'ฉันเป็นผู้ไล่ล่าตัวที่' }],
    emit: () => 'this.myNumber()'
  },
  {
    kind: 'chase.hunters',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผู้ไล่ล่ามีกี่ตัว',
    parts: [{ type: 'text', text: 'ผู้ไล่ล่ามีกี่ตัว' }],
    emit: () => 'this.here.hunters.length'
  },
  {
    kind: 'chase.gems-left',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ของที่ยังไม่ถูกเก็บ',
    parts: [{ type: 'text', text: 'ของที่ยังไม่ถูกเก็บ' }],
    emit: () => 'this.gemsLeft()'
  },
  {
    kind: 'chase.exit-open',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ประตูหนีเปิดแล้ว',
    hint: 'เปิดเมื่อของถูกเก็บครบ — จังหวะสุดท้ายที่ยังพอไปดักที่ประตูได้ทัน',
    parts: [{ type: 'text', text: 'ประตูหนีเปิดแล้ว' }],
    emit: () => 'this.here.exitOpen'
  },
  {
    kind: 'chase.tick',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ผ่านไปกี่จังหวะแล้ว',
    hint: 'จังหวะแรกคือ 1 — ใช้เปลี่ยนแผนตามช่วงเวลา เช่น ช่วงแรกกระจายตัว ช่วงหลังรุมไล่',
    parts: [{ type: 'text', text: 'ผ่านไปกี่จังหวะแล้ว' }],
    emit: () => 'this.here.tick'
  }
]

const HELPERS = `
  // ---------- ตัวช่วยของบล็อกไล่จับ ----------
  // this.here คือสิ่งที่ตัวที่กำลังคิดมองเห็น ณ จังหวะนั้น
  // this.here.me คือตัวเอง เปลี่ยนไปเรื่อย ๆ ตามตัวที่ระบบกำลังเรียก

  // แปลงชื่อเป้าหมายบนบล็อกให้เป็นช่องจริงในสนาม
  spot(target) {
    const ที่นี่ = this.here

    if (target === 'ahead') return this.ahead(ที่นี่.grid, ที่นี่.hero, ที่นี่.heroFacing, 3)
    if (target === 'gem') return this.nextGem()
    if (target === 'exit') return ที่นี่.exit
    if (target === 'home') return ที่นี่.me.home
    if (target === 'mate') return this.nearestMate()

    return ที่นี่.hero
  }

  // ของชิ้นที่ตัวเอกน่าจะไปเก็บต่อไป คือชิ้นที่ใกล้ตัวเอกที่สุด
  // เก็บครบแล้วเป้าหมายต่อไปของเขาคือประตูหนี
  nextGem() {
    const ที่นี่ = this.here
    let ใกล้สุด = ที่นี่.exit
    let ระยะ = Infinity

    for (const ของ of ที่นี่.gems) {
      const ห่าง = this.manhattan(ที่นี่.hero, ของ)
      if (ห่าง < ระยะ) {
        ระยะ = ห่าง
        ใกล้สุด = ของ
      }
    }

    return ใกล้สุด
  }

  nearestMate() {
    const ที่นี่ = this.here
    let ใกล้สุด = ที่นี่.me
    let ระยะ = Infinity

    for (const เพื่อน of ที่นี่.hunters) {
      if (เพื่อน.index === ที่นี่.me.index) continue

      const ห่าง = this.manhattan(ที่นี่.me, เพื่อน)
      if (ห่าง < ระยะ) {
        ระยะ = ห่าง
        ใกล้สุด = เพื่อน
      }
    }

    return ใกล้สุด
  }

  go(dir) {
    return dir
  }

  canGo(dir) {
    const ช่องหน้า = this.stepInto(this.here.me, dir)
    return this.walkable(this.here.grid, ช่องหน้า.row, ช่องหน้า.col)
  }

  // เดินตามทางที่สั้นที่สุด แล้วบอกสนามว่ากำลังคิดถึงช่องไหนบ้าง
  stepTo(target) {
    const ทาง = this.pathTo(this.here.grid, this.here.me, this.spot(target))
    if (ทาง.length < 2) return null

    for (const ช่อง of ทาง) this.visit(ช่อง)
    return this.towards(this.here.me, ทาง[1])
  }

  // เพื่อนยืนอยู่ช่องนี้แล้วหรือยัง — ผู้ไล่ล่ายืนทับกันไม่ได้
  taken(cell) {
    for (const เพื่อน of this.here.hunters) {
      if (เพื่อน.index === this.here.me.index) continue
      if (เพื่อน.row === cell.row && เพื่อน.col === cell.col) return true
    }

    return false
  }

  // ห่างจากเพื่อนที่ใกล้ที่สุดแค่ไหน ถ้าไปยืนช่องนั้น
  mateGap(cell) {
    let ใกล้สุด = 99

    for (const เพื่อน of this.here.hunters) {
      if (เพื่อน.index === this.here.me.index) continue

      const ห่าง = this.manhattan(cell, เพื่อน)
      if (ห่าง < ใกล้สุด) ใกล้สุด = ห่าง
    }

    return ใกล้สุด
  }

  // เข้าใกล้เป้าหมายเหมือน stepTo แต่เลือกทางที่ห่างเพื่อนที่สุดในบรรดาทางที่สั้นเท่ากัน
  // วัดระยะจากเป้าหมายออกมาครั้งเดียว แล้วดูว่าช่องข้าง ๆ ช่องไหนใกล้เป้าลงจริง
  spreadTo(target) {
    const หมาย = this.spot(target)
    const กริด = this.here.grid
    const ระยะ = this.field(กริด, หมาย)
    const ที่ฉันอยู่ = ระยะ[this.here.me.row][this.here.me.col]

    if (ที่ฉันอยู่ <= 0) return null

    let เลือก = null
    let ห่างเพื่อนสุด = -1

    for (const ช่อง of this.neighbors(กริด, this.here.me)) {
      if (ระยะ[ช่อง.row][ช่อง.col] !== ที่ฉันอยู่ - 1) continue
      if (this.taken(ช่อง)) continue

      this.visit(ช่อง)

      const ห่าง = this.mateGap(ช่อง)
      if (ห่าง > ห่างเพื่อนสุด) {
        ห่างเพื่อนสุด = ห่าง
        เลือก = ช่อง.dir
      }
    }

    // ทางที่เข้าใกล้เป้าถูกเพื่อนยืนขวางหมด ก็รอให้เขาไปก่อน
    return เลือก
  }

  // ฝูงปลา (Boids ของ Reynolds) — ให้คะแนนทุกทางที่เดินได้ด้วยกฎสี่ข้อ แล้วเลือกทางที่คะแนนดีที่สุด
  //   ไล่: ยิ่งใกล้เป้าหมายตามทางเดินจริงยิ่งดี
  //   แยก: ช่องที่ห่างเพื่อนไม่ถึงสามช่องโดนหักคะแนน ยิ่งใกล้ยิ่งโดนหักมาก
  //   เรียง: ไปทางเดียวกับที่เพื่อนหันอยู่ได้คะแนนเพิ่ม ตัวละหนึ่งส่วน
  //   รวม: ยิ่งห่างจุดกึ่งกลางของเพื่อนยิ่งโดนหักคะแนน
  flockTo(target, แยก, เรียง, รวม) {
    const หมาย = this.spot(target)
    const กริด = this.here.grid
    const ระยะ = this.field(กริด, หมาย)
    const เพื่อน = this.here.hunters.filter((ตัว) => ตัว.index !== this.here.me.index)
    const กลาง =
      เพื่อน.length === 0
        ? null
        : {
            row: เพื่อน.reduce((รวมแถว, ตัว) => รวมแถว + ตัว.row, 0) / เพื่อน.length,
            col: เพื่อน.reduce((รวมคอลัมน์, ตัว) => รวมคอลัมน์ + ตัว.col, 0) / เพื่อน.length
          }

    let เลือก = null
    let ดีสุด = -Infinity

    for (const ช่อง of this.neighbors(กริด, this.here.me)) {
      if (this.taken(ช่อง)) continue
      this.visit(ช่อง)

      let คะแนน = -ระยะ[ช่อง.row][ช่อง.col]

      for (const ตัว of เพื่อน) {
        const ห่าง = this.manhattan(ช่อง, ตัว)
        if (ห่าง < 3) คะแนน -= Number(แยก) * (3 - ห่าง)
        if (ตัว.facing === ช่อง.dir) คะแนน += Number(เรียง)
      }

      if (กลาง) คะแนน -= Number(รวม) * (Math.abs(ช่อง.row - กลาง.row) + Math.abs(ช่อง.col - กลาง.col))

      if (คะแนน > ดีสุด) {
        ดีสุด = คะแนน
        เลือก = ช่อง.dir
      }
    }

    return เลือก
  }

  // มองแค่ระยะเส้นตรง จึงเดินเข้ามุมอับได้ง่าย ๆ
  stepToward(target) {
    const หมาย = this.spot(target)
    let เลือก = null
    let ระยะ = Infinity

    for (const ช่อง of this.neighbors(this.here.grid, this.here.me)) {
      const ห่าง = this.manhattan(ช่อง, หมาย)
      if (ห่าง < ระยะ) {
        ระยะ = ห่าง
        เลือก = ช่อง.dir
      }
    }

    return เลือก
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

  straightTo(target) {
    return this.manhattan(this.here.me, this.spot(target))
  }

  heroDistanceTo(target) {
    const ระยะ = this.pathLength(this.here.grid, this.here.hero, this.spot(target))
    return ระยะ < 0 ? 999 : ระยะ
  }

  sees() {
    return this.sight(this.here.grid, this.here.me, this.here.hero)
  }

  heroIs(dir) {
    const ฉัน = this.here.me
    const ตัวเอก = this.here.hero

    if (dir === 'up') return ตัวเอก.row < ฉัน.row
    if (dir === 'down') return ตัวเอก.row > ฉัน.row
    if (dir === 'left') return ตัวเอก.col < ฉัน.col
    return ตัวเอก.col > ฉัน.col
  }

  myNumber() {
    return this.here.me.index + 1
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

const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

const ifElse = (cond: BlockNode, then: BlockNode[], otherwise: BlockNode[]) =>
  block('if-else', {}, { cond }, { then, else: otherwise })

const iAm = (index: number) => compare(block('chase.my-number'), 'eq', number(index))

/** บล็อกสั่งเดินที่แปลงมาจาก this.<ชื่อ>('<ค่าในช่อง>') ตรง ๆ */
const MOVE_CALLS: Array<[string, string, string]> = [
  ['go', 'chase.walk', 'dir'],
  ['stepTo', 'chase.chase-path', 'target'],
  ['spreadTo', 'chase.spread-step', 'target'],
  ['stepToward', 'chase.chase-straight', 'target']
]

const SENSE_CALLS: Array<[string, string, string]> = [
  ['canGo', 'chase.can-walk', 'dir'],
  ['heroIs', 'chase.hero-is', 'dir'],
  ['distanceTo', 'chase.steps-to', 'target'],
  ['straightTo', 'chase.straight-to', 'target'],
  ['heroDistanceTo', 'chase.hero-steps-to', 'target']
]

const PLAIN_SENSES: Array<[string, string]> = [
  ['sees', 'chase.sees'],
  ['myNumber', 'chase.my-number'],
  ['gemsLeft', 'chase.gems-left']
]

const STATEMENT_PARSERS: Matcher[] = [
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
    return back && ctx.call(back, 'wander') ? ctx.make('chase.wander') : null
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    const args = back ? ctx.call(back, 'flockTo') : null
    const target = args ? ctx.str(args[0]!) : null
    if (!args || args.length !== 4 || !target) return null

    return ctx.make(
      'chase.flock',
      { target },
      { separate: ctx.value(args[1]!), align: ctx.value(args[2]!), gather: ctx.value(args[3]!) }
    )
  },

  (node, ctx) => {
    const back = ctx.returned(node)
    if (back === undefined) return null
    if (back === null) return ctx.make('chase.hold')
    return back.type === 'Literal' && back.value === null ? ctx.make('chase.hold') : null
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
      ? ctx.make('chase.hunters')
      : null,
  (node, ctx) => (ctx.thisProp(node, 'here', 'exitOpen') ? ctx.make('chase.exit-open') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'tick') ? ctx.make('chase.tick') : null)
]

/** ตัดบรรทัดที่ระบบเขียนให้เองออก เหลือเฉพาะบล็อกที่ผู้เล่นต่อไว้จริง */
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

/**
 * ชื่อไทยของงานที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง"
 * worker ห่อทุกเมธอดด้วยตัวนับอยู่แล้ว ตรงนี้แค่เลือกตัวที่ควรให้เห็นแล้วตั้งชื่อให้อ่านออก
 */
export const WORK_LABEL: Record<string, string> = {
  stepTo: 'หาทางที่สั้นที่สุดแล้วก้าวตาม',
  spreadTo: 'หาทางที่สั้นที่สุดแบบไม่เบียดเพื่อน',
  flockTo: 'ให้คะแนนทางตามกฎฝูงปลา',
  mateGap: 'ดูว่าเพื่อนอยู่ห่างแค่ไหน',
  stepToward: 'เดินเข้าหาแบบตรงที่สุด',
  wander: 'เดินสุ่ม',
  pathTo: 'ค้นทางทั่วสนาม',
  pathLength: 'วัดระยะเดินจริง',
  distanceTo: 'ดูว่าฉันห่างเป้าหมายแค่ไหน',
  heroDistanceTo: 'ดูว่าตัวเอกห่างเป้าหมายแค่ไหน',
  straightTo: 'วัดระยะเส้นตรง',
  sees: 'มองหาตัวเอก',
  canGo: 'ดูว่าเดินทางนั้นได้ไหม',
  nextGem: 'เดาว่าตัวเอกจะไปเก็บชิ้นไหนต่อ',
  nearestMate: 'หาเพื่อนที่ใกล้ที่สุด',
  neighbors: 'ไล่ดูช่องรอบตัว'
}

export const CHASE_PACK = createPack({
  id: 'chase',
  blocks: BLOCKS,
  explain: CHASE_EXPLAIN,
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
      id: 'starter',
      name: 'เริ่มต้น',
      description:
        'เห็นตัวเอกเมื่อไรค่อยวิ่งเข้าหา ไม่เห็นก็เดินสุ่มไปเรื่อย — ไล่ไม่ค่อยติด เพราะพอมีกำแพงบังก็ลืมทันทีว่าเคยเห็นตรงไหน ลองลากบล็อกแก้เองดู',
      build: (): BlockProgram => ({
        name: 'ตัวใหม่ของฉัน',
        scripts: {
          'chase.on-turn': [
            ifElse(
              block('chase.sees'),
              [block('chase.chase-straight', { target: 'hero' })],
              [block('chase.wander')]
            )
          ]
        }
      })
    },
    {
      id: 'pursuit',
      name: 'ไล่ตามทางที่สั้นที่สุด',
      description:
        'ใกล้ก็ไล่ตามทางที่สั้นที่สุด ไกลก็ไปรอที่ของชิ้นที่ตัวเอกกำลังจะเก็บ — ไม่ต้องวิ่งตามหลัง แต่ไปยืนรอตรงที่เขาต้องไป',
      build: (): BlockProgram => ({
        name: 'ไล่ตามทางที่สั้นที่สุด',
        scripts: {
          'chase.on-turn': [
            ifElse(
              compare(block('chase.steps-to', { target: 'hero' }), 'lte', number(12)),
              [block('chase.chase-path', { target: 'hero' })],
              [block('chase.chase-path', { target: 'gem' })]
            )
          ]
        }
      })
    },
    {
      id: 'ambush',
      name: 'แบ่งหน้าที่ดักหน้า',
      description:
        'ตัวที่ 1 ไล่ตามหลัง ตัวที่ 2 ไปดักที่ช่องข้างหน้า ตัวที่เหลือไปเฝ้าของหรือเฝ้าประตูแบบไม่เบียดกันเอง — โปรแกรมชุดเดียวแต่เล่นกันคนละบทบาท',
      build: (): BlockProgram => ({
        name: 'แบ่งหน้าที่ดักหน้า',
        scripts: {
          'chase.on-turn': [
            ifElse(
              iAm(1),
              [block('chase.chase-path', { target: 'hero' })],
              [
                ifElse(
                  iAm(2),
                  [block('chase.chase-path', { target: 'ahead' })],
                  [
                    ifElse(
                      block('chase.exit-open'),
                      [block('chase.spread-step', { target: 'exit' })],
                      [block('chase.spread-step', { target: 'gem' })]
                    )
                  ]
                )
              ]
            )
          ]
        }
      })
    },
    {
      id: 'flock',
      name: 'ไล่เป็นฝูงปลา (Boids)',
      description:
        'ไม่มีใครสั่งการ ผู้ไล่ล่าทุกตัวทำตามกฎฝูงปลาของ Reynolds ชุดเดียวกัน: ไม่เบียดเพื่อน ไปทางเดียวกับเพื่อน และไม่ห่างฝูง บวกกฎข้อที่สี่คือว่ายเข้าหาเหยื่อ — น้ำหนักของกฎฝูงต้องเบากว่าแรงไล่ ลองเพิ่ม "แยก" เป็น 2 แล้วดูว่าฝูงวนหลบกันเองจนเหยื่อหนีรอด',
      build: (): BlockProgram => ({
        name: 'ไล่เป็นฝูงปลา (Boids)',
        scripts: {
          'chase.on-turn': [
            block('chase.flock', { target: 'hero' }, { separate: number(0.6), align: number(0.3), gather: number(0.1) })
          ]
        }
      })
    },
    {
      id: 'encircle',
      name: 'ไล่ต้อนเป็นทีม',
      description:
        'ตัวที่ยังอยู่ไกลไปนั่งทับของชิ้นที่เขายังไงก็ต้องมาเก็บ ตัวที่เข้ามาใกล้กว่า 5 ช่องเลิกรอ รุมเข้าหาพร้อมกันโดยเลี่ยงไม่เดินทางเดียวกัน — ชุดที่โหดที่สุดในนี้ ตั้งแต่สองตัวขึ้นไปแทบไม่มีหลุด',
      build: (): BlockProgram => ({
        name: 'ไล่ต้อนเป็นทีม',
        scripts: {
          'chase.on-turn': [
            ifElse(
              compare(block('chase.steps-to', { target: 'hero' }), 'lte', number(5)),
              [block('chase.spread-step', { target: 'hero' })],
              [block('chase.spread-step', { target: 'gem' })]
            )
          ]
        }
      })
    }
  ]
})

/** เปิดเกมมาให้เจอตัวที่แบ่งหน้าที่กันก่อน จะได้เห็นว่าผู้ไล่ล่าหลายตัวต่างกับตัวเดียวยังไง */
export const DEFAULT_PRESET_ID = 'ambush'
