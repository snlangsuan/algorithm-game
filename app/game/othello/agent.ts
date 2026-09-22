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
import { fly, readSwarm, score, type Range } from '../line/swarm'
import { ruthlessMove } from './ruthless'

/**
 * ช่องที่หมุนหรือสะท้อนกระดานแล้วตรงกันควรมีน้ำหนักเท่ากัน — มุมทั้งสี่ ช่องติดมุมทั้งแปด ฯลฯ
 * กระดาน 8×8 จึงเหลือแค่ 10 กลุ่ม: พับเหลือหนึ่งในสี่ของกระดาน (4×4) แล้วพับตามแนวทแยงอีกที
 * ฝูงนกหาน้ำหนัก 10 ค่านี้ แทนที่จะหา 64 ค่าทีละช่องแบบตัวอย่าง GA
 */
export const SYMMETRY_CLASS: number[] = Array.from({ length: 64 }, (_, cell) => {
  const row = Math.floor(cell / 8)
  const col = cell % 8
  const a = Math.min(Math.min(row, 7 - row), Math.min(col, 7 - col))
  const b = Math.max(Math.min(row, 7 - row), Math.min(col, 7 - col))
  // (a, b) ที่ 0 ≤ a ≤ b ≤ 3 เรียงเป็นเลขกลุ่ม 0–9 — กลุ่ม 0 คือมุม
  return a * 4 - (a * (a - 1)) / 2 + (b - a)
})

/** ขอบเขตที่ฝูงนกหาในโอเทลโล — น้ำหนักของแต่ละกลุ่ม ช่วงเดียวกับที่ตัวอย่าง GA สุ่ม */
export const OTHELLO_SPACE: ReadonlyArray<Range> = Array.from({ length: 10 }, (_, group) => ({
  key: `g${group}`,
  label: `กลุ่มที่ ${group + 1}`,
  min: 0,
  max: 20
}))

/** ขยายน้ำหนัก 10 กลุ่มเป็น 64 ช่อง เรียงแถวต่อแถว */
export const expandWeights = (groups: number[]): number[] => SYMMETRY_CLASS.map((group) => groups[group] ?? 0)

export interface TurnState {

  board: Board

  player: Player

  opponent: Player

  validMoves: Move[]

  turn: number

  lastMove: { row: number; col: number } | null

  timeBudget: number
}

export interface AgentMemory {

  label?: string
  [key: string]: unknown
}

export type AgentMove = { row: number; col: number } | [number, number] | null

export class OthelloAgent {

  name = 'Agent'

  memory: AgentMemory | null = null

  chooseMove(_state: TurnState): AgentMove {
    throw new Error('Agent ต้อง override เมธอด chooseMove(state)')
  }

  onGameStart(_player: Player): void {}

  onGameEnd(_board: Board, _winner: Player | null): void {}

  saveMemory(_data: AgentMemory): void {}

  /** น้ำหนัก 10 กลุ่มของนกที่ลองอยู่เกมนี้ — ยังไม่ได้สั่งให้ฝูงบินก็เป็น null */
  private bird: number[] | null = null

  /** ฝูงนก: นกตัวถัดไปบินหนึ่งก้าวไปยังน้ำหนักชุดใหม่ แล้วจำฝูงไว้ข้ามเกม */
  swarmFly(): void {
    const swarm = fly(readSwarm(this.memory?.swarm, OTHELLO_SPACE), Math.random, OTHELLO_SPACE)
    this.bird = swarm.birds[swarm.current]!.at
    this.saveMemory({ ...this.memory, swarm, label: `ฝูงนกบินไปแล้ว ${swarm.turn} ก้าว` })
  }

  /** ฝูงนก: น้ำหนัก 64 ช่องของนกตัวนี้ — ยังไม่ได้สั่งบินก็ได้ค่ากลางทุกช่อง */
  birdWeights(): number[] {
    return expandWeights(this.bird ?? OTHELLO_SPACE.map(({ min, max }) => (min + max) / 2))
  }

  /** ฝูงนก: น้ำหนัก 64 ช่องที่ดีที่สุดที่ทั้งฝูงเคยเจอ — ยังไม่มีก็ได้ของนกตัวนี้ */
  swarmBestWeights(): number[] {
    const swarm = readSwarm(this.memory?.swarm, OTHELLO_SPACE)
    return swarm?.best ? expandWeights(swarm.best) : this.birdWeights()
  }

  /** ฝูงนก: ให้คะแนนนกตัวนี้ — ยิ่งมากยิ่งดี ฝูงเก็บเป็นค่าติดลบเพื่อหาค่าที่น้อยที่สุด */
  swarmScore(value: number): void {
    const swarm = readSwarm(this.memory?.swarm, OTHELLO_SPACE)
    if (!swarm) return
    const next = score(swarm, -Number(value))
    const best = next.bestScore === null ? '' : ` · ดีที่สุด ${-next.bestScore} แต้ม`
    this.saveMemory({ ...this.memory, swarm: next, label: `ฝูงนกบินไปแล้ว ${next.turn} ก้าว${best}` })
  }

  /**
   * โหมดโหด — ส่งกระดานให้เอนจินใน ruthless.ts คิด แล้วลงตาที่มันเลือก
   * ใช้เวลาเกือบเต็มโควตาของตา เผื่อไว้ส่วนหนึ่งให้ส่งคำตอบกลับทัน
   */
  ruthless(state: TurnState): AgentMove {
    const budget = Math.max(5, Math.floor(state.timeBudget * 0.85))
    const found = ruthlessMove(state.board, state.player, budget)
    return found ? { row: found.row, col: found.col } : null
  }

  validMoves(board: Board, player: Player): Move[] {
    return getValidMoves(board, player)
  }

  simulate(board: Board, move: { row: number; col: number }, player: Player): Board {
    return applyMove(board, move, player)
  }

  clone(board: Board): Board {
    return cloneBoard(board)
  }

  count(board: Board): DiscCount {
    return countDiscs(board)
  }

  score(board: Board, player: Player): number {
    return discDiff(board, player)
  }

  rival(player: Player): Player {
    return opponent(player)
  }

  notation(row: number, col: number): string {
    return toNotation(row, col)
  }
}

export const AGENT_GLOBALS = { EMPTY, BLACK, WHITE } as const
