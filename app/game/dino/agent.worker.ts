import { DinoAgent, AGENT_GLOBALS, type ActionResult, type DinoMemory, type DinoState } from './agent'
import { isAction, type Action } from './engine'
import { instrument } from '../shared/instrument'
import { captureConsole, clearLog, pushLog, takeLog } from '../shared/console'
import type { WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

captureConsole(ctx as unknown as { console: Console }, () => currentLine)

const TRACE_INTERVAL = 40

const LINE_MARKER = '__dinoLine'

const CLOCK_EVERY = 2048

let agent: DinoAgent | null = null
let traced = false

/** ลำดับของสิ่งกีดขวางที่โปรแกรมเปิดดูในจังหวะนี้ */
let watched: number[] = []

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

function exitMethod() {
  trace?.stack.pop()
}

function markLine(line: number) {
  currentLine = line
  lineCounts[line] = (lineCounts[line] ?? 0) + 1

  if (++marks % CLOCK_EVERY === 0) sendTick(trace?.stack[trace.stack.length - 1] ?? 'step')
}

/**
 * ห่อทุกเมธอดของ agent ด้วยตัวนับ — แผง "โปรแกรมนี้ทำงานยังไง" อ่านยอดจากตรงนี้
 * ห้ามตั้งชื่อฟังก์ชันนี้ว่า instrument ซ้ำกับของที่ import มา ไม่งั้น worker โหลดไม่ขึ้น
 */
function countCalls(instance: DinoAgent): DinoAgent {
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

function build(code: string, memory: DinoMemory | null): { instance: DinoAgent; traced: boolean } {
  const marked = instrument(code, LINE_MARKER)

  const factory = new Function(
    'DinoAgent',
    'AIR_TIME',
    'JUMP_PEAK',
    LINE_MARKER,
    '__log',
    `"use strict";
${marked.code}
;
if (typeof Agent === 'undefined') {
  throw new Error('ไม่พบคลาสชื่อ Agent — ต้องเขียน "class Agent extends DinoAgent { ... }"')
}
return Agent;`
  )

  const AgentClass = factory(
    DinoAgent,
    AGENT_GLOBALS.AIR_TIME,
    AGENT_GLOBALS.JUMP_PEAK,
    markLine,
    (value: unknown) => pushLog(value, currentLine)
  )

  if (typeof AgentClass !== 'function') throw new Error('Agent ต้องเป็นคลาส')

  const instance = new AgentClass() as DinoAgent

  if (instance.step === DinoAgent.prototype.step) {
    throw new Error('Agent ยังไม่ได้ override เมธอด step(state)')
  }

  instance.memory = memory

  // ความจำส่งกลับไปให้หน้าเว็บเขียนลงเครื่อง — worker ตายเมื่อไรของในนี้ก็หายไปด้วย
  Object.defineProperty(instance, 'saveMemory', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(data: DinoMemory) {
      if (!data || typeof data !== 'object') throw new Error('saveMemory() ต้องรับ object ธรรมดา')

      instance.memory = data
      post({ type: 'memory', data })
    }
  })

  Object.defineProperty(instance, 'watch', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(index: number) {
      if (!Number.isInteger(index) || index < 0 || watched.includes(index)) return
      watched.push(index)
    }
  })

  return { instance: countCalls(instance), traced: marked.ok && marked.lines.length > 0 }
}

/** แปลงสิ่งที่ step() คืนมาให้เป็นท่าเดียว — ไม่ตอบอะไรเลยถือว่าวิ่งต่อ */
function toAction(raw: ActionResult | unknown): Action {
  if (raw === null || raw === undefined || raw === false) return 'run'
  if (isAction(raw)) return raw

  throw new Error(
    `ค่าที่คืนมาไม่ใช่ท่าที่สั่งได้: ${JSON.stringify(raw)} — ต้องเป็น 'jump', 'duck' หรือ 'run'`
  )
}

function decide(state: DinoState): Action {
  return toAction(agent!.step(state))
}

function run<T>(id: number, work: () => T): T {
  trace = { id, stack: [], counts: {}, calls: 0, lastSent: 0 }
  watched = []
  lineCounts = {}
  currentLine = 0
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
        const built = build(request.code, request.memory)
        agent = built.instance
        traced = built.traced
        post({
          type: 'ready',
          name: typeof agent.name === 'string' ? agent.name : 'Agent',
          traced
        })
        break
      }

      case 'start': {
        agent?.onStart(request.state)
        post({ type: 'done', id: request.id })
        break
      }

      case 'think': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const action = run(request.id, () => decide(request.state))
        post({ type: 'move', id: request.id, action, watched })
        break
      }

      case 'finish': {
        agent?.onFinish(request.state)
        post({ type: 'done', id: request.id })
        break
      }
    }
  } catch (error) {
    post({
      type: 'error',
      id: request.type === 'init' ? null : request.id,
      message: describe(error)
    })
  }
}
