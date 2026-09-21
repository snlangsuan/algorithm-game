import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { HANOI_PACK, WORK_LABEL } from '~/game/hanoi/blocks/pack'
import { AGENT_GLOBALS, HanoiAgent, type HanoiState } from '~/game/hanoi/agent'
import {
  MAX_DISKS,
  MIN_DISKS,
  applyMove,
  canMove,
  createHanoi,
  isSolved,
  optimalMoves,
  solveMoves,
  validateMoves,
  type Hanoi,
  type Move
} from '~/game/hanoi/engine'

const LIMIT = 20_000

function build(presetId: string): HanoiAgent {
  const preset = HANOI_PACK.presets.find((item) => item.id === presetId)!
  const { code } = generate(normalize(preset.build(), HANOI_PACK), HANOI_PACK)

  const factory = new Function(
    'HanoiAgent',
    ...Object.keys(AGENT_GLOBALS),
    `"use strict";\n${code}\n;return Agent;`
  )

  const Agent = factory(HanoiAgent, ...Object.values(AGENT_GLOBALS))
  return new Agent() as HanoiAgent
}

const stateOf = (puzzle: Hanoi, towers = puzzle.towers, move = 1, last: Move | null = null): HanoiState => ({
  towers,
  disks: puzzle.disks,
  source: puzzle.source,
  target: puzzle.target,
  spare: puzzle.spare,
  move,
  last,
  moveLimit: LIMIT,
  timeBudget: 1000
})

function playSteps(agent: HanoiAgent, puzzle: Hanoi): Move[] {
  const moves: Move[] = []
  let towers = puzzle.towers
  let last: Move | null = null

  for (let turn = 1; turn <= LIMIT; turn++) {
    const raw = agent.step(stateOf(puzzle, towers, turn, last)) as Move | null
    if (!raw) break

    const move = { from: raw.from, to: raw.to }
    assert.ok(canMove(towers, move.from, move.to), `ตาที่ ${turn} ผิดกติกา: ${JSON.stringify(move)}`)

    towers = applyMove(towers, move)
    moves.push(move)
    last = move

    if (isSolved(towers, puzzle)) break
  }

  return moves
}

test('เฉลยของเอนจินย้ายได้จริงและใช้ 2^n − 1 ตาพอดี', () => {
  for (let disks = MIN_DISKS; disks <= MAX_DISKS; disks++) {
    const puzzle = createHanoi({ disks })
    const report = validateMoves(puzzle, solveMoves(puzzle), LIMIT)

    assert.ok(report.ok, `จาน ${disks} ใบ: ${report.message}`)
    assert.equal(report.count, optimalMoves(disks))
    assert.equal(report.states.length, report.count + 1, 'ภาพของแต่ละตาไม่ครบ')
  }
})

test('กติกาห้ามวางจานใหญ่ทับจานเล็ก และห้ามหยิบจากหมุดว่าง', () => {
  const puzzle = createHanoi({ disks: 3 })

  assert.ok(canMove(puzzle.towers, 0, 1), 'จานเล็กสุดย้ายไปหมุดว่างได้')
  assert.equal(canMove(puzzle.towers, 1, 0), false, 'หยิบจากหมุดว่างไม่ได้')
  assert.equal(canMove(puzzle.towers, 0, 0), false, 'ย้ายกลับหมุดเดิมไม่ได้')

  const after = applyMove(puzzle.towers, { from: 0, to: 1 })
  assert.equal(canMove(after, 0, 1), false, 'จานใหญ่ห้ามทับจานเล็ก')
})

test('ตาที่ผิดกติกาถูกฟ้องพร้อมบอกว่าตาไหน', () => {
  const puzzle = createHanoi({ disks: 3 })
  const report = validateMoves(puzzle, [{ from: 0, to: 1 }, { from: 0, to: 1 }], LIMIT)

  assert.equal(report.ok, false)
  assert.equal(report.count, 1, 'ต้องเก็บตาที่ถูกกติกาไว้ให้ดูด้วย')
  assert.match(report.message, /ตาที่ 2/)
})

for (const disks of [3, 4, 5, 6, 7]) {
  test(`แบ่งแล้วพิชิต — จาน ${disks} ใบ ได้ ${optimalMoves(disks)} ตา ซึ่งน้อยที่สุดเท่าที่เป็นไปได้`, () => {
    const puzzle = createHanoi({ disks })
    const agent = build('recursive')

    const plan = agent.solve(stateOf(puzzle)) as Move[]
    const report = validateMoves(puzzle, plan, LIMIT)

    assert.ok(report.ok, report.message)
    assert.equal(report.count, optimalMoves(disks))
  })

  test(`กฎสลับตา — จาน ${disks} ใบ ได้ ${optimalMoves(disks)} ตาเท่ากับแบ่งแล้วพิชิต`, () => {
    const puzzle = createHanoi({ disks })
    const report = validateMoves(puzzle, playSteps(build('iterative'), puzzle), LIMIT)

    assert.ok(report.ok, report.message)
    assert.equal(report.count, optimalMoves(disks))
  })
}

test('แบ่งแล้วพิชิต ได้ลำดับเดียวกับเฉลยของเอนจินเป๊ะ', () => {

  const puzzle = createHanoi({ disks: 5 })
  assert.deepEqual(build('recursive').solve(stateOf(puzzle)), solveMoves(puzzle))
})

test('ตัวอย่าง "เริ่มต้น" ยังย้ายไม่ครบ — ตั้งใจให้เด็กแก้เอง', () => {
  const puzzle = createHanoi({ disks: 3 })
  const agent = build('starter')

  let towers = puzzle.towers
  for (let turn = 1; turn <= 30; turn++) {
    const move = agent.step(stateOf(puzzle, towers, turn, null)) as Move
    assert.ok(canMove(towers, move.from, move.to), `ตาที่ ${turn} ผิดกติกา`)
    towers = applyMove(towers, move)
  }

  assert.equal(isSolved(towers, puzzle), false, 'ตัวอย่างเริ่มต้นต้องยังแก้ไม่ได้')
})

test('กฎสลับตาเป็นไปตามความคี่คู่ของจำนวนจาน', () => {

  for (const disks of [3, 4]) {
    const puzzle = createHanoi({ disks })
    const first = playSteps(build('iterative'), puzzle)[0]!
    assert.equal(first.from, puzzle.source)
    assert.equal(first.to, disks % 2 === 0 ? 1 : puzzle.target)
  }
})

// ---------- ตัวเลขในแผง "โปรแกรมนี้ทำงานยังไง" ----------

/**
 * นับการเรียกเมธอดแบบเดียวกับที่ worker ทำ (watch() ใน agent.worker.ts)
 * คือเขียนทับเป็น own property การเรียกซ้ำผ่าน this.xxx() จึงถูกนับด้วย
 */
function countCalls(agent: HanoiAgent): Record<string, number> {
  const counts: Record<string, number> = {}
  const names = new Set<string>()

  for (
    let proto = Object.getPrototypeOf(agent);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof (proto as Record<string, unknown>)[name] === 'function') {
        names.add(name)
      }
    }
  }

  for (const name of names) {
    const original = (agent as unknown as Record<string, (...args: unknown[]) => unknown>)[name]!

    Object.defineProperty(agent, name, {
      configurable: true,
      writable: true,
      value(this: unknown, ...args: unknown[]) {
        counts[name] = (counts[name] ?? 0) + 1
        return original.apply(this, args)
      }
    })
  }

  return counts
}

test('ชื่อไทยของคำสั่งที่แผงงานใช้ ชี้ไปที่เมธอดที่มีอยู่จริง', () => {
  // ป้ายที่ชี้ไปเมธอดที่ไม่มีแล้ว จะไม่โผล่บนจอเลยและไม่มีอะไรฟ้อง
  const agent = build('recursive') as unknown as Record<string, unknown>

  for (const name of Object.keys(WORK_LABEL)) {
    assert.equal(typeof agent[name], 'function', `WORK_LABEL มี '${name}' แต่ agent ไม่มีเมธอดนี้`)
  }
})

test('แบ่งแล้วพิชิต — งานทั้งหมดเกิดก่อนจานใบแรกขยับ และนับได้ตรงกับจำนวนงานในกอง', () => {
  const puzzle = createHanoi({ disks: 10 })
  const agent = build('recursive')
  const counts = countCalls(agent)

  const report = validateMoves(puzzle, agent.solve(stateOf(puzzle)) as Move[], LIMIT)
  assert.ok(report.ok, report.message)

  // ยอดที่แผงงานจะโชว์ — ตรงกับตัวเลขที่หน้าความรู้อ้างไว้
  assert.equal(counts.planTake, 1534, 'จำนวนงานที่หยิบจากกองเปลี่ยนไป')
  assert.equal(counts.planMove, optimalMoves(10), 'ทุกตาที่ย้ายต้องมาจากงานที่เหลือจานใบเดียว')
  assert.equal(counts.planSplit, 1534 - optimalMoves(10), 'งานที่เหลือคืองานที่ถูกแตกต่อ')
  assert.equal(counts.slide, undefined, 'โหมดวางแผนต้องไม่เรียกคำสั่งของโหมดย้ายทีละตา')
})

test('กฎสลับตา — คิดเท่าเดิมทุกตา ไม่ว่าจานจะมีกี่ใบ', () => {
  const perMove = (disks: number) => {
    const puzzle = createHanoi({ disks })
    const agent = build('iterative')
    const counts = countCalls(agent)

    const moves = playSteps(agent, puzzle)
    assert.equal(moves.length, optimalMoves(disks))

    const calls = Object.values(counts).reduce((sum, count) => sum + count, 0)

    // ไม่เคยแตะกองงานเลยสักครั้ง นี่คือข้อต่างจริงระหว่างสองวิธี
    assert.equal(counts.planTake, undefined)
    assert.equal(counts.slide! + counts.forced!, moves.length, 'ทุกตาต้องมาจากกฎข้อใดข้อหนึ่ง')

    return calls / moves.length
  }

  const small = perMove(4)
  const large = perMove(9)

  // จาน 9 ใบมีตามากกว่าจาน 4 ใบ 34 เท่า แต่งานต่อหนึ่งตาต้องเท่าเดิม
  assert.equal(
    Math.round(small),
    Math.round(large),
    `คิดต่อตาไม่คงที่แล้ว: ${small} กับ ${large} — กฎสลับตาต้องเป็น O(1) ต่อหนึ่งตา`
  )
})
