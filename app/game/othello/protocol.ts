import type { AgentMemory, TurnState } from './agent'
import type { Board, Player } from './engine'
import type { LogLine } from '../shared/console'

export type WorkerRequest =
  /**
   * frozen = ฝั่งนี้เป็นแค่คู่ซ้อม ห้ามจำอะไรเพิ่มระหว่างรอบ
   * ไม่งั้นมันจะปรับตัวสู้ฝั่งที่กำลังฝึกอยู่ กลายเป็นเป้าเคลื่อนที่จนวัดความเก่งไม่ได้
   */
  | { type: 'init'; code: string; memory: AgentMemory | null; frozen?: boolean }
  | { type: 'start'; player: Player }
  | { type: 'move'; id: number; state: TurnState }
  | { type: 'end'; board: Board; winner: Player | null }

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
  | { type: 'ready'; name: string; traced: boolean }
  | { type: 'memory'; data: AgentMemory }
  | { type: 'move'; id: number; move: { row: number; col: number } }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
