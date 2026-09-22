import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { AGENT_GLOBALS, OthelloAgent, type AgentMove } from '~/game/othello/agent'
import {
  BLACK,
  WHITE,
  applyMove,
  countDiscs,
  createBoard,
  discDiff,
  getValidMoves,
  hasValidMove,
  opponent,
  type Board,
  type Player
} from '~/game/othello/engine'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { ruthlessMove } from '~/game/othello/ruthless'

/**
 * โหมดโหดต้องโหดจริง — ชนะทุกตัวอย่างอื่นในเกมทั้งตอนเดินก่อนและเดินหลัง
 * และท้ายเกมที่บอกว่า "แก้จนจบแล้ว" ต้องได้คำตอบตรงกับการไล่ทุกทางแบบซื่อ ๆ
 *
 * ในเทสต์ให้เวลาคิดแค่ 50 ms ต่อตา (ในเกมจริงได้ราว 425 ms) ชนะได้ตรงนี้ ในเกมจริงยิ่งชนะขาด
 */

const TEST_BUDGET = 50

function build(presetId: string): OthelloAgent {
  const preset = OTHELLO_PACK.presets.find((item) => item.id === presetId)!
  const { code } = generate(normalize(preset.build(), OTHELLO_PACK), OTHELLO_PACK)
  const factory = new Function('OthelloAgent', 'EMPTY', 'BLACK', 'WHITE', `"use strict";\n${code}\n;return Agent;`)
  return new (factory(OthelloAgent, AGENT_GLOBALS.EMPTY, AGENT_GLOBALS.BLACK, AGENT_GLOBALS.WHITE))() as OthelloAgent
}

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const toMove = (raw: AgentMove) => (Array.isArray(raw) ? { row: raw[0], col: raw[1] } : raw!)

/** เล่นหนึ่งเกม — โหมดโหดได้เวลาคิด TEST_BUDGET ส่วนคู่ต่อสู้ได้ 500 ms เท่าในเกมจริง */
function play(black: OthelloAgent, white: OthelloAgent, ruthlessSide: Player) {
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

    const raw = players[side].chooseMove({
      board,
      player: side,
      opponent: opponent(side),
      validMoves,
      turn,
      lastMove: null,
      timeBudget: side === ruthlessSide ? TEST_BUDGET / 0.85 : 500
    })
    const move = toMove(raw)
    assert.ok(
      validMoves.some((item) => item.row === move.row && item.col === move.col),
      `ตาที่ ${turn} ลงช่องที่ลงไม่ได้ (${move.row}, ${move.col})`
    )

    board = applyMove(board, move, side)
    side = opponent(side)
    turn++
  }

  for (const player of [BLACK, WHITE] as Player[]) {
    const diff = discDiff(board, player)
    players[player].onGameEnd(board, diff > 0 ? player : diff < 0 ? opponent(player) : null)
  }
  return countDiscs(board)
}

const RIVALS = OTHELLO_PACK.presets.map((preset) => preset.id).filter((id) => id !== 'ruthless')

for (const rival of RIVALS) {
  test(`โหมดโหดชนะ "${rival}" ทั้งตอนเดินก่อนและเดินหลัง`, () => {
    const real = Math.random
    Math.random = seeded(rival.length * 7919)
    try {
      for (const ruthlessSide of [BLACK, WHITE] as Player[]) {
        const ruthless = build('ruthless')
        const other = build(rival)
        const result =
          ruthlessSide === BLACK ? play(ruthless, other, BLACK) : play(other, ruthless, WHITE)

        const mine = ruthlessSide === BLACK ? result.black : result.white
        const theirs = ruthlessSide === BLACK ? result.white : result.black
        assert.ok(
          mine > theirs,
          `แพ้หรือเสมอ "${rival}" ตอนเป็น${ruthlessSide === BLACK ? 'ดำ' : 'ขาว'}: ${mine} ต่อ ${theirs}`
        )
      }
    } finally {
      Math.random = real
    }
  })
}

// ---------- ท้ายเกม: แก้จนจบต้องได้คำตอบที่ถูกจริง ----------

/** ไล่ทุกทางแบบไม่ตัดกิ่งเลย — ช้าแต่ถูกแน่นอน ใช้เป็นเฉลย */
function bruteForce(board: Board, player: Player, passed = false): number {
  const moves = getValidMoves(board, player)
  if (moves.length === 0) {
    if (passed || !hasValidMove(board, opponent(player))) return discDiff(board, player)
    return -bruteForce(board, opponent(player), true)
  }
  let best = -Infinity
  for (const move of moves) best = Math.max(best, -bruteForce(applyMove(board, move, player), opponent(player)))
  return best
}

/** กระดานสุ่มที่เหลือช่องว่าง empties ช่อง และฝ่าย player มีตาลง */
function randomPosition(random: () => number, empties: number): { board: Board; player: Player } | null {
  let board = createBoard()
  let side: Player = BLACK
  while (countDiscs(board).empty > empties) {
    const moves = getValidMoves(board, side)
    if (moves.length === 0) {
      if (!hasValidMove(board, opponent(side))) return null
      side = opponent(side)
      continue
    }
    board = applyMove(board, moves[Math.floor(random() * moves.length)]!, side)
    side = opponent(side)
  }
  return getValidMoves(board, side).length > 1 ? { board, player: side } : null
}

test('ท้ายเกมที่แก้จนจบ ได้ผลต่างหมากตรงกับการไล่ทุกทาง และตาที่เลือกให้ผลนั้นจริง', () => {
  const random = seeded(2024)
  let checked = 0

  while (checked < 25) {
    const found = randomPosition(random, 9)
    if (!found) continue

    const answer = ruthlessMove(found.board, found.player, 5000)!
    assert.ok(answer.solved, 'เหลือ 9 ช่องแต่ไม่ได้แก้จนจบ')

    const truth = bruteForce(found.board, found.player)
    assert.equal(answer.score, truth, 'ผลต่างหมากที่บอกไว้ไม่ตรงเฉลย')

    const after = applyMove(found.board, answer, found.player)
    assert.equal(-bruteForce(after, opponent(found.player)), truth, 'ตาที่เลือกไม่ได้ให้ผลดีที่สุดจริง')
    checked++
  }
})

test('เคารพเวลาคิด — ตากลางเกมที่ยังคิดได้อีกนาน ก็ตอบภายในเวลาที่ให้', () => {
  const random = seeded(99)
  const found = randomPosition(random, 40)!
  const started = Date.now()
  const answer = ruthlessMove(found.board, found.player, 100)!
  const spent = Date.now() - started

  assert.ok(spent < 250, `ให้เวลา 100 ms แต่ใช้ไป ${spent} ms`)
  assert.ok(answer.depth >= 4, `มองลึกได้แค่ ${answer.depth} ชั้น`)
})
