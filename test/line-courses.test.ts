import { test } from 'node:test'
import assert from 'node:assert/strict'

import { COURSES, buildTrack, checkCourse, createRun, findCourse, paintRuns, registerCourse, unregisterCourse, type Course } from '~/game/line/engine'
import { customCourse, parseCourses, serializeCourses, MAX_POINTS } from '~/game/line/custom'

/** สนามสี่เหลี่ยมมุมมนธรรมดา ๆ ที่ผ่านทุกด่าน — ใช้เป็นฐานแล้วแก้ทีละอย่างให้พัง */
const square = (overrides: Partial<Parameters<typeof customCourse>[0]> = {}): Course =>
  customCourse({
    id: 'custom-test',
    name: 'ทดสอบ',
    smooth: true,
    points: [
      { x: 300, y: 450 },
      { x: 700, y: 450 },
      { x: 780, y: 300 },
      { x: 700, y: 150 },
      { x: 300, y: 150 },
      { x: 200, y: 300 }
    ],
    paint: ['black', 'black', 'red', 'black', 'gap', 'black'],
    ...overrides
  })

test('สนามที่มากับเกมทุกสนามผ่านด่านตรวจเดียวกับสนามที่วาดเอง', () => {
  for (const course of COURSES) assert.equal(checkCourse(course), null, course.id)
})

test('สนามที่วาดดี ๆ ผ่าน และสนามที่เสียได้เหตุผลที่อ่านรู้เรื่อง', () => {
  assert.equal(checkCourse(square()), null)

  const cases: Array<[Course, RegExp]> = [
    [square({ points: [{ x: 100, y: 100 }, { x: 500, y: 100 }] }), /อย่างน้อย 3 จุด/],
    [square({ paint: ['gap', 'black', 'black', 'black', 'black', 'black'] }), /ท่อนแรก/],
    [square({ points: [{ x: 300, y: 450 }, { x: 305, y: 452 }, { x: 700, y: 150 }, { x: 200, y: 300 }] }), /ซ้อนกัน/],
    [square({ points: [{ x: 300, y: 590 }, { x: 700, y: 590 }, { x: 700, y: 150 }, { x: 300, y: 150 }] }), /ล้นขอบ/],
    [square({ points: [{ x: 400, y: 300 }, { x: 500, y: 300 }, { x: 450, y: 350 }] , paint: [] }), /สั้นเกินไป/]
  ]

  for (const [course, words] of cases) assert.match(checkCourse(course) ?? 'ผ่าน', words)
})

test('สีของแต่ละท่อนตามไปถึงเส้นที่เอนจินใช้จริง — เส้นขาดไม่มีในตารางค้นหา', () => {
  const track = buildTrack(square())
  const paints = new Set(paintRuns(track).map((run) => run.paint))
  assert.deepEqual([...paints].sort(), ['black', 'gap', 'red'])

  const visible = new Set([...track.grid.values()].flat())
  for (const [index, paint] of track.paint.entries()) {
    if (paint === 'gap') assert.ok(!visible.has(index), 'ท่อนที่เป็นเส้นขาดต้องไม่อยู่ในตารางที่เซนเซอร์ค้น')
  }
})

test('สนามที่วาดเองลงทะเบียนแล้วเอนจินหาเจอด้วย id และสร้างรอบวิ่งได้', () => {
  const course = square()
  registerCourse(course)
  try {
    assert.equal(findCourse(course.id), course)
    assert.ok(createRun({ courseId: course.id }).sensors[2]! >= 50)
  } finally {
    unregisterCourse(course.id)
  }
  assert.notEqual(findCourse(course.id), course, 'ถอนทะเบียนแล้วต้องหาไม่เจอ')
})

test('เก็บลงเครื่องแล้วอ่านกลับได้สนามเดิม', () => {
  const saved = JSON.parse(serializeCourses([square()]))
  const [read] = parseCourses(saved)
  assert.ok(read)
  assert.deepEqual(read.points, square().points)
  assert.deepEqual(read.paint, square().paint)
  assert.equal(read.custom, true)
})

test('ของเสียที่อ่านจากเครื่องถูกข้าม ไม่ทำให้ทั้งรายการพัง', () => {
  const good = JSON.parse(serializeCourses([square()])).courses[0]
  const read = parseCourses({
    courses: [
      null,
      { ...good, id: 'oval' },
      { ...good, id: 'custom-bad-paint', paint: ['purple'] },
      { ...good, id: 'custom-too-many', points: Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({ x: 100 + i, y: 100 })) },
      { ...good, id: 'custom-outside', points: [{ x: -5, y: 0 }, ...good.points.slice(1)] },
      { ...good, id: 'custom-unplayable', paint: good.points.map(() => 'gap') },
      good,
      { ...good }
    ]
  })

  assert.deepEqual(read.map((item) => item.id), ['custom-test'], 'เหลือแค่ตัวที่ดี และไม่ซ้ำ')
  assert.deepEqual(parseCourses('ไม่ใช่ JSON ของเรา'), [])
})
