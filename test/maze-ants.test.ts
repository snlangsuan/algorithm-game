import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { importProgram } from '~/game/blocks/importer'
import { normalize, type BlockProgram } from '~/game/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { AGENT_GLOBALS, MazeAgent, type MazeMemory, type MazeState } from '~/game/maze/agent'
import {
  COST_FLOOR,
  COST_MUD,
  cloneGrid,
  createMaze,
  findDirection,
  key,
  same,
  solve,
  stepCost,
  walkable,
  type Maze,
  type MazeKind,
  type Point
} from '~/game/maze/engine'
import { eraseLoops, layScent, emptyColony, readColony, mazeSignature } from '~/game/maze/ants'
import { TOPICS } from '~/data/algorithms'
import { figureFor } from '~/data/algorithm-figures'

/** Math.random ที่ล็อกเมล็ดไว้ — มดสุ่มเลือกทางเอง ต้องล็อกถึงจะวัดซ้ำได้ */
function withSeededRandom<T>(seed: number, work: () => T): T {
  const real = Math.random
  let state = seed

  Math.random = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  try {
    return work()
  } finally {
    Math.random = real
  }
}

/** สร้าง agent จากโค้ดที่บล็อกของตัวอย่างฝูงมดแปลงออกมาจริง แบบเดียวกับที่ worker ทำ */
function antAgent(edit?: (program: BlockProgram) => void): MazeAgent {
  const program = normalize(MAZE_PACK.presets.find((item) => item.id === 'ants')!.build(), MAZE_PACK)
  edit?.(program)
  const { code } = generate(program, MAZE_PACK)
  const factory = new Function('MazeAgent', 'FLOOR', 'WALL', 'MUD', 'COST_FLOOR', 'COST_MUD', `"use strict";\n${code}\n;return Agent;`)
  const Agent = factory(MazeAgent, AGENT_GLOBALS.FLOOR, AGENT_GLOBALS.WALL, AGENT_GLOBALS.MUD, AGENT_GLOBALS.COST_FLOOR, AGENT_GLOBALS.COST_MUD)
  return new Agent() as MazeAgent
}

/** เดินหนึ่งรอบแบบที่เกมเดินทีละก้าว — ความจำส่งต่อข้ามรอบแบบเดียวกับ worker */
function walk(maze: Maze, memory: MazeMemory | null, save: (data: MazeMemory) => void, edit?: (program: BlockProgram) => void) {
  const agent = antAgent(edit)
  agent.memory = memory
  agent.saveMemory = (data) => {
    agent.memory = data
    save(data)
  }

  const limit = maze.width * maze.height * 6
  const visits: Record<string, number> = { [key(maze.start.row, maze.start.col)]: 1 }
  let at = maze.start
  let previous: Point | null = null
  let cost = 0
  let steps = 0
  let ok = false

  const stateAt = (step: number): MazeState => ({
    grid: cloneGrid(maze.grid),
    width: maze.width,
    height: maze.height,
    start: { ...maze.start },
    goal: { ...maze.goal },
    costFloor: COST_FLOOR,
    costMud: COST_MUD,
    position: { ...at },
    step,
    previous,
    visits: { ...visits },
    stepLimit: limit,
    timeBudget: 5000
  })

  agent.onStart(stateAt(1))
  for (let step = 1; step <= limit; step++) {
    const raw = agent.step(stateAt(step)) as string | null
    const dir = raw ? findDirection(raw) : undefined
    if (!dir) break
    const next = { row: at.row + dir.dr, col: at.col + dir.dc }
    if (!walkable(maze.grid, next.row, next.col)) break

    cost += stepCost(maze.grid, next.row, next.col)
    steps = step
    previous = at
    at = next
    visits[key(at.row, at.col)] = (visits[key(at.row, at.col)] ?? 0) + 1
    if (same(at, maze.goal)) {
      ok = true
      break
    }
  }
  agent.onFinish({ ok, steps, cost })

  return { ok, cost, steps }
}

const strongest = (program: BlockProgram) => {
  program.scripts['maze.on-turn']![0]!.fields.mode = 'strongest'
}

/** ปล่อยมด 100 ตัวแล้วเดินตามกลิ่นแรงที่สุดหนึ่งรอบ */
function colonyRun(kind: MazeKind, seed: number) {
  const maze = createMaze({ kind, seed })
  let memory: MazeMemory | null = null
  const rounds = withSeededRandom(20260922 + seed, () =>
    Array.from({ length: 100 }, () => walk(maze, memory, (data) => (memory = data)))
  )
  const trail = walk(maze, memory, () => {}, strongest)
  return { maze, rounds, trail, optimal: solve(maze)!.cost }
}

const average = (list: number[]) => Math.round(list.reduce((sum, value) => sum + value, 0) / list.length)

test('ฝูงมด — ตัวอย่าง บล็อก→โค้ด→บล็อก ได้โค้ดเดิม', () => {
  const preset = MAZE_PACK.presets.find((item) => item.id === 'ants')!
  const first = generate(normalize(preset.build(), MAZE_PACK), MAZE_PACK)
  const imported = importProgram(first.code, MAZE_PACK)
  assert.ok(imported.ok, imported.message)
  assert.equal(imported.raw, 0)
  assert.equal(generate(normalize(imported.program!, MAZE_PACK), MAZE_PACK).code, first.code)
})

test('ฝูงมด — บนเขาวงกตที่มีทางวน เดินตามกลิ่นได้ทางที่ถูกเท่า Dijkstra และตัวเลขในหน้าความรู้ยังตรง', () => {
  const braid = colonyRun('braid', 1)
  assert.equal(braid.rounds.filter((round) => round.ok).length, 100, 'มดทุกตัวต้องถึงทางออก')
  assert.ok(braid.trail.ok)
  assert.equal(braid.trail.cost, braid.optimal)

  const early = average(braid.rounds.slice(0, 10).map((round) => round.cost))
  const late = average(braid.rounds.slice(-10).map((round) => round.cost))
  assert.ok(late < early, 'มดตัวหลัง ๆ ต้องเดินถูกกว่าตัวแรก ๆ')

  const obstacles = colonyRun('obstacles', 1)
  assert.ok(obstacles.trail.ok)

  const text = TOPICS.find((topic) => topic.slug === 'ant-colony')!.inGame
  for (const number of [early, late, braid.trail.cost, obstacles.trail.cost, obstacles.optimal]) {
    assert.ok(text.includes(String(number)), `หน้าฝูงมดไม่ได้พูดถึง ${number} แล้ว`)
  }
})

test('ฝูงมด — ภาพในหน้าความรู้: ทางตามกลิ่นเท่ากับทางที่ถูกที่สุด และมดตัวแรกเดินวนกว่ามาก', () => {
  const figure = figureFor('ant-colony')
  assert.ok(figure && figure.kind === 'maze')
  const cost = (path: Point[]) => path.slice(1).reduce((sum, point) => sum + stepCost(figure.maze.grid, point.row, point.col), 0)
  assert.equal(cost(figure.path), cost(figure.optimal))
  assert.ok(figure.explored.length > figure.path.length * 5)
})

test('ฝูงมด — ตัดวงวน ระเหยกลิ่น และกลิ่นของเขาวงกตอื่นใช้ไม่ได้', () => {
  const loop = [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 2, col: 2 },
    { row: 1, col: 2 },
    { row: 1, col: 3 }
  ]
  assert.deepEqual(eraseLoops(loop), [loop[0], loop[1], loop[4]])

  const maze = createMaze({ kind: 'braid', seed: 1 })
  const once = layScent(emptyColony(maze.grid), maze.grid, [maze.start], false)
  assert.equal(once.ants, 1)
  assert.equal(once.arrived, 0)
  assert.deepEqual(once.scent, {})

  const other = createMaze({ kind: 'braid', seed: 2 })
  assert.notEqual(mazeSignature(maze.grid), mazeSignature(other.grid))
  assert.equal(readColony(once, other.grid), null, 'กลิ่นของเขาวงกตหนึ่งต้องใช้กับอีกเขาวงกตไม่ได้')
  assert.deepEqual(readColony(JSON.parse(JSON.stringify(once)), maze.grid), once)
})
