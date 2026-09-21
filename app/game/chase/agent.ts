import {
  DIRECTIONS,
  FLOOR,
  WALL,
  aheadOf,
  cloneGrid,
  distanceField,
  exitOpen,
  inside,
  lineOfSight,
  manhattan,
  neighbors,
  opposite,
  pathLength,
  pathTo,
  same,
  stepAlong,
  stepInto,
  walkable,
  type Direction,
  type Grid,
  type Match,
  type Point
} from './engine'

/** ตัวละครหนึ่งตัวเท่าที่ AI มองเห็น — ใช้ได้ทั้งผู้ไล่ล่าและคนหนี */
export interface MoverView extends Point {
  /** หมายเลขตัว เริ่มที่ 0 — คนหนีเป็น 0 เสมอเพราะมีตัวเดียว */
  index: number
  facing: Direction
  /** จุดเกิดของตัวเอง */
  home: Point
}

/**
 * ทุกอย่างที่ตัวที่กำลังคิดรู้ ณ จังหวะนั้น — ใช้ร่วมกันทั้งสองฝ่าย
 *
 * ส่งใหม่ทุกครั้งที่ถึงตาเดิน และ me จะเปลี่ยนไปตามตัวที่กำลังคิด
 * ถ้าเป็นฝ่ายไล่ me คือผู้ไล่ล่าตัวนั้น (โปรแกรมชุดเดียวคุมได้ทุกตัว แยกหน้าที่ด้วยหมายเลข)
 * ถ้าเป็นฝ่ายหนี me คือคนหนีเอง ซึ่งอยู่ช่องเดียวกับ hero เสมอ
 */
export interface ChaseState {
  grid: Grid
  width: number
  height: number

  /** ตัวเอกที่ผู้เล่นบังคับอยู่ */
  hero: Point

  /** ทิศที่ตัวเอกกำลังหันไป — ใช้เดาว่าอีกสองสามช่องข้างหน้าจะไปโผล่ตรงไหน */
  heroFacing: Direction

  hunters: MoverView[]

  /** ตัวที่กำลังคิดอยู่ตอนนี้ — ผู้ไล่ล่าตัวหนึ่ง หรือคนหนี แล้วแต่ว่าโปรแกรมนี้เป็นของฝ่ายไหน */
  me: MoverView

  /** ของที่ตัวเอกยังเก็บไม่ครบ */
  gems: Point[]

  exit: Point

  /** ประตูหนีเปิดเมื่อของหมดแล้ว — ก่อนหน้านั้นเฝ้าไว้ก็เท่านั้น */
  exitOpen: boolean

  /** เก็บไปแล้วกี่ชิ้น */
  taken: number

  /** ผ่านไปกี่จังหวะแล้ว */
  tick: number

  /** เวลาคิดต่อหนึ่งจังหวะ (ms) */
  timeBudget: number
}

/** ทิศที่จะเดิน — คืน null คือยืนอยู่กับที่ */
export type MoveResult = Direction | Point | [number, number] | null

export class ChaseAgent {
  name = 'Agent'

  /** เรียกทุกครั้งที่ผู้ไล่ล่าตัวหนึ่งถึงตาเดิน */
  step(_state: ChaseState): MoveResult {
    throw new Error('Agent ต้อง override เมธอด step(state)')
  }

  onStart(_state: ChaseState): void {}

  onFinish(_result: { caught: boolean; ticks: number }): void {}

  /** บอกสนามว่าดูช่องนี้อยู่ — สนามจะระบายสีจาง ๆ ให้เห็นว่า AI คิดถึงทางไหน */
  visit(_cell: Point): void {}

  inside(grid: Grid, row: number, col: number): boolean {
    return inside(grid, row, col)
  }

  walkable(grid: Grid, row: number, col: number): boolean {
    return walkable(grid, row, col)
  }

  isWall(grid: Grid, row: number, col: number): boolean {
    return !walkable(grid, row, col)
  }

  neighbors(grid: Grid, at: Point): Array<Point & { dir: Direction }> {
    return neighbors(grid, at)
  }

  stepInto(at: Point, dir: Direction): Point {
    return stepInto(at, dir)
  }

  ahead(grid: Grid, at: Point, dir: Direction, count = 1): Point {
    return aheadOf(grid, at, dir, count)
  }

  directions(): Direction[] {
    return DIRECTIONS.map((dir) => dir.name)
  }

  opposite(dir: Direction): Direction {
    return opposite(dir)
  }

  turn(dir: Direction, side: 'left' | 'right'): Direction {
    const list = this.directions()
    const index = list.indexOf(dir)
    if (index < 0) throw new Error(`ไม่รู้จักทิศ "${dir}"`)

    const shift = side === 'right' ? 1 : list.length - 1
    return list[(index + shift) % list.length]!
  }

  /** ทิศที่ต้องเดินเพื่อไปช่องที่ติดกัน — null ถ้าไม่ได้ติดกัน */
  towards(from: Point, to: Point): Direction | null {
    for (const dir of DIRECTIONS) {
      if (from.row + dir.dr === to.row && from.col + dir.dc === to.col) return dir.name
    }
    return null
  }

  /** ระยะจากช่องหนึ่งไปทุกช่องในสนาม — คิดครั้งเดียวแล้วเอาไปใช้ทั้งกระดาน */
  field(grid: Grid, from: Point): number[][] {
    return distanceField(grid, from)
  }

  /** ทางที่สั้นที่สุด รวมช่องที่ยืนอยู่ — ว่างเปล่าถ้าไปไม่ถึง */
  pathTo(grid: Grid, from: Point, to: Point): Point[] {
    return pathTo(grid, from, to)
  }

  pathStep(grid: Grid, from: Point, to: Point): Direction | null {
    return stepAlong(grid, from, to)
  }

  pathLength(grid: Grid, from: Point, to: Point): number {
    return pathLength(grid, from, to)
  }

  manhattan(a: Point, b: Point): number {
    return manhattan(a, b)
  }

  same(a: Point | null, b: Point | null): boolean {
    return same(a, b)
  }

  sight(grid: Grid, a: Point, b: Point): boolean {
    return lineOfSight(grid, a, b)
  }
}

/**
 * แปลงสนามจริงให้เป็นสิ่งที่ AI มองเห็น — คัดลอกทุกชั้น
 * โค้ดของผู้เล่นจึงแก้ของจริงในเกมไม่ได้แม้จะเผลอเขียนทับ
 */
export function viewOf(match: Match, timeBudget: number): ChaseState {
  const hunters: MoverView[] = match.hunters.map((hunter) => ({
    index: hunter.index,
    row: hunter.at.row,
    col: hunter.at.col,
    facing: hunter.facing,
    home: { ...hunter.home }
  }))

  return {
    grid: cloneGrid(match.arena.grid),
    width: match.arena.width,
    height: match.arena.height,
    hero: { ...match.hero },
    heroFacing: match.facing,
    hunters,
    me: hunters[0] ?? heroAsMover(match),
    gems: match.gems.map((gem) => ({ ...gem })),
    exit: { ...match.arena.exit },
    exitOpen: exitOpen(match),
    taken: match.taken,
    tick: match.tick,
    timeBudget
  }
}

/** คนหนีในรูปแบบเดียวกับผู้ไล่ล่า — ฝ่ายหนีจะได้ใช้บล็อกที่อ้างถึง "ฉัน" ได้เหมือนกัน */
export function heroAsMover(match: Match): MoverView {
  return {
    index: 0,
    row: match.hero.row,
    col: match.hero.col,
    facing: match.facing,
    home: { ...match.arena.hero }
  }
}

export const AGENT_GLOBALS = { FLOOR, WALL } as const
