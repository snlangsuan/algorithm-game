export interface LogLine {
  text: string

  line: number
}

const LIMIT = 200

const MAX_LENGTH = 300

let lines: LogLine[] = []
let dropped = 0

export function describe(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  try {
    const text = JSON.stringify(value)
    if (typeof text !== 'string') return String(value)
    return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text
  } catch {
    return String(value)
  }
}

export function clearLog(): void {
  lines = []
  dropped = 0
}

export function pushLog(value: unknown, line: number): void {
  if (lines.length >= LIMIT) {
    dropped++
    return
  }

  lines.push({ text: describe(value), line })
}

export function takeLog(): LogLine[] {
  if (dropped > 0) lines.push({ text: `… ตัดอีก ${dropped} บรรทัดทิ้ง (พิมพ์เยอะเกินไป)`, line: 0 })

  const out = lines
  lines = []
  dropped = 0
  return out
}

export function captureConsole(ctx: { console: Console }, lineOf: () => number): void {
  const native = ctx.console

  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = native[level]?.bind(native)

    native[level] = (...args: unknown[]) => {
      pushLog(args.map(describe).join(' '), lineOf())
      original?.(...args)
    }
  }
}
