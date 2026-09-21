import type { ChaseState } from './agent'
import type { Direction, Point } from './engine'
import type { LogLine } from '../shared/console'

/**
 * หนึ่งคำสั่งเดินที่ AI ตอบกลับมา
 * ok = false คือสั่งเดินชนกำแพง ระบบให้ยืนอยู่กับที่แล้วเขียนบอกในคอนโซล
 */
export interface MoverMove {
  /** หมายเลขผู้ไล่ล่า — ฝ่ายหนีใช้ 0 เพราะมีตัวเดียว */
  index: number
  dir: Direction | null
  ok: boolean
  note?: string
}

export type WorkerRequest =
  | { type: 'init'; code: string }
  | { type: 'start'; state: ChaseState }
  /** ฝ่ายไล่ — ถึงตาเดินของผู้ไล่ล่าตัวไหนบ้างในจังหวะนี้ */
  | { type: 'think'; id: number; state: ChaseState; hunters: number[] }
  /** ฝ่ายหนี — ถามทางเดินของคนหนีหนึ่งก้าว */
  | { type: 'flee'; id: number; state: ChaseState }
  | { type: 'finish'; caught: boolean; ticks: number }

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
  /** ช่องที่ AI เปิดดูระหว่างคิด ใช้ระบายสีบนสนาม */
  | { type: 'moves'; id: number; moves: MoverMove[]; looked: Point[] }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
