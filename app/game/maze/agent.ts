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
