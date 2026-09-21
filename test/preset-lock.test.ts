import { test } from 'node:test'
import assert from 'node:assert/strict'

import { useBlockProgram } from '~/composables/useBlockProgram'
import { useBlockDrag } from '~/composables/useBlockEditor'
import { createBlock } from '~/game/blocks/program'
import { DEFAULT_PRESET_ID, MAZE_PACK } from '~/game/maze/blocks/pack'
import { countBlocks } from './helpers'

const setup = () => useBlockProgram(MAZE_PACK, DEFAULT_PRESET_ID)

const hat = 'maze.on-turn'

function holdFromPalette(kind: string) {
  const { start, end } = useBlockDrag()
  start({ dataTransfer: null } as unknown as DragEvent, { source: 'palette', kind, shape: 'statement' })
  return end
}

test('เปิดมาครั้งแรกเป็นตัวอย่าง จึงล็อกไว้', () => {
  const blocks = setup()
  assert.equal(blocks.locked.value, true)
  assert.equal(blocks.presetId.value, DEFAULT_PRESET_ID)
})

test('ล็อกอยู่แล้วหย่อนบล็อกไม่เข้า', () => {
  const blocks = setup()
  const before = countBlocks(blocks.program)
  const release = holdFromPalette('maze.walk')

  blocks.api.dropStatement({ parent: null, name: hat, index: 0 })
  release()

  assert.equal(countBlocks(blocks.program), before, 'ตัวอย่างต้องไม่ถูกแก้')
})

test('ล็อกอยู่แล้วลบบล็อกไม่ได้', () => {
  const blocks = setup()
  const before = countBlocks(blocks.program)
  const first = blocks.program.scripts[hat]![0]!

  blocks.api.remove(first.id)
  assert.equal(countBlocks(blocks.program), before)
})

test('ล็อกอยู่แล้วแก้ค่าในช่องไม่ได้ และเปลี่ยนชื่อไม่ได้', () => {
  const blocks = setup()
  const node = blocks.program.scripts[hat]!.find((item) => Object.keys(item.fields).length > 0)

  if (node) {
    const name = Object.keys(node.fields)[0]!
    const before = node.fields[name]
    blocks.api.setField(node, name, 'เปลี่ยนแล้ว')
    assert.equal(node.fields[name], before)
  }

  const oldName = blocks.program.name
  blocks.rename('ชื่อใหม่')
  assert.equal(blocks.program.name, oldName)
})

test('คัดลอกแล้วปลดล็อก เปลี่ยนชื่อ และไม่ใช่ตัวอย่างอีกต่อไป', () => {
  const blocks = setup()
  const original = blocks.program.name

  blocks.cloneForEditing()

  assert.equal(blocks.locked.value, false)
  assert.equal(blocks.presetId.value, '', 'คัดลอกแล้วต้องไม่ผูกกับตัวอย่างไหนอีก')
  assert.equal(blocks.program.name, `สำเนาของ ${original}`)
})

test('คัดลอกแล้วแก้ได้จริง', () => {
  const blocks = setup()
  blocks.cloneForEditing()

  const before = countBlocks(blocks.program)
  const release = holdFromPalette('maze.walk')

  blocks.api.dropStatement({ parent: null, name: hat, index: 0 })
  release()

  assert.equal(countBlocks(blocks.program), before + 1)
})

test('คัดลอกซ้ำไม่ทำให้ชื่อซ้อนกันไปเรื่อย', () => {
  const blocks = setup()
  blocks.cloneForEditing()
  const once = blocks.program.name

  blocks.cloneForEditing()
  assert.equal(blocks.program.name, once)
})

test('เลือกตัวอย่างอื่นแล้วกลับมาล็อกอีก', () => {
  const blocks = setup()
  blocks.cloneForEditing()
  assert.equal(blocks.locked.value, false)

  const other = MAZE_PACK.presets.find((preset) => preset.id !== DEFAULT_PRESET_ID)!
  blocks.usePreset(other.id)

  assert.equal(blocks.locked.value, true)
  assert.equal(blocks.presetId.value, other.id)

  assert.equal(blocks.program.name, other.build().name)
})

test('โปรแกรมที่อ่านกลับมาจากโค้ดถือเป็นของผู้ใช้ จึงแก้ได้เลย', () => {
  const blocks = setup()
  assert.equal(blocks.locked.value, true)

  blocks.replaceProgram({ name: 'จากโค้ด', scripts: { [hat]: [createBlock('maze.walk')] } })
  assert.equal(blocks.locked.value, false, 'สลับจากโหมดโค้ดกลับมาแล้วต้องแก้ได้ทันที')
})

test('โปรแกรมใหม่ว่างเปล่า แก้ได้ทันที และเข้าไปอยู่ในคลังของฉัน', () => {
  const blocks = setup()
  const before = blocks.library.length

  blocks.newProgram()

  assert.equal(blocks.locked.value, false)
  assert.equal(blocks.presetId.value, '')
  assert.equal(countBlocks(blocks.program), 0)
  assert.equal(blocks.library.length, before + 1)
  assert.ok(blocks.program.libraryId)
  assert.equal(blocks.programKey.value, `mine:${blocks.program.libraryId}`)
})

test('แก้โปรแกรมของฉันแล้วบันทึกลงคลังเอง — สลับไปดูตัวอย่างแล้วกลับมา ของยังอยู่', () => {
  const blocks = setup()
  blocks.newProgram()
  const id = blocks.program.libraryId!

  const release = holdFromPalette('maze.walk')
  blocks.api.dropStatement({ parent: null, name: hat, index: 0 })
  release()
  blocks.rename('ของฉันเอง')

  blocks.usePreset(DEFAULT_PRESET_ID)
  assert.equal(blocks.locked.value, true)
  assert.equal(blocks.program.libraryId, undefined)

  blocks.usePreset(`mine:${id}`)
  assert.equal(blocks.locked.value, false, 'โปรแกรมของฉันต้องแก้ต่อได้เลย')
  assert.equal(blocks.program.name, 'ของฉันเอง')
  assert.equal(countBlocks(blocks.program), 1)
})

test('คัดลอกตัวอย่างไปแก้ ก็เข้าไปอยู่ในคลังด้วย และลบทิ้งได้', () => {
  const blocks = setup()
  const before = blocks.library.length

  blocks.cloneForEditing()
  const id = blocks.program.libraryId!
  assert.equal(blocks.library.length, before + 1)
  assert.ok(blocks.library.some((entry) => entry.id === id))

  const removed: string[] = []
  const withHook = useBlockProgram(MAZE_PACK, DEFAULT_PRESET_ID, undefined, { onRemove: (key) => removed.push(key) })
  withHook.usePreset(`mine:${id}`)
  withHook.removeProgram()

  assert.ok(!withHook.library.some((entry) => entry.id === id), 'ต้องหายจากคลัง')
  assert.deepEqual(removed, [`mine:${id}`], 'เกมต้องได้รู้ว่าโปรแกรมไหนถูกลบ จะได้ล้างความจำตาม')
  assert.equal(withHook.presetId.value, DEFAULT_PRESET_ID, 'ลบตัวที่เปิดอยู่ ต้องกลับไปที่ตัวอย่างตั้งต้น')
  assert.equal(withHook.locked.value, true)
})
