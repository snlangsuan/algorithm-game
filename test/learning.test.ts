import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { OthelloAgent, AGENT_GLOBALS, OTHELLO_SPACE, SYMMETRY_CLASS, expandWeights, type AgentMemory } from '~/game/othello/agent'
import { readSwarm } from '~/game/line/swarm'
import { TOPICS } from '~/data/algorithms'
import {
  BLACK,
  WHITE,
  applyMove,
  countDiscs,
  createBoard,
  getValidMoves,
  hasValidMove,
  opponent,
  type Player
} from '~/game/othello/engine'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { usesBlock } from '~/game/blocks/program'

function build(presetId: string): OthelloAgent {
  const preset = OTHELLO_PACK.presets.find((item) => item.id === presetId)
  assert.ok(preset, `ไม่มีตัวอย่างชื่อ '${presetId}'`)

  const { code } = generate(normalize(preset.build(), OTHELLO_PACK), OTHELLO_PACK)
  const factory = new Function(
    'OthelloAgent',
    'EMPTY',
    'BLACK',
    'WHITE',
    `"use strict";\n${code}\n;return Agent;`
  )
  const Agent = factory(OthelloAgent, AGENT_GLOBALS.EMPTY, AGENT_GLOBALS.BLACK, AGENT_GLOBALS.WHITE)
  const agent: OthelloAgent = new Agent()

  agent.saveMemory = (data: AgentMemory) => {
    agent.memory = data
  }
  return agent
}

function play(black: OthelloAgent, white: OthelloAgent): Player | null {
  const players: Record<Player, OthelloAgent> = { [BLACK]: black, [WHITE]: white }
  for (const side of [BLACK, WHITE] as Player[]) players[side].onGameStart(side)

  let board = createBoard()
  let side: Player = BLACK
  let turn = 1

  while (turn < 200) {
    const validMoves = getValidMoves(board, side)
    if (validMoves.length === 0) {
      if (!hasValidMove(board, opponent(side))) break
      side = opponent(side)
      continue
    }
    const move = players[side].chooseMove({
      board,
      player: side,
      opponent: opponent(side),
      validMoves,
      turn,
      lastMove: null,
      timeBudget: 40
    })
    board = applyMove(board, move as { row: number; col: number }, side)
    side = opponent(side)
    turn++
  }

  const tally = countDiscs(board)
  const winner = tally.black === tally.white ? null : tally.black > tally.white ? BLACK : WHITE
  for (const s of [BLACK, WHITE] as Player[]) players[s].onGameEnd(board, winner)
  return winner
}

const GAMES = 80
const WINDOW = 25
const ROUNDS = 40

const SEED = 7919

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('ตัวอย่าง "วิวัฒนาการ" ใช้บล็อกความจำจริง ไม่ใช่แค่ดูโค้ดแล้วเดา', () => {

  const evolve = OTHELLO_PACK.presets.find((item) => item.id === 'evolve')!
  assert.ok(usesBlock(normalize(evolve.build(), OTHELLO_PACK), ['remember', 'forget']))
})

test(`GA ซ้อมแล้วเล่นเก่งขึ้น (เฉลี่ย ${ROUNDS} รอบ × ${GAMES} เกม)`, { timeout: 120_000 }, () => {
  const realRandom = Math.random
  Math.random = seededRandom(SEED)

  let firstTotal = 0
  let lastTotal = 0

  try {
    for (let round = 0; round < ROUNDS; round++) {
      const ga = build('evolve')
      const rival = build('corner')

      const results: Array<Player | null> = []
      for (let game = 0; game < GAMES; game++) results.push(play(ga, rival))

      const rate = (from: number, to: number) =>
        (results.slice(from, to).filter((winner) => winner === BLACK).length / (to - from)) * 100

      firstTotal += rate(0, WINDOW)
      lastTotal += rate(GAMES - WINDOW, GAMES)
    }
  } finally {
    Math.random = realRandom
  }

  const before = firstTotal / ROUNDS
  const after = lastTotal / ROUNDS
  console.log(
    `  ชนะ ${WINDOW} เกมแรก ${before.toFixed(1)}% -> ${WINDOW} เกมท้าย ${after.toFixed(1)}%` +
    ` (เฉลี่ย ${ROUNDS} รอบ)`
  )

  assert.ok(
    after > before,
    `ซ้อมแล้วควรชนะบ่อยขึ้น แต่ได้ ${before.toFixed(1)}% -> ${after.toFixed(1)}%`
  )
})

/**
 * ซ้อมแล้วต้องเก่งจริง ไม่ใช่ซ้อมเท่าไรก็เท่าเดิม
 *
 * เคยพลาดตรงนี้มาแล้ว — ตัวอย่าง GA เคยกลายพันธุ์ทีละ 6 ช่องจาก 64 ช่อง "ทุกเกม" รวมตอนเล่นจริง
 * ของดีที่สะสมไว้จึงถูกสุ่มทิ้งเร็วกว่าที่จะสะสมได้ ซ้อม 50 เกมกับ 400 เกมเก่งพอกันที่ราว 30%
 * เทสต์นี้พกความจำข้ามรอบเหมือนหน้าเกม แล้ววัดว่าแชมป์ที่ซ้อมมาแล้วชนะ "ยึดมุม" ได้เกินครึ่งจริง
 */
test('GA ซ้อม 200 เกมแล้วแกร่งกว่ายึดมุมชัดเจน', { timeout: 180_000 }, () => {
  const realRandom = Math.random

  /** ซ้อมต่อจากความจำเดิม แล้วคืนความจำที่ได้ — เหมือนกดฝึกอีกรอบในหน้าเกม */
  const trainOn = (memory: AgentMemory | null, games: number): AgentMemory | null => {
    const ga = build('evolve')
    ga.memory = memory

    for (let game = 0; game < games; game++) play(ga, build('corner'))
    return ga.memory
  }

  /** วัดฝีมือแชมป์ที่จำไว้ — ห้ามบันทึกทับระหว่างวัด ไม่งั้นมันแอบซ้อมต่อ */
  const winRate = (memory: AgentMemory | null, games: number): number => {
    let wins = 0

    for (let game = 0; game < games; game++) {
      const ga = build('evolve')
      ga.memory = memory
      ga.saveMemory = () => {}

      if (play(ga, build('corner')) === BLACK) wins++
    }

    return (wins / games) * 100
  }

  try {
    let raw = 0
    let trained = 0

    // เฉลี่ยหลายเมล็ดสุ่ม เพราะคะแนนจากเกมเดียวแกว่งแรง บางเมล็ดก็ได้แชมป์ดีตั้งแต่ต้น
    const seeds = [4517, 881, 20260920]

    for (const seed of seeds) {
      Math.random = seededRandom(seed)

      raw += winRate(null, 40)
      trained += winRate(trainOn(trainOn(null, 50), 150), 40)
    }

    const before = raw / seeds.length
    const after = trained / seeds.length

    console.log(`  ยังไม่ซ้อมชนะ ${before.toFixed(0)}% -> ซ้อม 200 เกมชนะ ${after.toFixed(0)}%`)

    assert.ok(
      after > 55,
      `ซ้อม 200 เกมแล้วควรชนะ 'ยึดมุม' ได้เกินครึ่ง แต่ได้แค่ ${after.toFixed(0)}% — กลายพันธุ์แรงไปจนของดีไม่สะสมหรือเปล่า`
    )
    assert.ok(after > before + 20, `ซ้อมแล้วดีขึ้นแค่ ${(after - before).toFixed(0)} จุด`)
  } finally {
    Math.random = realRandom
  }
})

/**
 * ความจำที่บาร์ค้างสูง ต้องกู้กลับได้
 *
 * เคยพลาดตรงนี้มาแล้ว — บาร์คะแนนเคยขึ้นอย่างเดียว พอเผลอไปฟลุกทำคะแนนสูงไว้ครั้งเดียว
 * (เช่นซ้อม GA กับ GA ด้วยกัน) แชมป์ก็ไม่มีวันถูกแทนอีกเลย ซ้อมกับใครต่ออีกกี่ร้อยเกมก็ชนะ 3%
 * ทางแก้เดียวคือกด "ล้าง" ซึ่งไม่มีใครเดาออก
 */
test('บาร์คะแนนที่ค้างอยู่สูง ต้องไหลลงจนกลับมาเรียนรู้ได้', { timeout: 120_000 }, () => {
  const realRandom = Math.random
  Math.random = seededRandom(31337)

  try {
    // ความจำที่ติดล็อก: น้ำหนักเท่ากันหมดทุกช่อง (เล่นไม่เป็น) แต่บาร์ถูกดันไว้เกือบเต็มกระดาน
    const stuck: AgentMemory = { a: Array.from({ length: 64 }, () => 10), b: 62 }

    const winRate = (memory: AgentMemory | null, games: number): number => {
      let wins = 0

      for (let game = 0; game < games; game++) {
        const ga = build('evolve')
        ga.memory = memory
        ga.saveMemory = () => {}

        if (play(ga, build('corner')) === BLACK) wins++
      }

      return (wins / games) * 100
    }

    const before = winRate(stuck, 40)

    const ga = build('evolve')
    ga.memory = stuck
    for (let game = 0; game < 150; game++) play(ga, build('corner'))

    const after = winRate(ga.memory, 40)
    const bar = (ga.memory as Record<string, unknown>).b

    console.log(`  ความจำที่ค้าง (b=62) ชนะ ${before.toFixed(0)}% -> ซ้อมต่อ 150 เกมชนะ ${after.toFixed(0)}% (บาร์เหลือ ${bar})`)

    assert.ok(
      Number(bar) < 62,
      `บาร์ต้องไหลลงได้เมื่อไม่มีใครชนะ แต่ยังค้างที่ ${bar} — ความจำจะตันถาวร`
    )
    assert.ok(
      after > before + 25,
      `ซ้อมต่อแล้วต้องกู้กลับมาได้ แต่ได้ ${before.toFixed(0)}% -> ${after.toFixed(0)}%`
    )
  } finally {
    Math.random = realRandom
  }
})

// ---------- ฝูงนก (PSO) ----------

test('หน้าฝูงนกหาน้ำหนักกระดาน — ระหว่างฝึกแพ้ GA แต่ตัวที่ดีที่สุดเจอเร็วกว่า และตัวเลขยังตรง', { timeout: 180_000 }, () => {
  const realRandom = Math.random

  /** อัตราชนะระหว่างฝึก — วิธีเดียวกับเทสต์ GA ข้างบน */
  const during = (presetId: string) => {
    Math.random = seededRandom(SEED)
    let first = 0
    let last = 0
    for (let round = 0; round < ROUNDS; round++) {
      const me = build(presetId)
      const rival = build('corner')
      const results: Array<Player | null> = []
      for (let game = 0; game < GAMES; game++) results.push(play(me, rival))
      const rate = (from: number, to: number) =>
        (results.slice(from, to).filter((winner) => winner === BLACK).length / (to - from)) * 100
      first += rate(0, WINDOW)
      last += rate(GAMES - WINDOW, GAMES)
    }
    return { first: (first / ROUNDS).toFixed(1), last: (last / ROUNDS).toFixed(1) }
  }

  /** ฝึก 40 เกม แล้วเอาตัวที่ดีที่สุดที่หาเจอ (ไม่สำรวจแล้ว) ไปเล่นหนึ่งเกม ลอง 40 ครั้ง */
  const champion = (presetId: string) => {
    let wins = 0
    for (let seed = 1000; seed < 1040; seed++) {
      Math.random = seededRandom(seed)
      const me = build(presetId)
      for (let game = 0; game < 40; game++) play(me, build('corner'))

      const judge = build(presetId)
      judge.memory = me.memory
      judge.saveMemory = () => {}
      const weights =
        presetId === 'swarm'
          ? expandWeights(readSwarm((me.memory as { swarm?: unknown } | null)?.swarm, OTHELLO_SPACE)!.best!)
          : ((me.memory as { a?: number[] } | null)?.a ?? [])
      judge.onGameStart = function (this: OthelloAgent & { vars: Record<string, unknown> }) {
        this.vars.a = weights
      }
      if (play(judge, build('corner')) === BLACK) wins++
    }
    return String(Math.round((wins / 40) * 100))
  }

  try {
    const ga = during('evolve')
    const swarm = during('swarm')
    const gaBest = champion('evolve')
    const swarmBest = champion('swarm')

    assert.ok(Number(swarm.last) < Number(ga.last), 'ระหว่างฝึก ฝูงนกต้องชนะน้อยกว่า GA')
    assert.ok(Number(swarmBest) > Number(gaBest), 'ตัวที่ดีที่สุดของฝูงต้องชนะบ่อยกว่าแชมป์ GA หลังฝึก 40 เกม')

    const text = TOPICS.find((topic) => topic.slug === 'swarm-weights')!.inGame
    for (const value of [`${swarm.first}%`, `${swarm.last}%`, `${ga.first}%`, `${ga.last}%`, `${swarmBest}%`, `${gaBest}%`]) {
      assert.ok(text.includes(value), `หน้าฝูงนกหาน้ำหนักไม่ได้พูดถึง ${value} แล้ว`)
    }
  } finally {
    Math.random = realRandom
  }
})

test('น้ำหนัก 10 กลุ่มครอบคลุมกระดาน และสมมาตรทั้งหมุนและสะท้อน', () => {
  assert.equal(new Set(SYMMETRY_CLASS).size, 10)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const group = SYMMETRY_CLASS[row * 8 + col]
      assert.equal(SYMMETRY_CLASS[row * 8 + (7 - col)], group, 'สะท้อนซ้ายขวา')
      assert.equal(SYMMETRY_CLASS[(7 - row) * 8 + col], group, 'สะท้อนบนล่าง')
      assert.equal(SYMMETRY_CLASS[col * 8 + row], group, 'สะท้อนตามแนวทแยง')
    }
  }
  assert.equal(SYMMETRY_CLASS[0], 0, 'มุมต้องเป็นกลุ่มแรก')
})
