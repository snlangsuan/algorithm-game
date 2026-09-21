import { test } from 'node:test'
import assert from 'node:assert/strict'

import { useChaseGame } from '~/composables/useChaseGame'

/**
 * ใครถือพวงมาลัยของคนหนี
 *
 * โหมด "เล่นเอง" ไม่เรียกบล็อกของฝ่ายหนีเลย ตัวเอกเดินหน้าไปเรื่อย ๆ ตามทิศที่หันอยู่
 * เคยพลาดตรงนี้มาแล้ว — เลือกอัลกอริทึมให้ฝ่ายหนีแล้วยังค้างอยู่โหมดเล่นเอง
 * ทุกรอบจึงจบเหมือนกันเป๊ะ (วิ่งไปชนผู้ไล่ล่าที่จังหวะเดิม) เหมือนเลือกไปก็ไม่มีผล
 */

test('เปิดหน้ามาครั้งแรก คนเล่นเป็นคนบังคับคนหนี', () => {
  const game = useChaseGame()

  assert.equal(game.control.value, 'player')
  assert.equal(game.side.value, 'hunter')
})

test('เลือกอัลกอริทึมให้ฝ่ายหนี แล้วบอทลงเล่นแทนทันที', () => {
  const game = useChaseGame()

  game.brains.runner.blocks.usePreset('field')

  assert.equal(game.control.value, 'agent', 'เลือกอัลกอริทึมแล้วแต่ยังเป็นคนเล่นบังคับ — บล็อกที่เลือกจะไม่ได้ลงสนาม')
  assert.equal(game.brains.runner.blocks.presetId.value, 'field')
  assert.equal(game.side.value, 'runner', 'สลับให้บอทแล้วควรพาไปดูบล็อกของฝ่ายนั้นด้วย')
})

test('แก้บล็อกของฝ่ายหนีก็ยกพวงมาลัยให้บอทเหมือนกัน', () => {
  const game = useChaseGame()

  game.brains.runner.blocks.cloneForEditing()

  assert.equal(game.control.value, 'agent')
})

test('ยุ่งกับฝ่ายไล่ ไม่แย่งพวงมาลัยไปจากคนเล่น', () => {
  const game = useChaseGame()

  game.brains.hunter.blocks.usePreset('ambush')
  game.brains.hunter.blocks.cloneForEditing()

  assert.equal(game.control.value, 'player', 'ฝ่ายไล่เป็นบอทอยู่แล้ว แก้บล็อกของมันไม่ควรไล่คนเล่นออกจากสนาม')
})

test('กดกลับไปเล่นเองได้ตลอด แม้เพิ่งเลือกอัลกอริทึมให้ฝ่ายหนีไป', () => {
  const game = useChaseGame()

  game.brains.runner.blocks.usePreset('evade')
  game.setControl('player')

  assert.equal(game.control.value, 'player')
  assert.equal(game.brains.runner.blocks.presetId.value, 'evade', 'สลับคนขับแล้วไม่ควรทิ้งอัลกอริทึมที่เลือกไว้')
})

test('ทุกอัลกอริทึมของฝ่ายหนี สั่งให้บอทลงเล่นได้จริง', () => {
  for (const preset of useChaseGame().brains.runner.blocks.pack.presets) {
    const game = useChaseGame()
    game.brains.runner.blocks.usePreset(preset.id)

    assert.equal(game.control.value, 'agent', `ตัวอย่าง '${preset.id}' เลือกแล้วยังไม่ได้ลงสนาม`)
  }
})
