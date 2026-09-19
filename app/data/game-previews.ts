/**
 * ภาพย่อของเกมในรายการ "เลือกเกม" — คำนวณสดจากเอนจินจริงทุกภาพ ไม่ใช่รูปที่แคปมาแปะ
 *
 * เหตุผลเดียวกับภาพในหน้าความรู้ (ดู algorithm-figures.ts): พอแผนที่เริ่มต้น สี หรือกติกาเปลี่ยน
 * รูปที่แคปไว้จะโกหกทันทีโดยไม่มีอะไรฟ้อง ที่นี่ใช้ createMaze/solve กับ createBoard/applyMove
 * ตัวเดียวกับที่เกมใช้ และมีเทสต์ล็อกไว้ว่าภาพต้องเดิมทุกครั้ง
 *
 * ภาพย่อเล็กกว่ากระดานจริงมาก จึงย่อขนาดแผนที่ลงให้ยังอ่านออกในกรอบไม่กี่ร้อยพิกเซล
 */
import {
  createMaze,
  createRng,
  solve,
  type Maze,
  type Point
} from '~/game/maze/engine'
import {
  BLACK,
  applyMove,
  countDiscs,
  createBoard,
  getValidMoves,
  opponent,
  type Board,
  type DiscCount,
  type Move,
  type Player
} from '~/game/othello/engine'

export interface MazePreview {
  maze: Maze
  /** เฉลยของแผนที่นี้ ใช้วาดเป็นเส้นทางในภาพ */
  path: Point[]
}

export interface OthelloPreview {
  board: Board
  /** ตาที่ฝ่ายที่ถึงคิวลงได้ วาดเป็นจุดบอกใบ้ */
  moves: Move[]
  /** หมากที่เพิ่งลงไป วาดกรอบไว้ */
  last: Point | null
  turn: Player
  count: DiscCount
}

/** แผนที่ย่อของภาพ — เล็กกว่าค่าเริ่มต้นของเกม (25×19) เพราะต้องอ่านออกในกรอบเล็ก */
const PREVIEW_MAZE = { width: 15, height: 11, seed: 7 } as const

/** เดินไปกี่ตาในภาพ Othello — พอให้กระดานเริ่มมีลวดลาย แต่ยังไม่รกจนดูไม่รู้เรื่อง */
const PREVIEW_PLIES = 18

/** seed ของกระดานในภาพ — เลือกไว้เพราะได้หมากกระจายรอบกลางกระดาน เหมือนเกมจริงช่วงกลาง */
const PREVIEW_SEED = 5

export function buildMazePreview(): MazePreview {
  const maze = createMaze(PREVIEW_MAZE)
  return { maze, path: solve(maze)?.path ?? [maze.start] }
}

/**
 * เดินแบบสุ่มโดยล็อก seed ไว้ — ไม่ใช่บอทเก่ง และไม่ได้ตั้งใจให้เป็น
 * ภาพนี้มีหน้าที่บอกว่า "กระดานหน้าตาแบบนี้" เท่านั้น ถ้าใช้บอทโลภกระดานจะเอียงไปมุมเดียว
 * จนดูไม่เหมือนเกมจริง (createRng มาจากเอนจินเขาวงกต — เป็นตัวสุ่มตัวเดียวที่โปรเจกต์นี้มี)
 */
export function buildOthelloPreview(): OthelloPreview {
  const rng = createRng(PREVIEW_SEED)

  let board = createBoard()
  let turn: Player = BLACK
  let last: Point | null = null

  for (let ply = 0; ply < PREVIEW_PLIES; ply++) {
    const moves = getValidMoves(board, turn)

    if (moves.length === 0) {
      // ฝ่ายนี้ไม่มีตาให้ลง ข้ามให้อีกฝ่าย ถ้าตันทั้งคู่คือจบเกม
      if (getValidMoves(board, opponent(turn)).length === 0) break
      turn = opponent(turn)
      continue
    }

    const move = moves[Math.floor(rng() * moves.length)]!

    board = applyMove(board, move, turn)
    last = { row: move.row, col: move.col }
    turn = opponent(turn)
  }

  // ฝ่ายที่ถึงคิวอาจไม่มีตาให้ลง ภาพจะได้ไม่โชว์จุดบอกใบ้ผิดฝ่าย
  if (getValidMoves(board, turn).length === 0) turn = opponent(turn)

  return {
    board,
    moves: getValidMoves(board, turn),
    last,
    turn,
    count: countDiscs(board)
  }
}
