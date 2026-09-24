import { test } from 'node:test'
import assert from 'node:assert/strict'

import { BLACK, WHITE, createPosition, type BoardSize } from '~/game/go/engine'
import { candidateFeatures } from '~/game/go/bots'
import {
  LEARNING_RATE,
  PATTERN_COUNT,
  SCALAR_COUNT,
  addChoice,
  emptyGradient,
  emptyWeights,
  learnWeights,
  packWeights,
  readWeights,
  scoreOf,
  type Features
} from '~/game/go/policy'

/**
 * นโยบายที่ฝึกน้ำหนักเอง — เทสต์ว่าคณิตศาสตร์ของ REINFORCE ถูกต้อง
 * (ชนะแล้วน้ำหนักของลักษณะที่เราเลือกต้องขึ้น แพ้ต้องลง และเก็บลงความจำแล้วอ่านกลับได้ครบ)
 */

const size: BoardSize = 9

const featuresWith = (pattern: number, scalars: number[]): Features => ({
  pattern,
  scalars: Float32Array.from([...scalars, ...new Array(SCALAR_COUNT - scalars.length).fill(0)])
})

test('ชนะแล้วน้ำหนักของลักษณะที่เลือกขึ้น แพ้แล้วลง', () => {
  const chosen = featuresWith(7, [1, 0, 1])
  const other = featuresWith(9, [0, 1, 0])

  const gradient = emptyGradient()
  addChoice(gradient, chosen, [chosen, other])
  assert.equal(gradient.steps, 1)

  const won = learnWeights(emptyWeights(), gradient, true)
  assert.ok(won.pattern[7]! > 0, 'รูปของตาที่เลือกต้องได้น้ำหนักเพิ่ม')
  assert.ok(won.pattern[9]! < 0, 'รูปของตาที่ไม่ได้เลือกต้องถูกดึงลง')
  assert.ok(won.scalar[0]! > 0, 'ลักษณะที่ตาเราเลือกมี ต้องได้น้ำหนักเพิ่ม')
  assert.ok(won.scalar[1]! < 0, 'ลักษณะที่มีแต่ในตาที่ไม่ได้เลือก ต้องถูกดึงลง')

  const lost = learnWeights(emptyWeights(), gradient, false)
  assert.ok(lost.pattern[7]! < 0, 'แพ้แล้วต้องดึงลงในทิศตรงข้าม')
  assert.equal(Math.round(lost.pattern[7]! * 1e6), -Math.round(won.pattern[7]! * 1e6))
})

test('ตาที่เลือกเหมือนค่าเฉลี่ยของทุกตัวเลือก ไม่ต้องเรียนอะไร', () => {
  const same = featuresWith(3, [1, 1])
  const gradient = emptyGradient()
  addChoice(gradient, same, [same])

  const after = learnWeights(emptyWeights(), gradient, true)
  for (let index = 0; index < PATTERN_COUNT; index++) {
    assert.equal(after.pattern[index], 0, 'มีตัวเลือกเดียว ไม่มีอะไรให้เทียบ จึงไม่ควรขยับ')
  }
})

test('baseline ทำให้ "ชนะตามคาด" เรียนน้อยกว่า "ชนะเหนือความคาดหมาย"', () => {
  const chosen = featuresWith(5, [1])
  const gradient = emptyGradient()
  addChoice(gradient, chosen, [chosen, featuresWith(6, [0])])

  const fresh = learnWeights(emptyWeights(), gradient, true)
  const expecting = learnWeights({ ...emptyWeights(), baseline: 0.9 }, gradient, true)

  assert.ok(
    fresh.pattern[5]! > expecting.pattern[5]!,
    'ฝ่ายที่ชนะอยู่แล้วเป็นปกติ ชนะอีกครั้งไม่ควรเรียนเท่าฝ่ายที่ไม่เคยชนะ'
  )
  assert.equal(fresh.games, 1)
  assert.ok(fresh.baseline > 0, 'baseline ต้องขยับเข้าหารางวัลล่าสุด')
})

test('อัตราการเรียนรู้คุมขนาดก้าวได้จริง', () => {
  const chosen = featuresWith(11, [1])
  const gradient = emptyGradient()
  addChoice(gradient, chosen, [chosen])
  // มีตัวเลือกเดียวจึงไม่ขยับ — ใส่ตัวเลือกที่สองเพื่อให้มีส่วนต่าง
  addChoice(gradient, chosen, [chosen, featuresWith(12, [0])])

  const after = learnWeights(emptyWeights(), gradient, true)
  const step = after.pattern[11]!
  assert.ok(step > 0 && step <= LEARNING_RATE, `ก้าวเดียว ${step} ต้องไม่เกินอัตราการเรียนรู้ ${LEARNING_RATE}`)
})

test('เก็บน้ำหนักลงความจำแล้วอ่านกลับได้เหมือนเดิม และของพังก็เริ่มใหม่ได้', () => {
  const gradient = emptyGradient()
  addChoice(gradient, featuresWith(2, [1]), [featuresWith(2, [1]), featuresWith(4, [0])])
  const weights = learnWeights(emptyWeights(), gradient, true)

  const back = readWeights(JSON.parse(JSON.stringify(packWeights(weights))))
  assert.equal(back.games, weights.games)
  assert.equal(Math.round(back.pattern[2]! * 1e4), Math.round(weights.pattern[2]! * 1e4))

  assert.equal(readWeights({ pattern: [1, 2, 3] }).games, 0, 'ความยาวไม่ตรงต้องเริ่มใหม่')
  assert.equal(readWeights(null).games, 0)
})

test('ลักษณะของตาอ่านกระดานได้ถูก — จับหมากได้ ลงแล้วเหลือลมหายใจเดียว และเส้นริม', () => {
  const position = createPosition(size)
  const board = position.board
  // ขาวเหลือลมหายใจเดียวที่ (0,2): ขาวที่ (0,0),(0,1) ล้อมด้วยดำ
  board[0] = WHITE
  board[1] = WHITE
  board[size] = BLACK
  board[size + 1] = BLACK

  const candidates = candidateFeatures({ ...position, toPlay: BLACK }, BLACK, null)
  const capture = candidates.find((item) => item.move === 2)
  assert.ok(capture, 'ช่อง (0,2) ต้องลงได้')
  assert.ok(capture.features.scalars[0]! > 0, 'ตาที่จับได้ ต้องมีลักษณะ "จับหมากได้"')
  assert.equal(capture.features.scalars[7], 1, 'ช่องแถวบนสุดคือเส้นแรก')

  const middle = candidates.find((item) => item.move === 4 * size + 4)
  assert.ok(middle, 'กลางกระดานต้องลงได้')
  assert.equal(middle.features.scalars[7], 0, 'กลางกระดานไม่ใช่เส้นแรก')
  assert.equal(middle.features.scalars[0], 0, 'กลางกระดานยังไม่ได้จับใคร')

  // คะแนนขึ้นกับน้ำหนัก — น้ำหนักศูนย์ ทุกตาต้องได้ศูนย์เท่ากันหมด
  assert.equal(scoreOf(emptyWeights(), middle.features), 0)
})
