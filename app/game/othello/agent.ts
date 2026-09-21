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
