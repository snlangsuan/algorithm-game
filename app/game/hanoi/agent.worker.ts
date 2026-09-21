import { AGENT_GLOBALS, HanoiAgent, type HanoiState, type PlanResult, type StepResult } from './agent'
import { insidePeg, type Move } from './engine'
import { instrument } from '../shared/instrument'
import { captureConsole, clearLog, pushLog, takeLog } from '../shared/console'
import type { AgentMode, ExploredMove, WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

captureConsole(ctx as unknown as { console: Console }, () => currentLine)

const TRACE_INTERVAL = 40

const EXPLORED_LIMIT = 200_000

const LINE_MARKER = '__hanoiLine'

const CLOCK_EVERY = 2048

const TIMELINE_LIMIT = 30_000

let agent: HanoiAgent | null = null
let mode: AgentMode = 'plan'
let traced = false
let explored: ExploredMove[] = []

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

function watch(instance: HanoiAgent): HanoiAgent {
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

function build(code: string): { instance: HanoiAgent; mode: AgentMode; traced: boolean } {

  const marked = instrument(code, LINE_MARKER)

  const factory = new Function(
    'HanoiAgent',
    'PEG_COUNT',
    LINE_MARKER,
    '__log',
    `"use strict";
${marked.code}
;
if (typeof Agent === 'undefined') {
  throw new Error('ไม่พบคลาสชื่อ Agent — ต้องเขียน "class Agent extends HanoiAgent { ... }"')
}
return Agent;`
  )

  const AgentClass = factory(
    HanoiAgent,
    AGENT_GLOBALS.PEG_COUNT,
    markLine,
    (value: unknown) => pushLog(value, currentLine)
  )

  if (typeof AgentClass !== 'function') {
    throw new Error('Agent ต้องเป็นคลาส')
  }

  const instance = new AgentClass() as HanoiAgent

  const plans = instance.solve !== HanoiAgent.prototype.solve
  const walks = instance.step !== HanoiAgent.prototype.step

  if (!plans && !walks) {
    throw new Error('Agent ยังไม่ได้ override เมธอด solve(state) หรือ step(state)')
  }

  Object.defineProperty(instance, 'visit', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(from: number | Move, to?: number) {
      if (explored.length >= EXPLORED_LIMIT) return

      const move =
        typeof from === 'object'
          ? { from: from.from, to: from.to }
          : { from, to: to as number }

      if (!insidePeg(move.from) || !insidePeg(move.to)) return
      explored.push({ ...move, line: currentLine })
    }
  })

  return {
    instance: watch(instance),
    mode: plans ? 'plan' : 'step',
    traced: marked.ok && marked.lines.length > 0
  }
}

function toMove(raw: unknown): Move | null {
  if (raw === null || raw === undefined) return null

  const from = Array.isArray(raw) ? raw[0] : (raw as Move).from
  const to = Array.isArray(raw) ? raw[1] : (raw as Move).to

  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new Error(`ค่าที่คืนมาไม่ใช่ตาย้ายจาน: ${JSON.stringify(raw)} — ต้องเป็น { from, to }`)
  }

  return { from: from as number, to: to as number }
}

function toPlan(raw: PlanResult): Move[] {
  if (raw === null || raw === undefined) return []

  if (!Array.isArray(raw)) {
    throw new Error('solve() ต้องคืนอาเรย์ของตา เช่น [{ from: 0, to: 2 }, ...]')
  }

  const plan: Move[] = []

  for (const item of raw) {
    const move = toMove(item)
    if (move) plan.push(move)
  }

  return plan
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
        agent?.onStart(request.state as HanoiState)
        break
      }

      case 'solve': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const moves = run(request.id, () => toPlan(agent!.solve(request.state)))
        post({ type: 'plan', id: request.id, moves, explored, timeline })
        break
      }

      case 'step': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const move = run(request.id, () => toMove(agent!.step(request.state) as StepResult))
        post({ type: 'move', id: request.id, move, explored, timeline })
        break
      }

      case 'finish': {
        agent?.onFinish({ ok: request.ok, moves: request.moves })
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
