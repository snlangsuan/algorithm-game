/**
 * ภาพในหน้าความรู้สร้างจากเอนจินจริง คำบรรยายจึงประกอบจากตัวเลขที่คำนวณได้ ไม่ฮาร์ดโค้ด
 *
 * เทสต์ชุดนี้กันสองอย่าง:
 *   1. ภาพต้องเหมือนเดิมทุกครั้ง — หลุด seed ที่ไหนสักแห่งแล้วภาพจะเปลี่ยนทุกครั้งที่เปิดหน้า
 *   2. สิ่งที่คำบรรยายพูด ต้องเป็นจริงกับภาพนั้น — ไม่งั้นหน้าจะโกหกแบบเงียบ ๆ
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TOPICS } from '~/data/algorithms'
import { buildFigures, figureFor, sweepOrder, wallFollowerWalk } from '~/data/algorithm-figures'
import { createMaze, same, solve, solveSteps, stepCost, walkable } from '~/game/maze/engine'
import { WHITE, countDiscs } from '~/game/othello/engine'

test('ทุกหัวข้อมีภาพประกอบ และมีคำบรรยายที่ไม่ว่าง', () => {
  for (const topic of TOPICS) {
    const figure = figureFor(topic.slug)
    assert.ok(figure, `${topic.slug}: ไม่มีภาพ`)
    assert.ok(figure.caption.trim().length > 40, `${topic.slug}: คำบรรยายสั้นเกินไป`)
  }
})

test('สร้างสองครั้งได้ภาพเดิมเป๊ะ — ไม่มี Math.random หลุดเข้ามา', () => {
  const first = buildFigures()
  const second = buildFigures()

  for (const slug of Object.keys(first)) {
    assert.equal(second[slug]!.caption, first[slug]!.caption, `${slug}: คำบรรยายไม่คงที่`)
  }
})

test('เส้นทางในภาพเดินได้จริง — ไม่ทะลุกำแพง ไม่กระโดดข้ามช่อง', () => {
  for (const topic of TOPICS) {
    const figure = figureFor(topic.slug)!
    if (figure.kind !== 'maze') continue

    for (const [index, at] of figure.path.entries()) {
      assert.ok(walkable(figure.maze.grid, at.row, at.col), `${topic.slug}: เส้นทางทับกำแพงที่ก้าว ${index}`)

      const previous = figure.path[index - 1]
      if (!previous) continue

      const gap = Math.abs(previous.row - at.row) + Math.abs(previous.col - at.col)
      assert.equal(gap, 1, `${topic.slug}: กระโดดข้ามช่องที่ก้าว ${index}`)
    }
  }
})

test('เลาะกำแพงในภาพ เดินถึงทางออกใน 238 ก้าว เท่าที่หน้าความรู้อ้างไว้', () => {
  const maze = createMaze()
  const walk = wallFollowerWalk(maze)

  assert.ok(same(walk[walk.length - 1]!, maze.goal), 'เดินไม่ถึงทางออก')
  assert.equal(walk.length - 1, 238)
  assert.equal((solveSteps(maze)?.path.length ?? 0) - 1, 134, 'เฉลยไม่ใช่ 134 ก้าวแล้ว')
})

test('สุ่มเดินในภาพยังไปไม่ถึงทางออก ตามที่คำบรรยายบอก', () => {
  const figure = figureFor('random-walk')!
  assert.equal(figure.kind, 'maze')
  if (figure.kind !== 'maze') return

  const last = figure.path[figure.path.length - 1]!
  assert.ok(!same(last, figure.maze.goal), 'ดันเดินถึงทางออก คำบรรยายจะผิดทันที')
})

test('ภาพของ Dijkstra: ทางที่ถูกที่สุดกับทางที่ก้าวน้อยที่สุด เป็นคนละเส้นจริง', () => {
  const open = createMaze({ kind: 'obstacles', seed: 3 })
  const cheapest = solve(open)!
  const fewest = solveSteps(open)!

  const priceOf = (cells: typeof cheapest.path) =>
    cells.slice(1).reduce((sum, at) => sum + stepCost(open.grid, at.row, at.col), 0)

  assert.ok(cheapest.path.length > fewest.path.length, 'ทางที่ถูกที่สุดต้องอ้อมกว่า')
  assert.ok(priceOf(cheapest.path) < priceOf(fewest.path), 'อ้อมแล้วต้องถูกกว่า ไม่งั้นภาพไม่เล่าอะไร')
})

test('ภาพของ A*: เปิดดูน้อยกว่า Dijkstra แต่ได้ทางเดียวกัน', () => {
  const open = createMaze({ kind: 'obstacles', seed: 3 })
  const dijkstra = sweepOrder(open, 'dijkstra')
  const astar = sweepOrder(open, 'astar')

  assert.ok(astar.length < dijkstra.length, `A* ไม่ได้เปิดน้อยกว่า (${astar.length} vs ${dijkstra.length})`)

  const figures = buildFigures()
  const one = figures.dijkstra!
  const two = figures['a-star']!
  assert.ok(one.kind === 'maze' && two.kind === 'maze')
  if (one.kind !== 'maze' || two.kind !== 'maze') return

  assert.deepEqual(two.path, one.path, 'สองหน้าต้องโชว์เส้นทางเดียวกัน ไม่งั้นคำบรรยายผิด')
})

test('ภาพ Othello: กินเยอะสุดนำตอนกลางเกม แต่ยึดมุมก่อนชนะตอนจบ', () => {
  const figures = buildFigures()
  const mid = figures.greedy!
  const end = figures.heuristic!

  assert.ok(mid.kind === 'othello' && end.kind === 'othello')
  if (mid.kind !== 'othello' || end.kind !== 'othello') return

  const midScore = countDiscs(mid.board)
  const endScore = countDiscs(end.board)

  assert.ok(midScore.black > midScore.white, 'กลางเกมดำต้องนำ ไม่งั้นคำบรรยายผิด')
  assert.ok(endScore.white > endScore.black, 'ตอนจบขาวต้องชนะ ไม่งั้นคำบรรยายผิด')

  // มุมเป็นของถาวร — ที่ขาวยึดไว้กลางเกม ต้องยังเป็นของขาวตอนจบ
  for (const at of [
    { row: 0, col: 0 },
    { row: 0, col: 7 },
    { row: 7, col: 0 },
    { row: 7, col: 7 }
  ]) {
    if (mid.board[at.row]![at.col] !== WHITE) continue
    assert.equal(end.board[at.row]![at.col], WHITE, `มุม ${at.row},${at.col} ถูกพลิกคืน ซึ่งเป็นไปไม่ได้`)
  }
})

test('ภาพของ GA: รุ่นที่ 0 ซึ่งสุ่มน้ำหนักล้วน ต้องแพ้ยึดมุมก่อน', () => {
  const figure = buildFigures().genetic!
  assert.equal(figure.kind, 'othello')
  if (figure.kind !== 'othello') return

  const score = countDiscs(figure.board)
  assert.ok(score.white > score.black, 'ถ้ารุ่นสุ่มล้วนดันชนะ คำบรรยายจะผิด')
  assert.equal(figure.moves.length, 0, 'ภาพนี้เป็นกระดานตอนจบ ไม่ควรมีตาให้ลงเหลือ')
})
