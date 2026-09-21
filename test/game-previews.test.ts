import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildChasePreview,
  buildDinoPreview,
  buildHanoiPreview,
  buildLinePreview,
  buildMazePreview,
  buildOthelloPreview
} from '~/data/game-previews'
import { pathLength, same as sameCell, walkable as chaseFloor } from '~/game/chase/engine'
import { BODY } from '~/game/dino/art'
import { JUMP_PEAK } from '~/game/dino/engine'
import { optimalMoves, solveMoves, validateMoves } from '~/game/hanoi/engine'
import { same, walkable } from '~/game/maze/engine'
import { BOARD_SIZE, getValidMoves, opponent } from '~/game/othello/engine'

test('ภาพย่อเขาวงกตเหมือนเดิมทุกครั้ง', () => {
  const first = buildMazePreview()
  const second = buildMazePreview()

  assert.deepEqual(second.maze.grid, first.maze.grid, 'แผนที่ไม่คงที่')
  assert.deepEqual(second.path, first.path, 'เส้นทางไม่คงที่')
})

test('เส้นทางในภาพย่อเดินได้จริง ตั้งแต่จุดเริ่มถึงทางออก', () => {
  const { maze, path } = buildMazePreview()

  assert.ok(path.length > 1, 'ไม่มีเส้นทางให้วาด')
  assert.ok(same(path[0]!, maze.start), 'เส้นทางไม่ได้เริ่มที่จุดเริ่ม')
  assert.ok(same(path.at(-1)!, maze.goal), 'เส้นทางไม่ได้จบที่ทางออก')

  for (const [index, at] of path.entries()) {
    assert.ok(walkable(maze.grid, at.row, at.col), `เส้นทางทับกำแพงที่ก้าว ${index}`)

    const previous = path[index - 1]
    if (!previous) continue

    const gap = Math.abs(previous.row - at.row) + Math.abs(previous.col - at.col)
    assert.equal(gap, 1, `กระโดดข้ามช่องที่ก้าว ${index}`)
  }
})

test('ภาพย่อ Othello เหมือนเดิมทุกครั้ง และเป็นกระดานที่เกิดขึ้นได้จริง', () => {
  const first = buildOthelloPreview()
  const second = buildOthelloPreview()

  assert.deepEqual(second.board, first.board, 'กระดานไม่คงที่')
  assert.deepEqual(second.last, first.last, 'ตาล่าสุดไม่คงที่')

  const { board, count, last, moves, turn } = first

  assert.equal(count.black + count.white + count.empty, BOARD_SIZE * BOARD_SIZE)
  assert.ok(count.black > 2 && count.white > 2, 'เกมยังไม่ได้เดินจริง')
  assert.ok(last, 'ไม่มีตาล่าสุดให้วาดกรอบ')
  assert.notEqual(board[last!.row]![last!.col], 0, 'ตาล่าสุดชี้ไปช่องว่าง')

  assert.deepEqual(moves, getValidMoves(board, turn))
  assert.ok(
    moves.length > 0 || getValidMoves(board, opponent(turn)).length === 0,
    'ฝ่ายที่ถึงคิวไม่มีตาให้ลง ทั้งที่อีกฝ่ายยังลงได้'
  )
})

test('ภาพย่อหอคอยฮานอยเหมือนเดิมทุกครั้ง และเป็นกองที่เกิดขึ้นได้จริง', () => {
  const first = buildHanoiPreview()
  const second = buildHanoiPreview()

  assert.deepEqual(second.towers, first.towers, 'กองไม่คงที่')
  assert.deepEqual(second.last, first.last, 'ตาล่าสุดไม่คงที่')

  const { puzzle, towers, last, moves, best } = first

  const sizes = towers.flat().sort((a, b) => a - b)
  assert.deepEqual(
    sizes,
    Array.from({ length: puzzle.disks }, (_, index) => index + 1),
    'จานหายหรือซ้ำ'
  )

  for (const tower of towers) {
    for (let floor = 1; floor < tower.length; floor++) {
      assert.ok(tower[floor]! < tower[floor - 1]!, 'มีจานใหญ่ทับจานเล็กอยู่ในภาพ')
    }
  }

  assert.ok(last, 'ไม่มีตาล่าสุดให้วาดกรอบ')
  assert.ok(towers.filter((tower) => tower.length > 0).length >= 2, 'จานกองอยู่หมุดเดียว ภาพไม่บอกอะไรเลย')
  assert.ok(moves > 0 && moves < best, 'ภาพต้องเป็นกองกลางทาง ไม่ใช่ตอนเริ่มหรือตอนจบ')
  assert.equal(best, optimalMoves(puzzle.disks))
})

test('กองในภาพย่อหอคอยฮานอย มาจากการเดินตามเฉลยจริง', () => {
  const { puzzle, moves } = buildHanoiPreview()

  const report = validateMoves(puzzle, solveMoves(puzzle), 20_000)
  assert.ok(report.ok, report.message)
  assert.ok(moves < report.count)
})

test('ภาพย่อเกมไล่จับเหมือนเดิมทุกครั้ง และเป็นฉากกลางเกมจริง', () => {
  const first = buildChasePreview()
  const second = buildChasePreview()

  assert.deepEqual(second.hero, first.hero, 'ตัวเอกไม่อยู่ที่เดิม')
  assert.deepEqual(second.hunters, first.hunters, 'ผู้ไล่ล่าไม่อยู่ที่เดิม')
  assert.deepEqual(second.path, first.path, 'เส้นทางไม่คงที่')

  const { arena, hero, hunters, gems, taken, path } = first

  assert.ok(chaseFloor(arena.grid, hero.row, hero.col), 'ตัวเอกยืนอยู่ในกำแพง')
  assert.ok(taken > 0, 'ยังไม่ได้เก็บของเลย ภาพไม่เล่าอะไร')
  assert.ok(gems.length > 0, 'เก็บของหมดแล้ว ภาพเป็นตอนจบ ไม่ใช่กลางเกม')
  assert.equal(taken + gems.length, arena.gems.length, 'ของหายไปจากภาพ')

  for (const hunter of hunters) {
    assert.ok(chaseFloor(arena.grid, hunter.row, hunter.col), 'ผู้ไล่ล่ายืนอยู่ในกำแพง')
    assert.ok(!sameCell(hunter, hero), 'ภาพย่อจบลงตอนโดนจับพอดี ซึ่งเล่าเรื่องผิด')
  }
})

test('เส้นทางในภาพย่อเกมไล่จับ เดินได้จริงจากผู้ไล่ล่าถึงตัวเอก', () => {
  const { arena, hero, hunters, path } = buildChasePreview()

  assert.ok(path.length > 1, 'ไม่มีเส้นทางให้วาด')
  assert.ok(sameCell(path[0]!, hunters[0]!), 'เส้นทางไม่ได้เริ่มที่ผู้ไล่ล่า')
  assert.ok(sameCell(path.at(-1)!, hero), 'เส้นทางไม่ได้จบที่ตัวเอก')
  assert.equal(path.length - 1, pathLength(arena.grid, hunters[0]!, hero), 'ไม่ใช่ทางที่สั้นที่สุด')

  for (const [index, at] of path.entries()) {
    assert.ok(chaseFloor(arena.grid, at.row, at.col), `เส้นทางทับกำแพงที่ก้าว ${index}`)

    const previous = path[index - 1]
    if (!previous) continue

    const gap = Math.abs(previous.row - at.row) + Math.abs(previous.col - at.col)
    assert.equal(gap, 1, `กระโดดข้ามช่องที่ก้าว ${index}`)
  }
})

test('ภาพย่อเกมวิ่งหลบเหมือนเดิมทุกครั้ง และเป็นจังหวะกลางอากาศเหนือของจริง', () => {
  const first = buildDinoPreview()
  const second = buildDinoPreview()

  assert.equal(second.distance, first.distance, 'ตำแหน่งไม่คงที่')
  assert.equal(second.height, first.height, 'ความสูงไม่คงที่')
  assert.deepEqual(
    second.obstacles.map((item) => item.id),
    first.obstacles.map((item) => item.id),
    'สิ่งกีดขวางในภาพไม่คงที่'
  )

  const { distance, height, obstacles, speed } = first

  assert.ok(height > 0, 'ภาพต้องเป็นจังหวะที่ลอยอยู่ ไม่ใช่ตอนวิ่งบนพื้น')
  assert.ok(height <= JUMP_PEAK + 1, 'ลอยสูงเกินกว่าที่กระโดดได้จริง')
  assert.ok(speed > 0, 'ต้องกำลังวิ่งอยู่')

  const under = obstacles.filter(
    (item) => item.x < distance + BODY.stand.width && item.x + item.box.width > distance
  )
  assert.equal(under.length, 1, 'ต้องมีของอยู่ใต้ตัวพอดีหนึ่งชิ้น ภาพจึงจะเล่าเรื่องว่ากำลังข้ามอยู่')
})

test('ภาพย่อหุ่นเดินตามเส้นเหมือนเดิมทุกครั้ง และหุ่นยังเกาะเส้นอยู่', () => {
  const first = buildLinePreview()
  const second = buildLinePreview()

  assert.equal(second.run.x, first.run.x, 'ตำแหน่งไม่คงที่')
  assert.equal(second.trail.length, first.trail.length, 'รอยไม่คงที่')
  assert.equal(first.run.over, null, 'ภาพต้องเป็นจังหวะกลางทาง ไม่ใช่ตอนจบรอบ')
  assert.ok(first.run.offset < 6, 'หุ่นในภาพย่อต้องอยู่บนเส้น')
  assert.ok(first.trail.length > 50, 'ต้องมีรอยให้เห็นว่าผ่านโค้งมาแล้ว')
})
