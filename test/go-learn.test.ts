import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BLACK,
  createPosition,
  isOver,
  play,
  score,
  type BoardSize,
  type Player,
  type Position
} from '~/game/go/engine'
import { GoAgent, viewOf, type AgentMemory, type TurnState } from '~/game/go/agent'
import { botMove, seedBots, setSearchScale, type BotKind } from '~/game/go/bots'
import { BOOK_DEPTH, bookMove, emptyBrain, learnFrom, readBrain, signature } from '~/game/go/learn'

/**
 * ตัวที่ "ยิ่งเล่นยิ่งเก่ง" — เทสต์ว่ามันจำถูก ลืมถูก และความจำไม่บวมเกินเพดานของเกม
 *
 * ส่วนที่ว่า "เก่งขึ้นจริงไหม" วัดด้วยการแข่งหลายสิบเกมซึ่งช้าและผลแกว่ง
 * จึงไม่เอามาเป็นเงื่อนไขผ่าน/ไม่ผ่านตรงนี้ (ดูตัวเลขที่วัดไว้ในบันทึกของงานแทน)
 */

const size: BoardSize = 9

const spot = (row: number, col: number) => row * size + col

test('ตำราเชื่อได้ต่อเมื่อเคยลองพอ และชนะเกินครึ่ง', () => {
  const position = createPosition(size)
  const key = signature(position)
  let brain = emptyBrain(size)

  const move = spot(4, 4)
  const played = [{ key, move, answering: -1 }]

  // ชนะสองครั้งยังไม่พอ (ต้อง 3 ครั้งขึ้นไป)
  brain = learnFrom(brain, played, true)
  brain = learnFrom(brain, played, true)
  assert.equal(bookMove(brain, position), null, 'เคยลองแค่สองครั้ง ยังไม่ควรเชื่อ')

  brain = learnFrom(brain, played, true)
  assert.equal(bookMove(brain, position), move, 'ชนะสามครั้งแล้วควรหยิบตานี้มาใช้')
  assert.equal(brain.games, 3)
  assert.equal(brain.wins, 3)

  // แพ้ซ้ำ ๆ จนอัตราชนะตกลงต่ำกว่าครึ่ง ก็ต้องเลิกเชื่อ
  for (let round = 0; round < 4; round++) brain = learnFrom(brain, played, false)
  assert.equal(bookMove(brain, position), null, 'ชนะ 3 จาก 7 ครั้งแล้ว ไม่ควรเดินตามอีก')
})

test('ตาตอบที่เคยชนะถูกจำไว้ และถูกลืมเมื่อแพ้', () => {
  let brain = emptyBrain(size)
  const theirs = spot(2, 2)
  const mine = spot(2, 3)

  brain = learnFrom(brain, [{ key: null, move: mine, answering: theirs }], true)
  assert.equal(brain.replies[theirs], mine, 'ชนะแล้วต้องจำตาตอบไว้')

  brain = learnFrom(brain, [{ key: null, move: mine, answering: theirs }], false)
  assert.equal(brain.replies[theirs], -1, 'แพ้แล้วต้องลืมตาตอบนั้นทิ้ง')
})

test('ตำราจดเฉพาะช่วงต้นเกม และความจำคนละขนาดกระดานใช้ด้วยกันไม่ได้', () => {
  const brain = learnFrom(emptyBrain(size), [{ key: null, move: spot(0, 0), answering: -1 }], true)
  assert.equal(Object.keys(brain.book).length, 0, 'ตาที่ลึกเกินตำรา (key = null) ต้องไม่ถูกจด')

  const late: Position = { ...createPosition(size), turn: BOOK_DEPTH + 1 }
  assert.equal(bookMove(brain, late), null, 'พ้นช่วงเปิดหมากแล้วไม่ต้องเปิดตำรา')

  const other = readBrain(brain, 13)
  assert.equal(other.games, 0, 'ความจำของกระดาน 9×9 ต้องใช้กับ 13×13 ไม่ได้')
  assert.equal(readBrain({ nonsense: true }, size).games, 0, 'ความจำรูปร่างแปลก ๆ ต้องเริ่มใหม่')
})

// ---------- เล่นจริงแล้วความจำโตขึ้นจริงไหม ----------

class Learner extends GoAgent {
  chooseMove(state: TurnState) {
    this.here = state
    return this.learned()
  }

  saveMemory(data: AgentMemory) {
    this.memory = data
  }
}

/** เล่นหนึ่งเกมจนจบ แล้วให้ตัวเรียนรู้เก็บบทเรียน */
function playGame(learner: Learner, rival: BotKind, budget: number, learnerBlack: boolean): boolean {
  let position: Position = createPosition(size)
  let last: number | null = null
  let moves = 0

  while (!isOver(position) && moves < size * size * 3) {
    const who: Player = position.toPlay
    const lastMove = last === null ? null : { row: (last / size) | 0, col: last % size }
    const raw =
      (who === BLACK) === learnerBlack
        ? learner.chooseMove(viewOf(position, budget, lastMove))
        : botMove(rival, position, who, budget, last)

    const move = raw === 'pass' || raw === null ? 'pass' : Array.isArray(raw) ? { row: raw[0], col: raw[1] } : raw
    position = play(position, move, who).position
    last = move === 'pass' ? null : move.row * size + move.col
    moves++
  }

  const won = learnerBlack ? score(position).winner === BLACK : score(position).winner !== BLACK
  learner.rememberGame(won)
  return won
}

test('เล่นจริงแล้วความจำโตขึ้นทุกเกม และยังเล็กกว่าเพดาน 256 KB', { timeout: 600_000 }, () => {
  setSearchScale(0.1)
  try {
    const learner = new Learner()
    let seen = 0

    for (let game = 0; game < 4; game++) {
      seedBots(500 + game)
      playGame(learner, 'kyu9', 20, game % 2 === 0)

      const brain = readBrain((learner.memory as { brain?: unknown } | null)?.brain, size)
      assert.equal(brain.games, game + 1, 'ต้องนับจำนวนเกมที่เล่นไปแล้วได้ถูก')
      assert.ok(Object.keys(brain.book).length > seen, 'เล่นอีกเกมแล้วตำราต้องหนาขึ้น')
      seen = Object.keys(brain.book).length
    }

    const bytes = JSON.stringify(learner.memory ?? {}).length
    assert.ok(bytes < 256 * 1024, `ความจำ ${bytes} ไบต์ เกินเพดานของเกมแล้ว`)
  } finally {
    setSearchScale(1)
  }
})

test('เจอกระดานเปิดเดิมอีกครั้ง หยิบตาจากตำรามาใช้เลย ไม่ต้องค้นใหม่', () => {
  const learner = new Learner()
  const position = createPosition(size)
  const move = spot(4, 4)

  // ป้อนความจำให้เลยว่าเคยลงกลางกระดานแล้วชนะสามครั้ง
  let brain = emptyBrain(size)
  const played = [{ key: signature(position), move, answering: -1 }]
  for (let round = 0; round < 3; round++) brain = learnFrom(brain, played, true)
  learner.memory = { brain }

  const started = Date.now()
  const chosen = learner.chooseMove(viewOf(position, 900, null))
  const spent = Date.now() - started

  assert.deepEqual(chosen, { row: 4, col: 4 }, 'ต้องหยิบตาจากตำรา')
  assert.ok(spent < 200, `ใช้เวลา ${spent} ms — น่าจะไปค้นใหม่ทั้งที่มีในตำราแล้ว`)
})
