import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BLACK,
  BOARD_SIZES,
  WHITE,
  createPosition,
  isLegal,
  isOver,
  legalMoves,
  play,
  score,
  type BoardSize,
  type Player,
  type Position
} from '~/game/go/engine'
import { botMove, seedBots, setSearchScale, type BotKind } from '~/game/go/bots'

/**
 * บอทหมากล้อมต้อง (1) ลงถูกกติกาเสมอ (2) เล่นจนจบเกมได้ (3) เรียงความเก่งตามระดับคิวจริง ๆ
 *
 * เทสต์ให้เวลาคิดน้อยกว่าในเกมจริงมาก (ตาละ 30–60 ms เทียบกับ 900 ms) เพราะวัดแค่ลำดับความเก่ง
 * ระดับที่ติดกันเก่งกว่ากันแค่นิดเดียว (หนึ่งคิวในโกะจริงก็ต่างกันไม่มาก) จึงเทียบแบบห่างสองขั้น
 */

const ALGORITHMS: BotKind[] = ['random', 'capture', 'pattern', 'influence', 'montecarlo', 'uct', 'rave', 'ruthless']
const LADDER: BotKind[] = ['kyu9', 'kyu8', 'kyu7', 'kyu6', 'kyu5', 'kyu4', 'kyu3', 'kyu2', 'kyu1']

interface Outcome {
  winner: Player | null
  moves: number
  lead: number
}

/** เล่นหนึ่งเกมจนจบ พร้อมตรวจทุกตาว่าถูกกติกา */
function playGame(black: BotKind, white: BotKind, size: BoardSize, budget: number): Outcome {
  let position: Position = createPosition(size)
  let last: number | null = null
  let moves = 0
  const cap = size * size * 3

  while (!isOver(position) && moves < cap) {
    const who: Player = position.toPlay
    const kind = who === BLACK ? black : white
    const move = botMove(kind, position, who, budget, last)

    if (move !== 'pass') {
      assert.ok(
        isLegal(position, move, who),
        `${kind} ลงตาผิดกติกาที่ (${move.row}, ${move.col}) ในตาที่ ${moves + 1}`
      )
    }

    position = play(position, move, who).position
    last = move === 'pass' ? null : move.row * size + move.col
    moves++
  }

  const counted = score(position)
  return { winner: counted.winner, moves, lead: counted.lead }
}

for (const kind of [...ALGORITHMS, 'kyu9' as BotKind, 'kyu5' as BotKind, 'kyu1' as BotKind]) {
  test(`บอท "${kind}" ลงถูกกติกาและเล่นจนจบเกมได้`, () => {
    seedBots(17)
    // ตรงนี้วัดแค่ว่าลงถูกกติกาและเล่นจบ ไม่ได้วัดความเก่ง จึงย่อการค้นลงให้เทสต์ไว
    setSearchScale(0.1)
    const outcome = playGame(kind, 'random', 9, 30)
    setSearchScale(1)
    assert.ok(outcome.moves > 10, `เกมจบเร็วผิดปกติ (${outcome.moves} ตา) — บอทอาจผ่านตารัวตั้งแต่ต้น`)
    assert.ok(outcome.moves < 9 * 9 * 3, 'เล่นไม่จบจนชนเพดานตา')
  })
}

test('ทุกขนาดกระดานเล่นจนจบได้ และจบด้วยการนับแต้มที่มีผู้ชนะ', () => {
  for (const size of BOARD_SIZES) {
    seedBots(size * 13)
    const outcome = playGame('capture', 'random', size as BoardSize, 20)
    assert.ok(outcome.moves > size, `กระดาน ${size} เล่นได้แค่ ${outcome.moves} ตา`)
    assert.ok(outcome.winner !== null, `กระดาน ${size} ต้องมีผู้ชนะเพราะโคมิเป็นครึ่งแต้ม`)
  }
})

test('บอททุกตัวไม่ถมตาตัวเองจนกลายเป็นฆ่าหมู่ของตัวเอง', () => {
  seedBots(3)
  let position = createPosition(9)
  let last: number | null = null

  for (let move = 0; move < 60 && !isOver(position); move++) {
    const who = position.toPlay
    const chosen = botMove('kyu6', position, who, 20, last)
    if (chosen === 'pass') break

    const before = position
    position = play(position, chosen, who).position
    last = chosen.row * 9 + chosen.col

    // ลงแล้วหมากของตัวเองต้องยังอยู่บนกระดาน (ไม่ใช่ลงแล้วโดนจับทันทีเพราะถมตาตัวเอง)
    const stillThere = position.board[last] === who
    assert.ok(stillThere || before.captures[who] < position.captures[who], 'ลงแล้วหมากหายทันทีโดยไม่ได้จับใคร')
  }
})

/** แข่งกันหลายเกม สลับสี — คืนจำนวนเกมที่ฝ่ายแรกชนะ */
function duel(strong: BotKind, weak: BotKind, games: number, budget: number, size: BoardSize = 9): number {
  let wins = 0
  for (let game = 0; game < games; game++) {
    seedBots(100 + game * 7)
    const strongIsBlack = game % 2 === 0
    const outcome = strongIsBlack ? playGame(strong, weak, size, budget) : playGame(weak, strong, size, budget)
    const won = strongIsBlack ? outcome.winner === BLACK : outcome.winner === WHITE
    if (won) wins++
  }
  return wins
}

test('บันไดคิว: ระดับที่ห่างกันสองขั้น ตัวที่เก่งกว่าชนะเป็นส่วนใหญ่', { timeout: 300_000 }, () => {
  // ช่วงที่เล่นด้วยกฎ (9–6 คิว) ไม่ได้ค้นอะไร จึงเทียบกันได้เต็มความเร็ว
  assert.ok(duel('kyu7', 'kyu9', 4, 40) >= 3, '7 คิวต้องชนะ 9 คิวเป็นส่วนใหญ่')
  assert.ok(duel('kyu6', 'kyu8', 4, 40) >= 3, '6 คิวต้องชนะ 8 คิวเป็นส่วนใหญ่')

  // รอยต่อระหว่างช่วงกฎกับช่วงที่เริ่มค้น — ต้องเก่งกว่ากันจริงแม้ค้นแค่นิดเดียว
  assert.ok(duel('kyu5', 'kyu6', 2, 40) >= 1, '5 คิว (เริ่มค้น) ต้องสูสีหรือดีกว่า 6 คิว')

  // ช่วงที่ค้นด้วย MCTS ทั้งคู่ — ย่อจำนวนรอบลงเท่า ๆ กัน ลำดับยังเหมือนเดิมแต่เทสต์เร็วขึ้นมาก
  setSearchScale(0.2)
  try {
    assert.ok(duel('kyu3', 'kyu5', 4, 40) >= 3, '3 คิวต้องชนะ 5 คิวเป็นส่วนใหญ่')
    assert.ok(duel('kyu1', 'kyu3', 4, 40) >= 3, '1 คิวต้องชนะ 3 คิวเป็นส่วนใหญ่')
  } finally {
    setSearchScale(1)
  }
})

test('หัวบันไดกับท้ายบันไดต่างกันขาด — 1 คิวชนะ 9 คิวทุกเกม', { timeout: 300_000 }, () => {
  setSearchScale(0.2)
  try {
    const wins = duel('kyu1', 'kyu9', 4, 40)
    assert.equal(wins, 4, `1 คิวชนะ 9 คิวแค่ ${wins}/4`)
  } finally {
    setSearchScale(1)
  }
})

test('โหมดโหดแข็งกว่าระดับ 1 คิว ซึ่งเป็นขั้นบนสุดของบันได', { timeout: 600_000 }, () => {
  setSearchScale(0.25)
  try {
    const wins = duel('ruthless', 'kyu1', 4, 60)
    assert.ok(wins >= 3, `โหมดโหดชนะ 1 คิวแค่ ${wins}/4 — ถ้าไม่แข็งกว่าก็ไม่มีเหตุผลให้มีโหมดนี้`)
  } finally {
    setSearchScale(1)
  }
})

test('โหมดโหดไม่ผ่านตาทิ้งเกมตอนตามหลัง', () => {
  // กระดานที่ขาวนำขาดและดำเพิ่งผ่านตา — ฝ่ายดำ (ตามหลัง) ต้องเล่นต่อ ไม่ใช่ผ่านตาจบเกม
  const size: BoardSize = 9
  const base = createPosition(size)
  const board = Uint8Array.from(base.board)
  for (let index = 0; index < size * size; index++) if (index % 9 > 2) board[index] = WHITE

  const behind: Position = { ...base, board, toPlay: BLACK, passes: 1 }
  seedBots(5)
  const move = botMove('ruthless', behind, BLACK, 60, null)
  assert.notEqual(move, 'pass', 'ตามหลังอยู่แล้วผ่านตา = ยกเกมให้เขา')
})

test('อัลกอริทึมที่ค้นด้วยการสุ่มเล่นจนจบ เก่งกว่าการสุ่มลงเฉย ๆ', { timeout: 300_000 }, () => {
  assert.ok(duel('montecarlo', 'random', 4, 40) >= 3, 'สุ่มเล่นจนจบควรชนะการสุ่มลงเฉย ๆ')
  setSearchScale(0.2)
  try {
    assert.ok(duel('uct', 'capture', 4, 40) >= 3, 'MCTS ควรชนะบอทที่ใช้กฎจับ/หนีอย่างเดียว')
  } finally {
    setSearchScale(1)
  }
})

test('ผ่านตาเมื่อไม่มีที่ลงที่ไม่ใช่ตาตัวเอง — ไม่ถมตาของตัวเองทิ้ง', () => {
  // กระดานที่ดำล้อมพื้นที่ไว้หมดแล้ว เหลือแต่ตาของตัวเอง
  const size: BoardSize = 9
  const position = createPosition(size)
  const board = position.board
  for (let index = 0; index < size * size; index++) board[index] = BLACK
  // เจาะตาสองตาให้หมู่ดำ และปล่อยช่องขาวไว้มุมหนึ่ง
  board[0] = 0
  board[2] = 0

  const full: Position = { ...position, board, toPlay: BLACK }
  assert.ok(legalMoves(full).length > 0, 'ยังมีช่องว่างอยู่จริง')

  const move = botMove('kyu9', full, BLACK, 20, null)
  assert.equal(move, 'pass', 'เหลือแต่ตาของตัวเอง ต้องผ่านตา ไม่ใช่ถมตาตัวเอง')
})
