import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { TOPICS } from '~/data/algorithms'
import type { BlockPack } from '~/game/blocks/pack'
import { methodSource } from '~/game/blocks/source'
import type { BlockNode, BlockSpec, EmitContext } from '~/game/blocks/types'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { HANOI_PACK } from '~/game/hanoi/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'

/**
 * กันกล่องดำ — บล็อกไหนเรียกโค้ดที่คิดอะไรเกินการอ่านค่าตรง ๆ ต้องมีการ์ดอธิบาย
 * และชื่อเมธอดในการ์ดต้องเปิดดูโค้ดจริงได้ ไม่ใช่ชื่อที่เปลี่ยนไปแล้ว
 */

const PACKS: BlockPack[] = [MAZE_PACK, OTHELLO_PACK, HANOI_PACK, CHASE_PACK, RUNNER_PACK, DINO_PACK, LINE_PACK]

const GAME = join(process.cwd(), 'app', 'game')

/** โค้ดที่บล็อกของชุดนี้หาเมธอดได้ — ลำดับเดียวกับที่การ์ดหาจริง (useBlockExplain) */
function sourcesOf(pack: BlockPack): string[] {
  const out = [pack.target.helpers]
  const read = (...path: string[]) => readFileSync(join(GAME, ...path), 'utf8')
  const rank = (name: string) => (name === 'agent.ts' ? 0 : name === 'engine.ts' ? 1 : 2)

  const game = readdirSync(GAME).find((folder) => {
    try {
      return read(folder, 'agent.ts').includes(`class ${pack.target.base}`)
    } catch {
      return false
    }
  })
  assert.ok(game, `ไม่เจอเกมของคลาส ${pack.target.base}`)

  const own = readdirSync(join(GAME, game))
    .filter((name) => name.endsWith('.ts') && !name.includes('.worker.'))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  for (const name of own) out.push(read(game, name))

  for (const name of readdirSync(join(GAME, 'shared')).sort()) {
    if (name.endsWith('.ts')) out.push(read('shared', name))
  }
  if (game !== 'line') out.push(read('line', 'swarm.ts'))

  return out
}

const find = (sources: string[], name: string) =>
  sources.map((source) => methodSource(source, name)).find(Boolean) ?? null

/** เมธอดที่บล็อกเรียกตรง ๆ — ลองให้บล็อกเขียนโค้ดตัวเองออกมาแล้วดูว่ามี this.อะไร( บ้าง */
function calls(spec: BlockSpec): string[] {
  const lines: string[] = []
  const first = (name: string) => {
    const part = spec.parts.find((item) => 'name' in item && item.name === name)
    return part && part.type === 'field' ? part.options[0]!.value : '1'
  }
  const ctx: EmitContext = {
    value: (_node, _slot, fallback) => fallback,
    field: (_node, name) => first(name),
    line: (_node, text) => void lines.push(text),
    raw: (text) => void lines.push(text),
    body: () => {},
    indent: () => {}
  }
  const node: BlockNode = { id: 'x', kind: spec.kind, fields: {}, inputs: {}, bodies: {} }
  const value = spec.emit(node, ctx)
  if (typeof value === 'string') lines.push(value)

  return [...new Set([...lines.join('\n').matchAll(/this\.(\w+)\(/g)].map((match) => match[1]!))]
}

/** เนื้อโค้ดจริงกี่บรรทัด ไม่นับคอมเมนต์และบรรทัดว่าง */
const size = (code: string) =>
  code.split('\n').filter((line) => {
    const text = line.trim()
    return text && !text.startsWith('//') && !text.startsWith('*') && !text.startsWith('/*')
  }).length

/** เมธอดที่ยาวเกินนี้ถือว่ามีความคิดซ่อนอยู่ ต้องอธิบาย — สั้นกว่านี้คืออ่านค่า/ส่งต่อเฉย ๆ */
const THINKING = 6

for (const pack of PACKS) {
  const sources = sourcesOf(pack)

  test(`${pack.id}: บล็อกที่ซ่อนความคิดไว้ มีการ์ดอธิบายครบ`, () => {
    const missing: string[] = []

    for (const spec of pack.blocks) {
      if (spec.pack !== pack.id || spec.explain) continue

      const hidden = calls(spec).filter((name) => {
        const code = find(sources, name)
        return code !== null && size(code) >= THINKING
      })
      if (hidden.length > 0) missing.push(`"${spec.title}" (${spec.kind}) เรียก ${hidden.join(', ')}`)
    }

    assert.deepEqual(missing, [], `บล็อกเหล่านี้ยังเป็นกล่องดำ:\n${missing.join('\n')}`)
  })

  test(`${pack.id}: การ์ดอธิบายชี้ไปที่โค้ดและหน้าความรู้ที่มีอยู่จริง`, () => {
    for (const spec of pack.blocks) {
      const explain = spec.explain
      if (!explain || spec.pack !== pack.id) continue

      assert.ok(explain.idea.trim(), `${spec.kind}: ยังไม่มีใจความ`)
      assert.ok(explain.steps.length > 0, `${spec.kind}: ยังไม่มีขั้นตอน`)

      for (const name of explain.code ?? []) {
        assert.ok(find(sources, name), `${spec.kind}: ไม่เจอเมธอด ${name} ในโค้ดของชุด ${pack.id}`)
      }

      if (explain.learn) {
        assert.ok(
          TOPICS.some((topic) => topic.slug === explain.learn),
          `${spec.kind}: ไม่มีหน้าความรู้ /learn/${explain.learn}`
        )
      }
    }
  })
}

test('ตัดโค้ดเมธอดได้ครบทั้งก้อน รวมคอมเมนต์ข้างบน และไม่หลงกับปีกกาในข้อความ', () => {
  const source = `class A {
  other() { return 1 }

  // บรรทัดแรกของเหตุผล
  // บรรทัดที่สอง
  pick(at: { row: number }) {
    const text = \`{ \${at.row} }\`
    if (at.row > 0) {
      return '}'
    }
    return text
  }

  after() {}
}`

  assert.equal(
    methodSource(source, 'pick'),
    `// บรรทัดแรกของเหตุผล
// บรรทัดที่สอง
pick(at: { row: number }) {
  const text = \`{ \${at.row} }\`
  if (at.row > 0) {
    return '}'
  }
  return text
}`
  )
  assert.equal(methodSource(source, 'missing'), null)
})

test('ตัดโค้ด: ข้ามบรรทัดประกาศใน interface และหาฟังก์ชันลูกศรเจอ', () => {
  const source = `interface Heap<T> {
  push(value: T): void
}

class Real {
  push(value) {
    this.list.push(value)
  }
}

export const twice = (value: number): number =>
  value * 2

const after = 1`

  assert.equal(methodSource(source, 'push'), 'push(value) {\n  this.list.push(value)\n}')
  assert.equal(methodSource(source, 'twice'), 'export const twice = (value: number): number =>\n  value * 2')
})
