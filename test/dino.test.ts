import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { DINO_SPACE, DinoAgent, viewOf, type DinoMemory } from '~/game/dino/agent'
import { readSwarm } from '~/game/line/swarm'
import { DINO_SWARM_FOUND } from '~/data/algorithm-figures'
import { TOPICS } from '~/data/algorithms'
import { ART, BODY, DUCK_CLEAR, FLOCK, HOP_TOP, birdBox } from '~/game/dino/art'
import {
  AIR_TIME,
  COURSES,
  DECIDE_EVERY,
  GRAVITY,
  JUMP_PEAK,
  JUMP_SPEED,
  LEVEL_SPAN,
  advance,
  canDuckUnder,
  createRun,
  duck,
  findCourse,
  gapRangeAt,
  jump,
  levelAt,
  metersOf,
  onGround,
  order,
  speedAt,
  speedOf,
  type Action,
  type Obstacle,
  type Run
} from '~/game/dino/engine'

function agentOf(presetId: string): DinoAgent {
  const preset = DINO_PACK.presets.find((item) => item.id === presetId)
  assert.ok(preset, `ไม่มีตัวอย่างชื่อ '${presetId}'`)

  const { code } = generate(normalize(preset.build(), DINO_PACK), DINO_PACK)
  const factory = new Function(
    'DinoAgent',
    'AIR_TIME',
    'JUMP_PEAK',
    `"use strict";\n${code}\n;return Agent;`
  )

  const Agent = factory(DinoAgent, AIR_TIME, JUMP_PEAK)
  return new Agent() as DinoAgent
}

/** เล่นจนชน หรือจนครบเวลาในเกมที่กำหนด */
function play(presetId: string, courseId: string, seed: number, limitSeconds = 120): Run {
  const agent = agentOf(presetId)
  const run = createRun({ courseId, seed })

  while (!run.over && run.time < limitSeconds) {
    const action = (agent.step(viewOf(run, 500)) ?? 'run') as Action
    order(run, action)
    for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
  }

  return run
}

/** เดินฟิสิกส์ไปเฉย ๆ โดยไม่สั่งอะไร */
function coast(run: Run, seconds: number): void {
  const frames = Math.round(seconds * 60)
  for (let frame = 0; frame < frames && !run.over; frame++) advance(run)
}

test('กระโดดหนึ่งครั้งลอยนานเท่าที่คำนวณไว้ แล้วกลับมาแตะพื้นพอดี', () => {
  const run = createRun({ courseId: 'practice', seed: 1 })

  assert.ok(onGround(run), 'เริ่มมาต้องอยู่บนพื้น')
  assert.ok(jump(run), 'สั่งกระโดดตอนอยู่บนพื้นต้องได้')
  assert.equal(jump(run), false, 'กระโดดซ้อนกลางอากาศไม่ได้')

  // ครึ่งทางของการลอย ต้องอยู่สูงสุด และสูงพอจะข้ามของที่สูงที่สุดในเกม
  coast(run, AIR_TIME / 2)
  const tallest = Math.max(...Object.values(ART).map((art) => art.box.bottom + art.box.height))
  assert.ok(run.y > 0, 'กลางอากาศต้องลอยอยู่')
  assert.ok(
    JUMP_PEAK > ART.rock.box.height,
    `กระโดดสูง ${JUMP_PEAK.toFixed(1)} ต้องมากกว่าก้อนหินที่สูง ${ART.rock.box.height}`
  )
  assert.ok(
    JUMP_PEAK + BODY.stand.height < tallest + BODY.stand.height + 100,
    'ความสูงของการกระโดดต้องอยู่ในช่วงที่เทียบกับของในเกมได้'
  )

  coast(run, AIR_TIME / 2 + 0.05)
  assert.ok(onGround(run), 'ครบเวลาลอยแล้วต้องกลับมาอยู่บนพื้น')
  assert.equal(run.y, 0)
})

test('ตัวเลขฟิสิกส์สอดคล้องกันเอง — เวลาลอยกับความสูงมาจากแรงโน้มถ่วงชุดเดียวกัน', () => {
  assert.ok(Math.abs(AIR_TIME - (2 * JUMP_SPEED) / GRAVITY) < 1e-9)
  assert.ok(Math.abs(JUMP_PEAK - (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)) < 1e-9)
})

test('นกมาทีละตัวหรือสองตัว บินสูงต่ำไม่เท่ากัน แต่ทุกฝูงกระโดดข้ามได้หรือหมอบลอดได้เสมอ', () => {
  const counts = new Set<number>()
  const bottoms = new Set<number>()
  let low = 0
  let birds = 0

  for (const course of COURSES) {
    for (let seed = 1; seed <= 40; seed++) {
      const run = createRun({ courseId: course.id, seed })
      const seen: Obstacle[] = []

      // กระโดดข้ามไปทีละช่วง แล้วให้เอนจินเติมของข้างหน้าใหม่ — ได้ตัวอย่างนกจากหลายระดับความเร็ว
      for (let hop = 1; hop <= 10; hop++) {
        run.distance = hop * 3000
        run.frontier = run.distance
        run.obstacles = []
        advance(run)
        seen.push(...run.obstacles)
      }

      for (const item of seen.filter((obstacle) => obstacle.kind === 'bird')) {
        birds++
        counts.add(item.count)
        bottoms.add(item.box.bottom)

        const top = item.box.bottom + item.box.height
        const duckable = canDuckUnder(item.box)
        const hoppable = top <= HOP_TOP
        assert.ok(duckable || hoppable, `นกขอบล่าง ${item.box.bottom} ยอด ${top} — หมอบก็ไม่พ้น กระโดดก็ไม่พ้น`)

        if (!duckable) low++
        if (item.count === 2) assert.ok(top > JUMP_PEAK, 'ฝูงสองตัวต้องกระโดดไม่พ้น ไม่งั้นบล็อกหมอบก็ไม่มีความหมาย')
      }
    }
  }

  assert.ok(birds > 50, 'สุ่มแล้วต้องเจอนกมากพอจะตรวจ')
  assert.deepEqual([...counts].sort(), [1, 2], 'ต้องมีทั้งแบบตัวเดียวและฝูงสองตัว')
  assert.ok(bottoms.size >= 10, 'ความสูงต้องสุ่มจริง ไม่ใช่มีแค่ไม่กี่ระดับ')
  assert.ok(low > 0, 'ต้องมีนกบินเรี่ยพื้นที่ต้องกระโดด — ไม่งั้น "เป็นนกก็หมอบ" จะถูกเสมอ')
  assert.ok(HOP_TOP < JUMP_PEAK && DUCK_CLEAR >= BODY.duck.height)
})

/** วางสิ่งกีดขวางชิ้นเดียวข้างหน้าที่ความเร็วนั้น แล้วลองสั่งท่าทุกจังหวะ — มีสักจังหวะที่รอดไหม */
function passable(box: { width: number; height: number; bottom: number }, count: number, speed: number): boolean {
  const course = findCourse('classic')
  const distance = ((speed - course.startSpeed) / course.speedStep) * course.speedEvery
  const action: Action = canDuckUnder(box) ? 'duck' : 'jump'

  for (let wait = 0; wait < 60; wait++) {
    const run = createRun({ courseId: 'classic', seed: 1 })
    run.distance = distance
    run.frontier = Number.MAX_SAFE_INTEGER
    run.obstacles = [{ id: 1, art: 'bird', kind: 'bird', x: distance + BODY.stand.width + speed * 0.9, box, count }]

    for (let tick = 0; tick < 90 && !run.over; tick++) {
      order(run, tick >= wait ? action : 'run')
      for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
    }

    if (!run.over) return true
  }

  return false
}

test('นกทุกความสูงที่สุ่มได้ ผ่านได้จริงทั้งตอนวิ่งช้าและวิ่งเร็วมาก', () => {
  const cases = [
    [1, FLOCK.low.min],
    [1, FLOCK.low.max],
    [1, FLOCK.high.min],
    [1, FLOCK.high.max],
    [2, FLOCK.pair.min],
    [2, FLOCK.pair.max]
  ] as const

  for (const [count, bottom] of cases) {
    for (const speed of [300, 2500]) {
      assert.ok(
        passable(birdBox(count, bottom), count, speed),
        `นก ${count} ตัว ขอบล่าง ${bottom} ที่ความเร็ว ${speed} ผ่านไม่ได้เลยสักจังหวะ`
      )
    }
  }
})

test('ของบนพื้นทุกแบบกระโดดข้ามได้ และหมอบแล้วไม่พ้น', () => {
  for (const art of ['barrel', 'stump', 'rock'] as const) {
    const box = ART[art].box
    assert.equal(box.bottom, 0, `${art} ต้องอยู่ติดพื้น`)
    assert.ok(box.height < JUMP_PEAK, `${art} สูง ${box.height} ต้องต่ำกว่าความสูงที่กระโดดได้`)
    assert.ok(box.height > BODY.duck.height, `${art} ต้องสูงกว่าหัวตอนหมอบ หมอบจึงไม่ช่วย`)
  }
})

test('หมอบกลางอากาศไม่ได้ และหมอบแล้วกล่องชนเตี้ยลงจริง', () => {
  const run = createRun({ courseId: 'practice', seed: 2 })

  assert.ok(duck(run, true))
  assert.equal(run.ducking, true)

  duck(run, false)
  jump(run)
  assert.equal(duck(run, true), false, 'กลางอากาศหมอบไม่ได้')
})

test('รอบเดียวกันเล่นซ้ำได้ผลเดิมเป๊ะ — เมล็ดสุ่มเดิมกับคำสั่งเดิม', () => {
  const first = play('reflex', 'classic', 7)
  const second = play('reflex', 'classic', 7)

  assert.equal(second.distance, first.distance)
  assert.equal(second.cleared, first.cleared)
  assert.equal(second.jumps, first.jumps)
  assert.equal(second.ducks, first.ducks)
})

test('ความเร็วไต่ขึ้นเรื่อย ๆ ไม่มีเพดาน — นี่คือสิ่งที่ทำให้ทุกกฎแพ้ในที่สุด', () => {
  const course = findCourse('classic')

  assert.ok(speedAt(course, 0) === course.startSpeed)
  assert.ok(speedAt(course, 50_000) > speedAt(course, 10_000))
  assert.ok(speedAt(course, 10_000) > speedAt(course, 1_000))
})

test('ระดับขึ้นตามระยะ และของถี่ขึ้นตามระดับ แต่ไม่ถี่กว่าเวลาที่ใช้กระโดด', () => {
  assert.equal(levelAt(0), 1)
  assert.equal(levelAt(LEVEL_SPAN), 2)
  assert.equal(levelAt(LEVEL_SPAN * 5 + 10), 6)

  const course = findCourse('classic')
  const early = gapRangeAt(course, 0)
  const late = gapRangeAt(course, LEVEL_SPAN * 20)

  assert.ok(late.min <= early.min, 'ระดับสูงขึ้นแล้วของต้องถี่ขึ้น')
  assert.ok(late.min >= AIR_TIME, 'ช่องว่างต้องไม่แคบกว่าเวลาที่ใช้กระโดดหนึ่งครั้ง')
})

for (const course of COURSES) {
  test(`${course.id} — ตัวอย่าง "เผื่อระยะตามความเร็ว (reflex agent)" ไปได้ไกลกว่า "ใกล้แล้วค่อยกระโดด" ทุกเมล็ด`, () => {
    for (const seed of [1, 2, 3]) {
      const naive = play('starter', course.id, seed)
      const smart = play('reflex', course.id, seed)

      assert.ok(
        smart.distance > naive.distance * 1.5,
        `เมล็ด ${seed}: กฎที่คิดจากความเร็วไปได้ ${metersOf(smart.distance)} ม. ` +
          `ส่วนกฎระยะตายตัวไปได้ ${metersOf(naive.distance)} ม. — ต่างกันน้อยเกินกว่าจะเป็นบทเรียน`
      )
    }
  })
}

test('สองตัวอย่างที่คิดถูก ให้ผลเหมือนกันเป๊ะ — เพราะเป็นกฎเดียวกันที่เขียนคนละหน่วย', () => {
  for (const seed of [1, 5, 9]) {
    const byDistance = play('reflex', 'classic', seed)
    const byTime = play('countdown', 'classic', seed)

    assert.equal(metersOf(byTime.distance), metersOf(byDistance.distance))
  }
})

test('ตัวอย่างที่ไม่เคยหมอบ ต้องตายกับฝูงนกในลู่ที่มีนก', () => {
  const run = play('starter', 'classic', 3)

  assert.equal(run.over, 'crashed')
  assert.ok(run.ducks === 0, 'ตัวอย่างนี้ไม่ควรหมอบเลยสักครั้ง')
})

test('ทุกรอบจบด้วยการชนเสมอ ไม่มีเส้นชัยให้ถึง', () => {
  const run = play('reflex', 'express', 4, 300)

  assert.equal(run.over, 'crashed', 'ความเร็วที่ไต่ขึ้นไม่มีเพดาน ทำให้ท้ายที่สุดต้องชน')
  assert.ok(run.distance > 1000, 'แต่ก็ต้องไปได้ไกลพอสมควรก่อนจะชน')
})

test('ของแคบที่สุดไม่ทะลุตัวไปได้แม้ตอนวิ่งเร็วมาก', () => {
  const run = createRun({ courseId: 'express', seed: 11 })

  // ดันให้ไปอยู่ช่วงความเร็วสูง แล้วปล่อยวิ่งชนโดยไม่หลบ
  run.distance = 60_000
  run.frontier = run.distance
  run.obstacles = []
  const fast = speedOf(run)
  assert.ok(fast > 2000, `ต้องเร็วจริง ๆ ถึงจะทดสอบได้ — ตอนนี้ ${fast.toFixed(0)} px/วิ`)

  coast(run, 20)
  assert.equal(run.over, 'crashed', 'วิ่งชนโดยไม่หลบ ต้องชนเสมอ ไม่ใช่วิ่งทะลุผ่านไป')
})

test('ตัวอย่างที่ไม่ได้ใช้หัวบล็อกเริ่มวิ่ง/ชน ไม่มีเมธอดเปล่า ๆ โผล่ในโค้ด', () => {
  for (const id of ['starter', 'reflex', 'countdown']) {
    const preset = DINO_PACK.presets.find((item) => item.id === id)!
    const { code } = generate(normalize(preset.build(), DINO_PACK), DINO_PACK)
    assert.ok(!code.includes('onStart(') && !code.includes('onFinish('), `${id} มีเมธอดที่ไม่ได้ใช้`)
  }
})

/** Math.random ที่ล็อกเมล็ดไว้ — GA สุ่มยีนเอง ต้องล็อกถึงจะวัดซ้ำได้ */
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

/** ฝึก GA หนึ่งการทดลอง — ความจำส่งต่อข้ามรอบแบบเดียวกับที่ worker ทำ คืนระยะของแต่ละรอบ (เมตร) */
function evolve(trial: number, runs: number): { meters: number[]; memory: DinoMemory | null } {
  let memory: DinoMemory | null = null
  const meters: number[] = []

  for (let round = 0; round < runs; round++) {
    const agent = agentOf('evolve')
    agent.memory = memory
    agent.saveMemory = (data) => {
      memory = data
      agent.memory = data
    }

    const run = createRun({ courseId: 'classic', seed: trial * 1000 + round })
    agent.onStart(viewOf(run, 500))

    while (!run.over) {
      order(run, (agent.step(viewOf(run, 500)) ?? 'run') as Action)
      for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
    }

    agent.onFinish(viewOf(run, 500))
    meters.push(metersOf(run.distance))
  }

  return { meters, memory }
}

test('GA — ฝึกแล้วไปได้ไกลขึ้น และตัวเลขในหน้าความรู้ยังตรง', () => {
  const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length
  const firsts: number[] = []
  const lasts: number[] = []

  for (let trial = 1; trial <= 10; trial++) {
    const { meters, memory } = withSeededRandom(20260921 + trial, () => evolve(trial, 30))

    const genes = memory?.a
    assert.ok(Array.isArray(genes) && genes.length === 2, 'ต้องจำยีนสองตัวไว้ข้ามรอบ')
    firsts.push(average(meters.slice(0, 5)))
    lasts.push(average(meters.slice(-5)))
  }

  const first = Math.round(average(firsts))
  const last = Math.round(average(lasts))
  assert.deepEqual({ first, last }, { first: 5197, last: 7040 })

  const text = TOPICS.find((topic) => topic.slug === 'evolved-timing')!.inGame
  for (const number of ['5,197', '7,040']) {
    assert.ok(text.includes(number), `หน้า GA ไม่ได้พูดถึงเลข ${number} แล้ว`)
  }
})

// ---------- ฝูงนก (PSO) ----------

/** ฝึกตัวอย่างใดก็ได้ที่จำข้ามรอบ — แบบเดียวกับ evolve() แต่เลือกตัวอย่างได้ */
function trainPreset(presetId: string, trial: number, runs: number): { meters: number[]; memory: DinoMemory | null } {
  let memory: DinoMemory | null = null
  const meters: number[] = []

  for (let round = 0; round < runs; round++) {
    const agent = agentOf(presetId)
    agent.memory = memory
    agent.saveMemory = (data) => {
      memory = data
      agent.memory = data
    }

    const run = createRun({ courseId: 'classic', seed: trial * 1000 + round })
    agent.onStart(viewOf(run, 500))

    while (!run.over) {
      order(run, (agent.step(viewOf(run, 500)) ?? 'run') as Action)
      for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
    }

    agent.onFinish(viewOf(run, 500))
    meters.push(metersOf(run.distance))
  }

  return { meters, memory }
}

test('หน้าฝูงนกหาจังหวะ — GA ออกตัวเร็วกว่า ฝูงนกแซงเมื่อฝึกนานขึ้น และตัวเลขยังตรง', () => {
  const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length
  const measure = (presetId: string, runs: number) => {
    const firsts: number[] = []
    const lasts: number[] = []
    for (let trial = 1; trial <= 10; trial++) {
      const { meters } = withSeededRandom(20260921 + trial, () => trainPreset(presetId, trial, runs))
      firsts.push(average(meters.slice(0, 5)))
      lasts.push(average(meters.slice(-5)))
    }
    return { first: Math.round(average(firsts)), last: Math.round(average(lasts)) }
  }

  const gaShort = measure('evolve', 30)
  const swarmShort = measure('swarm', 30)
  const gaLong = measure('evolve', 60)
  const swarmLong = measure('swarm', 60)

  assert.ok(gaShort.last > swarmShort.last, 'ฝึกสั้น GA ต้องนำ')
  assert.ok(swarmLong.last > gaLong.last, 'ฝึกนาน ฝูงนกต้องแซง')

  const text = TOPICS.find((topic) => topic.slug === 'swarm-timing')!.inGame
  for (const value of [gaShort.first, gaShort.last, swarmShort.first, swarmShort.last, swarmLong.last, gaLong.last]) {
    const shown = value.toLocaleString('en-US')
    assert.ok(text.includes(shown), `หน้าฝูงนกหาจังหวะไม่ได้พูดถึง ${shown} แล้ว`)
  }
})

test('ภาพของฝูงนกหาจังหวะ — จังหวะในภาพคือจังหวะที่ฝูงหาเจอจริง', () => {
  const { memory } = withSeededRandom(20260922, () => trainPreset('swarm', 1, 60))
  const swarm = readSwarm(memory?.swarm, DINO_SPACE)
  assert.ok(swarm?.best)
  assert.deepEqual(swarm.best.map((value) => Math.round(value * 100) / 100), [DINO_SWARM_FOUND.jump, DINO_SWARM_FOUND.duck])
})
