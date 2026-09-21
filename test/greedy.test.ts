import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { AGENT_GLOBALS, OthelloAgent } from '~/game/othello/agent'
import {
  BLACK,
  WHITE,
  applyMove,
  createBoard,
  getValidMoves,
  hasValidMove,
  opponent,
  type Player
} from '~/game/othello/engine'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'

function oneBlockProgram(): BlockProgram {
  const place = createBlock('othello.place')
  place.fields.spot = 'any'
  place.fields.order = 'most'
  return { name: 'กินเยอะสุดบล็อกเดียว', scripts: { 'othello.on-turn': [place] } }
}

function make(program: BlockProgram, side: Player): OthelloAgent {
  const { code } = generate(normalize(program, OTHELLO_PACK), OTHELLO_PACK)
  const factory = new Function(
    'OthelloAgent',
    'EMPTY',
    'BLACK',
    'WHITE',
    `"use strict";\n${code}\n;return Agent;`
  )
  const Agent = factory(OthelloAgent, AGENT_GLOBALS.EMPTY, AGENT_GLOBALS.BLACK, AGENT_GLOBALS.WHITE)
  const agent = new Agent() as OthelloAgent
  agent.onGameStart(side)
  return agent
}

function preset(side: Player): OthelloAgent {
  const found = OTHELLO_PACK.presets.find((item) => item.id === 'greedy')
  assert.ok(found, "ไม่มีตัวอย่างชื่อ 'greedy' แล้ว")
  return make(found.build(), side)
}

test('ตัวอย่างกินเยอะสุด เลือกตาเดียวกับบล็อกเดียวจบ ทุกตาทั้งเกม', () => {
  const short: Record<Player, OthelloAgent> = {
    [BLACK]: make(oneBlockProgram(), BLACK),
    [WHITE]: make(oneBlockProgram(), WHITE)
  }
  const long: Record<Player, OthelloAgent> = { [BLACK]: preset(BLACK), [WHITE]: preset(WHITE) }

  let board = createBoard()
  let side: Player = BLACK
  let turn = 1
  let compared = 0

  while (turn < 200) {
    const validMoves = getValidMoves(board, side)
    if (validMoves.length === 0) {
      if (!hasValidMove(board, opponent(side))) break
      side = opponent(side)
      continue
    }

    const state = () => ({
      board,
      player: side,
      opponent: opponent(side),
      validMoves,
      turn,
      lastMove: null,
      timeBudget: 1000
    })

    const a = short[side].chooseMove(state()) as { row: number; col: number }
    const b = long[side].chooseMove(state()) as { row: number; col: number }

    assert.deepEqual(
      { row: b.row, col: b.col },
      { row: a.row, col: a.col },
      `ตาที่ ${turn} เลือกไม่ตรงกัน`
    )

    compared++
    board = applyMove(board, a, side)
    side = opponent(side)
    turn++
  }

  assert.ok(compared > 50, `เทียบได้แค่ ${compared} ตา น้อยเกินกว่าจะเชื่อว่าเล่นจนจบ`)
})

test('ตาที่จำไว้ไม่ค้างข้ามตา — ตาถัดไปที่ไม่ได้จำอะไรเลย ต้องไม่ลงตาเดิมที่ลงไม่ได้แล้ว', () => {

  const agent = preset(BLACK)

  let board = createBoard()
  let side: Player = BLACK
  const seen: string[] = []

  for (let ply = 0; ply < 6; ply++) {
    const validMoves = getValidMoves(board, side)
    if (validMoves.length === 0) break

    const move = agent.chooseMove({
      board,
      player: side,
      opponent: opponent(side),
      validMoves,
      turn: ply + 1,
      lastMove: null,
      timeBudget: 1000
    }) as { row: number; col: number }

    assert.ok(
      validMoves.some((item) => item.row === move.row && item.col === move.col),
      `ตาที่ ${ply + 1} ลงตาที่ลงไม่ได้: ${move.row},${move.col}`
    )

    seen.push(`${move.row},${move.col}`)
    board = applyMove(board, move, side)
    side = opponent(side)
  }

  assert.equal(new Set(seen).size, seen.length, 'ลงตาซ้ำที่เดิม แปลว่าสิ่งที่จำไว้ค้างข้ามตา')
})
