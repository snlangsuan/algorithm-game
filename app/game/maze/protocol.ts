import type { MazeState } from './agent'
import type { Point } from './engine'
import type { LogLine } from '../shared/console'

/** ช่องที่โค้ดสำรวจ พร้อมบรรทัดที่สั่ง this.visit() ตอนนั้น */
export interface ExploredCell extends Point {
  line: number
}

/**
 * ลำดับบรรทัดที่โค้ดรันไปตลอดรอบ เก็บเป็นคู่ [บรรทัด, จำนวนช่องที่สำรวจแล้ว]
 * หน้าจอใช้เล่นย้อนให้ไฮไลต์ในโค้ดเดินพร้อมกับสีบนแผนที่
 */
export type LineTimeline = number[]

/** โหมดทำงานของ agent — ดูจากว่า override เมธอดไหนไว้ */
export type AgentMode = 'plan' | 'step'

export type WorkerRequest =
  | { type: 'init'; code: string }
  | { type: 'start'; state: MazeState }
  | { type: 'solve'; id: number; state: MazeState }
  | { type: 'step'; id: number; state: MazeState }
  | { type: 'finish'; ok: boolean; steps: number; cost: number }

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

/** สรุปการทำงานทั้งรอบ ส่งหลังเมธอดของ agent คืนค่า */
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
  | { type: 'ready'; name: string; mode: AgentMode; traced: boolean }
  | { type: 'path'; id: number; path: Point[]; explored: ExploredCell[]; timeline: number[] }
  | { type: 'move'; id: number; move: Point | null; explored: ExploredCell[]; timeline: number[] }
  | { type: 'error'; id: number | null; message: string }
  | TraceTick
  | TraceSummary
