import type { LineMemory, LineState } from './agent'
import type { Drive } from './engine'
import type { LogLine } from '../shared/console'

export type WorkerRequest =
  | { type: 'init'; code: string; memory: LineMemory | null }
  | { type: 'start'; id: number; state: LineState }
  | { type: 'think'; id: number; state: LineState }
  | { type: 'finish'; id: number; state: LineState }

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
  /**
   * กำลังมอเตอร์ของจังหวะนี้ — ตัดให้อยู่ในช่วง ±100 แล้ว
   * watched คือเซนเซอร์ที่โปรแกรมเปิดดูระหว่างคิด สนามจะวงให้เห็น
   */
  | { type: 'move'; id: number; drive: Drive; watched: number[] }
  /** onStart / onFinish ทำงานจบแล้ว — ความจำที่บันทึกระหว่างนั้นถูกส่งออกไปก่อนข้อความนี้เสมอ */
  | { type: 'done'; id: number }
  | { type: 'memory'; data: LineMemory }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
