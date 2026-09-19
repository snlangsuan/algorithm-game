/**
 * ภาพย่อในรายการ "เลือกเกม" สร้างจากเอนจินจริง ไม่ใช่ไฟล์รูป
 *
 * เทสต์ชุดนี้กันสองอย่างเหมือนภาพในหน้าความรู้:
 *   1. ภาพต้องเหมือนเดิมทุกครั้ง — หลุด Math.random ที่ไหนสักแห่งแล้วภาพจะกระพริบทุกครั้งที่เปิดหน้า
 *   2. สิ่งที่วาดต้องเป็นสถานะที่เกิดขึ้นได้จริงในเกม ไม่ใช่กระดานที่ผิดกติกา
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildMazePreview, buildOthelloPreview } from '~/data/game-previews'
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

  // จุดบอกใบ้ในภาพต้องเป็นตาของฝ่ายที่ถึงคิวจริง ๆ
  assert.deepEqual(moves, getValidMoves(board, turn))
  assert.ok(
    moves.length > 0 || getValidMoves(board, opponent(turn)).length === 0,
    'ฝ่ายที่ถึงคิวไม่มีตาให้ลง ทั้งที่อีกฝ่ายยังลงได้'
  )
})
