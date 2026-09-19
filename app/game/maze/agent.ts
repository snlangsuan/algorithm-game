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

/** ข้อมูลแผนที่ทั้งหมดที่ agent ได้รับ */
export interface MazeState {
  /** grid[row][col] : FLOOR(0) | WALL(1) | MUD(2) */
  grid: Grid
  width: number
  height: number
  /** ช่องเริ่มต้น */
  start: Point
  /** ทางออกที่ต้องไปให้ถึง */
  goal: Point
  /** ต้นทุนของการเหยียบพื้นปกติ / โคลน */
  costFloor: number
  costMud: number
  /** โหมดเดินทีละก้าว: ช่องที่ยืนอยู่ตอนนี้ (โหมดวางแผนจะเท่ากับ start) */
  position: Point
  /** โหมดเดินทีละก้าว: ก้าวที่เท่าไร เริ่มจาก 1 */
  step: number
  /** โหมดเดินทีละก้าว: ช่องที่เพิ่งเดินออกมา (null ถ้าเป็นก้าวแรก) */
  previous: Point | null
  /** โหมดเดินทีละก้าว: จำนวนครั้งที่เคยเหยียบแต่ละช่อง เช่น visits["3,5"] */
  visits: Record<string, number>
  /** จำนวนก้าวสูงสุดก่อนระบบตัดจบ */
  stepLimit: number
  /** เวลาที่แนะนำให้ใช้คิด (ms) */
  timeBudget: number
}

/** ค่าที่ solve() คืนได้ — ลิสต์ช่อง หรือลิสต์ทิศทาง */
export type PathResult = Array<Point | [number, number] | Direction> | null

/** ค่าที่ step() คืนได้ — ช่องถัดไป หรือทิศที่จะก้าว */
export type StepResult = Point | [number, number] | Direction | null

/** คิวลำดับความสำคัญที่ agent ขอมาใช้ได้จาก this.heap() */
export interface AgentHeap<T> {
  readonly size: number
  push(value: T, priority: number): void
  pop(): T | undefined
}

/**
 * คลาสแม่ของ agent ทุกตัวในเกมเขาวงกต
 *
 * ผู้เล่นเขียน `class Agent extends MazeAgent` แล้วเลือก override หนึ่งในสองเมธอด
 *
 *   solve(state) -> คืนเส้นทางทั้งเส้นทีเดียว (เห็นแผนที่ทั้งใบ เหมาะกับ BFS / Dijkstra / A*)
 *   step(state)  -> คืนก้าวถัดไปทีละก้าว (เหมาะกับหุ่นเดินเลาะกำแพงหรือหนูหาทาง)
 *
 * ถ้า override ทั้งคู่ ระบบจะใช้ solve()
 */
export class MazeAgent {
  /** ชื่อที่จะแสดงบนหน้าจอ — ตั้งทับได้ */
  name = 'Agent'

  /** override เพื่อวางแผนทั้งเส้นทางในครั้งเดียว */
  solve(_state: MazeState): PathResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  /** override เพื่อเดินทีละก้าว */
  step(_state: MazeState): StepResult {
    throw new Error('Agent ต้อง override เมธอด solve(state) หรือ step(state)')
  }

  /** เรียกครั้งเดียวก่อนเริ่มออกเดิน (ไม่บังคับ override) */
  onStart(_state: MazeState): void {}

  /** เรียกเมื่อจบรอบ พร้อมสรุปผล (ไม่บังคับ override) */
  onFinish(_result: { ok: boolean; steps: number; cost: number }): void {}

  /**
   * บอกระบบว่ากำลังสำรวจช่องนี้ — หน้าจอจะระบายสีตามลำดับที่เรียก
   * ใช้เพื่อ "เห็น" ว่าอัลกอริทึมของเราค้นไปทางไหนบ้าง (ไม่เรียกก็ได้ ไม่มีผลกับคะแนน)
   * ตัวจริงถูกแทนที่ตอนรันใน worker เมธอดนี้จึงว่างไว้
   */
  visit(_row: number | Point, _col?: number): void {}

  // ---------- ตัวช่วยอ่านแผนที่ ----------

  /** อยู่ในขอบเขตแผนที่ไหม */
  inside(grid: Grid, row: number, col: number): boolean {
    return inside(grid, row, col)
  }

  /** เดินเข้าไปได้ไหม (อยู่ในแผนที่ และไม่ใช่กำแพง) */
  walkable(grid: Grid, row: number, col: number): boolean {
    return walkable(grid, row, col)
  }

  /** เป็นกำแพงไหม */
  isWall(grid: Grid, row: number, col: number): boolean {
    return !inside(grid, row, col) || grid[row]![col] === WALL
  }

  /** ต้นทุนของการก้าวเข้าไปเหยียบช่องนี้ (พื้น 1, โคลน 5, กำแพง Infinity) */
  cost(grid: Grid, row: number, col: number): number {
    return stepCost(grid, row, col)
  }

  /** ช่องข้างเคียงที่เดินได้ทั้งหมด -> [{ row, col, dir, cost }, ...] */
  neighbors(grid: Grid, row: number, col: number): Neighbor[] {
    return neighbors(grid, row, col)
  }

  /** ช่องถัดไปถ้าก้าวไปทางนั้นจากตำแหน่งที่ให้ (ไม่เช็กกำแพงให้) */
  ahead(point: Point, direction: Direction): Point {
    const dir = findDirection(direction)
    if (!dir) throw new Error(`ไม่รู้จักทิศ "${direction}"`)
    return { row: point.row + dir.dr, col: point.col + dir.dc }
  }

  /** ทิศทั้งสี่เรียงตามเข็มนาฬิกา: up, right, down, left */
  directions(): Direction[] {
    return DIRECTIONS.map((dir) => dir.name)
  }

  /** หันขวา/ซ้ายจากทิศที่ให้ */
  turn(direction: Direction, side: 'left' | 'right'): Direction {
    const list = this.directions()
    const index = list.indexOf(direction)
    if (index < 0) throw new Error(`ไม่รู้จักทิศ "${direction}"`)
    const shift = side === 'right' ? 1 : list.length - 1
    return list[(index + shift) % list.length]!
  }

  /** กุญแจข้อความของช่อง ใช้เป็น key ของ Map / Set เช่น "3,5" */
  key(row: number | Point, col?: number): string {
    if (typeof row === 'object') return key(row.row, row.col)
    return key(row, col as number)
  }

  /** แปลงกุญแจกลับเป็นช่อง */
  parse(id: string): Point {
    const [row, col] = id.split(',')
    return { row: Number(row), col: Number(col) }
  }

  /** ระยะแบบเดินในกริด (heuristic ที่นิยมใช้กับ A*) */
  manhattan(a: Point, b: Point): number {
    return manhattan(a, b)
  }

  /** ช่องเดียวกันไหม */
  same(a: Point | null, b: Point | null): boolean {
    return a !== null && b !== null && a.row === b.row && a.col === b.col
  }

  /** คิวลำดับความสำคัญพร้อมใช้ — heap.push(value, priority) / heap.pop() / heap.size */
  heap<T>(): AgentHeap<T> {
    return createHeap<T>()
  }

  /**
   * ถอยกลับตามรอย cameFrom เพื่อประกอบเป็นเส้นทาง
   * cameFrom เป็น Map จาก key ของช่อง -> ช่องก่อนหน้า (ช่องเริ่มต้นชี้ไป null)
   * คืน [] ถ้าไปไม่ถึงเป้าหมาย
   */
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

/** ค่าคงที่ที่เรียกใช้ได้ในสโคปของโค้ดผู้เล่น */
export const AGENT_GLOBALS = { FLOOR, WALL, MUD, COST_FLOOR, COST_MUD } as const
