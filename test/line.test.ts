import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { importProgram } from '~/game/blocks/importer'
import { normalize, type BlockProgram } from '~/game/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { LineAgent, viewOf, type LineMemory } from '~/game/line/agent'
import { BIRDS, DIMENSIONS, fly, readSwarm, type Swarm } from '~/game/line/swarm'
import { SWARM_FOUND } from '~/data/algorithm-figures'
import { RULES, playRule, type RuleId } from '~/game/line/rules'
import { TOPICS } from '~/data/algorithms'
import { createBlock } from '~/game/blocks/program'

const numberBlock = (value: number) => Object.assign(createBlock('number'), { fields: { value } })
import {
  COURSES,
  DECIDE_EVERY,
  LINE_WIDTH,
  MAX_WHEEL,
  OFF_TRACK,
  SENSOR_BLUR,
  SENSOR_COUNT,
  VIEW,
  WHEEL_BASE,
  advance,
  averageOffset,
  buildTrack,
  createRun,
  distanceToLine,
  isLost,
  linePosition,
  order,
  readingAt,
  sensorPoint,
  turnAt,
  MARKER_SIZE,
  PX_PER_CM,
  FINISH_RADIUS,
  type Drive,
  type Run
} from '~/game/line/engine'

/**
 * สร้าง agent จากโค้ดที่บล็อกของตัวอย่างนั้นแปลงออกมาจริง
 * edit ใช้แก้บล็อกก่อนแปลง — จำลองสิ่งที่หน้าความรู้ชวนให้เด็กลองแก้เอง
 */
function agentOf(presetId: string, edit?: (program: BlockProgram) => void): LineAgent {
  const preset = LINE_PACK.presets.find((item) => item.id === presetId)
  assert.ok(preset, `ไม่มีตัวอย่างชื่อ '${presetId}'`)

  const program = normalize(preset.build(), LINE_PACK)
  edit?.(program)

  const { code } = generate(program, LINE_PACK)
  const factory = new Function('LineAgent', `"use strict";\n${code}\n;return Agent;`)

  const Agent = factory(LineAgent)
  return new Agent() as LineAgent
}

/** วิ่งจนจบรอบ — ไม่ตอบอะไรก็ใช้กำลังเดิมต่อ แบบเดียวกับที่ worker ทำ */
function play(presetId: string, courseId: string, edit?: (program: BlockProgram) => void): Run {
  const agent = agentOf(presetId, edit)
  const run = createRun({ courseId })
  let previous: Drive = { left: 0, right: 0 }

  while (!run.over) {
    previous = agent.step(viewOf(run, 500)) ?? previous
    order(run, previous)
    for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
  }

  return run
}

/** สนามพื้นฐานสี่สนาม — ตัวเลขในหน้าความรู้ของ bang-bang / P / PID อ้างจากสนามพวกนี้ */
const BASIC = COURSES.filter((course) => !course.challenge)

/** ขับด้วยกำลังตายตัวไปกี่วินาที */
function coast(run: Run, drive: Drive, seconds: number): void {
  order(run, drive)
  const frames = Math.round(seconds * 60)
  for (let frame = 0; frame < frames && !run.over; frame++) advance(run)
}

test('ทุกสนามอยู่ในกรอบจอ ยาวพอ และออกตัวบนเส้น', () => {
  for (const course of COURSES) {
    const track = buildTrack(course)
    // เขาวงกตวัดจากจุดเริ่มถึงเส้นชัยตามทางที่สั้นที่สุด ไม่ใช่รอบวง จึงสั้นกว่าได้
    const shortest = course.maze ? 1000 : 1500
    assert.ok(track.length > shortest, `${course.id}: สั้นเกินไป (${track.length.toFixed(0)} px)`)

    for (const point of track.points) {
      assert.ok(point.x > 20 && point.x < VIEW.width - 20, `${course.id}: เส้นล้นขอบซ้ายขวา`)
      assert.ok(point.y > 20 && point.y < VIEW.height - 20, `${course.id}: เส้นล้นขอบบนล่าง`)
    }

    const run = createRun({ courseId: course.id })
    assert.equal(run.sensors[2], 100, `${course.id}: เซนเซอร์กลางต้องอยู่บนเส้นตอนออกตัว`)
    // บางสนามออกตัวบนโค้งอ่อน ๆ เส้นใต้แถวเซนเซอร์จึงเบี่ยงได้นิดหน่อย แต่ต้องไม่มากจนหุ่นต้องรีบเลี้ยว
    const position = linePosition(run.sensors, 0)
    assert.ok(Math.abs(position) <= 8, `${course.id}: ออกตัวต้องเกือบตรงกลางเส้น — ได้ ${position}`)
    assert.ok(!run.sensors[0] && !run.sensors[4], `${course.id}: เซนเซอร์ริมสุดต้องอยู่บนพื้นขาวตอนออกตัว`)
  }
})

test('เซนเซอร์อ่านเต็มเมื่ออยู่กลางเส้น ศูนย์เมื่ออยู่นอกเส้น และค่อย ๆ ลดตรงขอบ', () => {
  const half = LINE_WIDTH / 2

  assert.equal(readingAt(0), 100)
  assert.equal(readingAt(half - SENSOR_BLUR), 100)
  assert.equal(readingAt(half), 50, 'ขอบเส้นพอดีต้องอ่านได้ครึ่งหนึ่ง')
  assert.equal(readingAt(half + SENSOR_BLUR), 0)
  assert.equal(readingAt(100), 0)
})

test('ตำแหน่งเส้นเป็นลบเมื่อเส้นอยู่ซ้าย เป็นบวกเมื่ออยู่ขวา และหลุดแล้วตอบฝั่งที่เห็นครั้งสุดท้าย', () => {
  assert.equal(linePosition([100, 0, 0, 0, 0], 0), -100)
  assert.equal(linePosition([0, 0, 0, 0, 100], 0), 100)
  assert.equal(linePosition([0, 100, 100, 0, 0], 0), -25)
  assert.equal(linePosition([0, 0, 0, 0, 0], -1), -100)
  assert.equal(linePosition([0, 0, 0, 0, 0], 1), 100)
  assert.ok(isLost([0, 0, 10, 0, 0]))
})

test('ด้านซ้ายของหุ่นคือด้านซ้ายจริง — หันไปทางขวาของจอ เซนเซอร์ซ้ายสุดต้องอยู่ด้านบน', () => {
  const at = { x: 100, y: 100, heading: 0 }
  assert.ok(sensorPoint(at, 0).y < sensorPoint(at, 4).y)
  assert.ok(sensorPoint(at, 2).x > at.x, 'แถวเซนเซอร์ต้องอยู่หน้าแกนล้อ')
})

test('ล้อขวาแรงกว่าก็เลี้ยวซ้าย · ล้อเท่ากันก็วิ่งตรง · สวนกันก็หมุนอยู่กับที่', () => {
  const straight = createRun({ courseId: 'oval' })
  const heading = straight.heading
  coast(straight, { left: 50, right: 50 }, 0.5)
  assert.ok(Math.abs(straight.heading - heading) < 1e-9, 'ล้อเท่ากันต้องไม่เลี้ยวเลย')

  // ออกตัวบนทางตรงที่หันไปทางขวาของจอ — เลี้ยวซ้ายคือหัวชี้ขึ้น มุมจึงลดลง
  const left = createRun({ courseId: 'oval' })
  coast(left, { left: 20, right: 60 }, 0.3)
  assert.ok(left.heading < heading, 'ล้อขวาแรงกว่าต้องเลี้ยวซ้าย')

  const spin = createRun({ courseId: 'oval' })
  coast(spin, { left: -50, right: 50 }, 0.4)
  assert.ok(Math.hypot(spin.x - createRun({ courseId: 'oval' }).x, spin.y - 500) < 2, 'สวนกันต้องหมุนอยู่กับที่')
  assert.ok(spin.heading < heading)
})

test('มอเตอร์ไม่ได้เร็วทันทีที่สั่ง — ค่อย ๆ ไล่ตามคำสั่ง', () => {
  const run = createRun({ courseId: 'oval' })
  coast(run, { left: 100, right: 100 }, 1 / 60)
  assert.ok(run.wheelLeft > 0 && run.wheelLeft < MAX_WHEEL * 0.3, 'เฟรมแรกต้องยังช้าอยู่')

  coast(run, { left: 100, right: 100 }, 0.8)
  assert.ok(run.wheelLeft > MAX_WHEEL * 0.95, 'ผ่านไปสักพักต้องเร็วเกือบเต็มที่')
})

test('กำลังเกิน ±100 ถูกตัดเหลือ ±100', () => {
  const run = createRun({ courseId: 'oval' })
  order(run, { left: 500, right: -900 })
  assert.deepEqual(run.drive, { left: 100, right: -100 })
})

test('ขับออกนอกเส้นไปตรง ๆ ต้องหลุดสนาม ไม่ใช่วิ่งต่อไปเรื่อย ๆ', () => {
  const run = createRun({ courseId: 'oval' })
  coast(run, { left: 60, right: 30 }, 5)
  assert.equal(run.over, 'lost')
  assert.ok(run.offset > OFF_TRACK)
})

test('จอดนิ่งอยู่กับที่จนหมดเวลา', () => {
  const run = createRun({ courseId: 'oval' })
  coast(run, { left: 0, right: 0 }, 100)
  assert.equal(run.over, 'timeout')
})

test('ตารางค้นหาเส้นตอบเท่ากับการไล่ดูทุกท่อน', () => {
  const track = buildTrack(COURSES[2]!)

  for (let index = 0; index < 400; index++) {
    const point = { x: 60 + ((index * 37) % 840), y: 60 + ((index * 53) % 480) }
    let slow = Number.POSITIVE_INFINITY

    for (let at = 0; at < track.points.length; at++) {
      const a = track.points[at]!
      const b = track.points[(at + 1) % track.points.length]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const span = dx * dx + dy * dy
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span))
      slow = Math.min(slow, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)))
    }

    const fast = distanceToLine(track, point)
    // ตารางดูแค่ช่องรอบ ๆ — ไกลเกินนั้นตอบว่าไกลมาก ซึ่งเซนเซอร์อ่านได้ศูนย์เหมือนกัน
    if (slow < 20) assert.ok(Math.abs(fast - slow) < 1e-9, `ที่ (${point.x}, ${point.y}) ได้ ${fast} แทน ${slow}`)
    else assert.ok(fast >= 20 || Math.abs(fast - slow) < 1e-9)
  }
})

test('วิ่งซ้ำได้เวลาเดิมเป๊ะ — สนามไม่มีการสุ่ม', () => {
  const first = play('pd', 'wave')
  const second = play('pd', 'wave')

  assert.equal(second.time, first.time)
  assert.equal(second.x, first.x)
})

test('ตัวอย่างทุกชุด บล็อก→โค้ด→บล็อก ได้โค้ดเดิม', () => {
  for (const preset of LINE_PACK.presets) {
    const first = generate(normalize(preset.build(), LINE_PACK), LINE_PACK)
    const imported = importProgram(first.code, LINE_PACK)
    assert.ok(imported.ok, `${preset.id}: ${imported.message}`)
    assert.equal(imported.raw, 0, `${preset.id}: มีบล็อกที่อ่านกลับไม่ได้`)
    assert.equal(generate(normalize(imported.program!, LINE_PACK), LINE_PACK).code, first.code)
  }
})

/** ผลของตัวอย่างทุกชุดบนทุกสนาม — ตัวเลขในหน้าความรู้อ้างจากตรงนี้ */
const RESULTS: Record<string, Record<string, string>> = {
  starter: {
    oval: 'finished 13.95', wave: 'lost', sharp: 'lost', eight: 'lost',
    'rcj-gaps': 'lost', 'rcj-junctions': 'lost', robotrace: 'lost', 'line-maze': 'lost'
  },
  'bang-bang': {
    oval: 'finished 14.22', wave: 'finished 21.03', sharp: 'finished 17.97', eight: 'lost',
    'rcj-gaps': 'finished 16.77', 'rcj-junctions': 'lost', robotrace: 'lost', 'line-maze': 'lost'
  },
  proportional: {
    oval: 'finished 11.13', wave: 'finished 16.65', sharp: 'finished 15.97', eight: 'finished 14.70',
    'rcj-gaps': 'timeout', 'rcj-junctions': 'lost', robotrace: 'finished 11.28', 'line-maze': 'timeout'
  },
  pd: {
    oval: 'finished 7.58', wave: 'finished 11.12', sharp: 'finished 10.37', eight: 'finished 10.08',
    'rcj-gaps': 'timeout', 'rcj-junctions': 'lost', robotrace: 'finished 7.82', 'line-maze': 'lost'
  },
  switching: {
    oval: 'finished 8.43', wave: 'finished 11.97', sharp: 'finished 11.42', eight: 'finished 11.17',
    'rcj-gaps': 'finished 10.32', 'rcj-junctions': 'lost', robotrace: 'finished 8.52', 'line-maze': 'lost'
  },
  'left-hand': {
    oval: 'finished 13.32', wave: 'finished 19.13', sharp: 'finished 17.57', eight: 'lost',
    'rcj-gaps': 'timeout', 'rcj-junctions': 'lost', robotrace: 'lost', 'line-maze': 'finished 23.28'
  },
  markers: {
    oval: 'finished 13.32', wave: 'finished 18.77', sharp: 'finished 17.62', eight: 'finished 17.52',
    'rcj-gaps': 'timeout', 'rcj-junctions': 'finished 15.02', robotrace: 'finished 13.43', 'line-maze': 'lost'
  }
}

const summary = (run: Run): string => (run.over === 'finished' ? `finished ${run.time.toFixed(2)}` : String(run.over))

for (const [presetId, expected] of Object.entries(RESULTS)) {
  test(`${presetId} — ผลบนทุกสนามยังตรงกับที่หน้าความรู้อ้าง`, () => {
    const actual = Object.fromEntries(COURSES.map((course) => [course.id, summary(play(presetId, course.id))]))
    assert.deepEqual(actual, expected)
  })
}

test('bang-bang พังที่จุดตัดของเลขแปด — เซนเซอร์สองข้างเห็นเส้นพร้อมกัน', () => {
  const run = play('bang-bang', 'eight')
  const where = run.track.points[run.index]!
  const crossing = { x: 480, y: 300 }

  assert.equal(run.over, 'lost')
  assert.ok(run.strayed, 'ต้องหลุดเพราะไปเกาะเส้นท่อนที่ตัดผ่าน ไม่ใช่วิ่งออกไปบนพื้นขาว')
  assert.ok(
    Math.hypot(where.x - crossing.x, where.y - crossing.y) < 90,
    `ต้องหลุดแถวจุดตัดกลางสนาม — หลุดที่ (${Math.round(where.x)}, ${Math.round(where.y)})`
  )
})

test('PD ส่ายห่างเส้นน้อยกว่า bang-bang ทั้งที่วิ่งเร็วกว่า', () => {
  for (const course of ['oval', 'wave', 'sharp']) {
    const bang = play('bang-bang', course)
    const pd = play('pd', course)

    assert.ok(pd.time < bang.time, `${course}: PD ต้องเร็วกว่า`)
    assert.ok(averageOffset(pd) < averageOffset(bang), `${course}: PD ต้องเกาะเส้นแนบกว่า`)
  }
})

test('ค่าคงที่ของหุ่นสอดคล้องกัน — แถวเซนเซอร์กว้างกว่าเส้น แต่ไม่กว้างกว่าตัวหุ่นเกินไป', () => {
  const span = (SENSOR_COUNT - 1) * 8
  assert.ok(span > LINE_WIDTH * 2, 'เซนเซอร์ริมสุดต้องอยู่นอกเส้นตอนหุ่นอยู่กลางเส้น')
  assert.ok(span < WHEEL_BASE * 1.5)
})

test('หน้าความรู้ของหุ่นเดินตามเส้นอ้างตัวเลขที่ตรงกับผลจริง', () => {
  const text = (slug: string) => TOPICS.find((topic) => topic.slug === slug)?.inGame ?? ''

  for (const number of ['14.22', '21.03', '17.97']) {
    assert.ok(text('bang-bang').includes(number), `หน้า bang-bang ไม่ได้พูดถึง ${number} แล้ว`)
  }
  for (const number of ['11.13', '16.65', '15.97', '14.70']) {
    assert.ok(text('p-control').includes(number), `หน้า P ไม่ได้พูดถึง ${number} แล้ว`)
  }
  for (const number of ['7.58', '11.12', '10.37', '10.08']) {
    assert.ok(text('pid-control').includes(number), `หน้า PID ไม่ได้พูดถึง ${number} แล้ว`)
  }
})

/** บล็อกสั่งมอเตอร์ตัวเดียวในโปรแกรม — ตัวอย่าง P กับ PD มีแค่ตัวเดียว */
const steerOf = (program: BlockProgram) => {
  const found = program.scripts['line.on-tick']!.find((node) => node.kind === 'line.steer')
  assert.ok(found, 'ไม่เจอบล็อกวิ่งแล้วเลี้ยว')
  return found
}

test('หน้า P — เร่งกำลังเป็น 70 โดยไม่แก้ Kp แล้วเลี้ยวไม่ทันมุมหักศอก กลับหัววิ่งย้อนทาง', () => {
  const run = play('proportional', 'sharp', (program) => {
    steerOf(program).inputs.speed!.fields.value = 70
  })

  assert.equal(run.over, 'timeout')
  assert.ok(run.progress < 0, `ต้องวิ่งย้อนทางจนถอยหลังเลยจุดเริ่ม — ได้ ${Math.round(run.progress)}`)
})

test('หน้า PID — ลบส่วน D ทิ้งที่กำลังเท่าเดิม แล้วช้าลงและหลุดที่จุดตัด', () => {
  // เหลือแค่ "ข × 0.7" ซึ่งเป็นท่อนซ้ายของการบวก — ข คือตำแหน่งเส้นของครั้งนี้
  const withoutD = (program: BlockProgram) => {
    const steer = steerOf(program)
    steer.inputs.turn = steer.inputs.turn!.inputs.left!
  }

  const summaries = Object.fromEntries(
    BASIC.map((course) => [course.id, summary(play('pd', course.id, withoutD))])
  )
  assert.deepEqual(summaries, {
    oval: 'finished 10.42',
    wave: 'finished 16.80',
    sharp: 'finished 58.80',
    eight: 'lost'
  })

  const text = TOPICS.find((topic) => topic.slug === 'pid-control')!.inGame
  for (const number of ['10.42', '58.80']) assert.ok(text.includes(number), `หน้า PID ไม่ได้พูดถึง ${number} แล้ว`)
})

test('หน้า PID — PD เร็วกว่า P ราวหนึ่งในสาม และเกาะเส้นแนบกว่า ทุกสนามพื้นฐาน', () => {
  for (const course of BASIC) {
    const p = play('proportional', course.id)
    const pd = play('pd', course.id)
    const ratio = pd.time / p.time

    assert.ok(ratio > 0.6 && ratio < 0.72, `${course.id}: PD ใช้เวลา ${(ratio * 100).toFixed(0)}% ของ P`)
    assert.ok(averageOffset(pd) < averageOffset(p), `${course.id}: PD ต้องเกาะเส้นแนบกว่า`)
  }
})

test('กฎที่เขียนซ้ำไว้วาดภาพ ให้ผลเท่ากับโค้ดที่บล็อกแปลงออกมาจริงทุกสนาม', () => {
  for (const id of Object.keys(RULES) as RuleId[]) {
    for (const course of COURSES) {
      const fromBlocks = play(id, course.id)
      const fromRule = playRule(course.id, id)

      assert.equal(fromRule.time, fromBlocks.time, `${id} บน ${course.id}: เวลาไม่ตรง`)
      assert.equal(fromRule.x, fromBlocks.x, `${id} บน ${course.id}: ตำแหน่งไม่ตรง`)
    }
  }
})

test('ภาพในหน้าความรู้ — สิ่งที่คำบรรยายชี้ให้ดูเกิดขึ้นจริงในรอยนั้น', () => {
  // หน้า P บอกว่ารอยเลยออกนอกเส้นตรงมุม — ต้องห่างเกินครึ่งความกว้างของเส้นจริง ๆ
  const p = playRule('sharp', 'proportional')
  const pd = playRule('sharp', 'pd')
  assert.ok(p.offsetMax > LINE_WIDTH / 2, `แบบ P ห่างเส้นมากสุดแค่ ${p.offsetMax.toFixed(1)} ยังไม่พ้นขอบเส้น`)
  assert.ok(pd.offsetMax < p.offsetMax, 'PD ต้องเลยมุมน้อยกว่าแบบ P')

  // หน้า bang-bang บอกว่าเซนเซอร์สองข้างเห็นเส้นพร้อมกันที่จุดตัด ก่อนจะหลุด
  const bang = playRule('eight', 'bang-bang')
  const fork = playRule('eight', 'bang-bang', (run) => run.sensors[0]! >= 50 && run.sensors[4]! >= 50)
  assert.ok(!fork.over, 'ต้องเจอจังหวะที่สองข้างเห็นพร้อมกันก่อนรอบจะจบ')
  assert.ok(fork.time < bang.time)
  assert.ok(Math.hypot(fork.x - 480, fork.y - 300) < 60, 'จังหวะนั้นต้องอยู่ที่จุดตัด')
})

test('หน้าสลับพฤติกรรม — ตัวเลขตรงกับผลจริง และข้ออ้างเรื่อง PD กับกำลัง 90 เป็นจริง', () => {
  const text = TOPICS.find((topic) => topic.slug === 'behavior-switching')!.inGame
  for (const number of ['8.43', '11.97', '11.42', '11.17', '10.32']) {
    assert.ok(text.includes(number), `หน้าสลับพฤติกรรมไม่ได้พูดถึง ${number} แล้ว`)
  }

  // PD บนสนามเส้นขาด — หมุนหาเส้นจนกลับหัววิ่งย้อนทาง แล้วหมดเวลา
  const pd = play('pd', 'rcj-gaps')
  assert.equal(pd.over, 'timeout')
  assert.ok(pd.progress < pd.furthest - 50, 'PD ต้องวิ่งย้อนทาง ไม่ใช่จอดนิ่ง')

  // เร่งกำลังปกติจาก 80 เป็น 90 แล้วข้ามเส้นขาดไม่รอดจนหมดเวลา
  const faster = play('switching', 'rcj-gaps', (program) => {
    program.scripts['line.on-tick']!.at(-1)!.inputs.speed!.fields.value = 90
  })
  assert.equal(faster.over, 'timeout')
})

test('ป้ายเขียววางก่อนถึงทางแยก ฝั่งเดียวกับที่ทางเลี้ยวไป — ทางตรงไปไม่มีป้าย', () => {
  const course = COURSES.find((item) => item.id === 'rcj-junctions')!
  const track = buildTrack(course)

  assert.deepEqual(
    course.branches!.map((branch) => turnAt(course, branch.at)),
    ['left', null, 'right', null]
  )
  assert.deepEqual(track.markers.map((marker) => marker.side), ['left', 'right'])

  for (const marker of track.markers) {
    assert.ok(distanceToLine(track, marker) > LINE_WIDTH / 2 + MARKER_SIZE / 2, 'ป้ายต้องไม่ทับเส้น')
  }
})

test('ทางแยกหลอกเซนเซอร์เห็นเหมือนเส้นดำ แต่ไม่นับเป็นทางของรอบ', () => {
  const course = COURSES.find((item) => item.id === 'rcj-junctions')!
  const track = buildTrack(course)
  const deadEnd = course.branches![0]!.to

  assert.ok(distanceToLine(track, deadEnd) < 1, 'ปลายทางตันต้องอยู่บนเส้นที่เซนเซอร์เห็น')
  assert.ok(
    track.points.every((at) => Math.hypot(at.x - deadEnd.x, at.y - deadEnd.y) > OFF_TRACK),
    'ปลายทางตันต้องไกลจากทางของรอบพอที่หุ่นจะหลุดสนาม'
  )
})

test('หน้าจำป้ายเขียว — ต้องจำ และต้องลืม ไม่งั้นเลี้ยวผิดทางแยก', () => {
  // ตัวอย่างที่ไม่อ่านป้ายเลย วิ่งตรงเข้าทางตันที่ทางแยกแรก
  const pd = play('pd', 'rcj-junctions')
  assert.equal(pd.over, 'lost')
  assert.ok(pd.strayed, 'PD ต้องหลุดเพราะเกาะทางตัน ไม่ใช่วิ่งออกไปบนพื้นขาว')

  // ไม่จำ — ล้าง c ทุกครั้ง ป้ายกับทางแยกไม่เคยอยู่ใต้เซนเซอร์พร้อมกัน จึงเลยทางแยกแรกไป
  const forgetful = play('markers', 'rcj-junctions', (program) => {
    program.scripts['line.on-tick']!.unshift(createBlock('set-var'))
    program.scripts['line.on-tick']![0]!.fields.name = 'c'
    program.scripts['line.on-tick']![0]!.inputs.value = numberBlock(0)
  })
  assert.equal(forgetful.over, 'lost')
  assert.ok(forgetful.strayed)

  // จำไม่ลืม — ลบสองบล็อกนับถอยหลังทิ้ง แล้วไปเลี้ยวที่ทางแยกถัดไปที่ไม่มีป้าย
  const stubborn = play('markers', 'rcj-junctions', (program) => {
    program.scripts['line.on-tick']!.splice(2, 2)
  })
  assert.equal(stubborn.over, 'lost')
  assert.ok(stubborn.strayed)
  assert.ok(stubborn.time > forgetful.time, 'ต้องผ่านทางแยกแรกได้ก่อนแล้วค่อยพังที่ทางแยกที่สอง')

  const text = TOPICS.find((topic) => topic.slug === 'marker-memory')!.inGame
  for (const number of [pd.time, forgetful.time, stubborn.time, play('markers', 'rcj-junctions').time]) {
    assert.ok(text.includes(number.toFixed(2)), `หน้าจำป้ายเขียวไม่ได้พูดถึง ${number.toFixed(2)} แล้ว`)
  }
})

// ---------- สนามตามกติกาการแข่งจริง ----------

const courseOf = (id: string) => COURSES.find((item) => item.id === id)!

/** ทิศของท่อนที่ i (องศา) */
const headingOf = (points: Array<{ x: number; y: number }>, index: number) => {
  const from = points[index]!
  const to = points[(index + 1) % points.length]!
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
}

const turnBetween = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180)

test('RoboCupJunior เส้นขาด — ช่องว่างยาวไม่เกิน 20 ซม. อยู่บนทางตรง และมีทางตรงก่อนถึงอย่างน้อย 5 ซม.', () => {
  const course = courseOf('rcj-gaps')
  const points = course.points
  const count = points.length
  let gaps = 0

  for (let index = 0; index < count; index++) {
    if (course.paint![index] !== 'gap') continue
    gaps++
    const before = (index - 1 + count) % count
    const after = (index + 1) % count
    const length = Math.hypot(points[after]!.x - points[index]!.x, points[after]!.y - points[index]!.y)
    const lead = Math.hypot(points[index]!.x - points[before]!.x, points[index]!.y - points[before]!.y)

    assert.ok(length <= 20 * PX_PER_CM + 0.01, `ช่องว่างที่ท่อน ${index} ยาว ${(length / PX_PER_CM).toFixed(1)} ซม.`)
    assert.ok(lead >= 5 * PX_PER_CM, `ก่อนช่องว่างที่ท่อน ${index} มีทางตรงแค่ ${(lead / PX_PER_CM).toFixed(1)} ซม.`)
    assert.equal(course.paint![before], 'black')
    assert.ok(turnBetween(headingOf(points, before), headingOf(points, index)) < 0.5, 'ช่องว่างต้องอยู่บนทางตรง')
    assert.ok(turnBetween(headingOf(points, index), headingOf(points, after)) < 0.5, 'ช่องว่างต้องอยู่บนทางตรง')
  }

  assert.ok(gaps >= 3)
})

test('RoboCupJunior ทางแยก — ทุกทางแยกตั้งฉาก', () => {
  const course = courseOf('rcj-junctions')
  for (const branch of course.branches!) {
    const at = course.points[branch.at]!
    const incoming = headingOf(course.points, (branch.at - 1 + course.points.length) % course.points.length)
    const spur = (Math.atan2(branch.to.y - at.y, branch.to.x - at.x) * 180) / Math.PI
    const angle = turnBetween(incoming, spur)
    assert.ok(Math.abs(angle) < 0.5 || Math.abs(angle - 90) < 0.5, `ทางแยกที่จุด ${branch.at} ทำมุม ${angle.toFixed(1)}°`)
  }
})

test('Robotrace — จุดตัดตั้งฉาก มีทางตรงก่อนและหลังอย่างน้อย 10 ซม. และทุกโค้งรัศมีไม่ต่ำกว่า 10 ซม.', () => {
  const course = courseOf('robotrace')
  const points = course.points
  const count = points.length
  // เส้นกว้าง 19 มม. ในกติกา = LINE_WIDTH พิกเซลในเกม
  const pxPerCm = LINE_WIDTH / 1.9

  // ทางทแยงสองเส้นที่ผ่านกลางสนาม
  const through = [...Array(count).keys()].filter((index) => {
    const from = points[index]!
    const to = points[(index + 1) % count]!
    const t = ((480 - from.x) * (to.x - from.x) + (300 - from.y) * (to.y - from.y)) / ((to.x - from.x) ** 2 + (to.y - from.y) ** 2)
    return t > 0 && t < 1 && Math.hypot(from.x + (to.x - from.x) * t - 480, from.y + (to.y - from.y) * t - 300) < 1
  })
  assert.equal(through.length, 2, 'ต้องมีเส้นผ่านจุดตัดกลางสนามสองเส้นพอดี')
  assert.ok(Math.abs(turnBetween(headingOf(points, through[0]!), headingOf(points, through[1]!)) - 90) <= 5, 'จุดตัดต้องตั้งฉาก ±5°')
  for (const index of through) {
    for (const end of [points[index]!, points[(index + 1) % count]!]) {
      assert.ok(Math.hypot(end.x - 480, end.y - 300) >= 10 * pxPerCm, 'ทางตรงรอบจุดตัดต้องยาวอย่างน้อย 10 ซม.')
    }
  }

  // รัศมีของวงกลมที่ผ่านสามจุดติดกัน — ทางตรงได้รัศมีอนันต์
  for (let index = 0; index < count; index++) {
    const a = points[(index - 1 + count) % count]!
    const b = points[index]!
    const c = points[(index + 1) % count]!
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) < 1e-6) continue
    const radius = (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) * Math.hypot(c.x - a.x, c.y - a.y)) / (2 * Math.abs(cross))
    assert.ok(radius >= 10 * pxPerCm, `โค้งที่จุด ${index} รัศมี ${(radius / pxPerCm).toFixed(1)} ซม.`)
  }
})

test('Robotrace — มีเครื่องหมายโค้งทุกจุดที่เข้าหรือออกโค้ง และไม่มีที่อื่น', () => {
  const course = courseOf('robotrace')
  const points = course.points
  const count = points.length
  // โค้งถูกซอยเป็นท่อนสั้น ๆ ส่วนทางตรงเป็นท่อนเดียวยาว ๆ — แยกกันด้วยความยาวของท่อน
  const curved = (index: number) => {
    const from = points[index]!
    const to = points[(index + 1) % count]!
    return Math.hypot(to.x - from.x, to.y - from.y) < 40
  }
  const expected = [...Array(count).keys()].filter((index) => curved((index - 1 + count) % count) !== curved(index))

  assert.deepEqual([...course.corners!].sort((a, b) => a - b), expected.sort((a, b) => a - b))

  const track = buildTrack(course)
  for (const marker of track.markers) {
    assert.equal(marker.kind, 'corner')
    assert.ok(distanceToLine(track, marker) > LINE_WIDTH / 2 + MARKER_SIZE / 2 - 0.5, 'เครื่องหมายต้องไม่ทับเส้น')
  }
})

test('เขาวงกตบนเส้น — ตามคู่มือ Pololu: หักมุมฉาก ไม่มีวงวน และเส้นชัยเป็นวงกลมกว้างสี่เท่าของเส้น', () => {
  const maze = courseOf('line-maze').maze!
  for (const [from, to] of maze.lines) assert.ok(from.x === to.x || from.y === to.y, 'ทุกเส้นต้องเป็นแนวนอนหรือแนวตั้ง')

  // ไม่มีวงวน = กราฟของทางแยกเป็นต้นไม้ — จำนวนท่อนน้อยกว่าจำนวนทางแยกอยู่หนึ่ง
  const graph = buildTrack(courseOf('line-maze')).maze!
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`
  const nodes = new Set(graph.edges.flatMap((edge) => [key(edge.from), key(edge.to)]))
  assert.equal(graph.edges.length, nodes.size - 1)

  assert.equal(FINISH_RADIUS * 2, LINE_WIDTH * 4)
})

test('หน้ามือซ้ายแตะกำแพงบนเส้น — ตัวเลขตรงกับผลจริง และมือขวาเข้าทางตันน้อยกว่าบนเขาวงกตนี้', () => {
  const left = play('left-hand', 'line-maze')
  const right = play('left-hand', 'line-maze', (program) => {
    const rule = program.scripts['line.on-tick']![0]!
    rule.inputs.cond!.fields.sensor = '4'
    rule.bodies.then![0]!.inputs.left!.fields.value = 60
    rule.bodies.then![0]!.inputs.right!.fields.value = -40
  })

  assert.equal(left.over, 'finished')
  assert.equal(right.over, 'finished')
  assert.ok(right.time < left.time)

  const text = TOPICS.find((topic) => topic.slug === 'line-maze-left-hand')!.inGame
  for (const time of [left.time, right.time]) assert.ok(text.includes(time.toFixed(2)), `หน้ามือซ้ายไม่ได้พูดถึง ${time.toFixed(2)}`)
})

// ---------- ฝูงนก (PSO) ----------

/** Math.random ที่ล็อกเมล็ดไว้ — ฝูงนกสุ่มเอง ต้องล็อกถึงจะวัดซ้ำได้ */
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

/** ฝึกฝูงนก — ความจำส่งต่อข้ามรอบแบบเดียวกับที่ worker ทำ คืนเวลาของแต่ละรอบ (null = ไม่ครบรอบ) */
function trainSwarm(courseId: string, rounds: number): { times: Array<number | null>; swarm: Swarm } {
  let memory: LineMemory | null = null
  const times: Array<number | null> = []

  for (let round = 0; round < rounds; round++) {
    const agent = agentOf('swarm')
    agent.memory = memory
    agent.saveMemory = (data) => {
      memory = data
      agent.memory = data
    }

    const run = createRun({ courseId })
    agent.onStart(viewOf(run, 500))

    let previous: Drive = { left: 0, right: 0 }
    while (!run.over) {
      previous = agent.step(viewOf(run, 500)) ?? previous
      order(run, previous)
      for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
    }

    agent.onFinish(viewOf(run, 500))
    times.push(run.over === 'finished' ? run.time : null)
  }

  return { times, swarm: readSwarm((memory as LineMemory | null)?.swarm)! }
}

test('ฝูงนก — ฝึก 100 รอบแล้วเร็วกว่า PD ที่คนจูนทุกครั้ง และตัวเลขในหน้าความรู้ยังตรง', () => {
  const pd = play('pd', 'sharp').time
  const bests: number[] = []
  const earlies: number[] = []

  for (let trial = 1; trial <= 5; trial++) {
    const { times, swarm } = withSeededRandom(20260922 + trial, () => trainSwarm('sharp', 100))
    assert.ok(swarm.bestScore !== null && swarm.bestScore < pd, `ครั้งที่ ${trial}: ${swarm.bestScore} ไม่ดีกว่า PD (${pd})`)
    bests.push(swarm.bestScore!)
    earlies.push(Math.min(...times.slice(0, 10).filter((time): time is number => time !== null)))

    // ภาพในหน้าความรู้วิ่งด้วยค่าที่ครั้งแรกหาเจอ
    if (trial === 1) {
      assert.deepEqual(
        swarm.best!.map((value) => Math.round(value * 100) / 100),
        [SWARM_FOUND.power, SWARM_FOUND.kp, SWARM_FOUND.kd]
      )
    }
  }

  const average = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length
  const text = TOPICS.find((topic) => topic.slug === 'particle-swarm')!.inGame
  for (const number of [pd, average(bests), Math.min(...bests), average(earlies), play('pd', 'sharp', (program) => {
    program.scripts['line.on-tick']!.at(-1)!.inputs.speed!.fields.value = 100
  }).time]) {
    assert.ok(text.includes(number.toFixed(2)), `หน้าฝูงนกไม่ได้พูดถึง ${number.toFixed(2)} แล้ว`)
  }
})

test('ฝูงนก — ความจำเสียหรือรูปร่างผิดถือว่ายังไม่มีฝูง แล้วเริ่มฝูงใหม่ได้', () => {
  assert.equal(readSwarm(null), null)
  assert.equal(readSwarm({ birds: [] }), null)
  assert.equal(readSwarm({ birds: 'x', best: null, bestScore: null, turn: 0, current: 0 }), null)

  const swarm = withSeededRandom(1, () => fly(null, Math.random))
  assert.equal(swarm.birds.length, BIRDS)
  assert.equal(swarm.turn, 1)
  for (const bird of swarm.birds) {
    DIMENSIONS.forEach(({ min, max }, d) => assert.ok(bird.at[d]! >= min && bird.at[d]! <= max))
  }
  assert.deepEqual(readSwarm(JSON.parse(JSON.stringify(swarm))), swarm)
})
