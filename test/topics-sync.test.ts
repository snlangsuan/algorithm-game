import { test } from 'node:test'
import assert from 'node:assert/strict'

import { TOPICS } from '~/data/algorithms'
import { countBlocks } from './helpers'
import { generate } from '~/game/blocks/codegen'
import { normalize, type BlockPack } from '~/game/blocks/pack'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import { HANOI_PACK } from '~/game/hanoi/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { AGENT_GLOBALS as HANOI_GLOBALS, HanoiAgent } from '~/game/hanoi/agent'
import { createHanoi, optimalMoves, validateMoves, type Move } from '~/game/hanoi/engine'
import { AGENT_GLOBALS as MAZE_GLOBALS, MazeAgent } from '~/game/maze/agent'
import { AGENT_GLOBALS, OthelloAgent } from '~/game/othello/agent'
import { createMaze, solveSteps, validatePath, type Point } from '~/game/maze/engine'
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

const NOT_ALGORITHMS: Record<string, string> = {
  'maze/starter': 'โปรแกรมตั้งต้นให้เด็กลากแก้ ตั้งใจให้ยังไปไม่ถึงทางออก ไม่ใช่อัลกอริทึม',
  'hanoi/starter': 'โปรแกรมตั้งต้นให้เด็กลากแก้ ย้ายจานเล็กสุดวนอยู่อย่างเดียวจนไม่มีวันจบ ไม่ใช่อัลกอริทึม',
  'chase/starter':
    'โปรแกรมตั้งต้นให้เด็กลากแก้ เห็นตัวเอกค่อยไล่ ไม่เห็นก็เดินสุ่ม จึงไล่ไม่ติดสักที ไม่ใช่อัลกอริทึม',
  'runner/collector':
    'โปรแกรมตั้งต้นของฝ่ายหนี เดินหาของที่ใกล้ที่สุดอย่างเดียวโดยไม่มองผู้ไล่ล่าเลย ไม่ใช่อัลกอริทึมการหนี',
  'dino/starter':
    'โปรแกรมตั้งต้นให้เด็กลากแก้ เผื่อระยะเป็นตัวเลขตายตัวและไม่เคยดูชนิดของเลย จึงไปได้ไม่กี่ร้อยเมตร ไม่ใช่อัลกอริทึม',
  'line/starter':
    'โปรแกรมตั้งต้นให้เด็กลากแก้ ดูเซนเซอร์ตัวซ้ายตัวเดียวและไม่มีกฎเลี้ยวขวาเลย จึงครบรอบได้แค่สนามวงรี ไม่ใช่อัลกอริทึม'
}

const PACKS: BlockPack[] = [MAZE_PACK, OTHELLO_PACK, HANOI_PACK, CHASE_PACK, RUNNER_PACK, DINO_PACK, LINE_PACK]

test('ทุกตัวอย่างที่เลือกได้ในเกม มีหน้าความรู้ของตัวเอง', () => {
  for (const pack of PACKS) {
    for (const preset of pack.presets) {
      const ref = `${pack.id}/${preset.id}`
      if (ref in NOT_ALGORITHMS) continue

      const topic = TOPICS.find(
        (item) => item.preset?.game === pack.id && item.preset.id === preset.id
      )
      assert.ok(
        topic,
        `ตัวอย่าง "${preset.name}" (${ref}) ยังไม่มีหน้าความรู้ — เขียนหัวข้อใหม่ หรือประกาศไว้ใน NOT_ALGORITHMS พร้อมเหตุผล`
      )
    }
  }
})

test('ทุกหัวข้อในหน้าความรู้ ชี้ไปที่ตัวอย่างที่เลือกเล่นได้จริง', () => {
  for (const topic of TOPICS) {
    assert.ok(topic.preset, `หัวข้อ '${topic.slug}' ไม่ได้ผูกกับตัวอย่างไหนเลย — ต้องมีให้กดเล่นได้`)

    const pack = PACKS.find((item) => item.id === topic.preset!.game)
    assert.ok(pack, `หัวข้อ '${topic.slug}' ชี้ไปเกม '${topic.preset.game}' ที่ไม่มีอยู่`)
    assert.ok(
      pack.presets.some((preset) => preset.id === topic.preset!.id),
      `หัวข้อ '${topic.slug}' ชี้ไปตัวอย่าง '${topic.preset.id}' ที่ไม่มีในดรอปดาวน์แล้ว`
    )
  }
})

test('รายการยกเว้นไม่มีของค้าง — ตัวอย่างที่ถูกลบไปแล้วต้องเอาออกจากรายการด้วย', () => {
  for (const ref of Object.keys(NOT_ALGORITHMS)) {
    const [game, id] = ref.split('/')
    const pack = PACKS.find((item) => item.id === game)
    assert.ok(
      pack?.presets.some((preset) => preset.id === id),
      `NOT_ALGORITHMS มี '${ref}' แต่ไม่มีตัวอย่างนั้นแล้ว`
    )
  }
})

function othello(presetId: string): OthelloAgent {
  const preset = OTHELLO_PACK.presets.find((item) => item.id === presetId)!
  const { code } = generate(normalize(preset.build(), OTHELLO_PACK), OTHELLO_PACK)
  const factory = new Function(
    'OthelloAgent',
    'EMPTY',
    'BLACK',
    'WHITE',
    `"use strict";\n${code}\n;return Agent;`
  )
  const Agent = factory(OthelloAgent, AGENT_GLOBALS.EMPTY, AGENT_GLOBALS.BLACK, AGENT_GLOBALS.WHITE)
  return new Agent() as OthelloAgent
}

function play(black: OthelloAgent, white: OthelloAgent) {
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
      timeBudget: 1000
    })
    board = applyMove(board, move as { row: number; col: number }, side)
    side = opponent(side)
    turn++
  }

  return countDiscs(board)
}

function withSeededRandom<T>(seed: number, run: () => T): T {
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
    return run()
  } finally {
    Math.random = real
  }
}

test('หน้า "เปลี่ยนกลยุทธ์ตามช่วงเกม" — ตัวเลขผลการแข่งยังตรงกับที่เขียนไว้', () => {
  const versus = (rival: string) => {
    const asBlack = play(othello('late'), othello(rival))
    const asWhite = play(othello(rival), othello('late'))
    return [
      `${asBlack.black}–${asBlack.white}`,
      `${asWhite.white}–${asWhite.black}`
    ]
  }

  const text = TOPICS.find((topic) => topic.slug === 'game-phases')!.inGame

  for (const score of [...versus('greedy'), ...versus('corner')]) {
    assert.ok(text.includes(score), `หน้าความรู้ไม่ได้พูดถึงผล ${score} แล้ว — ผลการแข่งเปลี่ยนไป`)
  }
})

test('หน้า "เส้นฐานสุ่ม" — สัดส่วนชนะยังตรงกับที่เขียนไว้', () => {

  const count = (rival: string) =>
    withSeededRandom(20260920, () => {
      let wins = 0
      for (let round = 0; round < 20; round++) {
        const asBlack = play(othello('random'), othello(rival))
        if (asBlack.black > asBlack.white) wins++
        const asWhite = play(othello(rival), othello('random'))
        if (asWhite.white > asWhite.black) wins++
      }
      return wins
    })

  const text = TOPICS.find((topic) => topic.slug === 'random-baseline')!.inGame

  for (const [rival, expected] of [['greedy', 12], ['corner', 5], ['late', 1]] as const) {
    assert.equal(count(rival), expected, `ตัวสุ่มชนะ '${rival}' ไม่ใช่ ${expected} จาก 40 เกมแล้ว`)
    assert.ok(text.includes(String(expected)), `หน้าความรู้ไม่ได้พูดถึงเลข ${expected} แล้ว`)
  }
})

test('หน้า DFS — จำนวนช่องที่เปิดดูและความยาวเส้นทาง ยังตรงกับที่เขียนไว้', () => {
  const run = (presetId: string, maze: ReturnType<typeof createMaze>) => {
    const preset = MAZE_PACK.presets.find((item) => item.id === presetId)!
    const { code } = generate(normalize(preset.build(), MAZE_PACK), MAZE_PACK)
    const globals = MAZE_GLOBALS as Record<string, unknown>
    const factory = new Function(
      'MazeAgent',
      ...Object.keys(globals),
      `"use strict";\n${code}\n;return Agent;`
    )
    const Agent = factory(MazeAgent, ...Object.values(globals))
    const agent = new Agent() as MazeAgent & { visit: (cell: Point) => void }

    const opened: Point[] = []
    agent.visit = (cell: Point) => opened.push(cell)

    const path = agent.solve({
      grid: maze.grid,
      width: maze.width,
      height: maze.height,
      start: maze.start,
      goal: maze.goal,
      costFloor: 1,
      costMud: 5,
      position: maze.start,
      step: 1,
      previous: null,
      visits: {},
      stepLimit: 5000,
      timeBudget: 1000
    })

    const report = validatePath(maze, (path ?? []) as Point[])
    assert.ok(report.ok, `${presetId}: เส้นทางเดินไม่ได้จริง — ${report.message}`)
    return { steps: report.steps, opened: opened.length }
  }

  const text = TOPICS.find((topic) => topic.slug === 'dfs')!.inGame

  const open = createMaze({ kind: 'obstacles', seed: 3 })
  const dfsOpen = run('dfs', open)
  const bfsOpen = run('bfs', open)

  assert.deepEqual(
    { dfsOpened: dfsOpen.opened, dfsSteps: dfsOpen.steps, bfsOpened: bfsOpen.opened, bfsSteps: bfsOpen.steps },
    { dfsOpened: 101, dfsSteps: 76, bfsOpened: 345, bfsSteps: 42 }
  )
  for (const number of [101, 76, 345, 42]) {
    assert.ok(text.includes(String(number)), `หน้า DFS ไม่ได้พูดถึงเลข ${number} แล้ว`)
  }

  const perfect = createMaze()
  const best = (solveSteps(perfect)?.path.length ?? 0) - 1
  assert.equal(run('dfs', perfect).steps, best)
  assert.equal(run('bfs', perfect).steps, best)
  assert.equal(best, 134)
  assert.ok(text.includes('134'))
})

test('หน้าหอคอยฮานอย — จำนวนตากับจำนวนงานที่หยิบ ยังตรงกับที่เขียนไว้', () => {
  /** สร้าง agent จากโค้ดที่บล็อกแปลงออกมา แล้วนับว่าหยิบงานจากกองไปกี่ครั้ง */
  const run = (presetId: string, disks: number) => {
    const preset = HANOI_PACK.presets.find((item) => item.id === presetId)!
    const { code } = generate(normalize(preset.build(), HANOI_PACK), HANOI_PACK)
    const globals = HANOI_GLOBALS as Record<string, unknown>
    const factory = new Function(
      'HanoiAgent',
      ...Object.keys(globals),
      `"use strict";\n${code}\n;return Agent;`
    )

    const Agent = factory(HanoiAgent, ...Object.values(globals))
    const agent = new Agent() as HanoiAgent & { planTake: () => void }
    const puzzle = createHanoi({ disks })

    let takes = 0
    const realTake = agent.planTake.bind(agent)
    agent.planTake = () => {
      takes++
      realTake()
    }

    const state = {
      towers: puzzle.towers,
      disks: puzzle.disks,
      source: puzzle.source,
      target: puzzle.target,
      spare: puzzle.spare,
      move: 1,
      last: null,
      moveLimit: 20_000,
      timeBudget: 1000
    }

    const report = validateMoves(puzzle, agent.solve(state) as Move[], 20_000)
    assert.ok(report.ok, `${presetId} จาน ${disks} ใบ: ${report.message}`)

    return { moves: report.count, takes }
  }

  const text = TOPICS.find((topic) => topic.slug === 'divide-and-conquer')!.inGame

  const five = run('recursive', 5)
  const ten = run('recursive', 10)

  assert.deepEqual(
    { moves5: five.moves, takes5: five.takes, moves10: ten.moves, takes10: ten.takes },
    { moves5: 31, takes5: 46, moves10: 1023, takes10: 1534 }
  )
  assert.equal(five.moves, optimalMoves(5))
  assert.equal(ten.moves, optimalMoves(10))

  for (const number of ['31', '46', '1,023', '1,534']) {
    assert.ok(text.includes(number), `หน้าแบ่งแล้วพิชิตไม่ได้พูดถึงเลข ${number} แล้ว`)
  }

  // หน้ากฎสลับตาอ้างว่าได้จำนวนตาเท่ากันเป๊ะ — ต้องเป็นจริงทุกขนาดที่หน้านั้นยกมา
  const parity = TOPICS.find((topic) => topic.slug === 'hanoi-parity')!.inGame

  for (const [disks, expected] of [[3, '7'], [5, '31'], [10, '1,023']] as const) {
    assert.equal(optimalMoves(disks), Number(expected.replace(',', '')))
    assert.ok(parity.includes(expected), `หน้ากฎสลับตาไม่ได้พูดถึงเลข ${expected} แล้ว`)
  }

  // จำนวนบล็อกของตัวอย่างที่หน้าเขียนอ้างไว้
  const blocks = countBlocks(
    normalize(HANOI_PACK.presets.find((item) => item.id === 'recursive')!.build(), HANOI_PACK)
  )
  assert.equal(blocks, 9)
  assert.ok(text.includes('9 บล็อก'), 'หน้าแบ่งแล้วพิชิตไม่ได้บอกว่ามี 9 บล็อกแล้ว')
})
