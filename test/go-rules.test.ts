import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  BLACK,
  BOARD_SIZES,
  areaMap,
  EMPTY,
  WHITE,
  createPosition,
  groupAt,
  isEye,
  isLegal,
  legalMoves,
  legality,
  libertiesAt,
  play,
  score,
  toIndex,
  toNotation,
  type Move,
  type Player,
  type Position
} from '~/game/go/engine'

/**
 * กติกาหมากล้อมต้องถูกจริง — จับหมาก ห้ามฆ่าตัวตาย โค และการนับแต้ม
 * ทั้งเกมยืนอยู่บนไฟล์นี้ไฟล์เดียว ผิดตรงนี้คือทุกอัลกอริทึมเรียนกติกาผิดตามหมด
 */

/** วางกระดานจากรูป — '.' ว่าง 'x' ดำ 'o' ขาว */
function fromArt(rows: string[], toPlay: Player = BLACK): Position {
  const size = rows.length as 9
  const position = createPosition(BOARD_SIZES[0])
  const board = new Uint8Array(size * size)

  for (const [row, line] of rows.entries()) {
    const cells = line.replace(/\s/g, '')
    assert.equal(cells.length, size, `แถว ${row} ยาวไม่เท่าขนาดกระดาน`)
    for (const [col, char] of [...cells].entries()) {
      board[row * size + col] = char === 'x' ? BLACK : char === 'o' ? WHITE : EMPTY
    }
  }

  return { ...position, size, board, toPlay }
}

const spot = (position: Position, row: number, col: number): Move => ({ row, col })

test('หมู่คือหมากสีเดียวกันที่ติดกัน และลมหายใจคือช่องว่างรอบหมู่', () => {
  const position = fromArt([
    '.........',
    '..xx.....',
    '..x......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])

  const group = groupAt(position.board, 9, toIndex(9, 1, 2))
  assert.ok(group)
  assert.equal(group.stones.length, 3, 'หมากสามเม็ดที่ติดกันต้องเป็นหมู่เดียว')
  assert.equal(group.liberties.length, 7)
  assert.equal(group.color, BLACK)

  // แนวทแยงไม่ถือว่าติดกันในโกะ
  const apart = fromArt([
    'x........',
    '.x.......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.equal(groupAt(apart.board, 9, 0)!.stones.length, 1, 'หมากแนวทแยงต้องเป็นคนละหมู่')
})

test('ลงหมากปิดลมหายใจสุดท้าย แล้วหมู่ของอีกฝ่ายถูกจับออกจากกระดาน', () => {
  const position = fromArt([
    '.x.......',
    'xo.......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])

  assert.equal(libertiesAt(position.board, 9, toIndex(9, 1, 1)), 2)

  const after = play(position, spot(position, 1, 2), BLACK)
  assert.equal(after.captured.length, 0, 'ยังเหลือลมหายใจอยู่ ยังไม่ถูกจับ')

  const closed = play(after.position, spot(position, 2, 1), BLACK)
  assert.equal(closed.captured.length, 1, 'ปิดครบสี่ด้านต้องจับได้')
  assert.equal(closed.position.board[toIndex(9, 1, 1)], EMPTY, 'หมากที่ถูกจับต้องหายไปจากกระดาน')
  assert.equal(closed.position.captures[BLACK], 1)
})

test('จับได้ทั้งหมู่พร้อมกัน ไม่ใช่ทีละเม็ด', () => {
  // หมู่ขาวสองเม็ดเหลือลมหายใจเดียวที่ (1,3)
  const position = fromArt([
    '.xx......',
    'xoo......',
    '.xx......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.equal(libertiesAt(position.board, 9, toIndex(9, 1, 1)), 1)

  const taken = play(position, spot(position, 1, 3), BLACK)
  assert.equal(taken.captured.length, 2, 'หมู่ขาวสองเม็ดต้องถูกจับพร้อมกัน')
  assert.equal(taken.position.board[toIndex(9, 1, 2)], EMPTY)
  assert.equal(taken.position.captures[BLACK], 2)
})

test('ห้ามฆ่าตัวตาย แต่ถ้าลงแล้วจับของอีกฝ่ายได้ ถือว่าลงได้', () => {
  const suicide = fromArt([
    '.o.......',
    'o.o......',
    '.o.......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.equal(legality(suicide, spot(suicide, 1, 1), BLACK), 'suicide')

  // ช่องเดียวกันเป๊ะ ๆ ที่มุมกระดาน: ขาวเหลือลมหายใจช่องนั้นช่องเดียว ดำลงไปจับได้ จึงไม่ใช่ฆ่าตัวตาย
  const capture = fromArt([
    '.ox......',
    'oxx......',
    'x........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.equal(libertiesAt(capture.board, 9, toIndex(9, 0, 1)), 1)
  assert.equal(libertiesAt(capture.board, 9, toIndex(9, 1, 0)), 1)

  const taken = play(capture, spot(capture, 0, 0), BLACK)
  assert.equal(taken.captured.length, 2, 'ลงมุมแล้วจับขาวได้สองเม็ด หมากดำจึงมีที่หายใจ')

  // ขาวมีลมหายใจอื่นเหลืออยู่ ลงช่องเดียวกันกลายเป็นฆ่าตัวตาย
  const alive = fromArt([
    '.ox......',
    'o.x......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.ok(libertiesAt(alive.board, 9, toIndex(9, 0, 1)) > 1)
  assert.equal(legality(alive, spot(alive, 0, 0), BLACK), 'suicide')
})

test('กติกาโค — จับคืนทันทีไม่ได้ ต้องไปลงที่อื่นก่อนหนึ่งตา', () => {
  // รูปโคมาตรฐาน: ขาวที่ (2,1) เหลือลมหายใจเดียวคือ (2,2) ซึ่งเป็นช่องที่ดำจะลง
  const art = fromArt(
    [
      '.........',
      '.xo......',
      'xo.o.....',
      '.xo......',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........'
    ],
    BLACK
  )
  assert.equal(libertiesAt(art.board, 9, toIndex(9, 2, 1)), 1)

  const taken = play(art, spot(art, 2, 2), BLACK)
  assert.equal(taken.captured.length, 1, 'ดำต้องจับหมากขาวได้หนึ่งเม็ด')
  assert.equal(taken.position.ko, toIndex(9, 2, 1), 'ช่องที่เพิ่งถูกจับกลายเป็นช่องต้องห้ามของโค')
  assert.equal(legality(taken.position, spot(art, 2, 1), WHITE), 'ko', 'ขาวห้ามกินคืนทันที')
  assert.ok(!legalMoves(taken.position, WHITE).includes(toIndex(9, 2, 1)))

  // ไปลงที่อื่นก่อนหนึ่งตา แล้วค่อยกลับมากินคืนได้
  const elsewhere = play(taken.position, spot(art, 7, 7), WHITE)
  const answer = play(elsewhere.position, spot(art, 8, 8), BLACK)
  assert.equal(answer.position.ko, null)
  assert.ok(isLegal(answer.position, spot(art, 2, 1), WHITE), 'ผ่านไปหนึ่งตาแล้วต้องกินคืนได้')

  // ตาที่คั่นเป็น pass ก็ล้างโคเหมือนกัน
  const passed = play(taken.position, 'pass', WHITE)
  assert.equal(passed.position.ko, null)
})

test('ผ่านตาสองครั้งติดกันคือจบเกม และ pass ไม่ทำให้กระดานเปลี่ยน', () => {
  const position = createPosition(9)
  const first = play(position, 'pass', BLACK)
  assert.equal(first.position.passes, 1)
  assert.deepEqual([...first.position.board], [...position.board])

  const second = play(first.position, 'pass', WHITE)
  assert.equal(second.position.passes, 2)
  assert.equal(legality(second.position, spot(position, 0, 0), BLACK), 'finished', 'จบเกมแล้วลงต่อไม่ได้')

  // ลงคั่นกลางแล้วตัวนับผ่านตาต้องเริ่มใหม่
  const between = play(first.position, spot(position, 4, 4), WHITE)
  assert.equal(between.position.passes, 0)
})

test('นับแต้มแบบจีน: หมากของตัวเอง + ช่องว่างที่ล้อมได้ ขาวได้โคมิเพิ่ม', () => {
  // ดำล้อมมุมบนซ้ายไว้สามช่อง ที่เหลือเป็นของขาว
  const position = fromArt([
    '..xoo....',
    '..xoo....',
    'xxxoo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....'
  ])

  const counted = score({ ...position, komi: 5.5 })
  assert.equal(counted.territory[BLACK], 4, 'ช่องว่างมุมบนซ้ายเป็นของดำ')
  assert.equal(counted.stones[BLACK], 5)
  assert.equal(counted.area[BLACK], 9)
  assert.ok(counted.area[WHITE] > counted.area[BLACK])
  assert.equal(counted.winner, WHITE)

  // ช่องว่างที่ติดทั้งสองสีไม่เป็นของใคร
  const shared = fromArt([
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......',
    'x.o......'
  ])
  const open = score({ ...shared, komi: 0 })
  assert.equal(open.territory[BLACK], 0, 'ดำไม่ได้ล้อมช่องไหนไว้เลย')
  assert.equal(open.neutral, 9, 'ช่องกลางที่ติดทั้งสองสีไม่เป็นของใคร')
  assert.equal(open.territory[WHITE], 9 * 6, 'ฝั่งขวาทั้งผืนติดแต่สีขาว จึงเป็นของขาว')
  assert.equal(open.lead, 9 - (9 + 54))
})

test('โคมิทำให้ไม่มีเสมอ และคิดเข้าฝ่ายขาวเสมอ', () => {
  const position = fromArt([
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo',
    'xxxxx.ooo'
  ])
  const counted = score({ ...position, komi: 5.5 })
  assert.equal(counted.stones[BLACK], 45)
  assert.equal(counted.stones[WHITE], 27)
  assert.equal(counted.winner, BLACK, 'ดำนำอยู่ 18 แต้ม โคมิ 5.5 ยังไม่พอพลิก')
  assert.ok(Number.isInteger(counted.lead * 2) && !Number.isInteger(counted.lead), 'โคมิครึ่งแต้มทำให้ไม่มีทางเสมอ')
})

test('ตา (eye) คือช่องว่างที่ล้อมด้วยสีตัวเอง และมุมทแยงต้องไม่เสียให้คู่ต่อสู้', () => {
  const middle = fromArt([
    '.........',
    '..xxx....',
    '..x.x....',
    '..xxx....',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.ok(isEye(middle.board, 9, toIndex(9, 2, 3), BLACK))
  assert.ok(!isEye(middle.board, 9, toIndex(9, 2, 3), WHITE))

  // มุมกระดาน: เสียมุมทแยงไปหนึ่งมุมก็ไม่ใช่ตาแล้ว
  const corner = fromArt([
    '.x.......',
    'xo.......',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........'
  ])
  assert.ok(!isEye(corner.board, 9, 0, BLACK), 'มุมทแยงเป็นของขาว จึงยังไม่ใช่ตาจริง')
})

test('ทุกขนาดกระดานเริ่มเกมได้ และตาแรกลงได้ทุกช่อง', () => {
  for (const size of BOARD_SIZES) {
    const position = createPosition(size)
    assert.equal(position.board.length, size * size)
    assert.equal(legalMoves(position).length, size * size, `กระดาน ${size} ตาแรกต้องลงได้ทุกช่อง`)
    assert.equal(position.toPlay, BLACK, 'ดำลงก่อนเสมอ')
  }
})

test('ชื่อช่องอ่านแบบหนังสือโกะ — ไม่มีคอลัมน์ I และแถวนับจากล่างขึ้นบน', () => {
  assert.equal(toNotation(9, 8, 0), 'A1')
  assert.equal(toNotation(9, 0, 8), 'J9')
  assert.equal(toNotation(19, 0, 0), 'A19')
  assert.equal(toNotation(19, 18, 18), 'T1')
})

test('พื้นที่ที่ระบายบนกระดาน ตรงกับแต้มที่นับได้เป๊ะ ๆ', () => {
  const position = fromArt([
    '..xoo....',
    '..xoo....',
    'xxxoo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....',
    'ooooo....'
  ])

  const counted = score({ ...position, komi: 5.5 })
  const owned = areaMap(position)

  const mine: Record<number, number> = { [BLACK]: 0, [WHITE]: 0 }
  for (const player of Object.values(owned)) mine[player]!++

  assert.equal(mine[BLACK], counted.area[BLACK], 'ช่องที่ระบายให้ดำ ต้องเท่ากับแต้มของดำ')
  assert.equal(mine[WHITE], counted.area[WHITE], 'ช่องที่ระบายให้ขาว ต้องเท่ากับแต้มของขาว')

  // ช่องที่ไม่เป็นของใครต้องไม่ถูกระบาย
  assert.equal(
    position.board.length - Object.keys(owned).length,
    counted.neutral,
    'ช่องที่เหลือ (ไม่ได้ระบาย) ต้องเท่ากับช่องกลาง ๆ ที่ไม่เป็นของใคร'
  )

  // หมากที่อยู่บนกระดานเป็นของเจ้าของหมากเสมอ
  for (const [index, cell] of position.board.entries()) {
    if (cell !== 0) assert.equal(owned[index], cell, `หมากที่ช่อง ${index} ต้องเป็นของเจ้าของหมากเอง`)
  }
})

test('กระดานเปล่ายังไม่มีใครถือครองอะไร', () => {
  const owned = areaMap(createPosition(9))
  assert.equal(Object.keys(owned).length, 0, 'ยังไม่มีหมากสักเม็ด จึงยังไม่มีพื้นที่ของใคร')
})
