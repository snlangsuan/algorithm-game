import type { HanoiState } from './agent'
import type { Move } from './engine'
import type { LogLine } from '../shared/console'

export interface ExploredMove extends Move {
  line: number
}

export type LineTimeline = number[]

export type AgentMode = 'plan' | 'step'

export type WorkerRequest =
  | { type: 'init'; code: string }
  | { type: 'start'; state: HanoiState }
  | { type: 'solve'; id: number; state: HanoiState }
  | { type: 'step'; id: number; state: HanoiState }
  | { type: 'finish'; ok: boolean; moves: number }

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
  | { type: 'plan'; id: number; moves: Move[]; explored: ExploredMove[]; timeline: number[] }
  | { type: 'move'; id: number; move: Move | null; explored: ExploredMove[]; timeline: number[] }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
