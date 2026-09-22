import type { MazeMemory, MazeState } from './agent'
import type { Point } from './engine'
import type { LogLine } from '../shared/console'

export interface ExploredCell extends Point {
  line: number
}

export type LineTimeline = number[]

export type AgentMode = 'plan' | 'step'

export type WorkerRequest =
  | { type: 'init'; code: string; memory: MazeMemory | null }
  | { type: 'start'; state: MazeState }
  | { type: 'solve'; id: number; state: MazeState }
  | { type: 'step'; id: number; state: MazeState }
  | { type: 'finish'; id: number; ok: boolean; steps: number; cost: number }

export interface TraceTick {
  type: 'trace'
  id: number
  method: string
  depth: number
  calls: number

  line: number
}

export interface TraceSummary {
  type: 'trace-summary'
  id: number
  counts: Record<string, number>
  calls: number
  ms: number

  lines: Record<number, number>
}

export type WorkerResponse =
  | { type: 'log'; lines: LogLine[] }
  | { type: 'ready'; name: string; mode: AgentMode; traced: boolean }
  | { type: 'path'; id: number; path: Point[]; explored: ExploredCell[]; timeline: number[] }
  | { type: 'move'; id: number; move: Point | null; explored: ExploredCell[]; timeline: number[] }
  /** onFinish ทำงานจบแล้ว — ความจำที่บันทึกระหว่างนั้นถูกส่งออกไปก่อนข้อความนี้เสมอ */
  | { type: 'done'; id: number }
  | { type: 'memory'; data: MazeMemory }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
