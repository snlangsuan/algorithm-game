/**
 * ภาพประกอบของหน้าความรู้ — คำนวณสดจากเอนจินจริงทุกภาพ ไม่ใช่รูปที่แคปมาแปะ
 *
 * เหตุผลที่ไม่เก็บเป็นไฟล์ภาพ: พอแผนที่เริ่มต้น สี หรือกติกาเปลี่ยน รูปที่แคปไว้จะโกหกทันที
 * โดยไม่มีอะไรฟ้อง ที่นี่ใช้ createMaze/solve ตัวเดียวกับที่เกมใช้ และมีเทสต์ล็อกตัวเลขในคำบรรยายไว้
 *
 * ทุกภาพต้องเดิมทุกครั้งที่เปิด — ห้ามใช้ Math.random ที่ไหนเลย ใช้ createRng(seed) เท่านั้น
 */
import {
  COST_FLOOR,
  COST_MUD,
  DIRECTIONS,
  MUD,
  WALL,
  createMaze,
  createRng,
  findDirection,
  key,
  manhattan,
  same,
  solve,
  stepCost,
  solveSteps,
  walkable,
  type Direction,
  type Maze,
  type Point
} from '~/game/maze/engine'
import {
  BLACK,
  BOARD_SIZE,
  WHITE,
  applyMove,
  countDiscs,
  createBoard,
  getValidMoves,
  type Board,
  type Move,
  type Player
} from '~/game/othello/engine'

export interface MazeFigure {
  kind: 'maze'
  maze: Maze
  /** ช่องที่ถูกเปิดดู เรียงตามลำดับ — ใช้ไล่เฉดสีให้เห็นว่าอันไหนมาก่อน */
  explored: Point[]
  /** เส้นทางที่เดินจริง */
  path: Point[]
  /** เฉลยของแผนที่ วาดเป็นเส้นประ */
  optimal: Point[]
  caption: string
}

export interface OthelloFigure {
  kind: 'othello'
  board: Board
  moves: Move[]
  last: Point | null
  caption: string
}

export type Figure = MazeFigure | OthelloFigure

// ---------- เขาวงกต ----------

/** แผนที่เดียวกับที่ผู้เล่นเจอตอนเปิดเกมครั้งแรก (seed 1) — ภาพกับเกมจึงตรงกันจริง */
const demoMaze = (): Maze => createMaze()

const turnTo = (facing: Direction, side: 'left' | 'right'): Direction => {
  const at = DIRECTIONS.findIndex((dir) => dir.name === facing)
  const shift = side === 'right' ? 1 : DIRECTIONS.length - 1
  return DIRECTIONS[(at + shift) % DIRECTIONS.length]!.name
}

const ahead = (at: Point, facing: Direction): Point => {
  const dir = findDirection(facing)!
  return { row: at.row + dir.dr, col: at.col + dir.dc }
}

const blocked = (maze: Maze, at: Point, facing: Direction): boolean => {
  const next = ahead(at, facing)
  return !walkable(maze.grid, next.row, next.col)
}

/**
 * เลาะกำแพงขวา — ไล่ตามบล็อกของตัวอย่าง "เลาะกำแพงขวา" ทีละข้อ
 * ถ้าขวาว่าง: หันขวาแล้วเดิน · ถ้าหน้าว่าง: เดิน · ไม่งั้น: หันซ้าย
 */
export function wallFollowerWalk(maze: Maze, limit = 4000): Point[] {
  const path: Point[] = [maze.start]
  let at = maze.start
  let facing: Direction = 'right'

  for (let turn = 0; turn < limit && !same(at, maze.goal); turn++) {
    if (!blocked(maze, at, turnTo(facing, 'right'))) {
      facing = turnTo(facing, 'right')
      at = ahead(at, facing)
      path.push(at)
    } else if (!blocked(maze, at, facing)) {
      at = ahead(at, facing)
      path.push(at)
    } else {
      facing = turnTo(facing, 'left')
    }
  }

  return path
}

/**
 * รอยเท้าน้อยสุด — เทียบสี่ทางแล้วเลือกที่เหยียบน้อยสุด
 * เสมอกันให้ของเดิมชนะ (หน้า > ขวา > ซ้าย > หลัง) เหมือนบล็อกที่ใช้ `<` ไม่ใช่ `<=`
 */
export function leastVisitedWalk(maze: Maze, limit = 4000): Point[] {
  const path: Point[] = [maze.start]
  const marks = new Map<string, number>()

  let at = maze.start
  let facing: Direction = 'right'

  for (let turn = 0; turn < limit && !same(at, maze.goal); turn++) {
    const id = key(at.row, at.col)
    marks.set(id, (marks.get(id) ?? 0) + 1)

    const sides: Array<{ facing: Direction; seen: number }> = []

    for (const side of [facing, turnTo(facing, 'right'), turnTo(facing, 'left'), turnTo(turnTo(facing, 'right'), 'right')]) {
      const next = ahead(at, side)
      if (!walkable(maze.grid, next.row, next.col)) continue
      sides.push({ facing: side, seen: marks.get(key(next.row, next.col)) ?? 0 })
    }

    if (sides.length === 0) break

    let best = sides[0]!
    for (const side of sides) if (side.seen < best.seen) best = side

    facing = best.facing
    at = ahead(at, facing)
    path.push(at)
  }

  return path
}

/**
 * สุ่มเดิน — เดินหน้าเรื่อย ๆ สุ่มเลี้ยวเป็นครั้งคราว ชนกำแพงก็เลี้ยว
 * limit สั้น ๆ เพราะจุดประสงค์ของภาพคือให้เห็นว่ามันเดินทับรอยตัวเอง ไม่ใช่ให้ถึงทางออก
 */
export function randomWalk(maze: Maze, seed = 7, limit = 500): Point[] {
  const rng = createRng(seed)
  const path: Point[] = [maze.start]

  let at = maze.start
  let facing: Direction = 'right'

  for (let turn = 0; turn < limit && !same(at, maze.goal); turn++) {
    if (blocked(maze, at, facing) || Math.floor(rng() * 5) === 0) {
      facing = turnTo(facing, Math.floor(rng() * 2) === 0 ? 'right' : 'left')
    }

    if (!blocked(maze, at, facing)) {
      at = ahead(at, facing)
      path.push(at)
    }
  }

  return path
}

/** จำนวนรอบที่สุ่มเล่นต่อหนึ่งตาในภาพของ MCTS — พอให้ตัวเลขนิ่งแต่ยังเร็ว */
const MCTS_ROUNDS = 60

export type Sweep = 'dfs' | 'bfs' | 'dijkstra' | 'astar'

/** ช่องที่รอคิวเปิดดู — spent/score ใช้เฉพาะสองวิธีที่เรียงตามราคา อีกสองวิธีปล่อยเป็นศูนย์ไว้ */
interface Waiting {
  at: Point
  spent: number
  score: number
}

/**
 * หยิบช่องถัดไปจากกองที่รออยู่ — ความต่างของสี่วิธีอยู่ตรงนี้ที่เดียว
 * ค้นลึกหยิบตัวท้าย (กองซ้อน) ค้นกว้างหยิบตัวแรก (คิว) อีกสองแบบหยิบตัวที่คะแนนต่ำสุด
 */
const takeNext = (waiting: Waiting[], how: Sweep): Waiting => {
  if (how === 'dfs') return waiting.pop()!
  if (how === 'bfs') return waiting.shift()!

  let pick = 0
  for (let index = 1; index < waiting.length; index++) {
    if (waiting[index]!.score < waiting[pick]!.score) pick = index
  }
  return waiting.splice(pick, 1)[0]!
}

/** ค้นลึกกับค้นกว้างไม่สนราคา ช่องหนึ่งเข้าคิวครั้งเดียวจบ */
const offerOnce = (seen: Set<string>, next: Point): Waiting | null => {
  const id = key(next.row, next.col)
  if (seen.has(id)) return null

  seen.add(id)
  return { at: next, spent: 0, score: 0 }
}

/**
 * Dijkstra กับ A* ยอมให้ช่องเดิมเข้าคิวซ้ำได้ ถ้ารอบนี้ไปถึงด้วยราคาที่ถูกกว่าเดิม
 * ต่างกันแค่ A* บวกระยะที่เดาไว้เข้าไปในคะแนน ตัวที่ใช้ตัดสินว่าจะหยิบอันไหนก่อน
 */
const offerCheaper = (
  best: Map<string, number>,
  maze: Maze,
  next: Point,
  spent: number,
  how: Sweep
): Waiting | null => {
  const id = key(next.row, next.col)
  const total = spent + (maze.grid[next.row]?.[next.col] === MUD ? COST_MUD : COST_FLOOR)
  if (total >= (best.get(id) ?? Infinity)) return null

  best.set(id, total)
  const guess = how === 'astar' ? manhattan(next, maze.goal) : 0
  return { at: next, spent: total, score: total + guess }
}

/**
 * ลำดับที่แต่ละวิธีเปิดดูช่อง — หัวใจของภาพสามใบท้าย เพราะรูปร่างของสีคือตัวบอกความต่าง
 * ค่าที่คืนคือช่องที่ถูก "หยิบออกมาสรุป" ตามลำดับ ตรงกับนิยามของ expanded ใน engine.ts
 *
 * โครงเดียวกันทั้งสี่วิธี ต่างกันแค่สองจุด: หยิบตัวไหนก่อน (takeNext)
 * กับรับเพื่อนบ้านเข้าคิวเมื่อไหร่ (offerOnce / offerCheaper)
 */
export function sweepOrder(maze: Maze, how: Sweep): Point[] {
  const start = key(maze.start.row, maze.start.col)
  const seen = new Set<string>([start])
  const best = new Map<string, number>([[start, 0]])
  const byCost = how === 'dijkstra' || how === 'astar'

  const order: Point[] = []
  const waiting: Waiting[] = [{ at: maze.start, spent: 0, score: 0 }]

  // เพดาน 5000 กันภาพบวมเกินจำเป็น แผนที่เริ่มต้นมีไม่ถึงพันช่องอยู่แล้ว
  while (waiting.length > 0 && order.length <= 5000) {
    const node = takeNext(waiting, how)

    order.push(node.at)
    if (same(node.at, maze.goal)) break

    for (const dir of DIRECTIONS) {
      const next = { row: node.at.row + dir.dr, col: node.at.col + dir.dc }
      if (!walkable(maze.grid, next.row, next.col)) continue

      const found = byCost
        ? offerCheaper(best, maze, next, node.spent, how)
        : offerOnce(seen, next)
      if (found) waiting.push(found)
    }
  }

  return order
}

// ---------- Othello ----------

type Policy = (board: Board, moves: Move[], me: Player) => Move

/** มุมทั้งสี่ — ยึดแล้วไม่มีวันถูกพลิก เพราะไม่มีช่องถัดออกไปให้หนีบ */
const CORNERS: Point[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 }
]

const isCorner = (move: Point): boolean => CORNERS.some((corner) => same(corner, move))

/** ช่องที่อยู่ติดมุม — ลงแล้วเท่ากับยื่นมุมให้คู่แข่ง */
const nextToCorner = (move: Point): boolean =>
  CORNERS.some(
    (corner) => Math.abs(corner.row - move.row) <= 1 && Math.abs(corner.col - move.col) <= 1
  ) && !isCorner(move)

/** กินเยอะสุด — ตรงกับตัวอย่าง "กินเยอะสุด" ที่ต่อด้วยบล็อกไว้ (ไล่ดูทุกตา เก็บตาที่พลิกได้มากที่สุด) */
const greedy: Policy = (_board, moves) =>
  moves.reduce((best, move) => (move.flips.length > best.flips.length ? move : best), moves[0]!)

/** ยึดมุมก่อน — มุมมาก่อน เลี่ยงช่องติดมุม ที่เหลือค่อยกินเยอะสุด */
const corner: Policy = (board, moves, me) => {
  const take = moves.find(isCorner)
  if (take) return take

  const safe = moves.filter((move) => !nextToCorner(move))
  return greedy(board, safe.length > 0 ? safe : moves, me)
}

/** กินน้อยสุด — ตรงข้ามกับโลภ ใช้ในช่วงต้นเกมเพื่อไม่ให้ตัวเองเหลือตาลงน้อย */
const fewest: Policy = (_board, moves) =>
  moves.reduce((best, move) => (move.flips.length < best.flips.length ? move : best), moves[0]!)

/**
 * ต้นเกมเก็บตัว ท้ายเกมกินรวบ — ตรงกับตัวอย่าง "late" ที่ต่อด้วยบล็อกไว้
 * เส้นแบ่งช่วงคือช่องว่างเหลือ 12 ช่อง เหมือนบล็อกเป๊ะ
 */
const PHASE_LINE = 12
const phases: Policy = (board, moves, me) => {
  const take = moves.find(isCorner)
  if (take) return take

  if (countDiscs(board).empty < PHASE_LINE) return greedy(board, moves, me)

  const safe = moves.filter((move) => !nextToCorner(move))
  return fewest(board, safe.length > 0 ? safe : moves, me)
}

/** เส้นฐานสุ่ม — ต้องผูกกับ seed ไม่งั้นภาพในหน้าความรู้เปลี่ยนทุกครั้งที่เปิด */
const randomPlay = (seed: number): Policy => {
  const rng = createRng(seed)
  return (_board, moves) => moves[Math.floor(rng() * moves.length)] ?? moves[0]!
}

/** เลือกช่องที่น้ำหนักสูงสุด — วิธีตัดสินใจของตัวอย่าง GA ส่วนน้ำหนักมาจากไหนเป็นอีกเรื่อง */
const byWeight =
  (weights: number[]): Policy =>
  (_board, moves) =>
    moves.reduce(
      (best, move) =>
        weights[move.row * BOARD_SIZE + move.col]! > weights[best.row * BOARD_SIZE + best.col]!
          ? move
          : best,
      moves[0]!
    )

/** น้ำหนักสุ่มล้วน = รุ่นที่ 0 ของ GA ก่อนเรียนรู้อะไรเลย */
const randomWeights = (seed: number): number[] => {
  const rng = createRng(seed)
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => Math.round(rng() * 100))
}

interface Match {
  board: Board
  last: Point | null
  moves: Move[]
  turn: Player
  played: number
  black: number
  white: number
}

/** เล่นจนจบ หรือหยุดที่ตาที่กำหนด — ไม่มีการสุ่ม ผลจึงเท่าเดิมทุกครั้ง */
export function playMatch(black: Policy, white: Policy, stopAfter = Infinity): Match {
  let board = createBoard()
  let turn: Player = BLACK
  let last: Point | null = null
  let played = 0

  while (played < stopAfter) {
    const moves = getValidMoves(board, turn)

    if (moves.length === 0) {
      const other = getValidMoves(board, turn === BLACK ? WHITE : BLACK)
      if (other.length === 0) break
      turn = turn === BLACK ? WHITE : BLACK
      continue
    }

    const move = (turn === BLACK ? black : white)(board, moves, turn)
    board = applyMove(board, move, turn)
    last = { row: move.row, col: move.col }
    turn = turn === BLACK ? WHITE : BLACK
    played++
  }

  const count = countDiscs(board)

  return {
    board,
    last,
    moves: getValidMoves(board, turn),
    turn,
    played,
    black: count.black,
    white: count.white
  }
}

/**
 * สุ่มเล่นจากกระดานนี้ไปจนจบเกมหนึ่งรอบ แล้วบอกว่าฝั่ง me ชนะไหม
 * นี่คือ "การสุ่มเล่นจนจบ" ของ MCTS ตรง ๆ — ไม่มีความรู้เรื่องเกมอยู่ในนี้เลยสักบรรทัด
 */
function playout(board: Board, turn: Player, me: Player, rng: () => number): boolean {
  let at = board
  let player = turn

  for (let ply = 0; ply < 80; ply++) {
    const moves = getValidMoves(at, player)

    if (moves.length === 0) {
      const other = player === BLACK ? WHITE : BLACK
      if (getValidMoves(at, other).length === 0) break
      player = other
      continue
    }

    at = applyMove(at, moves[Math.floor(rng() * moves.length)]!, player)
    player = player === BLACK ? WHITE : BLACK
  }

  const tally = countDiscs(at)
  const mine = me === BLACK ? tally.black : tally.white
  return mine > (tally.black + tally.white) - mine
}

/** อัตราชนะของแต่ละตา เมื่อวัดด้วยการสุ่มเล่นจนจบอย่างเดียว */
function playoutRates(board: Board, player: Player, rounds: number, seed: number) {
  const rng = createRng(seed)
  const other = player === BLACK ? WHITE : BLACK

  return getValidMoves(board, player)
    .map((move) => {
      const next = applyMove(board, move, player)
      let wins = 0
      for (let round = 0; round < rounds; round++) {
        if (playout(next, other, player, rng)) wins++
      }
      return { move, rate: Math.round((wins / rounds) * 100) }
    })
    .sort((a, b) => b.rate - a.rate)
}

// ---------- ประกอบเป็นภาพของแต่ละหัวข้อ ----------

const cornersOwnedBy = (board: Board, player: Player): number =>
  CORNERS.filter((at) => board[at.row]![at.col] === player).length

/**
 * สร้างภาพทั้งหมดครั้งเดียวแล้วเก็บไว้ — หน้าเปลี่ยนหัวข้อไม่ต้องคำนวณใหม่
 * คำบรรยายประกอบจากตัวเลขที่คำนวณได้จริง ไม่ฮาร์ดโค้ด จะได้ไม่มีวันขัดกับภาพ
 */
let cache: Record<string, Figure> | null = null

export function buildFigures(): Record<string, Figure> {
  const maze = demoMaze()
  const optimal = solve(maze)?.path ?? []
  const shortest = solveSteps(maze)?.path ?? []

  const wall = wallFollowerWalk(maze)
  const mouse = leastVisitedWalk(maze)
  const wander = randomWalk(maze)

  const bfs = sweepOrder(maze, 'bfs')
  const dfs = sweepOrder(maze, 'dfs')

  /**
   * สองหัวข้อท้ายใช้แผนที่แบบ "อุปสรรคสุ่ม" แทน เพราะบนเขาวงกตแท้มีทางเดียวถึงกันอยู่แล้ว
   * ทางที่ถูกที่สุดกับทางที่ก้าวน้อยที่สุดจึงเป็นเส้นเดียวกันเสมอ ภาพจะไม่เล่าอะไรเลย
   */
  const open = createMaze({ kind: 'obstacles', seed: 3 })
  const cheapest = solve(open)
  const fewest = solveSteps(open)
  const dijkstra = sweepOrder(open, 'dijkstra')
  const astar = sweepOrder(open, 'astar')

  const priceOf = (cells: Point[]): number =>
    cells.slice(1).reduce((sum, at) => sum + stepCost(open.grid, at.row, at.col), 0)

  const cheapestPath = cheapest?.path ?? []
  const fewestPath = fewest?.path ?? []

  // เกมเดียวกันสองจังหวะ — กลางเกมกับตอนจบ เพื่อให้เห็นว่าการนำตอนกลางเกมไม่ได้แปลว่าชนะ
  const mid = playMatch(greedy, corner, 38)
  const end = playMatch(greedy, corner)

  // กระดานกลางเกมที่ทั้งสองฝ่ายเล่นดี ไว้ให้เห็นว่าในหนึ่งตามีทางเลือกกี่ทาง
  const branching = playMatch(corner, corner, 24)

  // รุ่นที่ 0 ของ GA — น้ำหนักสุ่มล้วน ยังไม่ได้เรียนรู้อะไร
  const raw = playMatch(byWeight(randomWeights(20260920)), corner)

  // ต้นเกมเก็บตัว เจอ ยึดมุมก่อน — สองกฎที่ต่างกันแค่การถามว่าตอนนี้อยู่ช่วงไหนของเกม
  const staged = playMatch(phases, corner)

  // หนึ่งเกมของเส้นฐานสุ่ม — ผูก seed ไว้ ไม่งั้นภาพเปลี่ยนทุกครั้งที่เปิดหน้า
  const dice = playMatch(randomPlay(20260920), corner)

  const rates = playoutRates(branching.board, branching.turn, MCTS_ROUNDS, 20260920)

  return {
    'wall-follower': {
      kind: 'maze',
      maze,
      explored: [],
      path: wall,
      optimal: shortest,
      caption: `เส้นม่วงคือทางที่เลาะกำแพงขวาเดินจริง ${wall.length - 1} ก้าว เส้นเขียวประคือทางที่สั้นที่สุด ${shortest.length - 1} ก้าว · มันไม่ได้หลง แต่มันเลาะเข้าไปในซอกทุกซอกที่อยู่ติดกำแพงขวา เพราะกฎบังคับไว้แบบนั้น`
    },
    'least-visited': {
      kind: 'maze',
      maze,
      explored: mouse,
      path: mouse,
      optimal: shortest,
      caption: `สีอ่อนคือช่องที่เหยียบก่อน สีเข้มคือเหยียบทีหลัง — ช่องเข้มคือที่ที่มันวนซ้ำ · บนแผนที่ใบนี้ใช้ ${mouse.length - 1} ก้าว เท่ากับเลาะกำแพงพอดี เพราะ "เขาวงกตแท้" ไม่มีวงวนให้ติด ทุกทางตันต้องเดินเข้าแล้วถอยออกอยู่ดี ความต่างจะเห็นตอนเจอแผนที่ที่มีทางลัดเชื่อมถึงกัน`
    },
    'random-walk': {
      kind: 'maze',
      maze,
      explored: wander,
      path: wander,
      optimal: shortest,
      caption: `ปล่อยเดินสุ่ม ${wander.length - 1} ก้าวแล้วยังไม่ถึงทางออก · เส้นทับรอยตัวเองจนดูไม่ออกว่าเคยไปไหนมาบ้าง เพราะมันลืมทุกอย่างทันทีที่ก้าว เทียบกับเฉลยที่ใช้แค่ ${shortest.length - 1} ก้าว`
    },
    'random-baseline': {
      kind: 'othello',
      board: dice.board,
      moves: [],
      last: dice.last,
      caption: `หนึ่งเกมของตัวสุ่ม (ดำ) เจอ "ยึดมุมก่อน" (ขาว) จบที่ ${dice.black}–${dice.white} · แต่เกมเดียวบอกอะไรแทบไม่ได้เลย เพราะตัวสุ่มเล่นไม่เหมือนเดิมสักครั้ง ภาพนี้จึงต้องล็อกเลขสุ่มไว้ถึงจะได้ภาพเดิมทุกครั้งที่เปิดหน้า · ค่าที่ใช้ได้จริงคือสัดส่วนจากหลายสิบเกม ซึ่งอยู่ในหัวข้อนี้`
    },
    'game-phases': {
      kind: 'othello',
      board: staged.board,
      moves: [],
      last: staged.last,
      caption: `จบเกม — ดำคือ "ต้นเกมเก็บตัว ท้ายเกมกินรวบ" ชนะ "ยึดมุมก่อน" ${staged.black}–${staged.white} และปิดมุมไปได้ ${cornersOwnedBy(staged.board, BLACK)} จาก 4 มุม · ทั้งสองฝ่ายยึดมุมก่อนเหมือนกัน ต่างกันแค่ดำถามเพิ่มว่าตอนนี้เหลือช่องว่างกี่ช่อง แล้วค่อยเลือกว่าจะกินน้อยหรือกินเยอะ`
    },
    greedy: {
      kind: 'othello',
      board: mid.board,
      moves: mid.moves,
      last: mid.last,
      caption: `กลางเกม ตาที่ ${mid.played} — ดำคือ "กินเยอะสุด" นำอยู่ ${mid.black}–${mid.white} ดูเหมือนกำลังชนะ แต่ขาวยึดมุมไปแล้ว ${cornersOwnedBy(mid.board, WHITE)} มุม ซึ่งพลิกคืนไม่ได้อีกเลย · ดูหน้า "ฮิวริสติก" เพื่อเห็นว่าเกมนี้จบยังไง`
    },
    heuristic: {
      kind: 'othello',
      board: end.board,
      moves: [],
      last: end.last,
      caption: `เกมเดียวกันตอนจบ — ขาวคือ "ยึดมุมก่อน" ชนะ ${end.white}–${end.black} ทั้งที่ตอนตาที่ ${mid.played} ยังตามอยู่ ${mid.white}–${mid.black} · ไล่สายจากมุมทั้งสี่จะเห็นแถวขาวยาวที่ไม่เคยถูกพลิกอีกเลย นั่นคือที่มาของคะแนน`
    },
    genetic: {
      kind: 'othello',
      board: raw.board,
      moves: [],
      last: raw.last,
      caption: `นี่คือรุ่นที่ 0 ของ GA — ให้น้ำหนักทั้ง 64 ช่องแบบสุ่มล้วน แล้วลงช่องที่น้ำหนักสูงสุด ยังไม่รู้จักมุมหรือกฎอะไรเลย · เจอ "ยึดมุมก่อน" แล้วแพ้ ${raw.black}–${raw.white} · สิ่งที่ GA ทำหลังจากนี้คือแก้ตัวเลข 64 ตัวนั้นทีละนิด แล้วเก็บไว้เฉพาะครั้งที่คะแนนตอนจบดีขึ้น`
    },
    dfs: {
      kind: 'maze',
      maze,
      explored: dfs,
      path: [],
      optimal: [],
      caption: `ลำดับที่ค้นลึกก่อนเปิดดูช่อง — สีอ่อนมาก่อน สีเข้มมาทีหลัง · เห็นเป็นงูเส้นเดียวลากยาว เพราะมันมุ่งไปทางเดียวจนสุดก่อนจะถอยกลับ แผนที่ใบนี้เองก็ถูกขุดด้วยกฎเดียวกัน`
    },
    bfs: {
      kind: 'maze',
      maze,
      explored: bfs,
      path: shortest,
      optimal: shortest,
      caption: `ค้นกว้างก่อนแผ่ออกเป็นวงจากจุดเริ่ม สีจึงไล่เป็นชั้น ๆ ไม่ใช่เส้นเดียว · เปิดดู ${bfs.length} ช่องกว่าจะถึงทางออก แลกกับการรับประกันว่าเส้นม่วงคือทางที่ก้าวน้อยที่สุดจริง`
    },
    dijkstra: {
      kind: 'maze',
      maze: open,
      explored: dijkstra,
      path: cheapestPath,
      optimal: fewestPath,
      caption: `แผนที่แบบ "อุปสรรคสุ่ม" ไม่ใช่แผนที่เริ่มต้น เพราะต้องมีหลายทางให้เลือกถึงจะเห็นผลของราคา · ช่องเหลืองคือโคลน เหยียบทีละก้าวแพงกว่าพื้นปกติ ${COST_MUD} เท่า · เส้นม่วงคือทางที่ถูกที่สุด ${cheapestPath.length - 1} ก้าว ราคารวม ${priceOf(cheapestPath)} ส่วนเส้นเขียวประคือทางที่ก้าวน้อยที่สุด ${fewestPath.length - 1} ก้าว แต่ลุยโคลนจนราคารวม ${priceOf(fewestPath)} · ยอมอ้อมเพิ่มสองก้าวแล้วถูกกว่า`
    },
    'a-star': {
      kind: 'maze',
      maze: open,
      explored: astar,
      path: cheapestPath,
      optimal: fewestPath,
      caption: `แผนที่ใบเดียวกับหน้า Dijkstra ได้เส้นทางเดียวกันเป๊ะ เปลี่ยนแค่ลำดับการเปิดดู · บนแผนที่ใบนี้ Dijkstra เปิด ${dijkstra.length} ช่อง A* เปิด ${astar.length} ช่อง (บนแผนที่เริ่มต้นคือ ${sweepOrder(maze, 'dijkstra').length} กับ ${sweepOrder(maze, 'astar').length}) · สังเกตรูปร่างของสี มันเอียงไปทางทางออกแทนที่จะแผ่รอบตัวเท่ากันทุกทิศ`
    },
    mcts: {
      kind: 'othello',
      board: branching.board,
      moves: branching.moves,
      last: branching.last,
      caption: `กระดานเดียวกับหน้า "คิดแทนคู่แข่ง" แต่วัดคนละวิธี — จากตาที่ลงได้ ${branching.moves.length} ตา สุ่มเล่นจนจบเกมตาละ ${MCTS_ROUNDS} รอบแล้วนับว่าชนะกี่ครั้ง · ตาที่ดีที่สุดชนะ ${rates[0]?.rate ?? 0}% ตาที่แย่ที่สุดชนะ ${rates[rates.length - 1]?.rate ?? 0}% · ไม่มีใครบอกมันเลยว่ามุมสำคัญ มันนับเอาจากผลล้วน ๆ · ตัวอย่างในเกมทำแบบเดียวกันนี้ 300 รอบต่อหนึ่งตา`
    },
    minimax: {
      kind: 'othello',
      board: branching.board,
      moves: branching.moves,
      last: branching.last,
      caption: `จุดขาวคือตาที่ลงได้ในตานี้ ${branching.moves.length} ตา และแต่ละตาคู่แข่งก็ตอบได้อีกราว ๆ เท่านี้ · มองล่วงหน้าแค่ 2 ตาก็ราว ${(branching.moves.length ** 2).toLocaleString('en-US')} กระดาน มองล่วงหน้า 6 ตาคือราว ${(branching.moves.length ** 6).toLocaleString('en-US')} กระดาน ตัวอย่างในเกมจึงจำกัดไว้ที่ 4 ชั้น — ลึกกว่านั้นต้องมีเทคนิคตัดกิ่งมาช่วยถึงจะไหว`
    }
  }
}

export const figureFor = (slug: string): Figure | undefined => {
  cache = cache ?? buildFigures()
  return cache[slug]
}
