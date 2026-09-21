import {
  PEG_COUNT,
  canMove,
  heightOf,
  legalMoves,
  pegName,
  smallestPeg,
  spareOf,
  topOf,
  type Move,
  type Towers
} from './engine'

export interface HanoiState {

  towers: Towers

  disks: number

  source: number

  target: number

  spare: number

  move: number

  last: Move | null

  moveLimit: number

  timeBudget: number
}

export type PlanResult = Array<Move | [number, number]> | null

export type StepResult = Move | [number, number] | null

export class HanoiAgent {

  name = 'Agent'

  solve(_state: HanoiState): PlanResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  step(_state: HanoiState): StepResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  onStart(_state: HanoiState): void {}

  onFinish(_result: { ok: boolean; moves: number }): void {}

  visit(_from: number | Move, _to?: number): void {}

  top(towers: Towers, peg: number): number {
    return topOf(towers, peg)
  }

  height(towers: Towers, peg: number): number {
    return heightOf(towers, peg)
  }

  empty(towers: Towers, peg: number): boolean {
    return heightOf(towers, peg) === 0
  }

  legal(towers: Towers, from: number, to: number): boolean {
    return canMove(towers, from, to)
  }

  moves(towers: Towers): Move[] {
    return legalMoves(towers)
  }

  other(from: number, to: number): number {
    return spareOf(from, to)
  }

  smallest(towers: Towers): number {
    return smallestPeg(towers)
  }

  next(peg: number, side: 'right' | 'left'): number {
    const shift = side === 'right' ? 1 : PEG_COUNT - 1
    return (peg + shift) % PEG_COUNT
  }

  label(peg: number): string {
    return pegName(peg)
  }
}

export const AGENT_GLOBALS = { PEG_COUNT } as const
