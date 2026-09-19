/**
 * ตัวอย่าง "วิวัฒนาการ" (GA) ที่เขียนด้วยบล็อกล้วน ต้องเล่นเก่งขึ้นจริงเมื่อซ้อมไปเรื่อย ๆ
 *
 * ผลสั่นมากเพราะ fitness มาจากเกมเดียว เทสต์นี้จึงวัดค่าเฉลี่ยหลายรอบ ไม่ตัดสินรอบเดียว
 * ห้ามเปลี่ยน fitness กลับไปใช้แพ้/ชนะ — เคยลองแล้วแย่ลงชัดเจน (สัญญาณ 1 บิตต่อเกมหยาบเกินไป)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { OthelloAgent, AGENT_GLOBALS, type AgentMemory } from '~/game/othello/agent'
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

/** สร้าง agent จากตัวอย่างสำเร็จรูป โดยแปลงบล็อกเป็นโค้ดแล้วรันเหมือนที่ worker ทำ */
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
  // ในเบราว์เซอร์ระบบเก็บความจำลง localStorage ให้ ในเทสต์เก็บไว้ในตัวเองพอ
  agent.saveMemory = (data: AgentMemory) => {
    agent.memory = data
  }
  return agent
}

/** เล่นหนึ่งเกมจนจบ คืนผู้ชนะ (null = เสมอ) */
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

/**
 * GA มีสุ่มอยู่ในตัว ผลจึงสั่นมาก — รันจริง 15 ครั้งแบบไม่ล็อกเลขสุ่ม ตก 3 ครั้ง
 * เทสต์นี้จึงล็อกเลขสุ่มไว้ให้ได้ผลเดิมทุกครั้ง และใช้ 40 รอบเพื่อไม่ให้ผลมาจากเลขสุ่มชุดเดียว
 * (ลองกวาด 12 seed ที่ 40 รอบแล้ว ดีขึ้นทั้ง 12 — ที่ 6 รอบ ตก 2/12)
 */
const SEED = 7919

/** ตัวสุ่มแบบล็อกค่าได้ (mulberry32) ใช้แทน Math.random ระหว่างเทสต์ */
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
  // ห้ามเช็คด้วยการ scan โค้ดที่แปลงแล้ว — CORE_HELPERS ที่ระบบเติมให้มีคำว่า saveMemory( อยู่
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
