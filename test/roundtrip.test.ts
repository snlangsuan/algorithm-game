/**
 * บล็อก → โค้ด → บล็อก → โค้ด ต้องได้โค้ดเดิมเป๊ะทุกตัวอักษร
 *
 * นี่คือสัญญาหลักของระบบ ถ้าข้อนี้พัง ผู้เล่นสลับโหมดแล้วโปรแกรมจะเพี้ยนหรือหาย
 * (เคยพังมาแล้วตอนตัวอย่างไม่ถูก normalize — บล็อกที่หย่อนลงหัวที่ไม่มีในตัวอย่างหายเงียบ)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { importProgram } from '~/game/blocks/importer'
import { normalize } from '~/game/blocks/pack'
import { CATEGORY_LABEL, CATEGORY_ORDER, fits, findSpec, type BlockNode } from '~/game/blocks/types'
import { createBlock } from '~/game/blocks/program'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { countBlocks, countRaw, presetsOf, walkBlocks } from './helpers'

const ALL = [...presetsOf(MAZE_PACK), ...presetsOf(OTHELLO_PACK)]

for (const { pack, preset, title } of ALL) {
  test(`${title} — บล็อก→โค้ด→บล็อก→โค้ด ได้โค้ดเดิมเป๊ะ`, () => {
    const program = normalize(preset.build(), pack)
    const first = generate(program, pack)

    const imported = importProgram(first.code, pack)
    assert.ok(imported.ok, `อ่านโค้ดกลับเป็นบล็อกไม่ได้: ${imported.message}`)

    const again = generate(normalize(imported.program, pack), pack)
    assert.equal(again.code, first.code)
  })

  test(`${title} — อ่านโค้ดกลับแล้วไม่เหลือบล็อก "โค้ดของฉัน"`, () => {
    const program = normalize(preset.build(), pack)
    const imported = importProgram(generate(program, pack).code, pack)
    assert.equal(
      countRaw(imported.program),
      0,
      'ตัวอย่างสำเร็จรูปต้องเขียนด้วยบล็อกปกติได้ทั้งหมด — มี raw แปลว่ามีบล็อกหาย'
    )
  })

  test(`${title} — จำนวนบล็อกเท่าเดิมหลังไปกลับ`, () => {
    const program = normalize(preset.build(), pack)
    const imported = importProgram(generate(program, pack).code, pack)
    assert.equal(countBlocks(imported.program), countBlocks(program))
  })

  test(`${title} — lineOf กับ blockOf เป็นคู่ผกผันกัน`, () => {
    // หน้าจอย้อนจาก "บรรทัดที่กำลังรัน" กลับมาไฮไลต์บล็อก ถ้าสองอันนี้ไม่ตรงกันจะไฮไลต์ผิดตัว
    const { lineOf, blockOf } = generate(normalize(preset.build(), pack), pack)
    for (const [blockId, line] of Object.entries(lineOf)) {
      assert.equal(blockOf[line], blockId, `บรรทัด ${line} ชี้กลับไปคนละบล็อก`)
    }
    assert.equal(Object.keys(blockOf).length, Object.keys(lineOf).length)
  })

  test(`${title} — ทุกบล็อกที่ใช้ลงทะเบียนไว้แล้ว`, () => {
    const program = normalize(preset.build(), pack)
    walkBlocks(program, (node) => {
      assert.ok(findSpec(node.kind), `บล็อก '${node.kind}' ไม่มีใน registry`)
    })
  })

  test(`${title} — มีช่องครบทุกหัวบล็อกของเกม`, () => {
    // normalize ต้องเติมหัวที่ตัวอย่างไม่ได้เขียนไว้ ไม่งั้นหย่อนบล็อกลงหัวนั้นแล้วหายเงียบ
    const program = normalize(preset.build(), pack)
    for (const hat of pack.hats) {
      assert.ok(hat.kind in program.scripts, `ไม่มีช่องของหัวบล็อก '${hat.kind}'`)
    }
  })
}

for (const pack of [MAZE_PACK, OTHELLO_PACK]) {
  test(`${pack.id} — กล่องเครื่องมือใช้ชื่อหมวดและลำดับของระบบ`, () => {
    // เกมตั้งชื่อหมวดเองไม่ได้ ไม่งั้นสองเกมหน้าตาไม่เหมือนกัน
    const order = pack.palette.map((group) => group.category)
    assert.deepEqual(order, [...order].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
    ))
    for (const group of pack.palette) {
      assert.equal(group.label, CATEGORY_LABEL[group.category])
      assert.ok(group.kinds.length > 0, `หมวด ${group.category} ว่าง ไม่ควรโผล่ในกล่อง`)
    }
  })

  test(`${pack.id} — บล็อกความจำโผล่เฉพาะเกมที่รองรับ`, () => {
    const kinds = pack.palette.flatMap((group) => group.kinds)
    const hasMemory = kinds.includes('remember') || kinds.includes('forget')
    assert.equal(
      hasMemory,
      pack.target.memory === true,
      'บล็อกจำไว้/ลืม ต้องมีเฉพาะเกมที่ agent มี saveMemory'
    )
  })
}

// ---------- บล็อกข้อความ ----------

/** ต่อบล็อกสั้น ๆ ในเขาวงกตแล้วส่งไปกลับหนึ่งรอบ */
function trip(nodes: BlockNode[]) {
  const program = normalize({ name: 'ลองข้อความ', scripts: { 'maze.on-turn': nodes } }, MAZE_PACK)
  const first = generate(program, MAZE_PACK)
  const imported = importProgram(first.code, MAZE_PACK)
  assert.ok(imported.ok, imported.message)

  const back = normalize(imported.program, MAZE_PACK)
  return { code: first.code, again: generate(back, MAZE_PACK).code, program: back, raw: countRaw(imported.program) }
}

const text = (value: string) => {
  const node = createBlock('text')
  node.fields.value = value
  return node
}

const print = (value: BlockNode) => {
  const node = createBlock('log')
  node.inputs.value = value
  return node
}

for (const sample of ["ถึงทางออกแล้ว", "เขา'ว่า", 'ทับ\\หลัง', 'บรรทัด\nใหม่', '']) {
  test(`บล็อกข้อความ ${JSON.stringify(sample)} ไปกลับแล้วได้ข้อความเดิม`, () => {
    const { code, again, program, raw } = trip([print(text(sample))])
    assert.equal(again, code)
    assert.equal(raw, 0, 'ข้อความต้องกลับมาเป็นบล็อกข้อความ ไม่ใช่บล็อก "โค้ดของฉัน"')

    const printed = program.scripts['maze.on-turn']![0]!.inputs.value!
    assert.equal(printed.kind, 'text')
    assert.equal(printed.fields.value, sample)
  })
}

test('ต่อข้อความ ไปกลับแล้วยังเป็นบล็อกต่อข้อความ', () => {
  const join = createBlock('join')
  join.inputs.left = text('ก้าวที่ ')
  join.inputs.right = createBlock('maze.steps')

  const { code, again, program, raw } = trip([print(join)])
  assert.equal(again, code)
  assert.equal(raw, 0)

  const node = program.scripts['maze.on-turn']![0]!.inputs.value!
  assert.equal(node.kind, 'join')
  assert.equal(node.inputs.left!.kind, 'text')
  assert.equal(node.inputs.right!.kind, 'maze.steps')
})

test('บวกเลขธรรมดาไม่กลายเป็นต่อข้อความ', () => {
  // "ต่อข้อความ" เขียนออกมาเป็น `${a}${b}` ส่วน "คำนวณ" เป็น a + b จึงแยกกันได้
  const sum = createBlock('math')
  sum.fields.op = 'add'
  sum.inputs.left = createBlock('number')
  sum.inputs.left.fields.value = 1
  sum.inputs.right = createBlock('number')
  sum.inputs.right.fields.value = 2

  const assign = createBlock('set-var')
  assign.fields.name = 'a'
  assign.inputs.value = sum

  const { program } = trip([assign])
  assert.equal(program.scripts['maze.on-turn']![0]!.inputs.value!.kind, 'math')
})

test('ช่องที่รับตัวเลขไม่รับบล็อกข้อความ', () => {
  // ชนิดค่าต้องกันไม่ให้หย่อนข้อความลงช่องตัวเลข ไม่งั้นโค้ดที่ได้จะคำนวณเพี้ยน
  assert.equal(fits('string', 'number'), false)
  assert.equal(fits('string', 'check'), false)
  assert.equal(fits('string', 'any'), true)
  assert.equal(fits('string', 'string'), true)
})

test('createBlock ตั้งค่าเริ่มต้นให้ทุกช่องที่บล็อกประกาศไว้', () => {
  // ลืมชนิดใหม่ใน createBlock แล้วจะได้ node ที่ขาดคีย์ ซึ่งไปโผล่เป็นค่าว่างแบบเงียบ ๆ ทีหลัง
  for (const pack of [MAZE_PACK, OTHELLO_PACK]) {
    const kinds = [...pack.palette.flatMap((group) => group.kinds), ...pack.hats.map((hat) => hat.kind)]

    for (const kind of kinds) {
      const spec = findSpec(kind)!
      const node = createBlock(kind)

      for (const part of spec.parts) {
        if (part.type === 'field' || part.type === 'code' || part.type === 'number' || part.type === 'string') {
          assert.ok(part.name in node.fields, `${kind}: ไม่ได้ตั้งค่าเริ่มต้นของช่อง '${part.name}'`)
        } else if (part.type === 'input') {
          assert.ok(part.name in node.inputs, `${kind}: ไม่มีรู '${part.name}'`)
        } else if (part.type === 'body') {
          assert.ok(part.name in node.bodies, `${kind}: ไม่มีช่องคำสั่ง '${part.name}'`)
        }
      }
    }
  }
})
