import {
  ChaseAgent,
  AGENT_GLOBALS,
  type ChaseState,
  type MoveResult,
  type MoverView
} from './agent'
import {
  DIRECTION_LABEL,
  isDirection,
  stepInto,
  walkable,
  type Direction,
  type Point
} from './engine'
import { instrument } from '../shared/instrument'
import { captureConsole, clearLog, pushLog, takeLog } from '../shared/console'
import { cleanReason, type Reason } from '../shared/reason'
import type { MoverMove, WorkerRequest, WorkerResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

captureConsole(ctx as unknown as { console: Console }, () => currentLine)

const TRACE_INTERVAL = 40

/** ช่องที่ AI เปิดดูต่อหนึ่งจังหวะ — เกินนี้ก็ไม่ต้องส่งกลับไปวาด */
const LOOKED_LIMIT = 4000

const LINE_MARKER = '__chaseLine'

const CLOCK_EVERY = 2048

let agent: ChaseAgent | null = null
let traced = false
let looked: Point[] = []

/** เหตุผลล่าสุดที่ตัวที่กำลังคิดบอกไว้ — ล้างทุกครั้งก่อนถามตัวถัดไป */
let reason: Reason | null = null

/** อ่านผ่านฟังก์ชัน — ค่าถูกตั้งจากในโค้ดของผู้เล่น ตัวตรวจชนิดจึงมองไม่เห็นว่าเปลี่ยนไปแล้ว */
const heard = (): Reason | null => reason

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

/** ห่อทุกเมธอดของ agent ด้วยตัวนับ — แผง "โปรแกรมนี้ทำงานยังไง" อ่านยอดจากตรงนี้ */
function watch(instance: ChaseAgent): ChaseAgent {
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

function build(code: string): { instance: ChaseAgent; traced: boolean } {
  const marked = instrument(code, LINE_MARKER)

  const factory = new Function(
    'ChaseAgent',
    'FLOOR',
    'WALL',
    LINE_MARKER,
    '__log',
    `"use strict";
${marked.code}
;
if (typeof Agent === 'undefined') {
  throw new Error('ไม่พบคลาสชื่อ Agent — ต้องเขียน "class Agent extends ChaseAgent { ... }"')
}
return Agent;`
  )

  const AgentClass = factory(
    ChaseAgent,
    AGENT_GLOBALS.FLOOR,
    AGENT_GLOBALS.WALL,
    markLine,
    (value: unknown) => pushLog(value, currentLine)
  )

  if (typeof AgentClass !== 'function') throw new Error('Agent ต้องเป็นคลาส')

  const instance = new AgentClass() as ChaseAgent

  if (instance.step === ChaseAgent.prototype.step) {
    throw new Error('Agent ยังไม่ได้ override เมธอด step(state)')
  }

  Object.defineProperty(instance, 'visit', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(cell: Point) {
      if (!cell || looked.length >= LOOKED_LIMIT) return
      if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) return
      looked.push({ row: cell.row, col: cell.col })
    }
  })

  Object.defineProperty(instance, 'reason', {
    configurable: true,
    writable: true,
    enumerable: false,
    value(why: unknown) {
      reason = cleanReason(why)
    }
  })

  return { instance: watch(instance), traced: marked.ok && marked.lines.length > 0 }
}

/** แปลงสิ่งที่ step() คืนมาให้เป็นทิศเดียว — รับทั้งชื่อทิศ ช่องที่ติดกัน และ [แถว, หลัก] */
function toDirection(raw: MoveResult, from: Point): Direction | null {
  if (raw === null || raw === undefined) return null
  if (isDirection(raw)) return raw

  const row = Array.isArray(raw) ? raw[0] : (raw as Point).row
  const col = Array.isArray(raw) ? raw[1] : (raw as Point).col

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    throw new Error(`ค่าที่คืนมาไม่ใช่ทิศหรือช่อง: ${JSON.stringify(raw)}`)
  }

  const gap = Math.abs(row - from.row) + Math.abs(col - from.col)
  if (gap === 0) return null
  if (gap > 1) {
    throw new Error(
      `สั่งกระโดดไปช่อง (${row}, ${col}) ซึ่งไม่ได้อยู่ติดกัน — เดินได้ทีละหนึ่งช่องเท่านั้น`
    )
  }

  if (row < from.row) return 'up'
  if (row > from.row) return 'down'
  if (col < from.col) return 'left'
  return 'right'
}

/**
 * ถามทางเดินของตัวหนึ่ง — me คือตัวที่กำลังคิด ส่วน label ใช้เขียนข้อความตอนเดินไปชนอะไรเข้า
 * mates คือตัวอื่นที่ยืนขวางอยู่ได้ (ผู้ไล่ล่าด้วยกัน) — คนหนีไม่มี เพราะชนผู้ไล่ล่าคือโดนจับ
 */
function decide(
  state: ChaseState,
  me: MoverView,
  label: string,
  mates: MoverView[] = []
): MoverMove {
  const index = me.index
  reason = null
  const dir = toDirection(agent!.step({ ...state, me }), me)
  const said = heard()
  const why = said ? { reason: { ...said, who: label.trim() } } : {}
  if (!dir) return { index, dir: null, ok: true, ...why }

  const next = stepInto(me, dir)

  if (!walkable(state.grid, next.row, next.col)) {
    return {
      index,
      dir: null,
      ok: false,
      note: `${label}สั่งเดิน${DIRECTION_LABEL[dir]}ไปชนกำแพง จึงยืนอยู่กับที่`,
      ...why
    }
  }

  const blocker = mates.find(
    (mate) => mate.index !== index && mate.row === next.row && mate.col === next.col
  )

  if (blocker) {
    return {
      index,
      dir: null,
      ok: false,
      note: `${label}จะเดิน${DIRECTION_LABEL[dir]}ไปทับตัวที่ ${blocker.index + 1} จึงยืนอยู่กับที่ — ลองให้แต่ละตัวเล็งคนละที่ดู`,
      ...why
    }
  }

  return { index, dir, ok: true, ...why }
}

function run<T>(id: number, work: () => T): T {
  trace = { id, stack: [], counts: {}, calls: 0, lastSent: 0 }
  looked = []
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
        const built = build(request.code)
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
        break
      }

      case 'think': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        const moves = run(request.id, () =>
          request.hunters
            .map((index) => request.state.hunters[index])
            .filter((hunter): hunter is MoverView => Boolean(hunter))
            .map((hunter) =>
              decide(
                request.state,
                hunter,
                `ผู้ไล่ล่าตัวที่ ${hunter.index + 1} `,
                request.state.hunters
              )
            )
        )

        post({ type: 'moves', id: request.id, moves, looked })
        break
      }

      case 'flee': {
        if (!agent) throw new Error('ยังไม่ได้โหลดโค้ดของ agent')

        // ฝั่งเกมตั้ง me เป็นคนหนีมาให้แล้ว ตรงนี้จึงถามทางของตัวเดียวพอ
        const moves = run(request.id, () => [decide(request.state, request.state.me, 'คนหนี')])

        post({ type: 'moves', id: request.id, moves, looked })
        break
      }

      case 'finish': {
        agent?.onFinish({ caught: request.caught, ticks: request.ticks })
        break
      }
    }
  } catch (error) {
    post({
      type: 'error',
      id: request.type === 'think' || request.type === 'flee' ? request.id : null,
      message: describe(error)
    })
  }
}
