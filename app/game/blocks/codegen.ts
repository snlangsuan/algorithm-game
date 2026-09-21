import { CORE_HELPERS } from './core'
import { findSpec, type BlockId, type BlockNode, type EmitContext } from './types'
import type { BlockPack, BlockProgram } from './pack'

export interface GeneratedCode {
  code: string

  lineOf: Record<BlockId, number>

  blockOf: Record<number, BlockId>
}

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export function generate(program: BlockProgram, pack: BlockPack): GeneratedCode {
  const lines: string[] = []
  const lineOf: Record<BlockId, number> = {}
  const blockOf: Record<number, BlockId> = {}

  let depth = 0

  const push = (text: string): number => {
    lines.push(text ? `${'  '.repeat(depth)}${text}` : '')
    return lines.length
  }

  const context: EmitContext = {
    field: (node, name) => String(node.fields[name] ?? ''),

    value: (node, slot, fallback) => {
      const child = node.inputs[slot]
      if (!child) return fallback

      const spec = findSpec(child.kind)
      if (!spec || spec.shape !== 'value') return fallback

      return String(spec.emit(child, context) ?? fallback)
    },

    line: (node, text) => {
      const at = push(text)
      lineOf[node.id] = at
      blockOf[at] = node.id
    },

    raw: (text) => push(text),

    body: (node, name) => {
      for (const child of node.bodies[name] ?? []) statement(child)
    },

    indent: (delta) => {
      depth += delta
    }
  }

  function statement(node: BlockNode): void {
    const spec = findSpec(node.kind)
    if (!spec || spec.shape !== 'statement') return
    spec.emit(node, context)
  }

  push('/**')
  push(' * โปรแกรมนี้สร้างจากบล็อก — ลากบล็อกแล้วโค้ดตรงนี้เปลี่ยนตามทันที')
  push(' * กดสลับไปโหมด "เขียนโค้ดเอง" เพื่อเขียนต่อจากตรงนี้ได้เลย')
  push(' */')
  push(`class Agent extends ${pack.target.base} {`)

  depth = 1
  push(`name = '${escape(program.name)}'`)
  for (const field of pack.target.fields) push(field)
  push(`vars = { a: 0, b: 0, c: 0 }`)
  push('')

  const written = pack.target.methods.filter(
    (method) => !method.skipWhenEmpty || (program.scripts[method.hat.kind]?.length ?? 0) > 0
  )

  for (const [index, method] of written.entries()) {
    if (index > 0) push('')

    method.write({
      push: (text: string) => void push(text),
      indent: (delta: number) => {
        depth += delta
      },
      body: () => {
        for (const node of program.scripts[method.hat.kind] ?? []) statement(node)
      }
    })
  }

  for (const line of CORE_HELPERS.split('\n')) lines.push(line)
  for (const line of pack.target.helpers.split('\n')) lines.push(line)

  depth = 0
  push('}')

  return { code: lines.join('\n'), lineOf, blockOf }
}
