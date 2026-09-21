import { parse, type Node } from 'acorn'

export interface Instrumented {
  code: string
  ok: boolean
  lines: number[]
}

interface Mark {
  index: number
  line: number
}

const STATEMENT = /(?:Statement|Declaration)$/

type AstNode = Node & Record<string, unknown>

const SKIP_KEYS = new Set(['loc', 'range', 'parent'])

function blockLists(node: AstNode): unknown[] {
  if (node.type === 'Program' || node.type === 'BlockStatement' || node.type === 'StaticBlock') {
    return [node.body]
  }

  if (node.type === 'SwitchCase') return [node.consequent]
  return []
}

function markStatements(block: unknown, marks: Mark[]): void {
  if (!Array.isArray(block)) return

  for (const item of block) {
    const statement = item as Node | undefined
    if (!statement?.loc || !STATEMENT.test(statement.type)) continue

    marks.push({ index: statement.start, line: statement.loc.start.line })
  }
}

function collect(node: unknown, marks: Mark[], seen: Set<unknown>): void {
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)

  if (Array.isArray(node)) {
    for (const child of node) collect(child, marks, seen)
    return
  }

  const current = node as AstNode
  if (typeof current.type !== 'string') return

  for (const block of blockLists(current)) markStatements(block, marks)

  for (const key of Object.keys(current)) {
    if (!SKIP_KEYS.has(key)) collect(current[key], marks, seen)
  }
}

export function instrument(source: string, marker: string): Instrumented {
  try {
    const ast = parse(source, {
      ecmaVersion: 'latest',
      locations: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true
    })

    const marks: Mark[] = []
    collect(ast, marks, new Set())

    if (marks.length === 0) return { code: source, ok: true, lines: [] }

    marks.sort((a, b) => b.index - a.index)

    let code = source
    const lines = new Set<number>()

    for (const mark of marks) {
      code = `${code.slice(0, mark.index)}${marker}(${mark.line});${code.slice(mark.index)}`
      lines.add(mark.line)
    }

    return { code, ok: true, lines: [...lines].sort((a, b) => a - b) }
  } catch {
    return { code: source, ok: false, lines: [] }
  }
}
