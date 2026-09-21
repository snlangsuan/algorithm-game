import type { DinoMemory, DinoState } from './agent'
import type { Action } from './engine'
import type { LogLine } from '../shared/console'

export type WorkerRequest =
  | { type: 'init'; code: string; memory: DinoMemory | null }
  | { type: 'start'; id: number; state: DinoState }
  | { type: 'think'; id: number; state: DinoState }
  | { type: 'finish'; id: number; state: DinoState }

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
   * ท่าของจังหวะนี้ — ทำได้จริงไหมให้เอนจินเป็นคนตัดสิน ที่นี่แค่ส่งสิ่งที่โปรแกรมตอบมา
   * watched คือลำดับของสิ่งกีดขวางที่โปรแกรมเปิดดูระหว่างคิด — ลู่จะตีกรอบให้เห็น
   */
  | { type: 'move'; id: number; action: Action; watched: number[] }
  /** onStart / onFinish ทำงานจบแล้ว — ความจำที่บันทึกระหว่างนั้นถูกส่งออกไปก่อนข้อความนี้เสมอ */
  | { type: 'done'; id: number }
  | { type: 'memory'; data: DinoMemory }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
