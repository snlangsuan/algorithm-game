import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { VARIABLES } from '~/game/blocks/core'
import { quote, type BlockNode, type BlockSpec, type SelectOption } from '~/game/blocks/types'
import { OTHELLO_EXPLAIN } from './explain'

const SPOTS: SelectOption[] = [
  { value: 'any', label: 'ตาไหนก็ได้' },
  { value: 'corner', label: 'มุมกระดาน' },
  { value: 'edge', label: 'ริมขอบ' },
  { value: 'safe', label: 'ปลอดภัย (ไม่ติดมุม)' },
  { value: 'risky', label: 'ติดมุม (เสี่ยง)' }
]

const ORDERS: SelectOption[] = [
  { value: 'most', label: 'พลิกหมากได้มากที่สุด' },
  { value: 'least', label: 'พลิกหมากได้น้อยที่สุด' },
  { value: 'random', label: 'สุ่ม' }
]

const WHO: SelectOption[] = [
  { value: 'me', label: 'ฉัน' },
  { value: 'rival', label: 'คู่ต่อสู้' }
]

const HAT_START: BlockSpec = {
  kind: 'othello.on-start',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อเริ่มเกม',
  hint: 'ทำครั้งเดียวก่อนเกมเริ่ม เหมาะกับการเตรียมค่าหรือโหลดสิ่งที่จำไว้',
  parts: [{ type: 'text', text: 'เมื่อเริ่มเกม' }],
  emit: () => {}
}

const HAT_TURN: BlockSpec = {
  kind: 'othello.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาของฉัน',
  hint: 'ระบบอ่านบล็อกที่ต่อไว้ข้างล่างนี้ทุกครั้งที่ถึงตาเรา',
  parts: [{ type: 'text', text: 'เมื่อถึงตาของฉัน' }],
  emit: () => {}
}

const HAT_END: BlockSpec = {
  kind: 'othello.on-end',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อจบเกม',
  hint: 'ทำหลังรู้ผลแพ้ชนะ เหมาะกับการจำสิ่งที่ได้ผลไว้ใช้เกมหน้า',
  parts: [{ type: 'text', text: 'เมื่อจบเกม' }],
  emit: () => {}
}

const WEIGHT_SOURCES: SelectOption[] = [
  { value: 'bird', label: 'นกตัวนี้' },
  { value: 'best', label: 'ตัวที่ดีที่สุดของฝูง' }
]

/** บล็อกของฝูงนก (PSO) — ฝูงถูกจำไว้ข้ามเกมเอง ใช้คู่กับหัวบล็อกเริ่มเกมกับจบเกม */
const SWARM_BLOCKS: BlockSpec[] = [
  {
    kind: 'othello.swarm-fly',
    shape: 'statement',
    category: 'data',
    title: 'ฝูงนก: บินหนึ่งก้าว',
    hint: 'นกตัวถัดไปในฝูงบินไปลองน้ำหนักชุดใหม่ — ถูกดึงเข้าหาน้ำหนักที่ดีที่สุดของตัวเองกับของทั้งฝูง ใช้ในหัวบล็อกเริ่มเกม',
    parts: [{ type: 'text', text: 'ฝูงนก: นกตัวถัดไปบินหนึ่งก้าว' }],
    emit: (node, ctx) => ctx.line(node, 'this.swarmFly()')
  },
  {
    kind: 'othello.bird-weights',
    shape: 'statement',
    category: 'data',
    title: 'ใส่น้ำหนักของฝูงนกลงในลิสต์',
    hint: 'นกหนึ่งตัวคือน้ำหนัก 10 กลุ่ม (ช่องที่หมุนหรือสะท้อนกระดานแล้วตรงกันใช้น้ำหนักเดียวกัน) — บล็อกนี้ขยายเป็น 64 ช่องแล้วใส่ลงลิสต์ ใช้คู่กับ "ลงหมากที่ดีที่สุดตามน้ำหนักในลิสต์" · "นกตัวนี้" ใช้ตอนฝึก · "ดีที่สุดของฝูง" ใช้เมื่อฝึกพอแล้ว อยากให้บอทเล่นเต็มฝีมือ',
    parts: [
      { type: 'text', text: 'ใส่น้ำหนักของ' },
      { type: 'field', name: 'from', options: WEIGHT_SOURCES },
      { type: 'text', text: 'ลงในลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) =>
      ctx.line(
        node,
        `this.vars.${ctx.field(node, 'name')} = this.${ctx.field(node, 'from') === 'best' ? 'swarmBestWeights' : 'birdWeights'}()`
      )
  },
  {
    kind: 'othello.swarm-score',
    shape: 'statement',
    category: 'data',
    title: 'ฝูงนก: ให้คะแนน',
    hint: 'ให้คะแนนนกตัวที่เพิ่งลอง — ยิ่งมากยิ่งดี ถ้าดีกว่าที่มันหรือทั้งฝูงเคยได้ น้ำหนักชุดนี้จะถูกจำไว้ ใช้ในหัวบล็อกจบเกม',
    parts: [
      { type: 'text', text: 'ฝูงนก: ให้คะแนนนกตัวนี้' },
      { type: 'input', name: 'value', placeholder: 'คะแนน', accepts: 'number' }
    ],
    emit: (node, ctx) => ctx.line(node, `this.swarmScore(${ctx.value(node, 'value', '0')})`)
  }
]

const BLOCKS: BlockSpec[] = [
  {
    kind: 'othello.ruthless',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากโหมดโหด',
    hint: 'เอนจินเต็มกำลัง: มองล่วงหน้าลึกที่สุดเท่าที่เวลาให้ แล้วแก้ท้ายเกมจนจบจริง — ใช้เวลาคิดเต็มโควตาทุกตา',
    parts: [{ type: 'text', text: 'ลงหมากโหมดโหด' }],
    emit: (node, ctx) => ctx.line(node, 'return this.ruthless(this.here)')
  },
  {
    kind: 'othello.place',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมาก',
    hint: 'เลือกตาจากกลุ่มที่ระบุแล้วลงทันที ถ้ากลุ่มนั้นไม่มีตาให้ลง จะใช้ตาที่ลงได้ตาอื่นแทน',
    parts: [
      { type: 'text', text: 'ลงหมากที่' },
      { type: 'field', name: 'spot', options: SPOTS },
      { type: 'text', text: 'ซึ่ง' },
      { type: 'field', name: 'order', options: ORDERS }
    ],
    emit: (node, ctx) =>
      ctx.line(
        node,
        `return this.choose(${quote(ctx.field(node, 'spot'))}, ${quote(ctx.field(node, 'order'))})`
      )
  },
  {
    kind: 'othello.keep-move',
    shape: 'statement',
    category: 'action',
    title: 'จำตานี้ไว้',
    hint:
      'จดตาที่กำลังไล่ดูอยู่เก็บไว้ ยังไม่ลง — ใช้ข้างใน "สำหรับตาที่ลงได้แต่ละตา" ' +
      'เพื่อเก็บตาที่ดีที่สุดเท่าที่เจอมา แล้วค่อยลงตอนจบลูป · ที่จำไว้ใช้ได้แค่ในตานี้ ตาหน้าเริ่มนับใหม่',
    parts: [{ type: 'text', text: 'จำตานี้ไว้' }],
    emit: (node, ctx) => ctx.line(node, 'this.keep()')
  },
  {
    kind: 'othello.play-kept',
    shape: 'statement',
    category: 'action',
    title: 'ลงตาที่จำไว้',
    hint: 'ลงตาที่ "จำตานี้ไว้" เก็บไว้ล่าสุด ถ้าตานี้ยังไม่ได้จำอะไรไว้เลย จะลงตาที่พลิกมากที่สุดแทน',
    parts: [{ type: 'text', text: 'ลงตาที่จำไว้' }],
    emit: (node, ctx) => ctx.line(node, 'return this.savedMove()')
  },
  {
    kind: 'othello.by-weights',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากตามน้ำหนัก',
    hint: 'ลองทุกตาที่ลงได้ แล้วเลือกตาที่ทำให้กระดานได้คะแนนรวมสูงสุดตามน้ำหนัก 64 ช่องในลิสต์',
    parts: [
      { type: 'text', text: 'ลงหมากที่ดีที่สุดตามน้ำหนักในลิสต์' },
      { type: 'field', name: 'name', options: VARIABLES }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.byWeights('${ctx.field(node, 'name')}')`)
  },
  {
    kind: 'othello.think',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากโดยคิดล่วงหน้า',
    hint:
      'เอนจินจะเดินต้นไม้ให้ตามบล็อกที่ต่อไว้ข้างใน และเรียกชุดเดิมซ้ำทุกครั้งที่เจอ "มองต่ออีกชั้น" · ' +
      'บล็อกนิยามฟังก์ชันเองไม่ได้ การเรียกซ้ำจึงต้องให้เอนจินทำแทน ส่วนตรรกะว่าชั้นไหนเอามากสุดหรือน้อยสุด อยู่ในบล็อกของเราทั้งหมด',
    parts: [
      { type: 'text', text: 'ลงหมากที่ดีที่สุด คิดล่วงหน้า' },
      { type: 'input', name: 'depth', placeholder: 'ตัวเลข', accepts: 'number' },
      { type: 'text', text: 'ตา โดยคิดแบบนี้' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `return this.think(${ctx.value(node, 'depth', '2')}, () => {`)
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('})')
    }
  },
  {
    kind: 'othello.search',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากโดยสุ่มเล่นให้จบ',
    hint:
      'เอนจินสุ่มเล่นจนจบเกมซ้ำ ๆ แล้วจดไว้ว่ากิ่งไหนถูกลองกี่ครั้ง ชนะกี่ครั้ง · ' +
      'บล็อกที่ต่อไว้ข้างในคือกฎว่าจะแบ่งเวลาไปลองกิ่งไหน ซึ่งเป็นหัวใจของวิธีนี้',
    parts: [
      { type: 'text', text: 'ลงหมากที่ดีที่สุด โดยสุ่มเล่นจนจบ' },
      { type: 'input', name: 'rounds', placeholder: 'ตัวเลข', accepts: 'number' },
      { type: 'text', text: 'รอบ แล้วให้คะแนนกิ่งแบบนี้' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, `return this.search(${ctx.value(node, 'rounds', '200')}, () => {`)
      ctx.indent(1)
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('})')
    }
  },
  {
    kind: 'othello.move-flips',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตานี้พลิกได้กี่ตัว',
    hint: 'จำนวนหมากของคู่ต่อสู้ที่จะถูกพลิก ถ้าลงตาที่กำลังไล่ดูอยู่ — ใช้ข้างใน "สำหรับตาที่ลงได้แต่ละตา"',
    parts: [{ type: 'text', text: 'ตานี้พลิกได้กี่ตัว' }],
    emit: () => 'this.flipsHere()'
  },
  {
    kind: 'othello.branch-plays',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'กิ่งนี้ลองไปกี่ครั้ง',
    hint: 'เป็น 0 ถ้ายังไม่เคยลองกิ่งนี้เลย',
    parts: [{ type: 'text', text: 'กิ่งนี้ลองไปกี่ครั้ง' }],
    emit: () => 'this.branchPlays()'
  },
  {
    kind: 'othello.branch-wins',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'กิ่งนี้ชนะกี่ครั้ง',
    parts: [{ type: 'text', text: 'กิ่งนี้ชนะกี่ครั้ง' }],
    emit: () => 'this.branchWins()'
  },
  {
    kind: 'othello.all-plays',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ลองมาทั้งหมดกี่ครั้ง',
    hint: 'จำนวนครั้งที่ลองกิ่งพี่น้องรวมกันทั้งหมด ใช้คำนวณโบนัสให้กิ่งที่ยังลองน้อย',
    parts: [{ type: 'text', text: 'ลองมาทั้งหมดกี่ครั้ง' }],
    emit: () => 'this.allPlays()'
  },
  {
    kind: 'othello.each-move',
    shape: 'statement',
    category: 'control',
    title: 'สำหรับตาที่ลงได้แต่ละตา',
    hint:
      'ไล่ดูตาที่ลงได้ของกระดานที่กำลังคิดอยู่ทีละตา · ใช้ตรง ๆ ในตาของเราก็ได้ ' +
      'คู่กับ "ตานี้พลิกได้กี่ตัว" กับ "จำตานี้ไว้" หรือใช้ข้างใน "คิดล่วงหน้า" คู่กับ "มองต่ออีกชั้น"',
    parts: [
      { type: 'text', text: 'สำหรับตาที่ลงได้แต่ละตา' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, 'for (const ตา of this.movesHere()) {')
      ctx.indent(1)
      ctx.raw('this.focus(ตา)')
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },
  {
    kind: 'othello.answer',
    shape: 'statement',
    category: 'action',
    title: 'ตอบคะแนน',
    hint: 'ส่งคะแนนของกระดานที่กำลังคิดอยู่กลับขึ้นไปให้ชั้นบน แล้วจบการคิดของชั้นนี้',
    parts: [
      { type: 'text', text: 'ตอบคะแนน' },
      { type: 'input', name: 'value', placeholder: 'ตัวเลข', accepts: 'number' }
    ],
    emit: (node, ctx) => ctx.line(node, `return ${ctx.value(node, 'value', '0')}`)
  },
  {
    kind: 'othello.deeper',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'มองต่ออีกชั้น',
    hint: 'สมมติลงตาที่กำลังไล่อยู่ แล้วให้บล็อกชุดเดิมคิดต่อจากกระดานนั้นอีกหนึ่งชั้น ค่าที่ได้คือคะแนนที่ชั้นนั้นตอบกลับมา',
    parts: [{ type: 'text', text: 'มองต่ออีกชั้น' }],
    emit: () => 'this.deeper()'
  },
  {
    kind: 'othello.deepest',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'มองครบชั้นแล้ว',
    hint: 'จริงเมื่อลึกครบตามที่ตั้งไว้ หรือกระดานที่กำลังคิดอยู่ลงต่อไม่ได้แล้ว — ตรงนี้คือจุดที่ต้องให้คะแนน',
    parts: [{ type: 'text', text: 'มองครบชั้นแล้ว' }],
    emit: () => 'this.deepest()'
  },
  {
    kind: 'othello.my-turn',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ถึงตาของฉัน',
    hint: 'ชั้นของเราเลือกคะแนนสูงสุด ชั้นของคู่แข่งเลือกต่ำสุด บล็อกนี้บอกว่ากำลังอยู่ชั้นไหน',
    parts: [{ type: 'text', text: 'ถึงตาของฉัน' }],
    emit: () => 'this.myTurn()'
  },
  {
    kind: 'othello.won',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ฉันชนะเกมนี้',
    hint: 'ใช้ในหัวบล็อก "เมื่อจบเกม"',
    parts: [{ type: 'text', text: 'ฉันชนะเกมนี้' }],
    emit: () => 'this.won'
  },
  {
    kind: 'othello.has',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'มีตาที่ลงได้',
    parts: [
      { type: 'text', text: 'มีตาที่' },
      { type: 'field', name: 'spot', options: SPOTS },
      { type: 'text', text: 'ให้ลง' }
    ],
    emit: (node, ctx) => `this.has(${quote(ctx.field(node, 'spot'))})`
  },
  {
    kind: 'othello.count',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนตาที่ลงได้',
    parts: [
      { type: 'text', text: 'จำนวนตาที่' },
      { type: 'field', name: 'spot', options: SPOTS },
      { type: 'text', text: 'ลงได้' }
    ],
    emit: (node, ctx) => `this.spots(${quote(ctx.field(node, 'spot'))}).length`
  },
  {
    kind: 'othello.score',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'คะแนน',
    parts: [
      { type: 'text', text: 'คะแนนของ' },
      { type: 'field', name: 'who', options: WHO }
    ],
    emit: (node, ctx) => `this.score(${quote(ctx.field(node, 'who'))})`
  },
  {
    kind: 'othello.corners',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'มุมที่ยึดได้',
    hint: 'มุมลงแล้วไม่มีวันถูกพลิก ตัวเลขนี้จึงเป็นสิ่งที่ตัดสินเกมจริง ๆ ต่างจากจำนวนหมากที่เปลี่ยนได้ตลอด',
    parts: [
      { type: 'text', text: 'จำนวนมุมที่' },
      { type: 'field', name: 'who', options: WHO },
      { type: 'text', text: 'ยึดได้' }
    ],
    emit: (node, ctx) => `this.corners(${quote(ctx.field(node, 'who'))})`
  },
  {
    kind: 'othello.turn',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตาที่เท่าไร',
    parts: [{ type: 'text', text: 'ตาที่เท่าไรแล้ว' }],
    emit: () => 'this.here.turn'
  },
  {
    kind: 'othello.empty',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ช่องว่างที่เหลือ',
    parts: [{ type: 'text', text: 'ช่องว่างที่เหลือ' }],
    emit: () => 'this.count(this.here.board).empty'
  }
]

const HELPERS = `
  // ---------- ตัวช่วยของบล็อก ----------

  isCorner(move) {
    return (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7)
  }

  isEdge(move) {
    return move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7
  }

  // ช่องที่ติดกับมุม ลงแล้วมักเปิดมุมให้คู่ต่อสู้
  isRisky(move) {
    const near = (value) => value <= 1 || value >= 6
    return near(move.row) && near(move.col) && !this.isCorner(move)
  }

  spots(kind) {
    const moves = this.here.validMoves
    if (kind === 'corner') return moves.filter((move) => this.isCorner(move))
    if (kind === 'edge') return moves.filter((move) => this.isEdge(move))
    if (kind === 'safe') return moves.filter((move) => !this.isRisky(move))
    if (kind === 'risky') return moves.filter((move) => this.isRisky(move))
    return moves
  }

  has(kind) {
    return this.spots(kind).length > 0
  }

  score(who) {
    // ตอนจบเกมใช้กระดานสุดท้าย ระหว่างเกมใช้กระดานที่เห็นล่าสุด
    const tally = this.final ?? this.count(this.here.board)
    const side = this.side ?? this.here.player
    const mine = side === BLACK ? tally.black : tally.white
    return who === 'me' ? mine : (tally.black + tally.white) - mine
  }

  // ลองทุกตาที่ลงได้ แล้วให้คะแนนกระดานที่ได้ตามน้ำหนัก 64 ช่อง
  byWeights(slot) {
    const weights = this.list(slot)
    let best = this.here.validMoves[0]
    let bestScore = -Infinity

    for (const move of this.here.validMoves) {
      const board = this.simulate(this.here.board, move, this.here.player)
      let score = 0

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const cell = board[row][col]
          if (cell === EMPTY) continue
          const weight = weights[row * 8 + col] ?? 0
          score += cell === this.here.player ? weight : -weight
        }
      }

      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

  // จำนวนมุมที่ยึดได้ — อ่านจากกระดานที่กำลังดูอยู่ จึงใช้กับกระดานสมมติได้ด้วย
  corners(who) {
    const board = this.here.board
    const side = this.side ?? this.here.player
    const mine = who === 'me' ? side : side === BLACK ? WHITE : BLACK

    let total = 0
    for (const spot of [[0, 0], [0, 7], [7, 0], [7, 7]]) {
      if (board[spot[0]][spot[1]] === mine) total++
    }
    return total
  }

  // กระดานสมมติ — ทำให้บล็อกคะแนน/จำนวนตา/ช่องว่าง อ่านกระดานที่กำลังคิดอยู่ ไม่ใช่กระดานจริง
  imagine(board, player) {
    return {
      board,
      player,
      opponent: player === BLACK ? WHITE : BLACK,
      validMoves: this.validMoves(board, player),
      turn: this.here.turn,
      lastMove: null,
      timeBudget: 0
    }
  }

  /**
   * เดินต้นไม้ของมินิแมกซ์ตามบล็อกที่ผู้เล่นต่อไว้ข้างใน
   *
   * ตรงนี้ทำแค่สองอย่างที่บล็อกทำเองไม่ได้ — เรียกชุดบล็อกเดิมซ้ำอีกชั้น
   * กับเก็บตัวแปรของแต่ละชั้นแยกกัน · ส่วนตรรกะมากสุด/น้อยสุดอยู่ในบล็อกทั้งหมด
   */
  think(depth, judge) {
    const real = this.here
    // เพดาน 4 เพราะไม่มีการตัดกิ่ง — วัดแล้วลึก 5 กลางเกมใช้ 3.8 วินาทีต่อตา เกินเพดานของ worker
    const levels = Math.max(1, Math.min(Math.round(Number(depth)) || 1, 4))

    this.mind = { judge, me: this.side ?? real.player, left: 0, focus: null }

    let pick = real.validMoves[0]
    let best = -Infinity

    for (const move of real.validMoves) {
      const value = this.descend(real.board, real.player, move, levels - 1)
      if (value > best) {
        best = value
        pick = move
      }
    }

    this.here = real
    this.mind = null
    return pick
  }

  // ลงตาที่เลือกในกระดานสมมติ แล้วให้บล็อกชุดเดิมคิดต่อจากตรงนั้นอีกหนึ่งชั้น
  descend(board, player, move, left) {
    const mind = this.mind
    if (!mind) return 0

    const outer = this.here
    const vars = this.vars
    const focus = mind.focus
    const depth = mind.left

    const next = this.simulate(board, move, player)
    let turn = player === BLACK ? WHITE : BLACK
    // ฝ่ายนั้นลงไม่ได้ก็ผ่านตา กลับมาเป็นฝ่ายเดิม
    if (this.validMoves(next, turn).length === 0) turn = player

    this.here = this.imagine(next, turn)
    // แต่ละชั้นต้องมีตัวแปรของตัวเอง ไม่งั้นชั้นลึกจะทับค่าที่ชั้นบนกำลังใช้อยู่
    this.vars = { ...vars }
    mind.left = left
    mind.focus = null

    const value = Number(mind.judge())

    this.here = outer
    this.vars = vars
    mind.left = depth
    mind.focus = focus

    return Number.isFinite(value) ? value : 0
  }

  movesHere() {
    return this.here.validMoves
  }

  // ---------- สุ่มเล่นให้จบแล้วนับ ----------

  makeNode(board, player) {
    return {
      board,
      player,
      moves: this.validMoves(board, player),
      kids: new Map(),
      move: null,
      plays: 0,
      wins: 0
    }
  }

  /** สุ่มเดินจากกระดานนี้ไปจนจบเกม แล้วบอกว่าฝั่งเราชนะไหม — ไม่มีความรู้เรื่องเกมอยู่ในนี้เลย */
  rollout(board, player, me) {
    let at = board
    let turn = player

    for (let ply = 0; ply < 80; ply++) {
      const moves = this.validMoves(at, turn)
      const other = turn === BLACK ? WHITE : BLACK

      if (moves.length === 0) {
        if (this.validMoves(at, other).length === 0) break
        turn = other
        continue
      }

      at = this.simulate(at, moves[Math.floor(Math.random() * moves.length)], turn)
      turn = other
    }

    const tally = this.count(at)
    const mine = me === BLACK ? tally.black : tally.white
    return mine > tally.black + tally.white - mine
  }

  /** ให้บล็อกของผู้เล่นให้คะแนนกิ่งหนึ่ง โดยสลับกระดานกับตัวแปรเป็นของกิ่งนั้นชั่วคราว */
  rateBranch(parent, kid) {
    const tree = this.tree
    const outer = this.here
    const vars = this.vars

    tree.parent = parent
    tree.branch = kid
    this.here = this.imagine(kid.board, kid.player)
    this.vars = { ...vars }

    const value = Number(tree.judge())

    this.here = outer
    this.vars = vars
    return Number.isFinite(value) ? value : 0
  }

  branchPlays() {
    return this.tree && this.tree.branch ? this.tree.branch.plays : 0
  }

  branchWins() {
    return this.tree && this.tree.branch ? this.tree.branch.wins : 0
  }

  allPlays() {
    return this.tree && this.tree.parent ? this.tree.parent.plays : 0
  }

  /**
   * เอนจินเก็บต้นไม้กับสถิติให้ เพราะบล็อกไม่มีชนิดข้อมูลแบบต้นไม้
   * ส่วนกฎว่าจะลงไปกิ่งไหน อยู่ในบล็อกของผู้เล่นทั้งหมด
   */
  search(rounds, judge) {
    const real = this.here
    const me = this.side ?? real.player
    const limit = Math.max(1, Math.min(Math.round(Number(rounds)) || 1, 2000))

    this.tree = { judge, parent: null, branch: null }
    const root = this.makeNode(real.board, real.player)

    for (let round = 0; round < limit; round++) {
      const path = [root]
      let node = root

      // ไล่ลงไปตามกิ่งที่บล็อกให้คะแนนสูงสุด จนกว่าจะถึงกิ่งที่ยังไม่เคยลอง
      while (node.moves.length > 0) {
        let best = null
        let bestScore = -Infinity

        for (const move of node.moves) {
          const id = move.row * 8 + move.col
          let kid = node.kids.get(id)

          if (!kid) {
            const after = this.simulate(node.board, move, node.player)
            let turn = node.player === BLACK ? WHITE : BLACK
            if (this.validMoves(after, turn).length === 0) turn = node.player

            kid = this.makeNode(after, turn)
            kid.move = move
            node.kids.set(id, kid)
          }

          const value = this.rateBranch(node, kid)
          if (value > bestScore) {
            bestScore = value
            best = kid
          }
        }

        if (!best) break

        node = best
        path.push(node)
        if (node.plays === 0) break
      }

      const won = this.rollout(node.board, node.player, me)
      for (const step of path) {
        step.plays++
        if (won) step.wins++
      }
    }

    // ลงตาของกิ่งที่ถูกลองมากที่สุด ไม่ใช่กิ่งที่อัตราชนะสูงสุด — กิ่งที่ลองน้อยยังเชื่อไม่ได้
    let pick = real.validMoves[0]
    let most = -1

    for (const kid of root.kids.values()) {
      if (kid.plays > most) {
        most = kid.plays
        pick = kid.move
      }
    }

    this.here = real
    this.tree = null
    return pick
  }

  focus(move) {
    if (this.mind) this.mind.focus = move
    // เก็บไว้ต่างหากด้วย บล็อก "ไล่ดูทีละตา" จึงใช้ได้ทั้งในและนอกโหมดคิดล่วงหน้า
    this.look = move
  }

  // จำนวนหมากที่จะพลิกได้ ถ้าลงตาที่กำลังไล่ดูอยู่
  flipsHere() {
    return this.look ? this.look.flips.length : 0
  }

  // จดตาที่กำลังไล่ดูอยู่ไว้ — ผูกกับกระดานของตานี้ ไม่ให้ค้างข้ามตาจนลงตาที่ลงไม่ได้แล้ว
  keep() {
    this.saved = { move: this.look, at: this.here }
  }

  savedMove() {
    const saved = this.saved
    if (saved && saved.at === this.here && saved.move) return saved.move
    return this.choose('any', 'most')
  }

  deeper() {
    const mind = this.mind
    if (!mind || !mind.focus) return 0
    return this.descend(this.here.board, this.here.player, mind.focus, mind.left - 1)
  }

  deepest() {
    return !this.mind || this.mind.left <= 0 || this.here.validMoves.length === 0
  }

  myTurn() {
    return Boolean(this.mind) && this.here.player === this.mind.me
  }

  // เลือกตาจากกลุ่มที่ระบุ ถ้ากลุ่มนั้นว่างก็ใช้ตาที่ลงได้ทั้งหมดแทน
  choose(kind, order) {
    let list = this.spots(kind)
    if (list.length === 0) list = this.here.validMoves

    if (order === 'random') return list[Math.floor(Math.random() * list.length)]

    return [...list].sort((a, b) =>
      order === 'least' ? a.flips.length - b.flips.length : b.flips.length - a.flips.length
    )[0]
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

const place = (spot: string, order: string) => block('othello.place', { spot, order })
const has = (spot: string) => block('othello.has', { spot })
const number = (value: number) => block('number', { value })
const readVar = (name: string) => block('var-get', { name })
const random = (min: number, max: number) => block('random', { min, max })
const math = (op: string, left: BlockNode, right: BlockNode) => block('math', { op }, { left, right })
const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

const STATEMENT_PARSERS: Matcher[] = [
  (node, ctx) => {
    const back = ctx.returned(node)
    return back && ctx.call(back, 'ruthless') ? ctx.make('othello.ruthless') : null
  },
  (node, ctx) => (node.type === 'ExpressionStatement' && ctx.call(node.expression, 'swarmFly') ? ctx.make('othello.swarm-fly') : null),
  (node, ctx) => {
    if (node.type !== 'ExpressionStatement') return null
    const args = ctx.call(node.expression, 'swarmScore')
    return args && args.length === 1 ? ctx.make('othello.swarm-score', {}, { value: ctx.value(args[0]!) }) : null
  },
  (node, ctx) => {
    const expression = node.type === 'ExpressionStatement' ? node.expression : null
    if (expression?.type !== 'AssignmentExpression') return null
    const from = ctx.call(expression.right, 'birdWeights') ? 'bird' : ctx.call(expression.right, 'swarmBestWeights') ? 'best' : null
    const left = expression.left
    const name = left?.type === 'MemberExpression' && ctx.thisProp(left.object, 'vars') ? left.property?.name : null
    return from && name && VARIABLES.some((item) => item.value === name) ? ctx.make('othello.bird-weights', { from, name }) : null
  },
  (node, ctx) => {
    const back = ctx.returned(node)
    if (!back) return null

    if (ctx.call(back, 'savedMove')) return ctx.make('othello.play-kept')

    const weights = ctx.call(back, 'byWeights')
    const slot = weights ? ctx.str(weights[0]!) : null
    if (slot) return ctx.make('othello.by-weights', { name: slot })

    const tree = ctx.call(back, 'search')
    if (tree) {
      const inner: Node[] = tree[1]?.body?.body ?? []
      return ctx.make(
        'othello.search',
        {},
        { rounds: ctx.value(tree[0]!) },
        { do: inner.flatMap((item) => ctx.body(item)) }
      )
    }

    const deep = ctx.call(back, 'think')
    if (deep) {
      const inner: Node[] = deep[1]?.body?.body ?? []
      return ctx.make(
        'othello.think',
        {},
        { depth: ctx.value(deep[0]!) },
        { do: inner.flatMap((item) => ctx.body(item)) }
      )
    }

    const args = ctx.call(back, 'choose')
    if (!args) return null

    const spot = ctx.str(args[0]!)
    const order = ctx.str(args[1]!)
    return spot && order ? ctx.make('othello.place', { spot, order }) : null
  },

  (node, ctx) => {
    if (node.type !== 'ForOfStatement') return null
    if (!ctx.call(node.right, 'movesHere')) return null

    const inner: Node[] = (node.body?.body ?? []).filter(
      (item: Node) => !(item.type === 'ExpressionStatement' && ctx.call(item.expression, 'focus'))
    )

    return ctx.make('othello.each-move', {}, {}, { do: inner.flatMap((item) => ctx.body(item)) })
  },

  (node, ctx) =>
    node.type === 'ExpressionStatement' && ctx.call(node.expression, 'keep')
      ? ctx.make('othello.keep-move')
      : null,

  (node, ctx) => {
    const back = ctx.returned(node)
    return back ? ctx.make('othello.answer', {}, { value: ctx.value(back) }) : null
  }
]

const VALUE_PARSERS: Matcher[] = [
  (node, ctx) => (ctx.thisProp(node, 'won') ? ctx.make('othello.won') : null),
  (node, ctx) => {
    const args = ctx.call(node, 'has')
    const spot = args ? ctx.str(args[0]!) : null
    return spot ? ctx.make('othello.has', { spot }) : null
  },
  (node, ctx) => {
    if (node.type !== 'MemberExpression' || node.property?.name !== 'length') return null

    const args = ctx.call(node.object, 'spots')
    const spot = args ? ctx.str(args[0]!) : null
    return spot ? ctx.make('othello.count', { spot }) : null
  },
  (node, ctx) => {
    const args = ctx.call(node, 'score')
    const who = args ? ctx.str(args[0]!) : null
    return who ? ctx.make('othello.score', { who }) : null
  },
  (node, ctx) => {
    const args = ctx.call(node, 'corners')
    const who = args ? ctx.str(args[0]!) : null
    return who ? ctx.make('othello.corners', { who }) : null
  },
  (node, ctx) => (ctx.call(node, 'branchPlays') ? ctx.make('othello.branch-plays') : null),
  (node, ctx) => (ctx.call(node, 'branchWins') ? ctx.make('othello.branch-wins') : null),
  (node, ctx) => (ctx.call(node, 'allPlays') ? ctx.make('othello.all-plays') : null),
  (node, ctx) => (ctx.call(node, 'flipsHere') ? ctx.make('othello.move-flips') : null),
  (node, ctx) => (ctx.call(node, 'deeper') ? ctx.make('othello.deeper') : null),
  (node, ctx) => (ctx.call(node, 'deepest') ? ctx.make('othello.deepest') : null),
  (node, ctx) => (ctx.call(node, 'myTurn') ? ctx.make('othello.my-turn') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'turn') ? ctx.make('othello.turn') : null),
  (node, ctx) => {
    if (node.type !== 'MemberExpression' || node.property?.name !== 'empty') return null
    return ctx.call(node.object, 'count') ? ctx.make('othello.empty') : null
  }
]

function unwrap(statements: Node[], ctx: ParseContext): Node[] {
  const list = statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

  const last = list[list.length - 1]
  if (last?.type === 'ReturnStatement') {
    const args = ctx.call(last.argument, 'choose')
    if (args && ctx.str(args[0]!) === 'any' && ctx.str(args[1]!) === 'most') list.pop()
  }

  return list
}

export const OTHELLO_PACK = createPack({
  id: 'othello',
  blocks: [...BLOCKS, ...SWARM_BLOCKS],
  explain: OTHELLO_EXPLAIN,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'OthelloAgent',
    fields: [],
    helpers: HELPERS,
    memory: true,
    methods: [
      {
        hat: HAT_START,
        name: 'onGameStart',
        unwrap: (statements, ctx) =>
          statements.filter(
            (node) =>
              !(
                node.type === 'ExpressionStatement' &&
                (ctx.thisProp(node.expression?.left, 'side') ||
                  ctx.thisProp(node.expression?.left, 'final'))
              )
          ),
        write: (writer) => {
          writer.push('onGameStart(player) {')
          writer.indent(1)
          writer.push('this.side = player')
          writer.push('this.final = null')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: HAT_TURN,
        name: 'chooseMove',
        unwrap,
        write: (writer) => {
          writer.push('chooseMove(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.push('')
          writer.body()
          writer.push('')
          writer.push('// โปรแกรมไม่ได้สั่งลงตาไหนเลย — เลือกตาที่พลิกมากที่สุดให้')
          writer.push(`return this.choose('any', 'most')`)
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: HAT_END,
        name: 'onGameEnd',
        unwrap: (statements, ctx) =>
          statements.filter(
            (node) =>
              !(
                node.type === 'ExpressionStatement' &&
                (ctx.thisProp(node.expression?.left, 'won') ||
                  ctx.thisProp(node.expression?.left, 'final'))
              )
          ),
        write: (writer) => {
          writer.push('onGameEnd(board, winner) {')
          writer.indent(1)
          writer.push('this.won = winner === this.side')
          writer.push('this.final = this.count(board)')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    {
      id: 'greedy',
      name: 'กินเยอะสุด',
      description:
        'ไล่ดูตาที่ลงได้ทุกตา เทียบว่าพลิกหมากได้กี่ตัว เก็บตาที่มากที่สุดไว้ แล้วค่อยลง — เข้าใจง่ายแต่เสียมุมบ่อย · ' +
        'บล็อก "ลงหมากที่ [ตาไหนก็ได้] ซึ่ง [พลิกหมากได้มากที่สุด]" ทำสิ่งนี้ให้ในบล็อกเดียว ชุดนี้คือการแตกบล็อกนั้นออกมาให้เห็นข้างใน',
      build: (): BlockProgram => ({
        name: 'กินเยอะสุด',
        scripts: {
          'othello.on-turn': [

            block('set-var', { name: 'a' }, { value: number(-1) }),
            block(
              'othello.each-move',
              {},
              {},
              {
                do: [
                  block(
                    'if',
                    {},
                    { cond: compare(block('othello.move-flips'), 'gt', readVar('a')) },
                    {
                      then: [
                        block('set-var', { name: 'a' }, { value: block('othello.move-flips') }),
                        block('othello.keep-move')
                      ]
                    }
                  )
                ]
              }
            ),
            block('othello.play-kept')
          ]
        }
      })
    },
    {
      id: 'corner',
      name: 'ยึดมุมก่อน',
      description: 'มุมยึดแล้วไม่มีวันถูกพลิก จึงเอามุมก่อน แล้วค่อยเลี่ยงช่องติดมุม',
      build: (): BlockProgram => ({
        name: 'ยึดมุมก่อน',
        scripts: {
          'othello.on-turn': [
          block('if', {}, { cond: has('corner') }, { then: [place('corner', 'most')] }),
          block('if', {}, { cond: has('safe') }, { then: [place('safe', 'least')] }),
          place('any', 'least')
          ]
        }
      })
    },
    {
      id: 'late',
      name: 'ต้นเกมเก็บตัว ท้ายเกมกินรวบ',
      description: 'ช่วงแรกลงตาที่พลิกน้อยเพื่อคุมกระดาน พอใกล้จบค่อยกินให้เยอะที่สุด',
      build: (): BlockProgram => ({
        name: 'ต้นเกมเก็บตัว',
        scripts: {
          'othello.on-turn': [
          block('if', {}, { cond: has('corner') }, { then: [place('corner', 'most')] }),
          block(
            'if-else',
            {},
            {
              cond: block(
                'compare',
                { op: 'lt' },
                { left: block('othello.empty'), right: block('number', { value: 12 }) }
              )
            },
            { then: [place('any', 'most')], else: [place('safe', 'least')] }
          )
          ]
        }
      })
    },
    {
      id: 'evolve',
      name: 'วิวัฒนาการ (GA)',
      description:
        'สุ่มน้ำหนัก 64 ช่องเป็นแชมป์ แล้วแต่ละเกมกลายพันธุ์นิดหน่อย เกมไหนทำคะแนนดีกว่าแชมป์เดิมก็ยึดเป็นแชมป์แทน — ยิ่งประลองยิ่งเก่ง',
      build: (): BlockProgram => ({
        name: 'วิวัฒนาการ (GA)',
        scripts: {

          'othello.on-start': [
            block('set-var', { name: 'a' }, { value: block('recall', { slot: 'a' }) }),
            block(
              'if',
              {},
              {
                cond: block(
                  'compare',
                  { op: 'lt' },
                  { left: block('list-length', { name: 'a' }), right: number(64) }
                )
              },
              {
                then: [
                  block('list-clear', { name: 'a' }),
                  block(
                    'repeat',
                    { times: 64 },
                    {},
                    { do: [block('list-push', { name: 'a' }, { value: random(0, 20) })] }
                  )
                ]
              }
            ),
            // กลายพันธุ์ช่องเดียวต่อเกม — วัดจริงแล้วแก้ทีละ 6 ช่องทำให้ของดีที่สะสมมาพังทุกเกม
            // จนเทรนเพิ่มเท่าไรก็ไม่เก่งขึ้น (ชนะ 'ยึดมุม' ค้างที่ราว 30%) แก้ทีละช่องขึ้นไปถึงราว 79%
            block('list-put', { name: 'a' }, { index: random(1, 64), value: random(0, 20) })
          ],

          'othello.on-turn': [block('othello.by-weights', { name: 'a' })],

          // ไม่มีใครชนะบาร์ ก็ลดบาร์ลงทีละแต้ม
          //
          // บาร์ที่ขึ้นอย่างเดียวจะค้างถาวร พอเคยฟลุกทำคะแนนสูงไว้ครั้งเดียว
          // (เช่นตอนซ้อมกับคู่ที่อ่อนกว่า) แชมป์ก็จะไม่มีวันถูกแทนอีกเลย ซ้อมต่อกี่ร้อยเกมก็เท่าเดิม
          // ปล่อยให้บาร์ไหลลงได้ มันจะปรับตัวเองไปหาระดับคะแนนของคู่ซ้อมตรงหน้า
          'othello.on-end': [
            block(
              'if-else',
              {},
              {
                cond: block(
                  'compare',
                  { op: 'gt' },
                  { left: block('othello.score', { who: 'me' }), right: block('recall', { slot: 'b' }) }
                )
              },
              {
                then: [
                  block('remember', { slot: 'a' }, { value: readVar('a') }),
                  block('remember', { slot: 'b' }, { value: block('othello.score', { who: 'me' }) })
                ],
                else: [
                  block(
                    'remember',
                    { slot: 'b' },
                    { value: math('sub', block('recall', { slot: 'b' }), number(1)) }
                  )
                ]
              }
            )
          ]
        }
      })
    },
    {
      id: 'lookahead',
      name: 'คิดแทนคู่แข่ง (minimax)',
      description:
        'ไล่ดูตาของเราสลับตาของคู่แข่งสี่ชั้น ชั้นของเราเก็บคะแนนสูงสุด ชั้นของคู่แข่งเก็บต่ำสุด — ลองแก้สูตรให้คะแนนแล้วบอทจะเปลี่ยนนิสัยทันที',
      build: (): BlockProgram => ({
        name: 'คิดแทนคู่แข่ง',
        scripts: {
          'othello.on-turn': [
          block(
            'othello.think',
            {},
            { depth: number(4) },
            {
              do: [

                block(
                  'if',
                  {},
                  { cond: block('othello.deepest') },
                  {

                    then: [
                      block(
                        'set-var',
                        { name: 'c' },
                        {
                          value: math(
                            'sub',
                            block('othello.corners', { who: 'me' }),
                            block('othello.corners', { who: 'rival' })
                          )
                        }
                      ),
                      block('set-var', { name: 'c' }, { value: math('mul', readVar('c'), number(25)) }),
                      block(
                        'set-var',
                        { name: 'c' },
                        { value: math('add', readVar('c'), block('othello.score', { who: 'me' })) }
                      ),
                      block(
                        'set-var',
                        { name: 'c' },
                        { value: math('sub', readVar('c'), block('othello.score', { who: 'rival' })) }
                      ),
                      block('othello.answer', {}, { value: readVar('c') })
                    ]
                  }
                ),

                block(
                  'if-else',
                  {},
                  { cond: block('othello.my-turn') },
                  {
                    then: [block('set-var', { name: 'a' }, { value: number(-999) })],
                    else: [block('set-var', { name: 'a' }, { value: number(999) })]
                  }
                ),
                block(
                  'othello.each-move',
                  {},
                  {},
                  {
                    do: [

                      block('set-var', { name: 'b' }, { value: block('othello.deeper') }),
                      block(
                        'if-else',
                        {},
                        { cond: block('othello.my-turn') },
                        {

                          then: [
                            block(
                              'if',
                              {},
                              { cond: compare(readVar('b'), 'gt', readVar('a')) },
                              { then: [block('set-var', { name: 'a' }, { value: readVar('b') })] }
                            )
                          ],
                          else: [
                            block(
                              'if',
                              {},
                              { cond: compare(readVar('b'), 'lt', readVar('a')) },
                              { then: [block('set-var', { name: 'a' }, { value: readVar('b') })] }
                            )
                          ]
                        }
                      )
                    ]
                  }
                ),
                block('othello.answer', {}, { value: readVar('a') })
              ]
            }
          )
          ]
        }
      })
    },
    {
      id: 'playouts',
      name: 'สุ่มเล่นให้จบแล้วนับ (MCTS)',
      description:
        'ไม่มีสูตรบอกว่ากระดานดีแค่ไหนเลย — สุ่มเล่นจนจบเกมซ้ำ ๆ แล้วเลือกกิ่งที่ชนะบ่อย ผสมกับกิ่งที่ยังลองน้อย',
      build: (): BlockProgram => ({
        name: 'สุ่มเล่นให้จบแล้วนับ',
        scripts: {
          'othello.on-turn': [
          block(
            'othello.search',
            {},
            { rounds: number(300) },
            {
              do: [

                block(
                  'if',
                  {},
                  { cond: compare(block('othello.branch-plays'), 'lt', number(1)) },
                  { then: [block('othello.answer', {}, { value: number(999) })] }
                ),

                block(
                  'set-var',
                  { name: 'a' },
                  {
                    value: math(
                      'div',
                      block('othello.branch-wins'),
                      block('othello.branch-plays')
                    )
                  }
                ),

                block(
                  'set-var',
                  { name: 'b' },
                  {
                    value: math(
                      'div',
                      block('othello.all-plays'),
                      block('othello.branch-plays')
                    )
                  }
                ),
                block(
                  'set-var',
                  { name: 'b' },
                  { value: block('math-one', { fn: 'sqrt' }, { value: readVar('b') }) }
                ),
                block('set-var', { name: 'b' }, { value: math('mul', readVar('b'), number(1.4)) }),
                block('othello.answer', {}, { value: math('add', readVar('a'), readVar('b')) })
              ]
            }
          )
          ]
        }
      })
    },
    {
      id: 'random',
      name: 'สุ่ม',
      description: 'เลือกตาแบบสุ่ม ใช้เป็นคู่ซ้อมเบา ๆ',
      build: (): BlockProgram => ({ name: 'สุ่ม', scripts: { 'othello.on-turn': [place('any', 'random')] } })
    },
    {
      id: 'swarm',
      name: 'ฝูงนกหาน้ำหนัก (PSO)',
      description:
        'โจทย์เดียวกับวิวัฒนาการ (GA) แต่ใช้ฝูงนกหกตัวหาแทน และหาแค่ 10 น้ำหนัก เพราะช่องที่หมุนหรือสะท้อนกระดานแล้วตรงกัน เช่นมุมทั้งสี่ ควรมีน้ำหนักเท่ากัน — ทุกเกมนกตัวถัดไปบินหนึ่งก้าว เล่นด้วยน้ำหนักของมัน แล้วรับคะแนนเป็นจำนวนหมากตอนจบเกม',
      build: (): BlockProgram => ({
        name: 'ฝูงนกหาน้ำหนัก (PSO)',
        scripts: {
          'othello.on-start': [block('othello.swarm-fly'), block('othello.bird-weights', { from: 'bird', name: 'a' })],
          'othello.on-turn': [block('othello.by-weights', { name: 'a' })],
          'othello.on-end': [block('othello.swarm-score', {}, { value: block('othello.score', { who: 'me' }) })]
        }
      })
    },
    {
      id: 'ruthless',
      name: 'โหมดโหด',
      description:
        'เอนจินเต็มกำลังที่รวมหลายวิธีไว้ในตัวเดียว: มองล่วงหน้าแบบตัดกิ่ง (alpha-beta) ลึกขึ้นทีละชั้นจนหมดเวลา จำกระดานที่เคยคิดแล้ว ประเมินกระดานจากความคล่องตัว มุม และขอบที่พลิกไม่ได้ แล้วพอเหลือช่องว่างไม่เกิน 14 ช่องก็แก้จนจบเกมจริง — ลองเอาชนะดูสิ',
      build: (): BlockProgram => ({
        name: 'โหมดโหด',
        scripts: { 'othello.on-turn': [block('othello.ruthless')] }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'corner'
