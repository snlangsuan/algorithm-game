import { AGENT_GLOBALS, MazeAgent, type MazeState, type PathResult, type StepResult } from './agent'
import { findDirection, type Point } from './engine'
import { instrument } from '../shared/instrument'
import { captureConsole, clearLog, pushLog, takeLog } from '../shared/console'
import type { AgentMode, ExploredCell, WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

captureConsole(ctx as unknown as { console: Console }, () => currentLine)

const TRACE_INTERVAL = 40

const EXPLORED_LIMIT = 200_000

const LINE_MARKER = '__mazeLine'

const CLOCK_EVERY = 2048

const TIMELINE_LIMIT = 30_000

let agent: MazeAgent | null = null
let mode: AgentMode = 'plan'
let traced = false
let explored: ExploredCell[] = []

let currentLine = 0
let lineCounts: Record<number, number> = {}
let marks = 0

let timeline: number[] = []
let stride = 1
let sinceSample = 0

interface TraceState {
  id: number
  stack: string[]
  counts: Record<string, number>
  calls: number
  lastSent: number
}

let trace: TraceState | null = null

const post = (message: WorkerResponse) => ctx.postMessage(message)

const describe = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function sendTick(method: string) {
  if (!trace) return

  const now = Date.now()
  if (now - trace.lastSent < TRACE_INTERVAL) return

  trace.lastSent = now
  post({
    type: 'trace',
    id: trace.id,
    method,
    depth: trace.stack.length,
    calls: trace.calls,
    line: currentLine
  })
}

function enterMethod(method: string) {
  if (!trace) return

  trace.calls++
  trace.counts[method] = (trace.counts[method] ?? 0) + 1
  trace.stack.push(method)

  sendTick(method)
}

function markLine(line: number) {
  currentLine = line
  lineCounts[line] = (lineCounts[line] ?? 0) + 1

  if (++sinceSample >= stride) {
    sinceSample = 0
    timeline.push(line, explored.length)
    if (timeline.length >= TIMELINE_LIMIT * 2) thinTimeline()
  }

  if (++marks % CLOCK_EVERY === 0) sendTick(trace?.stack[trace.stack.length - 1] ?? 'solve')
}

function thinTimeline() {
  const thinned: number[] = []
  for (let index = 0; index < timeline.length; index += 4) {
    thinned.push(timeline[index]!, timeline[index + 1]!)
  }

  timeline = thinned
  stride *= 2
}

function exitMethod() {
  trace?.stack.pop()
}

function watch(instance: MazeAgent): MazeAgent {
  const names = new Set<string>()

  for (
    let proto = Object.getPrototypeOf(instance);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue
      if (typeof (proto as Record<string, unknown>)[name] === 'function') names.add(name)
    }
  }

  for (const name of Object.getOwnPropertyNames(instance)) {
    if (typeof (instance as unknown as Record<string, unknown>)[name] === 'function') names.add(name)
  }

  for (const name of names) {
    const original = (instance as unknown as Record<string, (...args: unknown[]) => unknown>)[name]
    if (typeof original !== 'function') continue

    Object.defineProperty(instance, name, {
      configurable: true,
      writable: true,
      enumerable: false,
      value(this: unknown, ...args: unknown[]) {
        enterMethod(name)
        try {
          return original.apply(this, args)
        } finally {
          exitMethod()
        }
      }
    })
  }

  return instance
}

function build(code: string): { instance: MazeAgent; mode: AgentMode; traced: boolean } {

  const marked = instrument(code, LINE_MARKER)

  const factory = new Function(
    'MazeAgent',
    'FLOOR',
    'WALL',
    'MUD',
    'COST_FLOOR',
    'COST_MUD',
    LINE_MARKER,
    '__log',
    `"use strict";
${marked.code}
;
if (typeof Agent === 'undefined') {
  throw new Error('ไม่พบคลาสชื่อ Agent — ต้องเขียน "class Agent extends MazeAgent { ... }"')
}
return Agent;`
  )

  const AgentClass = factory(
    MazeAgent,
    AGENT_GLOBALS.FLOOR,
    AGENT_GLOBALS.WALL,
    AGENT_GLOBALS.MUD,
    AGENT_GLOBALS.COST_FLOOR,
    AGENT_GLOBALS.COST_MUD,
    markLine,
    (value: unknown) => pushLog(value, currentLine)
  )

  if (typeof AgentClass !== 'function') {
    throw new Error('Agent ต้องเป็นคลาส')
  }

  const instance = new AgentClass() as MazeAgent

  const plans = instance.solve !== MazeAgent.prototype.solve
  const walks = instance.step !== MazeAgent.prototype.step

  if (!plans && !walks) {
    throw new Error('Agent ยังไม่ได้ override เมธอด solve(state) หรือ step(state)')
  }

  Object.defineProperty(instance, 'visit', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(row: number | Point, col?: number) {
      if (explored.length >= EXPLORED_LIMIT) return

      const point =
        typeof row === 'object' ? { row: row.row, col: row.col } : { row, col: col as number }

      if (!Number.isInteger(point.row) || !Number.isInteger(point.col)) return
      explored.push({ ...point, line: currentLine })
    }
  })

  return { instance: watch(instance), mode: plans ? 'plan' : 'step', traced: marked.ok && marked.lines.length > 0 }
}

function toPoint(raw: unknown, from: Point): Point | null {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'string') {
    const dir = findDirection(raw)
    if (!dir) throw new Error(`ไม่รู้จักทิศ "${raw}" — ใช้ได้แค่ up / right / down / left`)
    return { row: from.row + dir.dr, col: from.col + dir.dc }
  }

  const row = Array.isArray(raw) ? raw[0] : (raw as Point).row
  const col = Array.isArray(raw) ? raw[1] : (raw as Point).col

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    throw new Error(`ค่าที่คืนมาไม่ใช่ตำแหน่งบนแผนที่: ${JSON.stringify(raw)}`)
  }

  return { row: row as number, col: col as number }
}

function toPath(raw: PathResult, start: Point): Point[] {
  if (raw === null || raw === undefined) return []

  if (!Array.isArray(raw)) {
    throw new Error('solve() ต้องคืนอาเรย์ของช่อง เช่น [{ row, col }, ...] หรือทิศ เช่น ["right", "down"]')
  }

  const path: Point[] = []
  let cursor = start

  for (const item of raw) {
    const point = toPoint(item, cursor)
    if (!point) continue
    path.push(point)
    cursor = point
  }

  return path
}

function run<T>(id: number, work: () => T): T {
  trace = { id, stack: [], counts: {}, calls: 0, lastSent: 0 }
  explored = []
  lineCounts = {}
  currentLine = 0
  timeline = []
  stride = 1
  sinceSample = 0
  clearLog()

  const startedAt = Date.now()

  try {
    const value = work()

    post({
      type: 'trace-summary',
      id,
      counts: trace.counts,
      calls: trace.calls,
      ms: Date.now() - startedAt,
      lines: lineCounts
    })

    const logs = takeLog()
    if (logs.length > 0) post({ type: 'log', lines: logs })

    return value
  } finally {
    trace = null
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    switch (request.type) {
      case 'init': {
        const built = build(request.code)
        agent = built.instance
        mode = built.mode
        traced = built.traced
        post({
          type: 'ready',
          name: typeof agent.name === 'string' ? agent.name : 'Agent',
          mode,
          traced
        })
        break
      }

      case 'start': {
        agent?.onStart(request.state as MazeState)
        break
      }

      case 'solve': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const path = run(request.id, () => toPath(agent!.solve(request.state), request.state.start))
        post({ type: 'path', id: request.id, path, explored, timeline })
        break
      }

      case 'step': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const move = run(request.id, () =>
          toPoint(agent!.step(request.state) as StepResult, request.state.position)
        )
        post({ type: 'move', id: request.id, move, explored, timeline })
        break
      }

      case 'finish': {
        agent?.onFinish({ ok: request.ok, steps: request.steps, cost: request.cost })
        break
      }
    }
  } catch (error) {
    post({
      type: 'error',
      id: request.type === 'solve' || request.type === 'step' ? request.id : null,
      message: describe(error)
    })
  }
}
