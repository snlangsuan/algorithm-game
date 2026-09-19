import type { AgentMemory, TurnState } from './agent'
import type { Board, Player } from './engine'
import type { LogLine } from '../shared/console'

export type WorkerRequest =
  | { type: 'init'; code: string; memory: AgentMemory | null }
  | { type: 'start'; player: Player }
  | { type: 'move'; id: number; state: TurnState }
  | { type: 'end'; board: Board; winner: Player | null }

/** เมธอดที่กำลังทำงานอยู่ ณ ขณะนั้น (ส่งเป็นระยะระหว่างที่ agent คิด) */
export interface TraceTick {
  type: 'trace'
  id: number
  method: string
  depth: number
  calls: number
  /** บรรทัดของโค้ดผู้เล่นที่กำลังรัน (0 = ยังระบุไม่ได้) */
  line: number
}

/** สรุปการทำงานทั้งตา ส่งหลัง chooseMove() คืนค่า */
export interface TraceSummary {
  type: 'trace-summary'
  id: number
  counts: Record<string, number>
  calls: number
  ms: number
  /** จำนวนครั้งที่รันแต่ละบรรทัด */
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
