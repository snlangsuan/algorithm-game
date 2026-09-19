import {
  BLACK,
  WHITE,
  EMPTY,
  applyMove,
  cloneBoard,
  countDiscs,
  discDiff,
  getValidMoves,
  opponent,
  toNotation,
  type Board,
  type DiscCount,
  type Move,
  type Player
} from './engine'

/** ข้อมูลทั้งหมดที่ agent ได้รับในแต่ละตา */
export interface TurnState {
  /** กระดานปัจจุบัน: board[row][col] มีค่าเป็น EMPTY(0) / BLACK(1) / WHITE(2) */
  board: Board
  /** สีของเราในตานี้ */
  player: Player
  /** สีของคู่ต่อสู้ */
  opponent: Player
  /** ตาที่ลงได้ทั้งหมด — เลือกจากลิสต์นี้เท่านั้น */
  validMoves: Move[]
  /** ลำดับตาที่กำลังเล่น เริ่มจาก 1 */
  turn: number
  /** ตาที่คู่ต่อสู้เพิ่งลง (null ถ้าเป็นตาแรกหรือคู่ต่อสู้ผ่าน) */
  lastMove: { row: number; col: number } | null
  /**
   * เวลาที่ระบบแนะนำให้ใช้คิดในตานี้ (ms)
   * เล่นปกติจะกว้าง ส่วนตอนฝึกซ้อมจะสั้นลงมากเพื่อให้เล่นจบหลายเกมไว ๆ
   * agent จะทำตามหรือไม่ก็ได้ แต่ห้ามเกินเพดานจริง 3 วินาที
   */
  timeBudget: number
}

/** ความจำที่ agent บันทึกไว้ข้ามเกม — ต้องเป็นข้อมูลธรรมดาที่แปลงเป็น JSON ได้ */
export interface AgentMemory {
  /** ข้อความสั้น ๆ ให้หน้าจอแสดงผล เช่น "ฝึกมา 12 เกม" (ไม่ใส่ก็ได้) */
  label?: string
  [key: string]: unknown
}

/** ค่าที่ chooseMove() คืนได้ */
export type AgentMove = { row: number; col: number } | [number, number] | null

/**
 * คลาสแม่ของ agent ทุกตัว
 *
 * ผู้เล่นที่เอาโค้ดมาลงต้องเขียน `class Agent extends OthelloAgent`
 * แล้ว override เมธอด `chooseMove(state)` ให้คืนตาที่จะลง
 *
 * เมธอดอื่นทั้งหมดเป็นตัวช่วยที่เรียกใช้ได้เลย (this.validMoves(), this.simulate(), ...)
 */
export class OthelloAgent {
  /** ชื่อที่จะแสดงบนหน้าจอ — ตั้งทับได้ */
  name = 'Agent'

  /**
   * ความจำจากเกมก่อน ๆ ที่ระบบโหลดกลับมาให้ (null ถ้ายังไม่เคยบันทึก)
   * ใช้คู่กับ saveMemory() สำหรับ agent ที่ต้องเรียนรู้ข้ามเกม เช่น GA
   */
  memory: AgentMemory | null = null

  /** ต้อง override — คืนตาที่จะลง */
  chooseMove(_state: TurnState): AgentMove {
    throw new Error('Agent ต้อง override เมธอด chooseMove(state)')
  }

  /** เรียกครั้งเดียวก่อนเกมเริ่ม (ไม่บังคับ override) */
  onGameStart(_player: Player): void {}

  /** เรียกเมื่อเกมจบ (ไม่บังคับ override) */
  onGameEnd(_board: Board, _winner: Player | null): void {}

  /**
   * บันทึกความจำไว้ใช้เกมหน้า — ระบบจะเก็บลงเครื่องผู้เล่นให้
   * และอัปเดต this.memory ให้ตรงกับที่บันทึกทันที
   * ข้อมูลต้องเป็น object ธรรมดา (ตัวเลข ข้อความ อาเรย์) ห้ามมีฟังก์ชันหรือคลาส
   * ตัวจริงถูกแทนที่ตอนรันใน worker เมธอดนี้จึงว่างไว้
   */
  saveMemory(_data: AgentMemory): void {}

  // ---------- ตัวช่วย ----------

  /** ตาที่ลงได้ทั้งหมดของผู้เล่นที่ระบุ */
  validMoves(board: Board, player: Player): Move[] {
    return getValidMoves(board, player)
  }

  /** ลองลงหมากแล้วคืนกระดานใหม่ (ไม่แก้กระดานเดิม) */
  simulate(board: Board, move: { row: number; col: number }, player: Player): Board {
    return applyMove(board, move, player)
  }

  /** สำเนากระดาน */
  clone(board: Board): Board {
    return cloneBoard(board)
  }

  /** นับหมากบนกระดาน */
  count(board: Board): DiscCount {
    return countDiscs(board)
  }

  /** ผลต่างจำนวนหมากจากมุมมองของ player (ยิ่งมากยิ่งดี) */
  score(board: Board, player: Player): number {
    return discDiff(board, player)
  }

  /** สีของคู่ต่อสู้ */
  rival(player: Player): Player {
    return opponent(player)
  }

  /** แปลงตำแหน่งเป็นโน้ต เช่น (2, 3) -> "d3" */
  notation(row: number, col: number): string {
    return toNotation(row, col)
  }
}

/** ค่าคงที่ที่ agent เรียกใช้ได้ในสโคปของโค้ดผู้เล่น */
export const AGENT_GLOBALS = { EMPTY, BLACK, WHITE } as const
