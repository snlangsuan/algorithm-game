import {
  COST_FLOOR,
  COST_MUD,
  DIRECTIONS,
  FLOOR,
  MUD,
  WALL,
  createHeap,
  findDirection,
  inside,
  key,
  manhattan,
  neighbors,
  stepCost,
  walkable,
  type Direction,
  type Grid,
  type Neighbor,
  type Point
} from './engine'
import { chooseStep, emptyColony, layScent, readColony, strongestStep, type Colony } from './ants'

export interface MazeState {

  grid: Grid
  width: number
  height: number

  start: Point

  goal: Point

  costFloor: number
  costMud: number

  position: Point

  step: number

  previous: Point | null

  visits: Record<string, number>

  stepLimit: number

  timeBudget: number
}

/** ของที่จำไว้ข้ามรอบ — เก็บลงเครื่องเป็น JSON รอบหน้าเปิดมาก็ยังอยู่ */
export interface MazeMemory {
  label?: string
  [key: string]: unknown
}

export type PathResult = Array<Point | [number, number] | Direction> | null

export type StepResult = Point | [number, number] | Direction | null

export interface AgentHeap<T> {
  readonly size: number
  push(value: T, priority: number): void
  pop(): T | undefined
}

export class MazeAgent {

  name = 'Agent'

  solve(_state: MazeState): PathResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  step(_state: MazeState): StepResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  onStart(_state: MazeState): void {}

  onFinish(_result: { ok: boolean; steps: number; cost: number }): void {}

  /** ความจำที่เก็บไว้จากรอบก่อน ๆ — ยังไม่เคยจำอะไรเลยก็เป็น null */
  memory: MazeMemory | null = null

  /** บันทึกความจำลงเครื่อง — ตัวรันเป็นคนเขียนทับเมธอดนี้ */
  saveMemory(_data: MazeMemory): void {}

  /** ผลของรอบที่เพิ่งจบ — หัวบล็อก "เมื่อจบรอบ" ตั้งไว้ให้ก่อนทำบล็อกข้างใน */
  result: { ok: boolean; steps: number; cost: number } | null = null

  /** ฝูงมดที่อ่านจากความจำครั้งแรกของรอบนี้ */
  private colony: Colony | null | undefined = undefined

  /** ทางที่มดตัวนี้เดินมาทั้งหมด รวมวงวน — ตัดวงวนทีหลังตอนทิ้งกลิ่น */
  private antTrail: Point[] = []

  /**
   * มด: เลือกทางหนึ่งก้าว — 'scent' สุ่มโดยทางที่กลิ่นแรง ถูก และยังไม่เคยเหยียบมีโอกาสมากกว่า
   * 'strongest' ตามกลิ่นที่แรงที่สุดตรง ๆ ไม่สุ่ม ใช้ดูว่าฝูงจำทางไหนไว้
   */
  antStep(mode: 'scent' | 'strongest'): Direction | null {
    const state = (this as unknown as { here?: MazeState }).here
    if (!state) return null

    if (this.colony === undefined) this.colony = readColony(this.memory?.colony, state.grid)
    if (this.antTrail.length === 0) this.antTrail.push({ ...state.position })

    const direction =
      mode === 'strongest'
        ? strongestStep(this.colony, state.grid, state.position, state.visits)
        : chooseStep(this.colony, state.grid, state.position, state.visits, Math.random)

    if (direction) this.antTrail.push(this.ahead(state.position, direction))
    return direction
  }

  /** มด: ทิ้งกลิ่นตามทางที่เดินมา (ตัดวงวนออกก่อน) แล้วให้กลิ่นเก่าระเหย — ใช้ตอนจบรอบ */
  antLayScent(): void {
    const state = (this as unknown as { here?: MazeState }).here
    if (!state || this.antTrail.length === 0) return

    const colony = layScent(this.colony ?? emptyColony(state.grid), state.grid, this.antTrail, Boolean(this.result?.ok))
    this.colony = colony
    const best = colony.bestCost === null ? '' : ` · ทางถูกสุด ${colony.bestCost}`
    this.saveMemory({ ...this.memory, colony, label: `ปล่อยมดไปแล้ว ${colony.ants} ตัว ถึงทางออก ${colony.arrived} ตัว${best}` })
  }

  visit(_row: number | Point, _col?: number): void {}

  inside(grid: Grid, row: number, col: number): boolean {
    return inside(grid, row, col)
  }

  walkable(grid: Grid, row: number, col: number): boolean {
    return walkable(grid, row, col)
  }

  isWall(grid: Grid, row: number, col: number): boolean {
    return !inside(grid, row, col) || grid[row]![col] === WALL
  }

  cost(grid: Grid, row: number, col: number): number {
    return stepCost(grid, row, col)
  }

  neighbors(grid: Grid, row: number, col: number): Neighbor[] {
    return neighbors(grid, row, col)
  }

  ahead(point: Point, direction: Direction): Point {
    const dir = findDirection(direction)
    if (!dir) throw new Error(`ไม่รู้จักทิศ "${direction}"`)
    return { row: point.row + dir.dr, col: point.col + dir.dc }
  }

  directions(): Direction[] {
    return DIRECTIONS.map((dir) => dir.name)
  }

  turn(direction: Direction, side: 'left' | 'right'): Direction {
    const list = this.directions()
    const index = list.indexOf(direction)
    if (index < 0) throw new Error(`ไม่รู้จักทิศ "${direction}"`)
    const shift = side === 'right' ? 1 : list.length - 1
    return list[(index + shift) % list.length]!
  }

  key(row: number | Point, col?: number): string {
    if (typeof row === 'object') return key(row.row, row.col)
    return key(row, col as number)
  }

  parse(id: string): Point {
    const [row, col] = id.split(',')
    return { row: Number(row), col: Number(col) }
  }

  manhattan(a: Point, b: Point): number {
    return manhattan(a, b)
  }

  same(a: Point | null, b: Point | null): boolean {
    return a !== null && b !== null && a.row === b.row && a.col === b.col
  }

  heap<T>(): AgentHeap<T> {
    return createHeap<T>()
  }

  rebuild(cameFrom: Map<string, Point | null | undefined>, goal: Point): Point[] {
    if (!cameFrom.has(this.key(goal.row, goal.col))) return []

    const path: Point[] = []
    let cursor: Point | null | undefined = goal
    let guard = 0

    while (cursor && guard++ < 1_000_000) {
      path.push({ row: cursor.row, col: cursor.col })
      cursor = cameFrom.get(this.key(cursor.row, cursor.col))
    }

    return path.reverse()
  }
}

export const AGENT_GLOBALS = { FLOOR, WALL, MUD, COST_FLOOR, COST_MUD } as const
