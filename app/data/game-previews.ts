import {
  createMaze,
  createRng,
  solve,
  type Maze,
  type Point
} from '~/game/maze/engine'
import {
  applyMove as applyDisk,
  createHanoi,
  optimalMoves,
  solveMoves,
  type Hanoi,
  type Move as DiskMove,
  type Towers
} from '~/game/hanoi/engine'
import {
  advanceHero,
  aim,
  createMatch,
  dueHunters,
  findArena,
  moveHunter,
  pathTo,
  stepAlong,
  type Arena,
  type Direction
} from '~/game/chase/engine'
import { BODY, DUCK_CLEAR } from '~/game/dino/art'
import {
  DECIDE_EVERY,
  advance as advanceDino,
  createRun as createDinoRun,
  findCourse,
  onGround as dinoOnGround,
  order as orderDino,
  speedOf as dinoSpeed,
  visible as visibleObstacles,
  type Course,
  type Obstacle,
  type Run as DinoRun
} from '~/game/dino/engine'
import { lapPercent, type Point as LinePoint, type Run as LineRun } from '~/game/line/engine'
import { playRule } from '~/game/line/rules'
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

  path: Point[]
}

export interface HanoiPreview {
  puzzle: Hanoi

  towers: Towers

  last: DiskMove | null

  moves: number
  best: number
}

export interface ChasePreview {
  arena: Arena

  hero: Point

  hunters: Point[]

  /** ของที่ยังไม่ถูกเก็บ */
  gems: Point[]

  taken: number

  /** ทางที่ผู้ไล่ล่าตัวแรกกำลังเดินตามอยู่ */
  path: Point[]
}

export interface DinoPreview {
  course: Course

  /** วิ่งมาแล้วกี่พิกเซล — ใช้เป็นจุดอ้างอิงตำแหน่งของทุกอย่างในภาพ */
  distance: number

  /** เท้าลอยสูงจากพื้นกี่พิกเซลตอนนั้น */
  height: number

  /** สิ่งกีดขวางที่อยู่ในกรอบภาพ */
  obstacles: Obstacle[]

  speed: number

  cleared: number
}

export interface LinePreview {
  /** เส้นของสนาม — จุดถี่ ๆ ที่วนกลับมาจุดแรก */
  track: LinePoint[]

  /** รอยที่หุ่นวิ่งผ่านมาถึงตอนนั้น */
  trail: LinePoint[]

  run: LineRun
}

export interface OthelloPreview {
  board: Board

  moves: Move[]

  last: Point | null
  turn: Player
  count: DiscCount
}

const PREVIEW_MAZE = { width: 15, height: 11, seed: 7 } as const

const PREVIEW_PLIES = 18

const PREVIEW_SEED = 5

const PREVIEW_DISKS = 5

const PREVIEW_STEPS = 11

/** เส้นทางที่ตัวเอกเดินในภาพย่อ — เขียนไว้ตายตัว ภาพจะได้เหมือนเดิมทุกครั้ง */
const PREVIEW_RUN: Direction[] = [
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

const PREVIEW_HUNTER_SPEED = 0.5

export function buildMazePreview(): MazePreview {
  const maze = createMaze(PREVIEW_MAZE)
  return { maze, path: solve(maze)?.path ?? [maze.start] }
}

export function buildOthelloPreview(): OthelloPreview {
  const rng = createRng(PREVIEW_SEED)

  let board = createBoard()
  let turn: Player = BLACK
  let last: Point | null = null

  for (let ply = 0; ply < PREVIEW_PLIES; ply++) {
    const moves = getValidMoves(board, turn)

    if (moves.length === 0) {

      if (getValidMoves(board, opponent(turn)).length === 0) break
      turn = opponent(turn)
      continue
    }

    const move = moves[Math.floor(rng() * moves.length)]!

    board = applyMove(board, move, turn)
    last = { row: move.row, col: move.col }
    turn = opponent(turn)
  }

  if (getValidMoves(board, turn).length === 0) turn = opponent(turn)

  return {
    board,
    moves: getValidMoves(board, turn),
    last,
    turn,
    count: countDiscs(board)
  }
}

export function buildHanoiPreview(): HanoiPreview {
  const puzzle = createHanoi({ disks: PREVIEW_DISKS })
  const plan = solveMoves(puzzle)

  let towers = puzzle.towers
  let last: DiskMove | null = null

  for (const move of plan.slice(0, PREVIEW_STEPS)) {
    towers = applyDisk(towers, move)
    last = move
  }

  return {
    puzzle,
    towers,
    last,
    moves: Math.min(PREVIEW_STEPS, plan.length),
    best: optimalMoves(PREVIEW_DISKS)
  }
}

/**
 * ภาพย่อเกมไล่จับ — เดินตามบทที่เขียนไว้ ไม่มีการสุ่มเลย
 * ผู้ไล่ล่าใช้ทางที่สั้นที่สุดเหมือนตัวอย่างหลักในเกม ภาพจึงเล่าเรื่องเดียวกับของจริง
 */
export function buildChasePreview(): ChasePreview {
  const match = createMatch(findArena('lattice'), { hunters: 2, hunterSpeed: PREVIEW_HUNTER_SPEED })

  for (const dir of PREVIEW_RUN) {
    if (match.over) break

    aim(match, dir)
    advanceHero(match)

    for (const hunter of dueHunters(match, PREVIEW_HUNTER_SPEED)) {
      moveHunter(match, hunter, stepAlong(match.arena.grid, hunter.at, match.hero))
    }
  }

  return {
    arena: match.arena,
    hero: { ...match.hero },
    hunters: match.hunters.map((hunter) => ({ ...hunter.at })),
    gems: match.gems.map((gem) => ({ ...gem })),
    taken: match.taken,
    path: pathTo(match.arena.grid, match.hunters[0]!.at, match.hero)
  }
}

/** เมล็ดของลู่ในภาพย่อ — เลขตายตัว ภาพจะได้เหมือนเดิมทุกครั้ง */
const PREVIEW_DINO_SEED = 12

/**
 * ภาพย่อเกมวิ่งหลบ — เล่นด้วยกฎเดียวกับตัวอย่าง "เผื่อระยะตามความเร็ว (reflex agent)" จนเจอจังหวะที่เล่าเรื่องได้
 *
 * ที่อยากได้คือจังหวะลอยอยู่เหนือของที่กำลังข้าม ไม่ใช่ตอนวิ่งบนลู่โล่ง
 * กฎในนี้เขียนซ้ำแทนที่จะเรียกโปรแกรมจริง เพราะโปรแกรมของผู้เล่นรันใน worker ซึ่งเรียกจากตรงนี้ไม่ได้
 */
export function buildDinoPreview(): DinoPreview {
  const run: DinoRun = createDinoRun({ courseId: 'classic', seed: PREVIEW_DINO_SEED })

  for (let step = 0; step < 4000; step++) {
    // อยากได้จังหวะที่ตัวละครลอยอยู่เหนือของพอดี ไม่ใช่ลอยอยู่เฉย ๆ กลางลู่โล่ง
    const over = visibleObstacles(run).some(
      (item) => item.x < run.distance + BODY.stand.width && item.x + item.box.width > run.distance
    )
    if (!dinoOnGround(run) && run.y > 20 && over) break

    const speed = dinoSpeed(run)
    const next = visibleObstacles(run).find((item) => item.x + item.box.width > run.distance)
    const gap = next ? next.x - run.distance : Number.POSITIVE_INFINITY

    if (gap <= speed * 0.3) orderDino(run, next && next.box.bottom >= DUCK_CLEAR ? 'duck' : 'jump')
    else orderDino(run, 'run')

    for (let frame = 0; frame < DECIDE_EVERY && !run.over; frame++) advanceDino(run)
    if (run.over) break
  }

  return {
    course: findCourse('classic'),
    distance: run.distance,
    height: run.y,
    obstacles: visibleObstacles(run).map((item) => ({ ...item })),
    speed: dinoSpeed(run),
    cleared: run.cleared
  }
}

/** หยุดภาพไว้ตอนวิ่งไปได้เท่านี้ % ของรอบ — กลางสนามคดเคี้ยว เห็นรอยผ่านโค้งมาแล้วหลายโค้ง */
const PREVIEW_LINE_PERCENT = 62

/**
 * ภาพย่อหุ่นเดินตามเส้น — วิ่งสนามคดเคี้ยวด้วยกฎเดียวกับตัวอย่าง PD ในเกม แล้วหยุดกลางทาง
 * สนามไม่มีการสุ่ม ภาพจึงเหมือนเดิมทุกครั้งโดยไม่ต้องล็อกเมล็ด
 */
export function buildLinePreview(): LinePreview {
  const run = playRule('wave', 'pd', (current) => lapPercent(current) >= PREVIEW_LINE_PERCENT)

  return { track: run.track.points, trail: run.trail, run }
}
