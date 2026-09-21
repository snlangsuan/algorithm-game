import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { AGENT_GLOBALS, OthelloAgent } from '~/game/othello/agent'
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
  return new Agent() as OthelloAgent
}

function play(black: OthelloAgent, white: OthelloAgent) {
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
      timeBudget: 1000
    })

    board = applyMove(board, move as { row: number; col: number }, side)
    side = opponent(side)
    turn++
  }

  return countDiscs(board)
}

test('คิดแทนคู่แข่ง ชนะ "ยึดมุมก่อน" ได้ทั้งตอนเล่นดำและเล่นขาว', () => {
  const asBlack = play(build('lookahead'), build('corner'))
  assert.ok(
    asBlack.black > asBlack.white,
    `เล่นดำแล้วแพ้ ${asBlack.black}:${asBlack.white}`
  )

  const asWhite = play(build('corner'), build('lookahead'))
  assert.ok(
    asWhite.white > asWhite.black,
    `เล่นขาวแล้วแพ้ ${asWhite.white}:${asWhite.black}`
  )
})

test('คิดแทนคู่แข่ง ชนะ "กินเยอะสุด" ขาดลอย', () => {
  const result = play(build('lookahead'), build('greedy'))
  assert.ok(result.black > result.white, `แพ้ ${result.black}:${result.white}`)
})

test('think() คืนค่า this.here เดิมเสมอ ไม่งั้นบล็อกตัวถัดไปจะอ่านกระดานผิด', () => {
  const agent = build('lookahead')
  agent.onGameStart(BLACK)

  const board = createBoard()
  const state = {
    board,
    player: BLACK as Player,
    opponent: WHITE as Player,
    validMoves: getValidMoves(board, BLACK),
    turn: 1,
    lastMove: null,
    timeBudget: 1000
  }

  const move = agent.chooseMove(state)

  assert.ok(move, 'ไม่ได้เลือกตาเลย')
  assert.equal((agent as unknown as { here: unknown }).here, state, 'this.here ไม่ถูกคืนค่าเดิม')
})

test('ตัวแปรของแต่ละชั้นแยกกัน ชั้นลึกไม่ทับค่าของชั้นบน', () => {
  const agent = build('lookahead')
  agent.onGameStart(BLACK)

  const board = createBoard()
  const vars = (agent as unknown as { vars: Record<string, number> }).vars
  vars.a = 42

  agent.chooseMove({
    board,
    player: BLACK,
    opponent: WHITE,
    validMoves: getValidMoves(board, BLACK),
    turn: 1,
    lastMove: null,
    timeBudget: 1000
  })

  assert.equal(
    (agent as unknown as { vars: Record<string, number> }).vars.a,
    42,
    'ตัวแปรของชั้นบนถูกชั้นลึกทับ'
  )
})

function withSeededRandom<T>(seed: number, run: () => T): T {
  const real = Math.random
  let state = seed

  Math.random = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  try {
    return run()
  } finally {
    Math.random = real
  }
}

test('สุ่มเล่นให้จบแล้วนับ ชนะตัวที่มองตาเดียว ทั้งที่ไม่มีสูตรให้คะแนนกระดานเลย', () => {
  const beat = (rivalId: string) =>
    withSeededRandom(20260920, () => {
      const asBlack = play(build('playouts'), build(rivalId))
      const asWhite = play(build(rivalId), build('playouts'))
      return (asBlack.black > asBlack.white ? 1 : 0) + (asWhite.white > asWhite.black ? 1 : 0)
    })

  assert.equal(beat('random'), 2, 'แพ้ตัวสุ่ม แปลว่าการนับผลไม่ได้ทำงาน')
  assert.equal(beat('greedy'), 2, 'แพ้ "กินเยอะสุด"')
})

test('กิ่งที่ยังไม่เคยลอง ต้องได้ลองก่อนเสมอ ไม่งั้นจะติดอยู่กับกิ่งแรกที่บังเอิญชนะ', () => {
  const program = OTHELLO_PACK.presets.find((item) => item.id === 'playouts')!.build()
  const guard = program.scripts['othello.on-turn']![0]!.bodies.do![0]!

  assert.equal(guard.kind, 'if', 'บล็อกแรกในกฎเลือกกิ่งต้องเป็นการกันกิ่งที่ยังไม่เคยลอง')
  assert.equal(guard.inputs.cond?.inputs.left?.kind, 'othello.branch-plays')
})

test('ความลึกถูกจำกัดไว้ ไม่ให้โปรแกรมค้างเมื่อใส่เลขมหาศาล', () => {
  const preset = OTHELLO_PACK.presets.find((item) => item.id === 'lookahead')!
  const program = preset.build()
  const root = program.scripts['othello.on-turn']![0]!
  root.inputs.depth!.fields.value = 999

  const { code } = generate(normalize(program, OTHELLO_PACK), OTHELLO_PACK)
  const factory = new Function(
    'OthelloAgent',
    'EMPTY',
    'BLACK',
    'WHITE',
    `"use strict";\n${code}\n;return Agent;`
  )
  const Agent = factory(OthelloAgent, AGENT_GLOBALS.EMPTY, AGENT_GLOBALS.BLACK, AGENT_GLOBALS.WHITE)
  const agent: OthelloAgent = new Agent()
  agent.onGameStart(BLACK)

  let board = createBoard()
  let side: Player = BLACK
  for (let ply = 0; ply < 20; ply++) {
    const moves = getValidMoves(board, side)
    if (moves.length === 0) {
      side = opponent(side)
      continue
    }
    board = applyMove(board, moves[ply % moves.length]!, side)
    side = opponent(side)
  }

  const started = Date.now()
  const move = agent.chooseMove({
    board,
    player: BLACK,
    opponent: WHITE,
    validMoves: getValidMoves(board, BLACK),
    turn: 21,
    lastMove: null,
    timeBudget: 1000
  })

  assert.ok(move, 'ไม่ได้เลือกตาเลย')
  assert.ok(Date.now() - started < 3000, 'คิดนานเกินเพดาน 3 วินาทีของ worker')
})
