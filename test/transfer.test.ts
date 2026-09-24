import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { exportMemory, exportProgram, fileName, readMemoryFile, readProgramFile } from '~/game/blocks/transfer'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { HANOI_PACK } from '~/game/hanoi/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { GO_PACK } from '~/game/go/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { countBlocks } from './helpers'

const PACKS = [MAZE_PACK, OTHELLO_PACK, HANOI_PACK, CHASE_PACK, DINO_PACK, LINE_PACK, GO_PACK]

for (const pack of PACKS) {
  for (const preset of pack.presets) {
    test(`${pack.id}/${preset.id} — ส่งออกแล้วนำเข้ากลับ ได้โค้ดเดิมและจำนวนบล็อกเดิม`, () => {
      const program = normalize(preset.build(), pack)
      const read = readProgramFile(exportProgram(program, pack), pack)

      assert.ok(read.ok, read.ok ? '' : read.message)
      assert.equal(read.note, undefined, 'ไม่ควรมีบล็อกไหนถูกตัดทิ้ง')
      assert.equal(countBlocks(read.value), countBlocks(program))
      assert.equal(generate(read.value, pack).code, generate(program, pack).code)
    })
  }
}

test('นำเข้าแล้วได้รหัสบล็อกใหม่หมด — ไม่ชนกับบล็อกที่มีอยู่', () => {
  const program = normalize(DINO_PACK.presets[0]!.build(), DINO_PACK)
  const read = readProgramFile(exportProgram(program, DINO_PACK), DINO_PACK)
  assert.ok(read.ok)

  const ids = (value: unknown): string[] => JSON.stringify(value).match(/"id":"[^"]+"/g) ?? []
  const before = new Set(ids(program))
  for (const id of ids(read.value)) assert.ok(!before.has(id), `รหัส ${id} ซ้ำของเดิม`)
})

test('ไฟล์ของเกมอื่น ไฟล์เสีย และไฟล์ที่ไม่ใช่โปรแกรม ถูกปฏิเสธพร้อมเหตุผล', () => {
  const maze = exportProgram(normalize(MAZE_PACK.presets[0]!.build(), MAZE_PACK), MAZE_PACK)

  for (const [text, words] of [
    [maze, 'เกมอื่น'],
    ['{ not json', 'JSON'],
    ['[1, 2]', 'รูปแบบ'],
    [JSON.stringify({ format: 'something-else' }), 'ไม่ใช่ไฟล์โปรแกรม'],
    [JSON.stringify({ format: 'algorithm-game/blocks', game: 'dino', program: { name: 'x', scripts: {} } }), 'ไม่มีบล็อก']
  ] as const) {
    const read = readProgramFile(text, DINO_PACK)
    assert.equal(read.ok, false)
    assert.ok(!read.ok && read.message.includes(words), `${words}: ${!read.ok && read.message}`)
  }
})

test('บล็อกที่ไม่รู้จักหรือวางผิดที่ถูกตัดทิ้ง ส่วนที่เหลือยังใช้ได้', () => {
  const file = {
    format: 'algorithm-game/blocks',
    version: 1,
    game: 'dino',
    program: {
      name: 'ลองแก้มือ',
      scripts: {
        'dino.on-tick': [
          { kind: 'dino.jump' },
          { kind: 'maze.move' },
          { kind: 'dino.speed' },
          { kind: 'if', inputs: { cond: { kind: 'dino.jump' } }, bodies: { then: [{ kind: 'dino.duck' }] } }
        ]
      }
    }
  }

  const read = readProgramFile(JSON.stringify(file), DINO_PACK)
  assert.ok(read.ok)
  assert.equal(countBlocks(read.value), 3, 'เหลือ กระโดด + ถ้า + หมอบ')
  assert.match(read.note ?? '', /3 ตัว/)
})

test('ค่าในช่องที่ถูกเขียนลงโค้ดตรง ๆ ต้องเป็นตัวเลือกที่มีจริง — แทรกโค้ดผ่านไฟล์ไม่ได้', () => {
  const file = {
    format: 'algorithm-game/blocks',
    game: 'dino',
    program: {
      name: 'x',
      scripts: {
        'dino.on-tick': [
          { kind: 'set-var', fields: { name: 'a; globalThis.hacked = 1; //' }, inputs: { value: { kind: 'number', fields: { value: '1); evil(' } } } }
        ]
      }
    }
  }

  const read = readProgramFile(JSON.stringify(file), DINO_PACK)
  assert.ok(read.ok)

  const { code } = generate(read.value, DINO_PACK)
  assert.ok(!code.includes('hacked') && !code.includes('evil'), code)
  assert.match(code, /this\.vars\.a = /)
})

test('ความจำส่งออกแล้วนำเข้ากลับได้ของเดิม และไม่รับไฟล์ของเกมอื่น', () => {
  const memory = { a: [14, 35], b: 81186.7, label: 'จำไว้ 2 ช่อง' }
  const text = exportMemory(memory, 'dino', 'วิวัฒนาการหาจังหวะ (GA)')

  const same = readMemoryFile(text, 'dino', 'วิวัฒนาการหาจังหวะ (GA)')
  assert.ok(same.ok)
  assert.deepEqual(same.value, memory)
  assert.equal(same.note, undefined)

  const other = readMemoryFile(text, 'dino', 'โปรแกรมของฉัน')
  assert.ok(other.ok && other.note, 'โปรแกรมคนละตัวยังนำเข้าได้ แต่ต้องเตือน')

  const wrongGame = readMemoryFile(text, 'othello', 'x')
  assert.equal(wrongGame.ok, false)

  const huge = exportMemory({ a: 'x'.repeat(300 * 1024) }, 'dino', 'x')
  assert.equal(readMemoryFile(huge, 'dino', 'x').ok, false)
})

test('ชื่อไฟล์ตัดตัวอักษรต้องห้ามออก', () => {
  assert.equal(fileName('วิวัฒนาการ/หาจังหวะ: (GA)?', 'blocks'), 'วิวัฒนาการ หาจังหวะ (GA).blocks.json')
  assert.equal(fileName('   ', 'memory'), 'program.memory.json')
})
