/**
 * หน้าความรู้อ้างถึงของจริงในเกมทุกจุด — ชื่อตัวอย่าง, บล็อก, ไฟล์ต้นทาง
 *
 * ถ้าเปลี่ยนชื่อ preset หรือลบบล็อกออกแล้วลืมแก้เนื้อหา หน้าความรู้จะพังแบบเงียบ ๆ
 * (บล็อกหาย = เพจล่ม, preset หาย = ไม่มีบล็อกให้ดู) เทสต์ชุดนี้กันไว้
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { demoFor } from '~/data/algorithm-blocks'
import { GROUP_LABEL, GROUP_ORDER, TOPICS, findTopic, topicsIn } from '~/data/algorithms'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { countBlocks } from './helpers'

test('slug ไม่ซ้ำกัน และหาเจอทุกอัน', () => {
  const slugs = TOPICS.map((topic) => topic.slug)
  assert.equal(new Set(slugs).size, slugs.length, 'มี slug ซ้ำ')

  for (const slug of slugs) assert.ok(findTopic(slug), `หา '${slug}' ไม่เจอ`)
})

test('ทุกหัวข้ออยู่ในกลุ่มที่มีชื่อ และทุกกลุ่มที่ใช้อยู่ถูกจัดลำดับไว้', () => {
  for (const topic of TOPICS) {
    assert.ok(GROUP_LABEL[topic.group], `${topic.slug}: กลุ่มไม่มีชื่อ`)
    assert.ok(GROUP_ORDER.includes(topic.group), `${topic.slug}: กลุ่มไม่อยู่ใน GROUP_ORDER`)
  }

  // กลุ่มว่างได้ (หน้ารวมกรองทิ้งเอง) แต่ต้องไม่ว่างหมดทุกกลุ่ม
  assert.ok(
    GROUP_ORDER.some((group) => topicsIn(group).length > 0),
    'ไม่มีหัวข้ออยู่ในกลุ่มไหนเลย'
  )
})

for (const topic of TOPICS) {
  test(`${topic.slug} — เนื้อหาครบและไม่ว่าง`, () => {
    for (const [field, value] of Object.entries({
      name: topic.name,
      english: topic.english,
      tagline: topic.tagline,
      inGame: topic.inGame,
      good: topic.good,
      bad: topic.bad
    })) {
      assert.ok(value.trim().length > 0, `${topic.slug}: '${field}' ว่าง`)
    }

    assert.ok(topic.what.length > 0, 'ไม่มีคำอธิบาย')
    assert.ok(topic.steps.length >= 3, 'ขั้นตอนน้อยเกินไป')
  })

  test(`${topic.slug} — อ้างอิงทางทฤษฎีครบ`, () => {
    // ที่มากับเหตุผลต้องเป็นย่อหน้าจริง ไม่ใช่ประโยคเดียวจบ ไม่งั้นหน้าจะกลับไปห้วนเหมือนเดิม
    assert.ok(topic.theory.origin.length >= 2, 'ที่มาสั้นเกินไป ต้องมีอย่างน้อยสองย่อหน้า')
    assert.ok(topic.theory.why.length >= 2, 'ไม่ได้อธิบายว่าทำไมถึงได้ผล')

    for (const line of [...topic.theory.origin, ...topic.theory.why]) {
      assert.ok(line.trim().length > 40, `ย่อหน้าสั้นผิดปกติ: ${line}`)
    }

    assert.ok(topic.theory.papers.length > 0, 'ไม่มีงานอ้างอิง')

    for (const paper of topic.theory.papers) {
      // อ้างอิงต้องมีปีเป็นตัวเลขสี่หลัก ไม่งั้นแปลว่าเขียนลอย ๆ
      assert.match(paper.cite, /\((1[6-9]\d{2}|20\d{2})\)/, `อ้างอิงไม่มีปี: ${paper.cite}`)
    }

    assert.ok(topic.theory.bigO.time.trim().length > 0, 'ไม่มีความซับซ้อนเชิงเวลา')
    assert.ok(topic.theory.bigO.space.trim().length > 0, 'ไม่มีความซับซ้อนเชิงพื้นที่')

    // สัญกรณ์ O ใหญ่ลอย ๆ เด็กอ่านไม่ออก ต้องมีคำแปลติดไว้เสมอ
    assert.ok(topic.theory.bigO.plain.trim().length > 60, 'ไม่ได้แปลสัญกรณ์เป็นภาษาคน')
  })

  test(`${topic.slug} — มีบล็อกอธิบายที่สร้างได้จริง`, () => {
    const demo = demoFor(topic.slug, topic.preset)
    assert.ok(demo, 'สร้างบล็อกตัวอย่างไม่ได้')
    assert.ok(countBlocks(demo.program) > 0, 'บล็อกตัวอย่างว่างเปล่า')

    // ต้องมีช่องครบทุกหัวบล็อกของ pack นั้น ไม่งั้นหน้าจะเรนเดอร์ไม่ครบ
    for (const hat of demo.pack.hats) {
      assert.ok(hat.kind in demo.program.scripts, `ไม่มีช่องของหัวบล็อก '${hat.kind}'`)
    }
  })
}

test('ตัวอย่างที่หน้าความรู้อ้างถึง ยังมีอยู่จริงใน pack', () => {
  for (const topic of TOPICS) {
    if (!topic.preset) continue

    const pack = topic.preset.game === 'maze' ? MAZE_PACK : OTHELLO_PACK
    const found = pack.presets.find((preset) => preset.id === topic.preset!.id)
    assert.ok(found, `${topic.slug}: ไม่มีตัวอย่าง '${topic.preset.id}' ใน ${topic.preset.game} แล้ว`)
  }
})

test('ไฟล์ต้นทางที่อ้างถึง ยังอยู่จริง', () => {
  for (const topic of TOPICS) {
    if (!topic.source) continue

    // เขียนเป็น "path — ฟังก์ชัน()" จึงตัดเอาเฉพาะส่วน path
    const path = topic.source.split('—')[0]!.trim()
    assert.ok(existsSync(path), `${topic.slug}: ไม่มีไฟล์ ${path} แล้ว`)
  }
})

test('กลุ่ม blocks ต้องมีตัวอย่างจริง ส่วนกลุ่ม concept ต้องบอกว่าติดอะไร', () => {
  for (const topic of topicsIn('blocks')) {
    assert.ok(topic.preset, `${topic.slug}: อยู่กลุ่ม blocks แต่ไม่ได้ชี้ไปที่ตัวอย่างไหน`)
  }

  for (const topic of topicsIn('concept')) {
    assert.ok(topic.blocker, `${topic.slug}: อยู่กลุ่ม concept แต่ไม่ได้บอกว่าติดอะไร`)
  }

  for (const topic of topicsIn('engine')) {
    assert.ok(topic.source, `${topic.slug}: อยู่กลุ่ม engine แต่ไม่ได้ชี้ไฟล์ต้นทาง`)
  }
})
