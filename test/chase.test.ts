import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { createBlock } from '~/game/blocks/program'
import { normalize } from '~/game/blocks/pack'
import { TOPICS } from '~/data/algorithms'
import { figureFor } from '~/data/algorithm-figures'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import {
  AGENT_GLOBALS,
  ChaseAgent,
  heroAsMover,
  viewOf,
  type ChaseState
} from '~/game/chase/agent'
import {
  ARENAS,
  DIRECTIONS,
  TICK_LIMIT,
  advanceHero,
  aim,
  catcher,
  closestHunter,
  createMatch,
  distanceField,
  dueHunters,
  exitOpen,
  findArena,
  manhattan,
  lineOfSight,
  moveHunter,
  neighbors,
  pathLength,
  pathTo,
  same,
  stepAlong,
  stepHero,
  stepInto,
  walkable,
  type Direction,
  type Match,
  type Point
} from '~/game/chase/engine'

function agentOf(presetId: string, pack = CHASE_PACK): ChaseAgent {
  const preset = pack.presets.find((item) => item.id === presetId)
  assert.ok(preset, `ไม่มีตัวอย่างชื่อ '${presetId}'`)

  const { code } = generate(normalize(preset.build(), pack), pack)
  const factory = new Function(
    'ChaseAgent',
    ...Object.keys(AGENT_GLOBALS),
    `"use strict";\n${code}\n;return Agent;`
  )

  const Agent = factory(ChaseAgent, ...Object.values(AGENT_GLOBALS))
  return new Agent() as ChaseAgent
}

/** ขยับผู้ไล่ล่าทุกตัวที่ถึงตาเดิน ตามที่ agent สั่ง — เหมือนที่หน้าเกมทำทุกจังหวะ */
function hunt(match: Match, agent: ChaseAgent, speed: number): void {
  const state = viewOf(match, 1000)

  for (const hunter of dueHunters(match, speed)) {
    const raw = agent.step({ ...state, me: state.hunters[hunter.index]! })
    const dir = typeof raw === 'string' ? (raw as Direction) : null
    moveHunter(match, hunter, dir)
  }
}

// ---------- สนาม ----------

for (const arena of ARENAS) {
  test(`สนาม '${arena.id}' — ทุกช่องสำคัญอยู่บนพื้น และเดินถึงกันหมด`, () => {
    for (const line of arena.grid) assert.equal(line.length, arena.width, 'แถวยาวไม่เท่ากัน')

    const spots: Point[] = [arena.hero, arena.exit, ...arena.gems, ...arena.homes]
    for (const spot of spots) {
      assert.ok(walkable(arena.grid, spot.row, spot.col), `ช่อง ${spot.row},${spot.col} เป็นกำแพง`)
    }

    const field = distanceField(arena.grid, arena.hero)
    let floors = 0
    let reached = 0

    for (const [row, line] of arena.grid.entries()) {
      for (const [col, cell] of line.entries()) {
        if (cell !== 0) continue
        floors++
        if ((field[row]?.[col] ?? -1) >= 0) reached++
      }
    }

    assert.equal(reached, floors, 'มีช่องที่เดินไปไม่ถึง — ของหรือประตูอาจติดอยู่ในนั้น')
    assert.ok(arena.homes.length >= 4, 'ต้องมีจุดเกิดให้ผู้ไล่ล่าครบสี่ตัว')
    assert.ok(arena.gems.length >= 5, 'ของน้อยเกินไป เกมจบเร็วเกิน')
  })

  test(`สนาม '${arena.id}' — จุดเกิดผู้ไล่ล่าไม่ติดตัวเอกตั้งแต่เริ่ม`, () => {
    for (const home of arena.homes) {
      assert.ok(
        pathLength(arena.grid, arena.hero, home) >= 4,
        'เกิดมาก็โดนจับเลย ไม่ยุติธรรมกับคนเล่น'
      )
    }
  })
}

// ---------- การหาทาง ----------

test('ทางที่สั้นที่สุดเดินได้จริง ทีละช่อง ไม่ทะลุกำแพง', () => {
  const arena = findArena('rooms')
  const path = pathTo(arena.grid, arena.homes[0]!, arena.exit)

  assert.ok(path.length > 1, 'ไม่มีทางให้เดิน')
  assert.ok(same(path[0]!, arena.homes[0]!))
  assert.ok(same(path.at(-1)!, arena.exit))
  assert.equal(path.length - 1, pathLength(arena.grid, arena.homes[0]!, arena.exit))

  for (const [index, at] of path.entries()) {
    assert.ok(walkable(arena.grid, at.row, at.col), `ทับกำแพงที่ก้าว ${index}`)

    const previous = path[index - 1]
    if (!previous) continue
    assert.equal(
      Math.abs(previous.row - at.row) + Math.abs(previous.col - at.col),
      1,
      `กระโดดข้ามช่องที่ก้าว ${index}`
    )
  }
})

test('ก้าวตามทางที่สั้นที่สุด ทำให้ระยะลดลงทุกก้าว', () => {
  const arena = findArena('lattice')
  let at = arena.homes[3]!
  let left = pathLength(arena.grid, at, arena.exit)

  while (left > 0) {
    const dir = stepAlong(arena.grid, at, arena.exit)
    assert.ok(dir, 'ยังไม่ถึงที่หมายแต่ไม่มีก้าวต่อไป')

    at = stepInto(at, dir!)
    const now = pathLength(arena.grid, at, arena.exit)
    assert.equal(now, left - 1, 'ก้าวแล้วระยะไม่ได้ลดลงหนึ่ง')
    left = now
  }

  assert.ok(same(at, arena.exit))
})

test('มองเห็นกันเฉพาะแถวหรือหลักเดียวกัน และไม่มีกำแพงคั่น', () => {
  const arena = findArena('lattice')

  assert.ok(lineOfSight(arena.grid, { row: 1, col: 1 }, { row: 1, col: 13 }), 'แถวโล่งแต่มองไม่เห็น')
  assert.ok(!lineOfSight(arena.grid, { row: 1, col: 1 }, { row: 3, col: 3 }), 'คนละแถวคนละหลักแต่ดันเห็น')
  assert.ok(!lineOfSight(arena.grid, { row: 1, col: 2 }, { row: 5, col: 2 }), 'มีกำแพงคั่นแต่ดันเห็น')
})

// ---------- กติกา ----------

test('กดไปทางกำแพงแล้วไม่หันตาม แต่จำไว้ใช้ตอนถึงทางแยก', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 0.7 })

  aim(match, 'up')
  assert.equal(match.facing, 'right', 'ข้างบนเป็นกำแพงแต่ดันหันขึ้น')

  advanceHero(match)
  assert.equal(match.hero.row, match.arena.hero.row, 'ดันเดินทะลุกำแพงบน')
  assert.equal(match.queued, 'up', 'ทิศที่กดค้างไว้ต้องถูกจำไว้จนเลี้ยวได้จริง')
})

test('หันชนกำแพงตรง ๆ แล้วยืนอยู่กับที่ ไม่ทะลุออกนอกสนาม', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 0.7 })
  match.facing = 'up'

  advanceHero(match)
  assert.deepEqual(match.hero, match.arena.hero)
})

test('เหยียบของแล้วของหายไป ประตูเปิดเมื่อเก็บครบ', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 0.7 })
  const total = match.gems.length

  assert.equal(exitOpen(match), false, 'ยังไม่เก็บอะไรเลยแต่ประตูเปิด')

  match.hero = { ...match.gems[0]! }
  match.facing = 'right'
  match.gems.splice(0, 1)
  match.taken++

  match.gems = []
  assert.equal(exitOpen(match), true, 'เก็บครบแล้วประตูยังไม่เปิด')
  assert.ok(total >= 5)
})

test('เก็บครบแล้วเดินเข้าประตู = หนีรอด', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 1, hunterSpeed: 0.7 })

  match.gems = []
  match.hero = { row: arena.exit.row, col: arena.exit.col - 1 }
  aim(match, 'right')
  advanceHero(match)

  assert.equal(match.over, 'escaped')
})

test('ของยังไม่ครบ เดินทับประตูก็ยังไม่จบ', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 1, hunterSpeed: 0.7 })

  match.hero = { row: arena.exit.row, col: arena.exit.col - 1 }
  aim(match, 'right')
  advanceHero(match)

  assert.equal(match.over, null, 'ประตูต้องยังปิดอยู่จนกว่าจะเก็บของครบ')
  assert.ok(same(match.hero, arena.exit))
})

test('เดินสวนกันคนละทางก็นับว่าโดนจับ ไม่ใช่เดินทะลุกัน', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 1, hunterSpeed: 1 })

  const hunter = match.hunters[0]!
  match.hero = { row: hunter.at.row, col: hunter.at.col - 1 }

  const heroBefore = { ...match.hero }
  const hunterBefore = [{ ...hunter.at }]

  match.hero = { ...hunter.at }
  hunter.at = heroBefore

  assert.equal(catcher(match, heroBefore, hunterBefore), 0, 'ต้องบอกด้วยว่าตัวไหนจับได้')
  assert.equal(match.caughtBy, 0, 'ต้องจดไว้ในสนามว่าตัวไหนจับ')
  assert.deepEqual(match.caughtAt, match.hero, 'ต้องจดไว้ด้วยว่าจับกันตรงไหน')
})

test('ยังไม่โดนจับก็ต้องไม่มีใครถูกจดว่าเป็นคนจับ', () => {
  const match = createMatch(findArena('lattice'), { hunters: 2, hunterSpeed: 0.7 })
  const before = match.hunters.map((hunter) => ({ ...hunter.at }))

  assert.equal(catcher(match, { ...match.hero }, before), null)
  assert.equal(match.caughtBy, null)
  assert.equal(match.caughtAt, null)
})

test('คนหนีที่เป็น AI เดินทีละก้าวตามที่สั่ง ชนกำแพงแล้วอยู่ที่เดิม', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 0.7 })
  const start = { ...match.hero }

  assert.equal(stepHero(match, 'up'), false, 'ข้างบนเป็นกำแพง ต้องฟ้องว่าเดินไม่ได้')
  assert.deepEqual(match.hero, start)

  assert.equal(stepHero(match, 'right'), true)
  assert.deepEqual(match.hero, { row: start.row, col: start.col + 1 })

  // สั่งให้ยืนรอ ต้องไม่ไหลต่อเองเหมือนโหมดคนเล่น
  stepHero(match, null)
  assert.deepEqual(match.hero, { row: start.row, col: start.col + 1 })
})

test('ผู้ไล่ล่าเดินช้ากว่าตัวเอกตามค่าความเร็วที่ตั้งไว้', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 0.5 })

  const walked = Array.from({ length: 10 }, () => dueHunters(match, 0.5).length)
  assert.equal(
    walked.reduce((sum, item) => sum + item, 0),
    5,
    'ความเร็ว 0.5 ต้องได้เดิน 5 ครั้งใน 10 จังหวะ'
  )
})

test('สั่งเดินชนกำแพงแล้วผู้ไล่ล่าไม่ขยับ', () => {
  const match = createMatch(findArena('rooms'), { hunters: 1, hunterSpeed: 1 })
  const hunter = match.hunters[0]!
  const before = { ...hunter.at }

  const blocked = DIRECTIONS.map((dir) => dir.name).find(
    (dir) => !walkable(match.arena.grid, stepInto(before, dir).row, stepInto(before, dir).col)
  )

  assert.ok(blocked, 'จุดเกิดนี้ไม่มีกำแพงติดเลย เลือกจุดอื่นมาทดสอบ')
  assert.equal(moveHunter(match, hunter, blocked!), false)
  assert.deepEqual(hunter.at, before)
})

// ---------- โปรแกรมของผู้ไล่ล่า ----------

test('ตัวอย่าง "ไล่ตามทางที่สั้นที่สุด" จับตัวเอกที่ยืนนิ่งได้', () => {
  const match = createMatch(findArena('lattice'), { hunters: 1, hunterSpeed: 1 })
  const agent = agentOf('pursuit')

  const start = closestHunter(match)
  let ticks = 0

  while (ticks < 200) {
    ticks++
    match.tick = ticks

    const heroBefore = { ...match.hero }
    const hunterBefore = match.hunters.map((hunter) => ({ ...hunter.at }))

    hunt(match, agent, 1)
    if (catcher(match, heroBefore, hunterBefore) !== null) break
  }

  assert.ok(ticks < 200, `ไล่ ${ticks} จังหวะแล้วยังจับตัวที่ยืนนิ่งไม่ได้`)
  assert.ok(ticks <= start + 2, `ควรเดินตรงไปเลย ${start} ก้าว แต่ใช้ ${ticks} จังหวะ`)
})

test('ตัวอย่าง "ไล่ตามทางที่สั้นที่สุด" อยู่ไกลจะไปดักที่ของ ไม่ใช่วิ่งตามหลัง', () => {
  const arena = findArena('wide')
  const match = createMatch(arena, { hunters: 1, hunterSpeed: 1 })
  const agent = agentOf('pursuit')

  const hunter = match.hunters[0]!
  hunter.at = { row: 9, col: 17 }
  match.hero = { row: 1, col: 1 }

  const state = viewOf(match, 1000)
  const gem = match.gems.reduce((best, item) =>
    Math.abs(item.row - match.hero.row) + Math.abs(item.col - match.hero.col) <
    Math.abs(best.row - match.hero.row) + Math.abs(best.col - match.hero.col)
      ? item
      : best
  )

  const dir = agent.step({ ...state, me: state.hunters[0]! }) as Direction
  const next = stepInto(hunter.at, dir)

  assert.equal(
    pathLength(arena.grid, next, gem),
    pathLength(arena.grid, hunter.at, gem) - 1,
    'อยู่ไกลแล้วควรเดินเข้าหาของที่ตัวเอกจะเก็บ'
  )
})

test('ตัวอย่าง "แบ่งหน้าที่ดักหน้า" — แต่ละตัวเล็งคนละที่จริง', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 3, hunterSpeed: 1 })
  const agent = agentOf('ambush')

  match.hero = { row: 5, col: 7 }
  match.facing = 'right'

  const state = viewOf(match, 1000)
  const ahead = { row: 5, col: 10 }

  const moves = match.hunters.map((hunter) => {
    const dir = agent.step({ ...state, me: state.hunters[hunter.index]! }) as Direction
    return { hunter, next: stepInto(hunter.at, dir) }
  })

  const [first, second, third] = moves

  assert.equal(
    pathLength(arena.grid, first!.next, match.hero),
    pathLength(arena.grid, first!.hunter.at, match.hero) - 1,
    'ตัวที่ 1 ต้องไล่ตามตัวเอกตรง ๆ'
  )

  assert.equal(
    pathLength(arena.grid, second!.next, ahead),
    pathLength(arena.grid, second!.hunter.at, ahead) - 1,
    'ตัวที่ 2 ต้องไปดักที่ช่องข้างหน้าตัวเอก'
  )

  assert.ok(third, 'ตัวที่ 3 ต้องมีคำสั่งเดินด้วย')
})

test('ตัวอย่าง "เริ่มต้น" ไล่ไม่ค่อยติด — เห็นค่อยไล่ ไม่เห็นก็เดินสุ่ม', () => {
  const match = createMatch(findArena('rooms'), { hunters: 1, hunterSpeed: 1 })
  const agent = agentOf('starter')

  // ยืนคนละห้องกัน มองไม่เห็นกันแน่ ๆ
  match.hero = { row: 3, col: 4 }
  match.hunters[0]!.at = { row: 7, col: 10 }

  const state = viewOf(match, 1000)
  const seen = new Set<string>()

  for (let round = 0; round < 40; round++) {
    const dir = agent.step({ ...state, me: state.hunters[0]! })
    if (dir) seen.add(String(dir))
  }

  assert.ok(seen.size > 1, 'มองไม่เห็นตัวเอกแล้วควรเดินสุ่ม ไม่ใช่เดินทางเดิมทุกครั้ง')
})

test('ทุกคำสั่งเดินที่ตัวอย่างส่งออกมา เป็นทิศที่ระบบรู้จัก', () => {
  const names = DIRECTIONS.map((dir) => dir.name)

  for (const preset of CHASE_PACK.presets) {
    const match = createMatch(findArena('rooms'), { hunters: 4, hunterSpeed: 1 })
    const agent = agentOf(preset.id)
    const state = viewOf(match, 1000)

    for (const hunter of match.hunters) {
      const dir = agent.step({ ...state, me: state.hunters[hunter.index]! })
      assert.ok(
        dir === null || names.includes(dir as Direction),
        `ตัวอย่าง '${preset.id}' คืนค่าแปลก ๆ: ${JSON.stringify(dir)}`
      )
    }
  }
})

test('สิ่งที่ AI มองเห็นเป็นสำเนา — เขียนทับแล้วสนามจริงไม่เปลี่ยน', () => {
  const match = createMatch(findArena('lattice'), { hunters: 2, hunterSpeed: 0.7 })
  const state: ChaseState = viewOf(match, 1000)

  state.grid[1]![1] = 1
  state.gems.length = 0
  state.hero.row = 99

  assert.equal(match.arena.grid[1]![1], 0, 'AI แก้กำแพงในสนามจริงได้')
  assert.ok(match.gems.length > 0, 'AI ลบของในสนามจริงได้')
  assert.equal(match.hero.row, match.arena.hero.row, 'AI ย้ายตัวเอกได้')
})

// ---------- เล่นจริงทั้งรอบ ----------

/**
 * คนเล่นสมมติ — เดินไปเก็บของชิ้นที่ใกล้ที่สุด แต่ถ้าผู้ไล่ล่าจ่ออยู่ในสามช่องก็หลบก่อน
 * ไม่เก่งเท่าคนจริง แต่พอใช้ตอบคำถามว่าเกมนี้ยังชนะได้อยู่ไหม และยากขึ้นจริงไหมเมื่อเพิ่มตัวไล่
 */
function humanMove(match: Match): Direction | null {
  const grid = match.arena.grid
  const fields = match.hunters.map((hunter) => distanceField(grid, hunter.at))

  const risk = (cell: Point) =>
    Math.min(
      ...fields.map((field) => {
        const steps = field[cell.row]![cell.col]!
        return steps < 0 ? 99 : steps
      })
    )

  const goal = exitOpen(match)
    ? match.arena.exit
    : match.gems.reduce(
        (best, gem) => (manhattan(match.hero, gem) < manhattan(match.hero, best) ? gem : best),
        match.gems[0]!
      )

  const options = neighbors(grid, match.hero).map((cell) => ({
    dir: cell.dir,
    risk: risk(cell),
    toGoal: pathLength(grid, cell, goal)
  }))

  if (options.length === 0) return null

  const safe = options.filter((option) => option.risk >= 3)
  const sorted =
    safe.length > 0
      ? safe.sort((a, b) => a.toGoal - b.toGoal)
      : options.sort((a, b) => b.risk - a.risk)

  return sorted[0]!.dir
}

/**
 * เล่นหนึ่งรอบจนจบ — ฝ่ายไล่เป็น AI เสมอ
 * ส่วนฝ่ายหนีจะเป็นคนเล่นสมมติ หรือ AI จาก RUNNER_PACK ก็ได้ ตามที่ส่ง runnerPreset มา
 */
function playRound(
  arenaId: string,
  hunters: number,
  speed: number,
  presetId: string,
  runnerPreset?: string,
  seed?: number
) {
  const match = createMatch(findArena(arenaId), { hunters, hunterSpeed: speed, seed })
  const hunterAgent = agentOf(presetId)
  const runnerAgent = runnerPreset ? agentOf(runnerPreset, RUNNER_PACK) : null

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    match.tick = tick

    const heroBefore = { ...match.hero }

    if (runnerAgent) {
      const state = viewOf(match, 1000)
      const raw = runnerAgent.step({ ...state, me: heroAsMover(match) })
      stepHero(match, typeof raw === 'string' ? (raw as Direction) : null)
    } else {
      const dir = humanMove(match)
      if (dir) aim(match, dir)
      advanceHero(match)
    }

    if (match.over === 'escaped') return { outcome: 'escaped', tick, taken: match.taken }
    if (catcher(match, heroBefore, match.hunters.map((hunter) => ({ ...hunter.at }))) !== null) {
      return { outcome: 'caught', tick, taken: match.taken }
    }

    const before = match.hunters.map((hunter) => ({ ...hunter.at }))
    hunt(match, hunterAgent, speed)

    if (catcher(match, heroBefore, before) !== null) {
      return { outcome: 'caught', tick, taken: match.taken }
    }
  }

  return { outcome: 'timeout', tick: TICK_LIMIT, taken: match.taken }
}

test('เกมนี้ยังชนะได้ — ระดับง่ายแล้วคนเล่นหนีออกไปได้', () => {
  const round = playRound('rooms', 2, 0.5, 'pursuit')

  assert.equal(round.outcome, 'escaped', `เล่นดี ๆ แล้วยังไม่รอด (${round.outcome} ที่จังหวะ ${round.tick})`)
  assert.equal(round.taken, findArena('rooms').gems.length, 'ออกได้ทั้งที่เก็บของไม่ครบ')
})

test('เพิ่มผู้ไล่ล่าแล้วยากขึ้นจริง — สี่ตัวความเร็วสูงจับคนเล่นชุดเดียวกันได้', () => {
  const easy = playRound('lattice', 2, 0.65, 'ambush')
  const hard = playRound('lattice', 4, 0.8, 'ambush')

  assert.equal(easy.outcome, 'escaped', 'สองตัวก็ยังจับได้ เกมยากเกินไปตั้งแต่ต้น')
  assert.equal(hard.outcome, 'caught', 'เพิ่มเป็นสี่ตัวแล้วยังจับไม่ได้ ปุ่มปรับความยากไม่มีความหมาย')
  assert.ok(hard.tick < easy.tick, 'ยากขึ้นแล้วควรจบเร็วขึ้น')
})

// ---------- AI ฝ่ายหนี ----------

test('ตัวอย่าง "เก็บของอย่างเดียว" เดินเข้าหาของที่ใกล้ที่สุด โดยไม่สนผู้ไล่ล่า', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 1, hunterSpeed: 0.7 })
  const agent = agentOf('collector', RUNNER_PACK)

  // วางผู้ไล่ล่าไว้ระหว่างเรากับของ ถ้ามันไม่สนจริงก็จะเดินเข้าไปหา
  const gem = match.gems.reduce((best, item) =>
    pathLength(arena.grid, match.hero, item) < pathLength(arena.grid, match.hero, best) ? item : best
  )

  const state = viewOf(match, 1000)
  const dir = agent.step({ ...state, me: heroAsMover(match) }) as Direction
  const next = stepInto(match.hero, dir)

  assert.equal(
    pathLength(arena.grid, next, gem),
    pathLength(arena.grid, match.hero, gem) - 1,
    'ต้องเข้าใกล้ของชิ้นที่ใกล้ที่สุดหนึ่งก้าว'
  )
})

test('ตัวอย่าง "ใกล้ก็หนีก่อน" ถอยออกห่างเมื่อผู้ไล่ล่าจ่อ แล้วกลับไปเก็บของเมื่อพ้นระยะ', () => {
  const arena = findArena('lattice')
  const agent = agentOf('evade', RUNNER_PACK)

  const near = createMatch(arena, { hunters: 1, hunterSpeed: 0.7 })
  near.hero = { row: 3, col: 7 }
  near.hunters[0]!.at = { row: 3, col: 9 }

  const beforeGap = pathLength(arena.grid, near.hero, near.hunters[0]!.at)
  const state = viewOf(near, 1000)
  const dir = agent.step({ ...state, me: heroAsMover(near) }) as Direction
  const next = stepInto(near.hero, dir)

  assert.ok(
    pathLength(arena.grid, next, near.hunters[0]!.at) > beforeGap,
    'ผู้ไล่ล่าจ่ออยู่สองช่องแล้วยังไม่ถอย'
  )

  const far = createMatch(arena, { hunters: 1, hunterSpeed: 0.7 })
  far.hero = { row: 1, col: 1 }
  far.hunters[0]!.at = { row: 9, col: 13 }

  const goal = far.gems.reduce((best, item) =>
    pathLength(arena.grid, far.hero, item) < pathLength(arena.grid, far.hero, best) ? item : best
  )

  const calm = viewOf(far, 1000)
  const away = agent.step({ ...calm, me: heroAsMover(far) }) as Direction

  assert.equal(
    pathLength(arena.grid, stepInto(far.hero, away), goal),
    pathLength(arena.grid, far.hero, goal) - 1,
    'ไม่มีใครใกล้แล้วต้องกลับไปเก็บของ'
  )
})

test('ทุกคำสั่งเดินของตัวอย่างฝ่ายหนี เป็นทิศที่ระบบรู้จัก', () => {
  const names = DIRECTIONS.map((dir) => dir.name)

  for (const preset of RUNNER_PACK.presets) {
    const match = createMatch(findArena('rooms'), { hunters: 3, hunterSpeed: 0.7 })
    const agent = agentOf(preset.id, RUNNER_PACK)
    const state = viewOf(match, 1000)

    const dir = agent.step({ ...state, me: heroAsMover(match) })
    assert.ok(
      dir === null || names.includes(dir as Direction),
      `ตัวอย่าง '${preset.id}' คืนค่าแปลก ๆ: ${JSON.stringify(dir)}`
    )
  }
})

test('AI ฝ่ายหนีที่รู้จักหลบ อยู่รอดนานกว่าตัวที่เก็บของอย่างเดียว', () => {
  const hunter = 'pursuit'

  const blind = playRound('lattice', 2, 0.65, hunter, 'collector')
  const careful = playRound('lattice', 2, 0.65, hunter, 'evade')
  const weighted = playRound('lattice', 2, 0.65, hunter, 'field')

  assert.equal(blind.outcome, 'caught', 'ตัวที่ไม่สนใจใครเลยกลับรอด — เกมง่ายเกินไปแล้ว')

  for (const [name, round] of [['ใกล้ก็หนีก่อน', careful], ['ชั่งน้ำหนักทุกก้าว', weighted]] as const) {
    assert.ok(
      round.tick > blind.tick,
      `'${name}' ต้องอยู่รอดนานกว่าตัวที่เก็บของอย่างเดียว (${round.tick} vs ${blind.tick})`
    )
  }
})

// ---------- ตัวเลขในหน้าความรู้ ต้องมาจากการเล่นจริง ----------

/** สนามมาตรฐานที่หน้าความรู้ของฝ่ายหนีทั้งสองหน้าอ้างถึง */
const DUEL = { arena: 'lattice', hunters: 2, speed: 0.65, hunter: 'pursuit' } as const

const textOf = (slug: string) => TOPICS.find((topic) => topic.slug === slug)!.inGame

test('หน้า "ชั้นความปลอดภัยมาก่อน" — ตัวเลขที่เขียนไว้ยังตรงกับผลจริง', () => {
  const round = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, DUEL.hunter, 'evade')
  const blind = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, DUEL.hunter, 'collector')
  const total = findArena(DUEL.arena).gems.length

  assert.equal(round.outcome, 'caught', `ตอนนี้ได้ผล '${round.outcome}' ไม่ใช่ถูกจับแล้ว`)
  assert.equal(round.tick, 38, `ยื้อได้ถึงจังหวะที่ ${round.tick} ไม่ใช่ 38 แล้ว`)
  assert.equal(round.taken, 4, `เก็บของได้ ${round.taken} ชิ้น ไม่ใช่ 4 ชิ้นแล้ว`)
  assert.equal(blind.tick, 9, `ตัวที่ไม่ระวังโดนจับที่จังหวะ ${blind.tick} ไม่ใช่ 9 แล้ว`)

  const text = textOf('layered-safety')
  for (const number of ['38', '4', String(total), '9']) {
    assert.ok(text.includes(number), `หน้าความรู้ไม่ได้พูดถึงเลข ${number} แล้ว`)
  }
})

test('หน้า "สนามแรงดึงและแรงผลัก" — ตัวเลขที่เขียนไว้ยังตรงกับผลจริง', () => {
  const round = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, DUEL.hunter, 'field')
  const total = findArena(DUEL.arena).gems.length

  assert.equal(round.outcome, 'escaped', `ตอนนี้ได้ผล '${round.outcome}' ไม่ใช่หนีรอดแล้ว`)
  assert.equal(round.taken, total, 'หนีออกได้ทั้งที่เก็บของไม่ครบ')

  assert.equal(round.tick, 68, `ออกประตูที่จังหวะ ${round.tick} ไม่ใช่ 68 แล้ว`)

  const text = textOf('potential-field')
  for (const number of [String(round.tick), String(total)]) {
    assert.ok(text.includes(number), `หน้าความรู้ไม่ได้พูดถึงเลข ${number} แล้ว`)
  }
})

test('ภาพประกอบของฝ่ายหนี เดินมาจากบล็อกจริง ไม่ใช่วาดทิ้งไว้', () => {
  for (const [slug, presetId] of [
    ['layered-safety', 'evade'],
    ['potential-field', 'field']
  ] as const) {
    const figure = figureFor(slug)!
    assert.equal(figure.kind, 'chase', `${slug}: ไม่ใช่ภาพของเกมไล่จับ`)
    if (figure.kind !== 'chase') continue

    // เดินซ้ำด้วยตัวอย่างจริงจำนวนจังหวะเท่ากับในภาพ แล้วต้องได้สนามหน้าตาเดียวกันเป๊ะ
    const match = createMatch(findArena(DUEL.arena), {
      hunters: DUEL.hunters,
      hunterSpeed: DUEL.speed
    })
    const runner = agentOf(presetId, RUNNER_PACK)
    const hunters = agentOf(DUEL.hunter)

    for (let tick = 1; tick <= figure.match.tick; tick++) {
      match.tick = tick

      const state = viewOf(match, 1000)
      const raw = runner.step({ ...state, me: heroAsMover(match) })
      stepHero(match, typeof raw === 'string' ? (raw as Direction) : null)

      hunt(match, hunters, DUEL.speed)
    }

    assert.deepEqual(match.hero, figure.match.hero, `${slug}: ตำแหน่งคนหนีในภาพไม่ตรงกับของจริง`)
    assert.deepEqual(
      match.hunters.map((hunter) => hunter.at),
      figure.match.hunters.map((hunter) => hunter.at),
      `${slug}: ตำแหน่งผู้ไล่ล่าในภาพไม่ตรงกับของจริง`
    )
    assert.equal(match.taken, figure.match.taken, `${slug}: จำนวนของที่เก็บในภาพไม่ตรงกับของจริง`)
  }
})

test('หน้า "ไล่ต้อนเป็นทีม" — ตัวเลขที่เขียนไว้ยังตรงกับผลจริง', () => {
  const evade = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, 'encircle', 'evade')
  const field = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, 'encircle', 'field')

  assert.equal(evade.outcome, 'caught', `จับ 'ใกล้ก็หนีก่อน' ไม่ได้แล้ว (${evade.outcome})`)
  assert.equal(evade.tick, 15, `จับได้ที่จังหวะ ${evade.tick} ไม่ใช่ 15 แล้ว`)

  assert.equal(field.outcome, 'caught', `จับ 'ชั่งน้ำหนักทุกก้าว' ไม่ได้แล้ว (${field.outcome})`)
  assert.equal(field.tick, 21, `จับได้ที่จังหวะ ${field.tick} ไม่ใช่ 21 แล้ว`)

  const text = textOf('encirclement')
  for (const number of ['15', '21', '60', '26']) {
    assert.ok(text.includes(number), `หน้าความรู้ไม่ได้พูดถึงเลข ${number} แล้ว`)
  }
})

/** ตัวสุ่มที่ให้ลำดับเดิมทุกครั้ง — ตัวอย่าง "เริ่มต้น" ของฝ่ายไล่เดินสุ่ม ไม่ล็อกไว้ผลจะไม่ซ้ำเดิม */
function seededRandom(seed: number): () => number {
  let state = seed

  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('"ไล่ต้อนเป็นทีม" โหดกว่าทุกชุดที่มี — จับคนหนีที่รู้จักหลบได้เร็วกว่าเสมอ', () => {
  const others = CHASE_PACK.presets.filter((preset) => preset.id !== 'encircle')
  const realRandom = Math.random

  try {
    Math.random = seededRandom(98317)

    for (const runner of ['evade', 'field'] as const) {
      const best = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, 'encircle', runner)
      assert.equal(best.outcome, 'caught', `ชุดโหดจับ '${runner}' ไม่ได้`)

      for (const preset of others) {
        const round = playRound(DUEL.arena, DUEL.hunters, DUEL.speed, preset.id, runner)

        assert.ok(
          round.outcome !== 'caught' || round.tick > best.tick,
          `'${preset.name}' จับ '${runner}' ได้ที่จังหวะ ${round.tick} ซึ่งไม่ช้ากว่าชุดโหดที่ ${best.tick} — ชุดโหดไม่โหดจริงแล้ว`
        )
      }
    }
  } finally {
    Math.random = realRandom
  }
})

test('เส้นแบ่งที่หน้าความรู้อ้าง — ตัวเดียวจับ AI ที่หลบเป็นไม่ได้เลย สองตัวจับได้ทุกสนาม', () => {
  for (const arena of ARENAS) {
    const alone = playRound(arena.id, 1, DUEL.speed, 'encircle', 'evade')
    assert.equal(
      alone.outcome,
      'timeout',
      `${arena.id}: ตัวเดียวได้ผล '${alone.outcome}' กับ 'ใกล้ก็หนีก่อน' ไม่ใช่ไล่จนหมดเวลาแล้ว — ข้อความในหน้าความรู้ต้องแก้`
    )

    for (const runner of ['evade', 'field'] as const) {
      const pair = playRound(arena.id, 2, DUEL.speed, 'encircle', runner)
      assert.equal(
        pair.outcome,
        'caught',
        `${arena.id}: สองตัวจับ '${runner}' ไม่ได้ (${pair.outcome}) — ข้อความในหน้าความรู้ต้องแก้`
      )
    }
  }
})

// ---------- ผู้ไล่ล่าหลายตัวต้องเป็นหลายตัวจริง ----------

test('ผู้ไล่ล่ายืนทับกันไม่ได้ — สั่งเดินไปช่องที่เพื่อนยืนอยู่แล้วไม่ขยับ', () => {
  const match = createMatch(findArena('lattice'), { hunters: 2, hunterSpeed: 1 })
  const [first, second] = match.hunters

  first!.at = { row: 3, col: 7 }
  second!.at = { row: 3, col: 8 }

  assert.equal(moveHunter(match, first!, 'right'), false, 'เดินทับเพื่อนได้')
  assert.deepEqual(first!.at, { row: 3, col: 7 })

  // เพื่อนขยับออกไปก่อนแล้วค่อยเดินตาม ทำได้ปกติ
  assert.equal(moveHunter(match, second!, 'right'), true)
  assert.equal(moveHunter(match, first!, 'right'), true)
  assert.deepEqual(first!.at, { row: 3, col: 8 })
})

test('เล่นทั้งรอบด้วยผู้ไล่ล่าสี่ตัว ก็ไม่มีจังหวะไหนที่ยืนซ้อนกัน', () => {
  const match = createMatch(findArena('lattice'), { hunters: 4, hunterSpeed: 0.8 })
  const hunters = agentOf('ambush')
  const runner = agentOf('field', RUNNER_PACK)

  for (let tick = 1; tick <= 80; tick++) {
    match.tick = tick

    const heroBefore = { ...match.hero }
    const view = viewOf(match, 1000)
    const raw = runner.step({ ...view, me: heroAsMover(match) })
    stepHero(match, typeof raw === 'string' ? (raw as Direction) : null)

    if (match.over) break
    if (catcher(match, heroBefore, match.hunters.map((hunter) => ({ ...hunter.at }))) !== null) break

    const before = match.hunters.map((hunter) => ({ ...hunter.at }))
    hunt(match, hunters, 0.8)

    const spots = new Set(match.hunters.map((hunter) => `${hunter.at.row},${hunter.at.col}`))
    assert.equal(spots.size, match.hunters.length, `จังหวะที่ ${tick} มีผู้ไล่ล่ายืนทับกัน`)

    if (catcher(match, heroBefore, before) !== null) break
  }
})

test('บล็อก "ไม่เบียดเพื่อน" เลี่ยงทางที่เพื่อนอยู่ เมื่อสองทางสั้นเท่ากัน', () => {
  const arena = findArena('lattice')
  const hero = { row: 1, col: 7 }
  const me = { row: 3, col: 4 }

  const up = { row: 2, col: 4 }
  const right = { row: 3, col: 5 }

  // ตั้งฉากให้สองทางนี้สั้นเท่ากันจริง ๆ ก่อน ไม่งั้นเทสต์ไม่ได้วัดสิ่งที่ตั้งใจวัด
  assert.equal(
    pathLength(arena.grid, up, hero),
    pathLength(arena.grid, right, hero),
    'ฉากทดสอบเปลี่ยนไปแล้ว — สองทางไม่ได้สั้นเท่ากัน'
  )

  const choose = (mate: Point): Direction => {
    const match = createMatch(arena, { hunters: 2, hunterSpeed: 1 })
    match.hero = { ...hero }
    match.hunters[0]!.at = { ...me }
    match.hunters[1]!.at = { ...mate }

    const node = createBlock('chase.spread-step')
    node.fields.target = 'hero'

    const program = normalize({ name: 'ลองไม่เบียด', scripts: { 'chase.on-turn': [node] } }, CHASE_PACK)
    const { code } = generate(program, CHASE_PACK)
    const factory = new Function(
      'ChaseAgent',
      ...Object.keys(AGENT_GLOBALS),
      `"use strict";\n${code}\n;return Agent;`
    )
    const agent = new (factory(ChaseAgent, ...Object.values(AGENT_GLOBALS)))() as ChaseAgent

    const state = viewOf(match, 1000)
    return agent.step({ ...state, me: state.hunters[0]! }) as Direction
  }

  assert.equal(choose({ row: 1, col: 4 }), 'right', 'เพื่อนอยู่ทางบน แต่ยังเลือกเดินขึ้น')
  assert.equal(choose({ row: 3, col: 6 }), 'up', 'เพื่อนอยู่ทางขวา แต่ยังเลือกเดินขวา')
})

// ---------- เมล็ดสุ่มประจำรอบ ----------

/**
 * กติกากับ AI เป็นสูตรตายตัว ถ้าสนามตั้งต้นเหมือนเดิมด้วย ทุกรอบก็เดินซ้ำรอยเดิมแล้วไปจบที่เดิม
 * เมล็ดสุ่มจึงเปลี่ยนแค่ "ฉากตั้งต้น" คือใครเกิดมุมไหนและใครออกตัวก่อน — ไม่แตะกติกาหรือวิธีคิดของ AI
 */
test('ไม่ส่งเมล็ดมา ได้สนามตั้งต้นแบบเดิมเป๊ะ — หน้าความรู้กับภาพประกอบพึ่งข้อนี้อยู่', () => {
  const arena = findArena('lattice')
  const match = createMatch(arena, { hunters: 3, hunterSpeed: 0.65 })

  assert.deepEqual(
    match.hunters.map((hunter) => hunter.at),
    arena.homes.slice(0, 3),
    'จุดเกิดต้องเรียงตามหมายเลขตัวเหมือนเดิม'
  )

  for (const hunter of match.hunters) assert.equal(hunter.credit, 0, 'ทุกตัวต้องออกตัวพร้อมกัน')
})

test('เมล็ดเดียวกันได้สนามเดียวกันเป๊ะ — ย้อนดูรอบเดิมซ้ำได้', () => {
  const arena = findArena('rooms')
  const first = createMatch(arena, { hunters: 3, hunterSpeed: 0.65, seed: 4242 })
  const again = createMatch(arena, { hunters: 3, hunterSpeed: 0.65, seed: 4242 })

  assert.deepEqual(
    again.hunters.map((hunter) => ({ at: hunter.at, credit: hunter.credit })),
    first.hunters.map((hunter) => ({ at: hunter.at, credit: hunter.credit }))
  )
})

test('เมล็ดต่างกันได้ฉากตั้งต้นต่างกันจริง ทั้งมุมที่เกิดและจังหวะออกตัว', () => {
  const arena = findArena('lattice')

  const scenes = Array.from({ length: 12 }, (_, index) =>
    createMatch(arena, { hunters: 2, hunterSpeed: 0.65, seed: 1000 + index * 137 })
  )

  const spots = new Set(
    scenes.map((match) => match.hunters.map((hunter) => `${hunter.at.row},${hunter.at.col}`).join(' '))
  )
  const starts = new Set(scenes.map((match) => match.hunters.map((hunter) => hunter.credit).join(' ')))

  assert.ok(spots.size >= 4, `12 เมล็ดได้จุดเกิดแค่ ${spots.size} แบบ — ยังซ้ำเดิมเกินไป`)
  assert.ok(starts.size >= 8, `12 เมล็ดได้จังหวะออกตัวแค่ ${starts.size} แบบ`)

  for (const match of scenes) {
    const used = new Set(match.hunters.map((hunter) => `${hunter.at.row},${hunter.at.col}`))
    assert.equal(used.size, match.hunters.length, 'สองตัวเกิดทับกันไม่ได้')

    for (const hunter of match.hunters) {
      assert.ok(
        arena.homes.some((home) => same(home, hunter.at)),
        'ต้องเกิดที่จุดเกิดที่สนามกำหนดไว้เท่านั้น'
      )
      assert.ok(hunter.credit >= 0 && hunter.credit < 1, 'เศษก้าวตั้งต้นต้องอยู่ใน 0–1')
    }
  }
})

test('ฉากตั้งต้นที่ต่างกัน ทำให้รอบจบไม่เหมือนเดิม', () => {
  const outcomes = new Set<string>()

  for (let index = 0; index < 8; index++) {
    const round = playRound('lattice', 2, 0.65, 'ambush', 'evade', 1000 + index * 137)
    outcomes.add(`${round.outcome}@${round.tick}`)
  }

  assert.ok(outcomes.size >= 5, `เล่น 8 รอบได้ผลแค่ ${outcomes.size} แบบ — ยังซ้ำเดิมเกินไป`)
})
