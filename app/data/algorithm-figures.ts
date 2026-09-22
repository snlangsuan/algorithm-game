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
  applyMove as applyDisk,
  createHanoi,
  optimalMoves,
  pegName,
  solveMoves,
  type Hanoi,
  type Move as DiskMove,
  type Towers
} from '~/game/hanoi/engine'
import {
  advanceHero,
  aheadOf as chaseAhead,
  aim as chaseAim,
  createMatch,
  distanceField as chaseField,
  dueHunters,
  exitOpen as chaseExitOpen,
  findArena as findChaseArena,
  moveHunter,
  neighbors as chaseNeighbors,
  pathLength as chaseLength,
  pathTo as chasePath,
  stepAlong as chaseStep,
  stepHero,
  type Direction as ChaseDirection,
  type Hunter,
  type Match as ChaseMatch
} from '~/game/chase/engine'
import {
  DECIDE_EVERY,
  advance as advanceRunner,
  createRun as createRunnerRun,
  metersOf,
  order as orderRunner,
  speedOf as runnerSpeed,
  type Action as RunnerAction,
  type Run as RunnerRun
} from '~/game/dino/engine'
import { viewOf as runnerView } from '~/game/dino/agent'
import { DUCK_CLEAR } from '~/game/dino/art'
import { SEE_THRESHOLD, averageOffset, secondsOf, type Run as LineRun } from '~/game/line/engine'
import { pdWith, playRule, playWith } from '~/game/line/rules'
import { followScent, pathCost, trainColony } from '~/game/maze/ants'
import { fly as flySwarm, score as scoreSwarm } from '~/game/line/swarm'
import { OTHELLO_SPACE, expandWeights } from '~/game/othello/agent'

/**
 * ค่าที่ตัวอย่างฝูงนก (PSO) หาเจอบนสนามมุมหักศอก หลังฝึก 100 รอบ ด้วยเมล็ดสุ่มแรกของเทสต์
 * ตัวอย่างนั้นสุ่มเอง ภาพจึงวิ่งด้วยค่าที่มันหาเจอแทน — เทสต์ฝึกซ้ำแล้วตรวจว่ายังได้ค่านี้
 */
export const SWARM_FOUND = { power: 100, kp: 0.37, kd: 4.74 }

/**
 * จังหวะที่ตัวอย่างฝูงนกของเกมวิ่งหลบหาเจอ หลังฝึก 60 รอบ ด้วยเมล็ดสุ่มของเทสต์ — เทสต์ฝึกซ้ำแล้วตรวจว่ายังได้ค่านี้
 */
export const DINO_SWARM_FOUND = { jump: 0.11, duck: 0.05 }
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

  explored: Point[]

  path: Point[]

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

export interface HanoiFigure {
  kind: 'hanoi'
  puzzle: Hanoi

  towers: Towers

  last: DiskMove | null
  caption: string
}

export interface ChaseFigure {
  kind: 'chase'
  match: ChaseMatch

  /** ช่องที่ผู้ไล่ล่าวางแผนจะเดินผ่าน — สนามระบายสีม่วงจาง ๆ ให้ */
  looked: Point[]

  /** ช่องที่ฝ่ายหนีชั่งใจอยู่ — สนามระบายสีเขียวจาง ๆ ให้ */
  runnerLooked?: Point[]
  caption: string
}

export interface RunnerFigure {
  kind: 'runner'
  run: RunnerRun
  /** ลำดับของสิ่งกีดขวางที่โปรแกรมกำลังจ้องอยู่ */
  watched: number[]
  caption: string
}

export interface LineFigure {
  kind: 'line'
  /** รอบที่วิ่งจบแล้ว — สนามวาดรอยที่วิ่งจริงทั้งรอบ */
  run: LineRun
  /** เซนเซอร์ที่กฎใช้ตัดสินใจ — วงให้เห็นบนตัวหุ่น */
  watched: number[]
  caption: string
}

export type Figure = MazeFigure | OthelloFigure | HanoiFigure | ChaseFigure | RunnerFigure | LineFigure

/** ทศนิยมหนึ่งตำแหน่ง — ระยะห่างจากเส้นในคำบรรยาย */
const pixels = (value: number): string => value.toFixed(1)

/**
 * กองของหอคอยฮานอยหลังเดินตามเฉลยไปกี่ตา — คำนวณสดจากเอนจินจริงเหมือนภาพอื่น
 * คืนแผนทั้งชุดมาด้วย คำบรรยายจะได้อ้างตัวเลขจากของจริง ไม่ใช่พิมพ์ทิ้งไว้
 */
function hanoiAfter(disks: number, steps: number) {
  const puzzle = createHanoi({ disks })
  const plan = solveMoves(puzzle)

  let towers = puzzle.towers
  let last: DiskMove | null = null

  for (const move of plan.slice(0, steps)) {
    last = move
    towers = applyDisk(towers, move)
  }

  return { puzzle, plan, towers, last }
}

/** ตาที่เท่าไรบ้างที่จานเล็กสุดเป็นคนขยับ (นับจาก 1) */
function smallestTurns(puzzle: Hanoi, plan: DiskMove[], take: number): number[] {
  const turns: number[] = []
  let towers = puzzle.towers

  for (const [index, move] of plan.entries()) {
    if (towers[move.from]![towers[move.from]!.length - 1] === 1) turns.push(index + 1)
    towers = applyDisk(towers, move)
    if (turns.length >= take) break
  }

  return turns
}

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

const MCTS_ROUNDS = 60

export type Sweep = 'dfs' | 'bfs' | 'dijkstra' | 'astar'

interface Waiting {
  at: Point
  spent: number
  score: number
}

const takeNext = (waiting: Waiting[], how: Sweep): Waiting => {
  if (how === 'dfs') return waiting.pop()!
  if (how === 'bfs') return waiting.shift()!

  let pick = 0
  for (let index = 1; index < waiting.length; index++) {
    if (waiting[index]!.score < waiting[pick]!.score) pick = index
  }
  return waiting.splice(pick, 1)[0]!
}

const offerOnce = (seen: Set<string>, next: Point): Waiting | null => {
  const id = key(next.row, next.col)
  if (seen.has(id)) return null

  seen.add(id)
  return { at: next, spent: 0, score: 0 }
}

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

export function sweepOrder(maze: Maze, how: Sweep): Point[] {
  const start = key(maze.start.row, maze.start.col)
  const seen = new Set<string>([start])
  const best = new Map<string, number>([[start, 0]])
  const byCost = how === 'dijkstra' || how === 'astar'

  const order: Point[] = []
  const waiting: Waiting[] = [{ at: maze.start, spent: 0, score: 0 }]

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

type Policy = (board: Board, moves: Move[], me: Player) => Move

const CORNERS: Point[] = [
  { row: 0, col: 0 },
  { row: 0, col: BOARD_SIZE - 1 },
  { row: BOARD_SIZE - 1, col: 0 },
  { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 }
]

const isCorner = (move: Point): boolean => CORNERS.some((corner) => same(corner, move))

const nextToCorner = (move: Point): boolean =>
  CORNERS.some(
    (corner) => Math.abs(corner.row - move.row) <= 1 && Math.abs(corner.col - move.col) <= 1
  ) && !isCorner(move)

const greedy: Policy = (_board, moves) =>
  moves.reduce((best, move) => (move.flips.length > best.flips.length ? move : best), moves[0]!)

const corner: Policy = (board, moves, me) => {
  const take = moves.find(isCorner)
  if (take) return take

  const safe = moves.filter((move) => !nextToCorner(move))
  return greedy(board, safe.length > 0 ? safe : moves, me)
}

const fewest: Policy = (_board, moves) =>
  moves.reduce((best, move) => (move.flips.length < best.flips.length ? move : best), moves[0]!)

const PHASE_LINE = 12
const phases: Policy = (board, moves, me) => {
  const take = moves.find(isCorner)
  if (take) return take

  if (countDiscs(board).empty < PHASE_LINE) return greedy(board, moves, me)

  const safe = moves.filter((move) => !nextToCorner(move))
  return fewest(board, safe.length > 0 ? safe : moves, me)
}

const randomPlay = (seed: number): Policy => {
  const rng = createRng(seed)
  return (_board, moves) => moves[Math.floor(rng() * moves.length)] ?? moves[0]!
}

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

/** ลงหมากแบบเดียวกับบล็อก "ลงหมากที่ดีที่สุดตามน้ำหนักในลิสต์" — ให้คะแนนทั้งกระดานหลังลง */
const byBoardWeights =
  (weights: number[]): Policy =>
  (board, moves, me) => {
    let best = moves[0]!
    let bestScore = -Infinity

    for (const move of moves) {
      const next = applyMove(board, move, me)
      let score = 0
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const cell = next[row]![col]
          if (cell === BLACK || cell === WHITE) score += (cell === me ? 1 : -1) * weights[row * BOARD_SIZE + col]!
        }
      }
      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }

    return best
  }

/** ฝึกฝูงนกของโอเทลโลแบบไม่ผ่าน worker ด้วยตัวสุ่มแบบกำหนดเมล็ด — ภาพต้องเหมือนเดิมทุกครั้ง */
function othelloSwarm(games: number, seed: number) {
  const random = createRng(seed)
  let swarm: ReturnType<typeof flySwarm> | null = null

  for (let game = 0; game < games; game++) {
    swarm = flySwarm(swarm, random, OTHELLO_SPACE)
    const played = playMatch(byBoardWeights(expandWeights(swarm.birds[swarm.current]!.at)), corner)
    swarm = scoreSwarm(swarm, -played.black)
  }

  return swarm!
}

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

const cornersOwnedBy = (board: Board, player: Player): number =>
  CORNERS.filter((at) => board[at.row]![at.col] === player).length

/** ผู้ไล่ล่าตัวหนึ่งเล็งไปที่ไหน — คืนช่องเป้าหมาย */
type ChaseAim = (match: ChaseMatch, hunter: Hunter) => Point

/**
 * เดินหนึ่งฉากของเกมไล่จับตามบทที่เขียนไว้ ไม่มีการสุ่มเลย
 * ผู้ไล่ล่าใช้ทางที่สั้นที่สุดเหมือนบล็อกในเกมจริง ต่างกันแค่ว่าเล็งไปที่ไหน
 */
function chaseScene(
  arenaId: string,
  run: ChaseDirection[],
  hunters: number,
  speed: number,
  aimOf: ChaseAim
): { match: ChaseMatch; looked: Point[] } {
  const match = createMatch(findChaseArena(arenaId), { hunters, hunterSpeed: speed })

  for (const dir of run) {
    chaseAim(match, dir)
    advanceHero(match)

    for (const hunter of dueHunters(match, speed)) {
      moveHunter(match, hunter, chaseStep(match.arena.grid, hunter.at, aimOf(match, hunter)))
    }
  }

  const looked = match.hunters.flatMap((hunter) =>
    chasePath(match.arena.grid, hunter.at, aimOf(match, hunter))
  )

  return { match, looked }
}

/** ของชิ้นที่ตัวเอกน่าจะไปเก็บต่อ — ชิ้นที่ใกล้ตัวเขาที่สุด */
const nextGemOf = (match: ChaseMatch): Point =>
  match.gems.reduce(
    (best, gem) => (manhattan(match.hero, gem) < manhattan(match.hero, best) ? gem : best),
    match.gems[0] ?? match.arena.exit
  )

/**
 * บทเดินของตัวเอกในภาพทั้งสองหน้า — เขียนไว้ตายตัว ภาพจะได้เหมือนเดิมทุกครั้ง
 * ความยาวเลือกให้พอดีกับจังหวะที่ผู้ไล่ล่าสามตัวแยกย้ายกันไปคนละทางพอดี
 */
/**
 * นโยบายของฝ่ายหนีสองแบบ — เขียนซ้ำจากบล็อกใน RUNNER_PACK ให้ภาพประกอบใช้
 * แก้สูตรในบล็อกเมื่อไร ต้องแก้ตรงนี้ให้ตรงกันด้วย (มีเทสต์เทียบผลของทั้งสองทางไว้)
 */

/** ระยะจากผู้ไล่ล่าที่ใกล้ที่สุดถึงช่องใดก็ได้ */
function threatOf(match: ChaseMatch): (cell: Point) => number {
  const fields = match.hunters.map((hunter) => chaseField(match.arena.grid, hunter.at))

  return (cell) => {
    let near = 99

    for (const field of fields) {
      const steps = field[cell.row]![cell.col]!
      if (steps >= 0 && steps < near) near = steps
    }

    return near
  }
}

/** เป้าหมายตอนนี้ของฝ่ายหนี — ของที่ใกล้ที่สุด หรือประตูเมื่อเก็บครบแล้ว */
function runnerGoal(match: ChaseMatch): Point {
  if (chaseExitOpen(match)) return match.arena.exit

  return match.gems.reduce(
    (best, gem) => (manhattan(match.hero, gem) < manhattan(match.hero, best) ? gem : best),
    match.gems[0] ?? match.arena.exit
  )
}

interface RunnerChoice {
  dir: ChaseDirection | null
  /** ช่องที่ชั่งใจก่อนตัดสินใจ */
  looked: Point[]
}

/** ถอยไปทางที่ผู้ไล่ล่าต้องเดินมาไกลที่สุด เสมอกันค่อยเลือกช่องที่ใกล้เป้าหมายกว่า */
function dodgeChoice(match: ChaseMatch): RunnerChoice {
  const risk = threatOf(match)
  const goal = runnerGoal(match)
  const cells = chaseNeighbors(match.arena.grid, match.hero)

  let dir: ChaseDirection | null = null
  let safest = -1
  let closest = Infinity

  for (const cell of cells) {
    const safety = risk(cell)
    const toGoal = chaseLength(match.arena.grid, cell, goal)

    if (safety > safest || (safety === safest && toGoal < closest)) {
      safest = safety
      closest = toGoal
      dir = cell.dir
    }
  }

  return { dir, looked: cells.map((cell) => ({ row: cell.row, col: cell.col })) }
}

/**
 * ตัวอย่าง "ใกล้ก็หนีก่อน" — สองชั้น ชั้นเอาตัวรอดตัดหน้าเมื่อใกล้กว่า 4 ช่อง
 * วัดระยะแบบเดียวกับบล็อกเป๊ะ ๆ คือเล็งผู้ไล่ล่าที่ใกล้ที่สุดแบบเส้นตรงก่อน แล้วค่อยวัดระยะเดินจริงไปหาตัวนั้น
 */
function evadeChoice(match: ChaseMatch): RunnerChoice {
  const closest = match.hunters.reduce((best, hunter) =>
    manhattan(match.hero, hunter.at) < manhattan(match.hero, best.at) ? hunter : best
  )

  const gap = chaseLength(match.arena.grid, match.hero, closest.at)
  if ((gap < 0 ? 999 : gap) <= 4) return dodgeChoice(match)

  const goal = runnerGoal(match)

  return {
    dir: chaseStep(match.arena.grid, match.hero, goal),
    looked: chasePath(match.arena.grid, match.hero, goal)
  }
}

/** ตัวอย่าง "ชั่งน้ำหนักทุกก้าว" — แรงดึงของเป้าหมาย ลบแรงผลักที่ออกฤทธิ์ในระยะ 3 ช่อง */
function fieldChoice(match: ChaseMatch): RunnerChoice {
  const risk = threatOf(match)
  const goal = runnerGoal(match)
  const cells = chaseNeighbors(match.arena.grid, match.hero)

  let dir: ChaseDirection | null = null
  let best = -Infinity

  for (const cell of cells) {
    const danger = Math.max(0, 3 - risk(cell))
    const toGoal = chaseLength(match.arena.grid, cell, goal)
    const score = -(toGoal < 0 ? 99 : toGoal) - danger * 2

    if (score > best) {
      best = score
      dir = cell.dir
    }
  }

  return { dir, looked: cells.map((cell) => ({ row: cell.row, col: cell.col })) }
}

/** ตัวอย่าง "ไล่ตามทางที่สั้นที่สุด" ของฝ่ายไล่ — ใกล้ก็ตามตัว ไกลก็ไปดักที่ของ */
function pursuitAim(match: ChaseMatch, hunter: Hunter): Point {
  if (chaseLength(match.arena.grid, hunter.at, match.hero) <= 12) return match.hero

  return match.gems.reduce(
    (best, gem) => (manhattan(match.hero, gem) < manhattan(match.hero, best) ? gem : best),
    match.gems[0] ?? match.arena.exit
  )
}

/**
 * ปล่อยให้ AI ทั้งสองฝ่ายเดินสู้กันตามจำนวนจังหวะที่กำหนด
 * ไม่มีการสุ่มเลย ภาพจึงเหมือนเดิมทุกครั้งที่เปิดหน้า
 */
/**
 * กฎฝูงปลาแบบเดียวกับ flockTo ในบล็อก "ว่ายแบบฝูงปลา" เขียนซ้ำเป็น TypeScript ไว้วาดภาพ
 * เทสต์เทียบว่าเลือกทางเดียวกับโค้ดที่บล็อกแปลงออกมาจริง
 */
export function flockDirection(
  match: ChaseMatch,
  hunter: Hunter,
  separate: number,
  align: number,
  gather: number
): ChaseDirection | null {
  const grid = match.arena.grid
  const field = chaseField(grid, match.hero)
  const mates = match.hunters.filter((other) => other.index !== hunter.index)
  const middle =
    mates.length === 0
      ? null
      : {
          row: mates.reduce((sum, other) => sum + other.at.row, 0) / mates.length,
          col: mates.reduce((sum, other) => sum + other.at.col, 0) / mates.length
        }

  let chosen: ChaseDirection | null = null
  let best = -Infinity

  for (const next of chaseNeighbors(grid, hunter.at)) {
    if (mates.some((other) => other.at.row === next.row && other.at.col === next.col)) continue

    let score = -field[next.row]![next.col]!
    for (const other of mates) {
      const gap = Math.abs(next.row - other.at.row) + Math.abs(next.col - other.at.col)
      if (gap < 3) score -= separate * (3 - gap)
      if (other.facing === next.dir) score += align
    }
    if (middle) score -= gather * (Math.abs(next.row - middle.row) + Math.abs(next.col - middle.col))

    if (score > best) {
      best = score
      chosen = next.dir
    }
  }

  return chosen
}

/** น้ำหนักของตัวอย่าง "ไล่เป็นฝูงปลา" */
export const FLOCK_WEIGHTS = { separate: 0.6, align: 0.3, gather: 0.1 } as const

function chaseDuel(
  arenaId: string,
  hunters: number,
  speed: number,
  ticks: number,
  choose: (match: ChaseMatch) => RunnerChoice,
  hunterMove?: (match: ChaseMatch, hunter: Hunter) => ChaseDirection | null
): { match: ChaseMatch; looked: Point[]; runnerLooked: Point[] } {
  const match = createMatch(findChaseArena(arenaId), { hunters, hunterSpeed: speed })
  let runnerLooked: Point[] = []

  for (let tick = 1; tick <= ticks; tick++) {
    match.tick = tick

    const choice = choose(match)
    runnerLooked = choice.looked
    stepHero(match, choice.dir)

    if (match.over) break

    for (const hunter of dueHunters(match, speed)) {
      moveHunter(
        match,
        hunter,
        hunterMove ? hunterMove(match, hunter) : chaseStep(match.arena.grid, hunter.at, pursuitAim(match, hunter))
      )
    }
  }

  const looked = match.hunters.flatMap((hunter) =>
    chasePath(match.arena.grid, hunter.at, pursuitAim(match, hunter))
  )

  return { match, looked, runnerLooked }
}

const CHASE_RUN: ChaseDirection[] = [
  'down',
  'down',
  'right',
  'right',
  'right',
  'right',
  'right',
  'right',
  'up',
  'up',
  'right',
  'right'
]

/**
 * เล่นเกมวิ่งด้วยกฎ "หลบเมื่อเหลือเวลาไม่เกิน margin วินาที" จนถึงจังหวะที่กำลังจะสั่งหลบพอดี
 *
 * ใช้กฎเดียวกับตัวอย่างในเกมเป๊ะ แต่เขียนซ้ำตรงนี้ เพราะโปรแกรมของผู้เล่นรันใน Web Worker
 * ซึ่งเรียกจากตอนสร้างภาพประกอบไม่ได้ · หยุดตอนความเร็วเกินที่กำหนด จะได้เทียบสองความเร็วกันได้
 */
function runnerScene(margin: number, seed: number, untilSpeed: number) {
  const run = createRunnerRun({ courseId: 'classic', seed })

  for (let step = 0; step < 20000 && !run.over; step++) {
    const view = runnerView(run, 500)
    const first = view.obstacles[0]

    if (first && first.time <= margin && runnerSpeed(run) >= untilSpeed && first.distance > 8) {
      return { run, first, speed: runnerSpeed(run) }
    }

    let action: RunnerAction = 'run'
    if (first && first.time <= margin) action = first.bottom >= DUCK_CLEAR ? 'duck' : 'jump'

    orderRunner(run, action)
    for (let frame = 0; frame < DECIDE_EVERY && !run.over; frame++) advanceRunner(run)
  }

  return { run, first: runnerView(run, 500).obstacles[0] ?? null, speed: runnerSpeed(run) }
}

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

  const open = createMaze({ kind: 'obstacles', seed: 3 })
  const cheapest = solve(open)
  const fewest = solveSteps(open)
  const dijkstra = sweepOrder(open, 'dijkstra')
  const astar = sweepOrder(open, 'astar')

  const priceOf = (cells: Point[]): number =>
    cells.slice(1).reduce((sum, at) => sum + stepCost(open.grid, at.row, at.col), 0)

  const cheapestPath = cheapest?.path ?? []
  const fewestPath = fewest?.path ?? []

  const mid = playMatch(greedy, corner, 38)
  const end = playMatch(greedy, corner)

  const branching = playMatch(corner, corner, 24)

  const raw = playMatch(byWeight(randomWeights(20260920)), corner)

  const flock = othelloSwarm(40, 20260920)
  const flockBest = playMatch(byBoardWeights(expandWeights(flock.best!)), corner)
  const corners = Math.round(flock.best![0]!)
  const besideCorner = Math.round(flock.best![4]!)

  const staged = playMatch(phases, corner)

  const dice = playMatch(randomPlay(20260920), corner)

  const rates = playoutRates(branching.board, branching.turn, MCTS_ROUNDS, 20260920)

  // หอคอยฮานอย 4 ใบ — เล็กพอให้นับตาตามได้ด้วยตา แต่ยังเห็นโครงของการแตกงาน
  const FIGURE_DISKS = 4
  const half = optimalMoves(FIGURE_DISKS - 1)
  const pivot = hanoiAfter(FIGURE_DISKS, half + 1)
  const stacked = hanoiAfter(FIGURE_DISKS, half)
  const oddTurns = smallestTurns(stacked.puzzle, stacked.plan, 4)

  // ไล่จับ — ฉากแรกไล่ตามหลังล้วน ๆ ฉากที่สองแบ่งหน้าที่กันสามตัว
  const tail = chaseScene('lattice', CHASE_RUN, 2, 0.5, (match) => match.hero)

  const split = chaseScene('lattice', CHASE_RUN, 3, 0.5, (match, hunter) => {
    if (hunter.index === 0) return match.hero
    if (hunter.index === 1) return chaseAhead(match.arena.grid, match.hero, match.facing, 3)
    return nextGemOf(match)
  })

  const tailGap = tail.match.hunters.map((hunter) =>
    chaseLength(tail.match.arena.grid, hunter.at, tail.match.hero)
  )

  const splitGap = split.match.hunters.map((hunter) =>
    chaseLength(split.match.arena.grid, hunter.at, split.match.hero)
  )

  // ฉากเดียวกันอีกครั้ง คราวนี้ไม่มีใครมีหน้าที่ประจำ — ใครใกล้กว่า 5 ช่องก็รุม ที่เหลือไปยึดของ
  const RUSH_RANGE = 5
  const closing = chaseScene('lattice', CHASE_RUN, 4, 0.5, (match, hunter) =>
    chaseLength(match.arena.grid, hunter.at, match.hero) <= RUSH_RANGE ? match.hero : nextGemOf(match)
  )

  const closingGap = closing.match.hunters.map((hunter) =>
    chaseLength(closing.match.arena.grid, hunter.at, closing.match.hero)
  )

  const rushing = closingGap.filter((gap) => gap <= RUSH_RANGE).length
  const holding = closingGap.length - rushing

  // ฝ่ายหนีเป็น AI ทั้งสองฉาก ผู้ไล่ล่าชุดเดียวกัน ต่างกันแค่วิธีคิดของคนหนี
  // หยุดที่จังหวะที่ 11 ซึ่งทั้งสองฉากมีผู้ไล่ล่าห่างเท่ากันพอดี
  // จะได้เทียบกันได้ตรง ๆ ว่าที่ระยะเดียวกัน สองวิธีคิดตัดสินใจต่างกันยังไง
  const DUEL_TICKS = 11
  const layered = chaseDuel('lattice', 2, 0.65, DUEL_TICKS, evadeChoice)
  const potential = chaseDuel('lattice', 2, 0.65, DUEL_TICKS, fieldChoice)

  const layeredGap = Math.min(
    ...layered.match.hunters.map((hunter) =>
      chaseLength(layered.match.arena.grid, hunter.at, layered.match.hero)
    )
  )

  const potentialGap = Math.min(
    ...potential.match.hunters.map((hunter) =>
      chaseLength(potential.match.arena.grid, hunter.at, potential.match.hero)
    )
  )

  // เกมวิ่งหลบ — ฉากเดียวกันสองจังหวะ ต่างกันที่ความเร็ว จะได้เห็นว่าระยะที่ต้องเผื่อโตตามความเร็ว
  const MARGIN = 0.3
  const slowScene = runnerScene(MARGIN, 4, 0)
  const fastScene = runnerScene(MARGIN, 4, 620)

  const slowSpeed = Math.round(slowScene.speed)
  const fastSpeed = Math.round(fastScene.speed)
  const slowGap = Math.round(slowScene.first?.distance ?? 0)
  const fastGap = Math.round(fastScene.first?.distance ?? 0)

  // ยีนกระโดดที่สุ่มได้ตอนเริ่มฝึก — เร็วเกินไปจนเป็นยีนที่การคัดเลือกต้องทิ้ง
  const EARLY_GENE = 0.4
  const earlyScene = runnerScene(EARLY_GENE, 4, 0)
  const swarmScene = runnerScene(DINO_SWARM_FOUND.jump, 4, 0)
  const swarmSpeed = Math.round(swarmScene.speed)
  const swarmGap = Math.round(swarmScene.first?.distance ?? 0)
  const earlySpeed = Math.round(earlyScene.speed)
  const earlyGap = Math.round(earlyScene.first?.distance ?? 0)

  // หุ่นเดินตามเส้น — ทุกภาพคือรอยที่วิ่งจริงทั้งรอบ ด้วยกฎเดียวกับตัวอย่างในเกม
  const bang = playRule('eight', 'bang-bang')
  const bothSeen = (run: LineRun) =>
    (run.sensors[0] ?? 0) >= SEE_THRESHOLD && (run.sensors[4] ?? 0) >= SEE_THRESHOLD
  const fork = playRule('eight', 'bang-bang', bothSeen)
  const proportional = playRule('sharp', 'proportional')
  const pd = playRule('sharp', 'pd')
  const gaps = playRule('rcj-gaps', 'switching')
  const gapsPd = playRule('rcj-gaps', 'pd')
  const junctions = playRule('rcj-junctions', 'markers')
  const junctionsPd = playRule('rcj-junctions', 'pd')
  const lineMaze = playRule('line-maze', 'left-hand')

  // ฝูงปลาสามตัวบนสนามตาราง ไล่ AI ที่หนีเป็น — หยุดภาพไว้ก่อนจับได้ จะได้เห็นว่าฝูงเข้าหาจากคนละทาง
  const FLOCK_TICKS = 12
  const school = chaseDuel('lattice', 3, 0.65, FLOCK_TICKS, evadeChoice, (match, hunter) =>
    flockDirection(match, hunter, FLOCK_WEIGHTS.separate, FLOCK_WEIGHTS.align, FLOCK_WEIGHTS.gather)
  )
  const schoolGaps = school.match.hunters.map((hunter) => chaseLength(school.match.arena.grid, hunter.at, school.match.hero))

  // ฝูงมดบนเขาวงกตแบบมีทางวน — ภาพต้องเหมือนเดิมทุกครั้ง จึงฝึกด้วยตัวสุ่มแบบกำหนดเมล็ด
  const braid = createMaze({ kind: 'braid', seed: 1 })
  const ants = trainColony(braid.grid, braid.start, braid.goal, 100, createRng(7))
  const antTrail = followScent(ants.colony, braid.grid, braid.start, braid.goal)
  const antFirst = ants.walks[0]!
  const braidBest = solve(braid)
  // ค่าที่ฝูงนกหาเจอบนสนามมุมหักศอก (ฝึก 100 รอบ เมล็ดสุ่มแรกของเทสต์) — เทสต์ตรวจว่ายังหาเจอค่านี้อยู่
  const swarmFound = playWith('sharp', pdWith(SWARM_FOUND.power, SWARM_FOUND.kp, SWARM_FOUND.kd))

  return {
    'bang-bang': {
      kind: 'line',
      run: bang,
      watched: [0, 4],
      caption: `รอยม่วงคือทางที่ bang-bang วิ่งจริงบนสนามเลขแปด ห่างเส้นเฉลี่ย ${pixels(averageOffset(bang))} พิกเซล เพราะมันเลี้ยวเต็มแรงทุกครั้งที่ส่าย · ที่วินาที ${secondsOf(fork.time)} ตรงจุดตัดกลางสนาม เซนเซอร์ซ้ายสุดกับขวาสุดเห็นเส้นพร้อมกัน กฎข้อแรกคือ "ซ้ายเห็นก็หมุนซ้าย" มันจึงหมุนไปเกาะเส้นที่ตัดผ่าน แล้ววิ่งออกนอกทางของตัวเองจนหลุดที่วินาที ${secondsOf(bang.time)}`
    },
    'p-control': {
      kind: 'line',
      run: proportional,
      watched: [],
      caption: `รอยของแบบ P บนสนามมุมหักศอก ครบรอบใน ${secondsOf(proportional.time)} วินาที ห่างเส้นเฉลี่ย ${pixels(averageOffset(proportional))} พิกเซล และมากสุด ${pixels(proportional.offsetMax)} พิกเซล · ดูตรงมุม — รอยเลยออกนอกเส้นไปก่อนแล้วค่อยวกกลับ เพราะมอเตอร์ตอบช้า และ P ไม่รู้ว่าตัวเองกำลังหมุนเข้าหาเส้นอยู่แล้ว มันจึงเลี้ยวแรงเท่าเดิมจนเลย`
    },
    'pid-control': {
      kind: 'line',
      run: pd,
      watched: [],
      caption: `สนามเดียวกับภาพของแบบ P แต่เป็นรอยของ PD ที่กำลัง 90 — ครบรอบใน ${secondsOf(pd.time)} วินาที (แบบ P ใช้ ${secondsOf(proportional.time)}) ห่างเส้นเฉลี่ย ${pixels(averageOffset(pd))} พิกเซล เทียบกับ ${pixels(averageOffset(proportional))} ของแบบ P · รอยตรงมุมแนบกว่าทั้งที่วิ่งเร็วกว่า เพราะส่วน D เห็นว่าเส้นกำลังวิ่งกลับเข้ากลาง แล้วผ่อนการเลี้ยวก่อนจะเลย`
    },
    'behavior-switching': {
      kind: 'line',
      run: gaps,
      watched: [],
      caption: `รอยของโปรแกรมสลับพฤติกรรมบนสนาม RoboCupJunior · เส้นขาด ครบรอบใน ${secondsOf(gaps.time)} วินาที · ตรงเส้นขาดทั้งสี่ช่วง รอยเป็นเส้นตรงพาดข้ามช่องว่าง ที่นั่นไม่มีอะไรให้เห็นเลย มันวิ่งตรงเพราะจำได้ว่าก่อนหน้านั้นเส้นอยู่นิ่ง ๆ กลางตัวมานาน · ส่วนตัวอย่าง PD บนสนามเดียวกันหมุนหาเส้นตรงช่องว่างแรกจนกลับหัว แล้ววิ่งไม่ครบรอบภายใน ${secondsOf(gapsPd.time)} วินาที`
    },
    boids: {
      kind: 'chase',
      match: school.match,
      looked: [],
      caption: `จังหวะที่ ${FLOCK_TICKS} ของผู้ไล่ล่าสามตัวที่ใช้กฎฝูงปลา ไล่ AI ที่หนีเป็น — ตอนนี้ห่างตัวเอก ${schoolGaps.join(' · ')} ช่อง · ตัวหนึ่งประชิดตัวเอกทางซ้าย อีกสองตัวอยู่แถวบนคนละฝั่ง ไม่มีตัวไหนได้รับคำสั่งให้อ้อมไปอีกทาง แต่กฎ "แยก" ทำให้ตัวที่ตามหลังเพื่อนไม่ยอมเดินซ้อนทาง จึงกระจายออกไปเอง`
    },
    'ant-colony': {
      kind: 'maze',
      maze: braid,
      explored: antFirst,
      path: antTrail,
      optimal: braidBest?.path ?? [],
      caption: `ช่องสีจางคือที่มดตัวแรกเดินผ่าน — ยังไม่มีกลิ่นให้ตาม มันเดินวนไป ${(antFirst.length - 1).toLocaleString()} ก้าว ราคารวม ${pathCost(braid.grid, antFirst).toLocaleString()} กว่าจะถึงทางออก · เส้นม่วงคือทางที่เดินตามกลิ่นแรงที่สุดหลังปล่อยมด 100 ตัว ราคา ${pathCost(braid.grid, antTrail)} ส่วนเส้นเขียวประคือทางที่ถูกที่สุดของ Dijkstra ราคา ${braidBest?.cost ?? 0} — ฝูงมดหาทางเดียวกันเจอโดยไม่มีตัวไหนเห็นแผนที่`
    },
    'particle-swarm': {
      kind: 'line',
      run: swarmFound,
      watched: [],
      caption: `รอยของค่าที่ฝูงนกหาเจอบนสนามมุมหักศอก — กำลัง ${SWARM_FOUND.power} · Kp ${SWARM_FOUND.kp} · Kd ${SWARM_FOUND.kd} ครบรอบใน ${secondsOf(swarmFound.time)} วินาที เทียบกับ ${secondsOf(pd.time)} ของตัวอย่าง PD ที่คนจูน · Kp ที่ฝูงเลือกต่ำกว่าของคนเกือบครึ่ง แต่ Kd ใกล้เคียงกัน แปลว่าที่กำลังเต็ม หุ่นต้องเลี้ยวตามระยะที่เบี่ยงให้เบาลง แล้วพึ่งส่วน D ช่วยผ่อนก่อนเลยเส้น`
    },
    'line-maze-left-hand': {
      kind: 'line',
      run: lineMaze,
      watched: [0],
      caption: `รอยของมือซ้ายแตะกำแพงบนเขาวงกตบนเส้น ถึงวงกลมเส้นชัยใน ${secondsOf(lineMaze.time)} วินาที · ดูตรงทางตัน รอยวิ่งเข้าไปจนสุดเส้น หมุนกลับ แล้ววิ่งออกมาทางเดิม เพราะตอนหลุดเส้นแบบ P หมุนหาเส้นฝั่งที่เห็นครั้งสุดท้ายเอง · ทางตันด้านล่างไม่มีรอยเลย เพราะทุกครั้งที่ผ่านทางแยกนั้น ทางซ้ายคือทางอื่น`
    },
    'marker-memory': {
      kind: 'line',
      run: junctions,
      watched: [0, 4],
      caption: `รอยของโปรแกรมจำป้ายเขียวบนสนาม RoboCupJunior · ทางแยก ครบรอบใน ${secondsOf(junctions.time)} วินาที · สี่เหลี่ยมเขียวข้างเส้นคือป้าย อยู่ก่อนถึงทางแยกทุกครั้ง ตรงทางแยกแรกรอยหักเลี้ยวซ้ายทั้งที่ทางตรงไปก็มีเส้นดำ เพราะยังจำป้ายซ้ายได้ · ทางแยกถัดขึ้นไปไม่มีป้าย รอยจึงวิ่งตรงผ่าน ทั้งที่ทางตันแยกไปฝั่งเดียวกัน เพราะความจำหมดอายุไปก่อนแล้ว · ตัวอย่าง PD บนสนามเดียวกันวิ่งตรงเข้าทางตันแรก หลุดที่วินาที ${secondsOf(junctionsPd.time)}`
    },
    'reflex-rules': {
      kind: 'runner',
      run: slowScene.run,
      watched: [0],
      caption: `จังหวะที่กฎเพิ่งสั่งหลบพอดี — ตอนนั้นลู่วิ่งอยู่ที่ ${slowSpeed} พิกเซลต่อวินาที กฎจึงเผื่อระยะไว้ ${Math.round(slowSpeed * MARGIN)} พิกเซล และของชิ้นหน้าเข้ามาอยู่ที่ ${slowGap} พิกเซลพอดี · ทั้งโปรแกรมมีกฎข้อเดียวเท่านี้ ไม่มีการจำอะไรจากจังหวะก่อน และไม่ได้วางแผนอะไรล่วงหน้า`
    },
    'time-to-contact': {
      kind: 'runner',
      run: fastScene.run,
      watched: [0],
      caption: `กฎเดิมเป๊ะ แต่เป็นจังหวะที่ลู่เร่งมาถึง ${fastSpeed} พิกเซลต่อวินาทีแล้ว (ระดับ ${fastScene.run.level}) — คราวนี้ระยะที่เผื่อกลายเป็น ${Math.round(fastSpeed * MARGIN)} พิกเซล และของชิ้นหน้าอยู่ห่าง ${fastGap} พิกเซล · เลขพิกเซลเปลี่ยนไปเกือบเท่าตัวเมื่อเทียบกับภาพก่อนหน้า ทั้งที่ "เวลาที่เหลือก่อนชน" ยังเป็น ${MARGIN} วินาทีเท่าเดิม นี่คือเหตุผลที่ตัวเลขในกฎควรอยู่ในหน่วยเวลา`
    },
    'swarm-timing': {
      kind: 'runner',
      run: swarmScene.run,
      watched: [0],
      caption: `จังหวะที่ฝูงนกหาเจอหลังฝึก 60 รอบ: กระโดดเมื่อของเหลือเวลาถึงตัว ${DINO_SWARM_FOUND.jump} วินาที หมอบเมื่อเหลือ ${DINO_SWARM_FOUND.duck} วินาที · ภาพคือจังหวะที่เพิ่งสั่งกระโดดพอดี ลู่วิ่งอยู่ที่ ${swarmSpeed} พิกเซลต่อวินาที ของชิ้นหน้าอยู่ห่าง ${swarmGap} พิกเซล — เฉียดกว่ายีนตั้งต้นของ GA ในหัวข้อก่อนมาก ฝูงเรียนรู้ว่ายิ่งรอให้ของเข้ามาใกล้ ยิ่งตกลงมาทันก่อนของชิ้นถัดไป`
    },
    'evolved-timing': {
      kind: 'runner',
      run: earlyScene.run,
      watched: [0],
      caption: `ยีนกระโดด ${EARLY_GENE} วินาที แบบที่สุ่มได้ตอนเริ่มฝึกบ่อย ๆ — ลู่วิ่งอยู่ที่ ${earlySpeed} พิกเซลต่อวินาที มันจึงสั่งกระโดดตอนของยังห่างถึง ${earlyGap} พิกเซล ซึ่งเร็วเกินไป · ยีนแบบนี้วิ่งได้ไม่กี่ร้อยเมตรก็ชน พอเทียบระยะกับแชมป์แล้วแพ้ การคัดเลือกก็ทิ้งมันไปเอง โดยไม่มีใครต้องบอกว่าเลขนี้ผิด`
    },
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
    'swarm-weights': {
      kind: 'othello',
      board: flockBest.board,
      moves: [],
      last: flockBest.last,
      caption: `ตัวที่ดีที่สุดของฝูงนกหลังฝึก 40 เกม เล่นฝ่ายดำกับ "ยึดมุมก่อน" จบที่ ${flockBest.black}–${flockBest.white} · ฝูงให้น้ำหนักมุม ${corners} จากเต็ม 20 แต่ก็ให้ช่องทแยงติดมุมสูงถึง ${besideCorner} ด้วย ทั้งที่ผู้เล่นเก่ง ๆ ถือว่าช่องนั้นอันตราย เพราะเปิดมุมให้คู่แข่ง — ฝูงไม่ได้เข้าใจโอเทลโล มันแค่เจอน้ำหนักที่ชนะคู่ซ้อมตัวนี้ ซึ่งเดินเหมือนเดิมทุกเกม`
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
    'divide-and-conquer': {
      kind: 'hanoi',
      puzzle: pivot.puzzle,
      towers: pivot.towers,
      last: pivot.last,
      caption: `จาน ${FIGURE_DISKS} ใบใช้ ${pivot.plan.length} ตา และภาพนี้คือตาที่ ${half + 1} พอดี — ${half} ตาแรกคือย้าย ${FIGURE_DISKS - 1} ใบบนไปกองไว้ที่หมุด ${pegName(pivot.puzzle.spare)} ตานี้คือย้ายใบล่างสุดไปหมุด ${pegName(pivot.puzzle.target)} ที่ว่างโล่ง แล้วที่เหลืออีก ${half} ตาคือย้ายกองนั้นตามไปทับ · สองครึ่งที่ว่าคืองานเดียวกับทั้งก้อนเป๊ะ แค่เล็กลงหนึ่งใบ จำนวนตาจึงเป็น ${half} + 1 + ${half} = ${pivot.plan.length}`
    },
    'hanoi-parity': {
      kind: 'hanoi',
      puzzle: stacked.puzzle,
      towers: stacked.towers,
      last: stacked.last,
      caption: `กองเดียวกันนี้เกิดขึ้นได้โดยไม่ต้องวางแผนอะไรเลย · ${half} ตาแรกของโจทย์ ${FIGURE_DISKS} ใบ จานเล็กสุดเป็นคนขยับในตาที่ ${oddTurns.join(', ')} คือตาคี่ทุกตาไม่มีพลาด ส่วนตาคู่ที่เหลือมีตาที่ถูกกติกาอยู่ตาเดียวเสมอจึงไม่ต้องเลือก · จาน ${FIGURE_DISKS} ใบเป็นจำนวนคู่ จานเล็กสุดจึงวนไปทางขวา ${pegName(0)}→${pegName(1)}→${pegName(2)}→${pegName(0)}`
    },
    pursuit: {
      kind: 'chase',
      match: tail.match,
      looked: tail.looked,
      caption: `ผู้ไล่ล่าสองตัวเล็งที่ตัวเอกเหมือนกันทั้งคู่ ช่องม่วงจางคือทางที่สั้นที่สุดที่แต่ละตัวกำลังจะเดินตาม · ตอนนี้ห่างอยู่ ${tailGap.join(' กับ ')} ช่อง และปลายทางของทั้งสองเส้นคือช่องเดียวกัน คือช่องที่ตัวเอกยืนอยู่ตอนนี้ ซึ่งอีกวินาทีเดียวเขาก็ไม่อยู่ตรงนั้นแล้ว — ไล่ตามหลังอย่างเดียวจึงได้แค่ตามติด ไม่ได้ปิดทางหนี · ตัวเอกเก็บของไปแล้ว ${tail.match.taken} จาก ${tail.match.arena.gems.length} ชิ้น`
    },
    ambush: {
      kind: 'chase',
      match: split.match,
      looked: split.looked,
      caption: `ฉากเดียวกัน ตัวเอกเดินทางเดิมเป๊ะทุกก้าว ต่างกันแค่ผู้ไล่ล่าเล็งคนละที่ — ตัวที่ 1 ตามหลังอยู่ ${splitGap[0]} ช่อง ตัวที่ 2 ไม่วิ่งตาม แต่ไปยืนรอที่ช่องข้างหน้าตัวเอกสามช่อง จึงมาโผล่ข้างหน้าแล้วตั้งแต่ตอนนี้ ตัวที่ 3 ไปรอที่ของชิ้นที่เขากำลังจะเก็บ · เส้นทั้งสามแยกออกจากกัน ทางที่ตัวเอกเดินได้อย่างปลอดภัยจึงแคบลงเรื่อย ๆ แทนที่จะแค่ถูกตามติด`
    },
    encirclement: {
      kind: 'chase',
      match: closing.match,
      looked: closing.looked,
      caption: `ฉากเดิมอีกครั้ง ตัวเอกเดินทางเดิมเป๊ะ คราวนี้ผู้ไล่ล่าสี่ตัวและไม่มีใครมีหน้าที่ประจำเลย — ตอนนี้ห่างอยู่ ${closingGap.join(' · ')} ช่อง ${rushing} ตัวที่เข้าเขต ${RUSH_RANGE} ช่องแล้วเลิกเฝ้า หันมารุมตัวเอกพร้อมกัน อีก ${holding} ตัวที่ยังไกลไปยึดของชิ้นที่เขากำลังจะเก็บไว้ก่อน · ต่างจากหัวข้อที่แล้วตรงที่บทบาทไม่ได้ถูกแบ่งไว้ล่วงหน้า ตัวไหนเข้าเขตก่อนก็กลายเป็นตัวรุมเอง ถอยห่างออกไปเมื่อไรก็กลับไปเฝ้าของใหม่ · ในเกมจริงยังมีกฎย่อยอีกข้อ คือเมื่อมีหลายทางที่สั้นเท่ากัน แต่ละตัวจะเลี่ยงไปทางที่ห่างเพื่อนที่สุด วงจึงแคบลงจากคนละด้าน ไม่ใช่ไล่ต่อแถวกันมาทางเดียว`
    },
    'layered-safety': {
      kind: 'chase',
      match: layered.match,
      looked: layered.looked,
      runnerLooked: layered.runnerLooked,
      caption: `จังหวะที่ ${layered.match.tick} ของตัวอย่าง "ใกล้ก็หนีก่อน" — ผู้ไล่ล่าที่ใกล้ที่สุดห่าง ${layeredGap} ช่อง ซึ่งเข้าเงื่อนไข "ไม่เกิน 4" พอดี ชั้นเอาตัวรอดจึงตัดหน้าชั้นทำงาน ช่องเขียวจางคือช่องรอบตัวที่มันกำลังชั่งว่าถอยไปทางไหนแล้วห่างที่สุด ส่วนช่องม่วงจางคือทางที่ฝ่ายไล่วางไว้ · เก็บของไปแล้ว ${layered.match.taken} จาก ${layered.match.arena.gems.length} ชิ้น`
    },
    'potential-field': {
      kind: 'chase',
      match: potential.match,
      looked: potential.looked,
      runnerLooked: potential.runnerLooked,
      caption: `จังหวะเดียวกันเป๊ะ สนามเดียวกัน ผู้ไล่ล่าชุดเดียวกัน เปลี่ยนแค่วิธีคิดของคนหนีเป็น "ชั่งน้ำหนักทุกก้าว" — ผู้ไล่ล่าที่ใกล้ที่สุดห่าง ${potentialGap} ช่องเท่ากัน แต่แรงผลักออกฤทธิ์เฉพาะในระยะ 3 ช่อง ที่ระยะนี้จึงเหลือแต่แรงดึงของเป้าหมาย มันเลยเดินหน้าเก็บของต่อแทนที่จะถอย · เก็บไปแล้ว ${potential.match.taken} จาก ${potential.match.arena.gems.length} ชิ้น มากกว่าอีกฉากหนึ่งชิ้นทั้งที่เดินมาเท่ากัน`
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
