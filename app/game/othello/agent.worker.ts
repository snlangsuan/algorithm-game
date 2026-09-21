import { AGENT_GLOBALS, OthelloAgent, type AgentMemory, type AgentMove } from './agent'
import { findMove, getValidMoves } from './engine'
import { instrument } from '../shared/instrument'
import { captureConsole, clearLog, pushLog, takeLog } from '../shared/console'
import type { WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

captureConsole(ctx as unknown as { console: Console }, () => currentLine)

const TRACE_INTERVAL = 40

const LINE_MARKER = '__othelloLine'

const CLOCK_EVERY = 2048

let agent: OthelloAgent | null = null
let traced = false

let currentLine = 0
let lineCounts: Record<number, number> = {}
let marks = 0

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

  if (++marks % CLOCK_EVERY === 0) sendTick(trace?.stack[trace.stack.length - 1] ?? 'chooseMove')
}

function exitMethod() {
  trace?.stack.pop()
}

function watch(instance: OthelloAgent): OthelloAgent {
  const names = new Set<string>()

  for (
    let proto = Object.getPrototypeOf(instance);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue
      if (typeof (proto as Record<string, unknown>)[key] === 'function') names.add(key)
    }
  }

  for (const key of Object.getOwnPropertyNames(instance)) {
    if (typeof (instance as unknown as Record<string, unknown>)[key] === 'function') names.add(key)
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

function build(code: string, memory: AgentMemory | null, frozen = false): OthelloAgent {

  const marked = instrument(code, LINE_MARKER)
  traced = marked.ok && marked.lines.length > 0

  const factory = new Function(
    'OthelloAgent',
    'EMPTY',
    'BLACK',
    'WHITE',
    LINE_MARKER,
    '__log',
    `"use strict";
${marked.code}
;
if (typeof Agent === 'undefined') {
  throw new Error('ไม่พบคลาสชื่อ Agent — ต้องเขียน "class Agent extends OthelloAgent { ... }"')
}
return Agent;`
  )

  const AgentClass = factory(
    OthelloAgent,
    AGENT_GLOBALS.EMPTY,
    AGENT_GLOBALS.BLACK,
    AGENT_GLOBALS.WHITE,
    markLine,
    (value: unknown) => pushLog(value, currentLine)
  )

  if (typeof AgentClass !== 'function') {
    throw new Error('Agent ต้องเป็นคลาส')
  }

  const instance = new AgentClass() as OthelloAgent

  if (typeof instance.chooseMove !== 'function') {
    throw new Error('Agent ต้องมีเมธอด chooseMove(state)')
  }

  if (instance.chooseMove === OthelloAgent.prototype.chooseMove) {
    throw new Error('Agent ยังไม่ได้ override เมธอด chooseMove(state)')
  }

  instance.memory = memory

  Object.defineProperty(instance, 'saveMemory', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(data: AgentMemory) {
      if (!data || typeof data !== 'object') {
        throw new Error('saveMemory() ต้องรับ object ธรรมดา')
      }

      // คู่ซ้อมที่ถูกตรึงไว้ ให้จำเหมือนเดิมทุกเกม — เรียก saveMemory ได้ แต่ไม่มีผล
      if (frozen) return

      instance.memory = data
      post({ type: 'memory', data })
    }
  })

  return watch(instance)
}

function normalize(raw: AgentMove, request: WorkerRequest & { type: 'move' }): { row: number; col: number } {
  if (raw === null || raw === undefined) {
    throw new Error('chooseMove() ไม่ได้คืนค่าตาที่จะลง')
  }

  const row = Array.isArray(raw) ? raw[0] : raw.row
  const col = Array.isArray(raw) ? raw[1] : raw.col

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    throw new Error(`ค่าที่คืนมาไม่ใช่ตำแหน่งบนกระดาน: ${JSON.stringify(raw)}`)
  }

  const legal = getValidMoves(request.state.board, request.state.player)
  if (!findMove(legal, row as number, col as number)) {
    throw new Error(`ตา (${row}, ${col}) ผิดกติกา`)
  }

  return { row: row as number, col: col as number }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    switch (request.type) {
      case 'init': {
        agent = build(request.code, request.memory, request.frozen ?? false)
        post({ type: 'ready', name: typeof agent.name === 'string' ? agent.name : 'Agent', traced })
        break
      }

      case 'start': {
        agent?.onGameStart(request.player)
        break
      }

      case 'move': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        trace = { id: request.id, stack: [], counts: {}, calls: 0, lastSent: 0 }
        lineCounts = {}
        currentLine = 0
        clearLog()
        const startedAt = Date.now()

        try {
          const raw = agent.chooseMove(request.state)
          const move = normalize(raw, request)

          post({
            type: 'trace-summary',
            id: request.id,
            counts: trace.counts,
            calls: trace.calls,
            ms: Date.now() - startedAt,
            lines: lineCounts
          })

          const logs = takeLog()
          if (logs.length > 0) post({ type: 'log', lines: logs })

          post({ type: 'move', id: request.id, move })
        } finally {
          trace = null
        }
        break
      }

      case 'end': {
        agent?.onGameEnd(request.board, request.winner)
        break
      }
    }
  } catch (error) {
    post({
      type: 'error',
      id: request.type === 'move' ? request.id : null,
      message: describe(error)
    })
  }
}
