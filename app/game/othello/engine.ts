export const EMPTY = 0 as const
export const BLACK = 1 as const
export const WHITE = 2 as const

export const BOARD_SIZE = 8

export type Player = typeof BLACK | typeof WHITE
export type Cell = typeof EMPTY | Player
export type Board = Cell[][]

export interface Move {
  row: number
  col: number

  flips: Array<[number, number]>
}

export interface DiscCount {
  black: number
  white: number
  empty: number
}

const DIRECTIONS: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
]

export const opponent = (player: Player): Player => (player === BLACK ? WHITE : BLACK)

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE

export const cloneBoard = (board: Board): Board => board.map((row) => [...row])

export function createBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => EMPTY as Cell)
  )
  board[3]![3] = WHITE
  board[3]![4] = BLACK
  board[4]![3] = BLACK
  board[4]![4] = WHITE
  return board
}

export function getFlips(board: Board, row: number, col: number, player: Player): Array<[number, number]> {
  if (!inBounds(row, col) || board[row]![col] !== EMPTY) return []

  const foe = opponent(player)
  const flips: Array<[number, number]> = []

  for (const [dr, dc] of DIRECTIONS) {
    const line: Array<[number, number]> = []
    let r = row + dr
    let c = col + dc

    while (inBounds(r, c) && board[r]![c] === foe) {
      line.push([r, c])
      r += dr
      c += dc
    }

    if (line.length > 0 && inBounds(r, c) && board[r]![c] === player) {
      flips.push(...line)
    }
  }

  return flips
}

export function getValidMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = []

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const flips = getFlips(board, row, col, player)
      if (flips.length > 0) moves.push({ row, col, flips })
    }
  }

  return moves
}

export const findMove = (moves: Move[], row: number, col: number): Move | undefined =>
  moves.find((move) => move.row === row && move.col === col)

export const hasValidMove = (board: Board, player: Player): boolean =>
  getValidMoves(board, player).length > 0

export function applyMove(board: Board, move: { row: number; col: number }, player: Player): Board {
  const flips = getFlips(board, move.row, move.col, player)
  if (flips.length === 0) {
    throw new Error(`ลงตาที่ (${move.row}, ${move.col}) ไม่ได้`)
  }

  const next = cloneBoard(board)
  next[move.row]![move.col] = player
  for (const [r, c] of flips) next[r]![c] = player
  return next
}

export function countDiscs(board: Board): DiscCount {
  let black = 0
  let white = 0
  let empty = 0

  for (const row of board) {
    for (const cell of row) {
      if (cell === BLACK) black++
      else if (cell === WHITE) white++
      else empty++
    }
  }

  return { black, white, empty }
}

export function discDiff(board: Board, player: Player): number {
  const { black, white } = countDiscs(board)
  return player === BLACK ? black - white : white - black
}

export const toNotation = (row: number, col: number): string =>
  `${String.fromCharCode(97 + col)}${row + 1}`
