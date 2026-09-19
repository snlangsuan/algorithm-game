/**
 * Maze engine — ฟังก์ชันบริสุทธิ์ล้วน ไม่ผูกกับ Vue หรือ DOM
 * ใช้ร่วมกันได้ทั้งฝั่ง UI และใน Web Worker ที่รันโค้ดของผู้เล่น
 */

export const FLOOR = 0 as const
export const WALL = 1 as const
export const MUD = 2 as const

export type Cell = typeof FLOOR | typeof WALL | typeof MUD
export type Grid = Cell[][]

export interface Point {
  row: number
  col: number
}

/** ต้นทุนของการก้าวเข้าไปเหยียบช่องแต่ละชนิด */
export const COST_FLOOR = 1
export const COST_MUD = 5

export const MIN_SIZE = 9
export const MAX_SIZE = 61

export type MazeKind = 'perfect' | 'braid' | 'obstacles' | 'cavern'

export interface MazeOptions {
  width: number
  height: number
  kind: MazeKind
  /** สัดส่วนกำแพงของแบบ "อุปสรรคสุ่ม" (0..1) */
  density: number
  /** สัดส่วนช่องโคลนบนพื้นที่เดินได้ (0..1) */
  mud: number
  seed: number
}

export interface Maze {
  width: number
  height: number
  grid: Grid
  start: Point
  goal: Point
  kind: MazeKind
  seed: number
}

export const DIRECTIONS = [
  { name: 'up', dr: -1, dc: 0 },
  { name: 'right', dr: 0, dc: 1 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'left', dr: 0, dc: -1 }
] as const

export type Direction = (typeof DIRECTIONS)[number]['name']

/** ช่องข้างเคียงพร้อมทิศและต้นทุนที่ต้องจ่ายเมื่อก้าวเข้าไป */
export interface Neighbor extends Point {
  dir: Direction
  cost: number
}

// ---------- ตัวช่วยพื้นฐาน ----------

/** ตัวสุ่มที่ผูกกับ seed — seed เดิมได้แผนที่เดิมเสมอ (mulberry32) */
export function createRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const inside = (grid: Grid, row: number, col: number): boolean =>
  row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0)

export const walkable = (grid: Grid, row: number, col: number): boolean =>
  inside(grid, row, col) && grid[row]![col] !== WALL

/** ต้นทุนของการก้าวเข้าไปเหยียบช่องนี้ (กำแพง = Infinity) */
export const stepCost = (grid: Grid, row: number, col: number): number => {
  if (!inside(grid, row, col)) return Infinity
  const cell = grid[row]![col]
  if (cell === WALL) return Infinity
  return cell === MUD ? COST_MUD : COST_FLOOR
}

export const key = (row: number, col: number): string => `${row},${col}`

export const same = (a: Point | null, b: Point | null): boolean =>
  a !== null && b !== null && a.row === b.row && a.col === b.col

export const manhattan = (a: Point, b: Point): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

export const cloneGrid = (grid: Grid): Grid => grid.map((line) => [...line])

export function neighbors(grid: Grid, row: number, col: number): Neighbor[] {
  const list: Neighbor[] = []

  for (const dir of DIRECTIONS) {
    const r = row + dir.dr
    const c = col + dir.dc
    if (!walkable(grid, r, c)) continue
    list.push({ row: r, col: c, dir: dir.name, cost: stepCost(grid, r, c) })
  }

  return list
}

export const findDirection = (name: string) => DIRECTIONS.find((dir) => dir.name === name)

/** ขนาดที่รับได้: อยู่ในช่วง และเป็นเลขคี่เสมอ (แบบเขาวงกตต้องการกรอบกำแพง) */
export const normalizeSize = (value: number): number => {
  const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)))
  return clamped % 2 === 0 ? clamped - 1 : clamped
}

// ---------- ค้นหาเส้นทาง (ใช้ทั้งตอนสร้างแผนที่และตอนหาเฉลย) ----------

/** คิวลำดับความสำคัญแบบ binary heap */
class Heap<T> {
  private items: Array<{ value: T; priority: number }> = []

  get size(): number {
    return this.items.length
  }

  push(value: T, priority: number): void {
    const items = this.items
    items.push({ value, priority })

    let index = items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (items[parent]!.priority <= items[index]!.priority) break
      ;[items[parent], items[index]] = [items[index]!, items[parent]!]
      index = parent
    }
  }

  pop(): T | undefined {
    const items = this.items
    const top = items[0]
    if (!top) return undefined

    const last = items.pop()!
    if (items.length === 0) return top.value

    items[0] = last
    let index = 0

    for (;;) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index

      if (left < items.length && items[left]!.priority < items[smallest]!.priority) smallest = left
      if (right < items.length && items[right]!.priority < items[smallest]!.priority) smallest = right
      if (smallest === index) break

      ;[items[smallest], items[index]] = [items[index]!, items[smallest]!]
      index = smallest
    }

    return top.value
  }
}

export const createHeap = <T>() => new Heap<T>()

export interface SearchResult {
  path: Point[]
  cost: number
  /** จำนวนช่องที่ถูกดึงออกจากคิวระหว่างค้นหา */
  expanded: number
}

/**
 * Dijkstra ทั่วไป — costOf คืนต้นทุนของการก้าวเข้าช่องนั้น หรือ null ถ้าเข้าไม่ได้
 * ตอนสร้างแผนที่จะส่ง costOf ที่ยอมให้ "ทะลุกำแพง" ด้วยราคาแพง เพื่อเจาะทางให้เดินถึงกันเสมอ
 */
export function search(
  grid: Grid,
  start: Point,
  goal: Point,
  costOf: (cell: Cell) => number | null
): SearchResult | null {
  const dist = new Map<string, number>()
  const from = new Map<string, Point | null>()
  const heap = createHeap<Point>()

  const startKey = key(start.row, start.col)
  dist.set(startKey, 0)
  from.set(startKey, null)
  heap.push(start, 0)

  let expanded = 0

  while (heap.size > 0) {
    const cell = heap.pop()!
    const id = key(cell.row, cell.col)
    const best = dist.get(id) ?? Infinity

    expanded++

    if (same(cell, goal)) {
      const path: Point[] = []
      let cursor: Point | null = cell

      while (cursor) {
        path.push(cursor)
        cursor = from.get(key(cursor.row, cursor.col)) ?? null
      }

      return { path: path.reverse(), cost: best, expanded }
    }

    for (const dir of DIRECTIONS) {
      const r = cell.row + dir.dr
      const c = cell.col + dir.dc
      if (!inside(grid, r, c)) continue

      const price = costOf(grid[r]![c]!)
      if (price === null) continue

      const nextId = key(r, c)
      const next = best + price
      if (next >= (dist.get(nextId) ?? Infinity)) continue

      dist.set(nextId, next)
      from.set(nextId, cell)
      heap.push({ row: r, col: c }, next)
    }
  }

  return null
}

/** เส้นทางที่ต้นทุนต่ำที่สุดจริง ๆ ของแผนที่นี้ — ใช้เป็นเฉลยไว้เทียบคะแนน */
export const solve = (maze: Maze): SearchResult | null =>
  search(maze.grid, maze.start, maze.goal, (cell) =>
    cell === WALL ? null : cell === MUD ? COST_MUD : COST_FLOOR
  )

/** เส้นทางที่ "ก้าวน้อยที่สุด" โดยไม่สนต้นทุนโคลน */
export const solveSteps = (maze: Maze): SearchResult | null =>
  search(maze.grid, maze.start, maze.goal, (cell) => (cell === WALL ? null : 1))

// ---------- สร้างแผนที่ ----------

const filled = (width: number, height: number, cell: Cell): Grid =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => cell))

function shuffle<T>(items: T[], rng: () => number): T[] {
  const list = [...items]

  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }

  return list
}

/**
 * เขาวงกตแท้ (perfect maze) ด้วย recursive backtracker
 * ช่องทางเดินอยู่ที่พิกัดคี่ ส่วนพิกัดคู่เป็นกำแพงกั้นระหว่างช่อง
 * ผลลัพธ์คือทุกช่องเดินถึงกันได้ และมีทางเดียวเท่านั้นระหว่างสองช่องใด ๆ
 */
function carvePerfect(width: number, height: number, rng: () => number): Grid {
  const grid = filled(width, height, WALL)
  const startCell = { row: 1, col: 1 }

  grid[startCell.row]![startCell.col] = FLOOR

  const stack: Point[] = [startCell]

  while (stack.length > 0) {
    const cell = stack[stack.length - 1]!
    const options = shuffle([...DIRECTIONS], rng).filter((dir) => {
      const r = cell.row + dir.dr * 2
      const c = cell.col + dir.dc * 2
      return r > 0 && r < height - 1 && c > 0 && c < width - 1 && grid[r]![c] === WALL
    })

    const dir = options[0]

    if (!dir) {
      stack.pop()
      continue
    }

    grid[cell.row + dir.dr]![cell.col + dir.dc] = FLOOR
    grid[cell.row + dir.dr * 2]![cell.col + dir.dc * 2] = FLOOR
    stack.push({ row: cell.row + dir.dr * 2, col: cell.col + dir.dc * 2 })
  }

  return grid
}

/** ทุบกำแพงที่ปลายตัน ทำให้เขาวงกตมีวงวนและมีหลายเส้นทางให้เลือก */
function braid(grid: Grid, rng: () => number, ratio: number): void {
  const height = grid.length
  const width = grid[0]?.length ?? 0

  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      if (grid[row]![col] !== FLOOR) continue
      if (neighbors(grid, row, col).length !== 1) continue
      if (rng() > ratio) continue

      const walls = shuffle([...DIRECTIONS], rng).filter((dir) => {
        const r = row + dir.dr
        const c = col + dir.dc
        return r > 0 && r < height - 1 && c > 0 && c < width - 1 && grid[r]![c] === WALL
      })

      const dir = walls[0]
      if (dir) grid[row + dir.dr]![col + dir.dc] = FLOOR
    }
  }
}

/** ทุ่งโล่งที่โปรยกำแพงสุ่ม — ใช้ฝึกอัลกอริทึมที่ต้องเลี่ยงสิ่งกีดขวาง */
function scatterObstacles(width: number, height: number, density: number, rng: () => number): Grid {
  const grid = filled(width, height, FLOOR)

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (rng() < density) grid[row]![col] = WALL
    }
  }

  return grid
}

/**
 * ถ้ำ: สุ่มเต็มพื้นที่แล้วเกลี่ยด้วย cellular automata
 * ได้โพรงกว้าง ๆ ที่เชื่อมกันแบบธรรมชาติ
 */
function growCavern(width: number, height: number, density: number, rng: () => number): Grid {
  let grid = filled(width, height, FLOOR)

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const edge = row === 0 || col === 0 || row === height - 1 || col === width - 1
      if (edge || rng() < density) grid[row]![col] = WALL
    }
  }

  for (let pass = 0; pass < 4; pass++) {
    const next = cloneGrid(grid)

    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        let walls = 0

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            if (grid[row + dr]![col + dc] === WALL) walls++
          }
        }

        next[row]![col] = walls > 4 ? WALL : FLOOR
      }
    }

    grid = next
  }

  return grid
}

/** ช่องที่เดินได้ซึ่งอยู่ใกล้ตำแหน่งเป้าหมายที่สุด */
function nearestOpen(grid: Grid, target: Point): Point {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  let best: Point = target
  let bestDistance = Infinity

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (grid[row]![col] === WALL) continue

      const distance = manhattan({ row, col }, target)
      if (distance >= bestDistance) continue

      best = { row, col }
      bestDistance = distance
    }
  }

  return best
}

/**
 * การันตีว่าเดินจากจุดเริ่มถึงเป้าหมายได้เสมอ
 * ถ้ายังไปไม่ถึง จะเจาะกำแพงตามเส้นทางที่ "ทุบกำแพงน้อยที่สุด"
 */
function ensureReachable(grid: Grid, start: Point, goal: Point): void {
  const reachable = search(grid, start, goal, (cell) => (cell === WALL ? null : 1))
  if (reachable) return

  // ยอมให้ทะลุกำแพงด้วยราคาแพง เส้นทางที่ได้จึงเลี่ยงการทุบเท่าที่ทำได้
  const dig = search(grid, start, goal, (cell) => (cell === WALL ? 24 : 1))
  if (!dig) return

  for (const cell of dig.path) {
    if (grid[cell.row]![cell.col] === WALL) grid[cell.row]![cell.col] = FLOOR
  }
}

/** โปรยโคลนลงบนพื้นที่เดินได้ — เดินผ่านได้แต่ต้นทุนแพงกว่าปกติ */
function scatterMud(grid: Grid, ratio: number, rng: () => number, keep: Point[]): void {
  if (ratio <= 0) return

  const height = grid.length
  const width = grid[0]?.length ?? 0

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (grid[row]![col] !== FLOOR) continue
      if (keep.some((point) => point.row === row && point.col === col)) continue
      if (rng() < ratio) grid[row]![col] = MUD
    }
  }
}

export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff)

export const DEFAULT_OPTIONS: MazeOptions = {
  width: 25,
  height: 19,
  kind: 'perfect',
  density: 0.28,
  mud: 0.12,
  seed: 1
}

export function createMaze(options: Partial<MazeOptions> = {}): Maze {
  const config: MazeOptions = { ...DEFAULT_OPTIONS, ...options }
  const width = normalizeSize(config.width)
  const height = normalizeSize(config.height)
  const rng = createRng(config.seed)

  let grid: Grid

  switch (config.kind) {
    case 'braid': {
      grid = carvePerfect(width, height, rng)
      braid(grid, rng, 0.75)
      break
    }
    case 'obstacles': {
      grid = scatterObstacles(width, height, config.density, rng)
      break
    }
    case 'cavern': {
      grid = growCavern(width, height, config.density + 0.18, rng)
      break
    }
    default: {
      grid = carvePerfect(width, height, rng)
      break
    }
  }

  const corner = config.kind === 'perfect' || config.kind === 'braid'
  const start = corner ? { row: 1, col: 1 } : nearestOpen(grid, { row: 0, col: 0 })
  const goal = corner
    ? { row: height - 2, col: width - 2 }
    : nearestOpen(grid, { row: height - 1, col: width - 1 })

  grid[start.row]![start.col] = FLOOR
  grid[goal.row]![goal.col] = FLOOR

  ensureReachable(grid, start, goal)
  scatterMud(grid, config.mud, rng, [start, goal])

  return { width, height, grid, start, goal, kind: config.kind, seed: config.seed }
}

// ---------- ตรวจเส้นทางที่ผู้เล่นส่งกลับมา ----------

export interface PathReport {
  ok: boolean
  message: string
  /** จำนวนก้าวที่เดินจริง */
  steps: number
  /** ต้นทุนรวม (โคลนแพงกว่าพื้นปกติ) */
  cost: number
  /** เส้นทางเต็มตั้งแต่จุดเริ่ม — ถ้าผิดกติกาจะได้เท่าที่เดินถูก */
  cells: Point[]
}

/**
 * ตรวจว่าเส้นทางเดินได้จริงไหม: ต้องเริ่มที่จุดเริ่ม ก้าวทีละช่องในแนวตั้ง/แนวนอน
 * ห้ามทะลุกำแพง และต้องจบที่เป้าหมาย
 */
export function validatePath(maze: Maze, path: Point[]): PathReport {
  const cells: Point[] = [maze.start]
  const limit = maze.width * maze.height * 4
  let cost = 0

  const raw = path.length > 0 && same(path[0]!, maze.start) ? path.slice(1) : path

  if (raw.length > limit) {
    return { ok: false, message: `เส้นทางยาวเกิน ${limit} ก้าว`, steps: 0, cost: 0, cells }
  }

  for (const [index, cell] of raw.entries()) {
    const previous = cells[cells.length - 1]!

    if (!Number.isInteger(cell?.row) || !Number.isInteger(cell?.col)) {
      return {
        ok: false,
        message: `ก้าวที่ ${index + 1} ไม่ใช่ตำแหน่งบนแผนที่: ${JSON.stringify(cell)}`,
        steps: cells.length - 1,
        cost,
        cells
      }
    }

    if (manhattan(previous, cell) !== 1) {
      return {
        ok: false,
        message: `ก้าวที่ ${index + 1} กระโดดข้ามช่อง จาก (${previous.row}, ${previous.col}) ไป (${cell.row}, ${cell.col})`,
        steps: cells.length - 1,
        cost,
        cells
      }
    }

    if (!walkable(maze.grid, cell.row, cell.col)) {
      return {
        ok: false,
        message: `ก้าวที่ ${index + 1} ชนกำแพงที่ (${cell.row}, ${cell.col})`,
        steps: cells.length - 1,
        cost,
        cells
      }
    }

    cells.push({ row: cell.row, col: cell.col })
    cost += stepCost(maze.grid, cell.row, cell.col)
  }

  const last = cells[cells.length - 1]!

  if (!same(last, maze.goal)) {
    return {
      ok: false,
      message: `เดินจบที่ (${last.row}, ${last.col}) แต่ทางออกอยู่ที่ (${maze.goal.row}, ${maze.goal.col})`,
      steps: cells.length - 1,
      cost,
      cells
    }
  }

  return { ok: true, message: 'ถึงทางออกแล้ว', steps: cells.length - 1, cost, cells }
}
