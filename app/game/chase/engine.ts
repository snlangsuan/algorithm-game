/**
 * สนามไล่จับ — กติกาล้วน ๆ ไม่รู้จักหน้าจอและไม่รู้จัก AI
 *
 * เกมนี้กลับด้านกับเกมอื่นในชุด: ผู้เล่นเป็นคนบังคับตัวเอกเอง
 * ส่วนบล็อกที่ต่อไว้เป็นสมองของ "ผู้ไล่ล่า" ทุกตัว เขียนเก่งขึ้นเท่าไรก็หนียากขึ้นเท่านั้น
 *
 * ทุกอย่างเดินเป็นช่อง ๆ ตามจังหวะเวลา (tick): ตัวเอกขยับได้ทุกจังหวะ
 * ส่วนผู้ไล่ล่าเดินช้ากว่าตามค่าความเร็วที่ตั้งไว้ ไม่งั้นหนีไม่รอดเลยสักครั้ง
 */

export const FLOOR = 0 as const
export const WALL = 1 as const

export type Cell = typeof FLOOR | typeof WALL
export type Grid = Cell[][]

export interface Point {
  row: number
  col: number
}

/** เรียงตามเข็มนาฬิกา — เลี้ยวซ้าย/ขวาคือขยับตำแหน่งในลิสต์นี้ */
export const DIRECTIONS = [
  { name: 'up', dr: -1, dc: 0 },
  { name: 'right', dr: 0, dc: 1 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'left', dr: 0, dc: -1 }
] as const

export type Direction = (typeof DIRECTIONS)[number]['name']

export const DIRECTION_LABEL: Record<Direction, string> = {
  up: 'ขึ้น',
  right: 'ขวา',
  down: 'ลง',
  left: 'ซ้าย'
}

export const findDirection = (name: string) => DIRECTIONS.find((dir) => dir.name === name)

export const isDirection = (value: unknown): value is Direction =>
  typeof value === 'string' && DIRECTIONS.some((dir) => dir.name === value)

export const opposite = (dir: Direction): Direction => {
  const index = DIRECTIONS.findIndex((item) => item.name === dir)
  return DIRECTIONS[(index + 2) % DIRECTIONS.length]!.name
}

export const inside = (grid: Grid, row: number, col: number): boolean =>
  row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0)

export const walkable = (grid: Grid, row: number, col: number): boolean =>
  inside(grid, row, col) && grid[row]![col] !== WALL

export const same = (a: Point | null, b: Point | null): boolean =>
  a !== null && b !== null && a.row === b.row && a.col === b.col

export const manhattan = (a: Point, b: Point): number =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

export const cloneGrid = (grid: Grid): Grid => grid.map((line) => [...line])

/** ช่องถัดไปทางนั้น — ยังไม่สนว่าเป็นกำแพงหรือเปล่า */
export function stepInto(at: Point, dir: Direction): Point {
  const found = findDirection(dir)
  if (!found) return { row: at.row, col: at.col }
  return { row: at.row + found.dr, col: at.col + found.dc }
}

export function neighbors(grid: Grid, at: Point): Array<Point & { dir: Direction }> {
  const list: Array<Point & { dir: Direction }> = []

  for (const dir of DIRECTIONS) {
    const row = at.row + dir.dr
    const col = at.col + dir.dc
    if (walkable(grid, row, col)) list.push({ row, col, dir: dir.name })
  }

  return list
}

/**
 * ระยะเดินจริงจากช่องหนึ่งไปทุกช่องในสนาม (ค้นกว้างก่อน)
 * ช่องที่เดินไปไม่ถึงได้ -1 — สนามในเกมเชื่อมถึงกันหมดอยู่แล้ว แต่กันไว้ก่อน
 */
export function distanceField(grid: Grid, from: Point): number[][] {
  const field = grid.map((line) => line.map(() => -1))
  if (!walkable(grid, from.row, from.col)) return field

  field[from.row]![from.col] = 0
  const queue: Point[] = [{ row: from.row, col: from.col }]

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!
    const step = field[at.row]![at.col]! + 1

    for (const next of neighbors(grid, at)) {
      if (field[next.row]![next.col] !== -1) continue
      field[next.row]![next.col] = step
      queue.push({ row: next.row, col: next.col })
    }
  }

  return field
}

/** จำนวนก้าวที่สั้นที่สุดระหว่างสองช่อง — -1 ถ้าไปไม่ถึง */
export function pathLength(grid: Grid, from: Point, to: Point): number {
  if (!walkable(grid, to.row, to.col)) return -1
  return distanceField(grid, to)[from.row]?.[from.col] ?? -1
}

/**
 * ทางที่สั้นที่สุดจาก from ไป to — คืนทุกช่องรวมช่องเริ่มต้น
 *
 * วัดระยะจากปลายทางออกมาครั้งเดียว แล้วไต่ลงทีละขั้น
 * ได้ทั้งเส้นทางและก้าวถัดไปจากการค้นรอบเดียว
 */
export function pathTo(grid: Grid, from: Point, to: Point): Point[] {
  if (!walkable(grid, from.row, from.col) || !walkable(grid, to.row, to.col)) return []

  const field = distanceField(grid, to)
  let step = field[from.row]?.[from.col] ?? -1
  if (step < 0) return []

  const path: Point[] = [{ row: from.row, col: from.col }]
  let at = from

  while (step > 0) {
    const next = neighbors(grid, at).find((cell) => field[cell.row]![cell.col] === step - 1)
    if (!next) break

    at = { row: next.row, col: next.col }
    path.push(at)
    step--
  }

  return path
}

/** ก้าวแรกของทางที่สั้นที่สุด — null ถ้าอยู่ที่หมายแล้วหรือไปไม่ถึง */
export function stepAlong(grid: Grid, from: Point, to: Point): Direction | null {
  if (same(from, to)) return null

  const field = distanceField(grid, to)
  const step = field[from.row]?.[from.col] ?? -1
  if (step < 1) return null

  const next = neighbors(grid, from).find((cell) => field[cell.row]![cell.col] === step - 1)
  return next?.dir ?? null
}

/** มองเห็นกันไหม — ต้องอยู่แถวหรือหลักเดียวกัน และไม่มีกำแพงคั่น */
export function lineOfSight(grid: Grid, a: Point, b: Point): boolean {
  if (a.row !== b.row && a.col !== b.col) return false

  const steps = manhattan(a, b)
  if (steps === 0) return true

  const dr = Math.sign(b.row - a.row)
  const dc = Math.sign(b.col - a.col)

  for (let step = 1; step <= steps; step++) {
    if (!walkable(grid, a.row + dr * step, a.col + dc * step)) return false
  }

  return true
}

/** ช่องที่อยู่ข้างหน้า at ไปทางนั้น count ช่อง — ชนกำแพงเมื่อไรก็หยุดที่ช่องสุดท้ายที่เดินได้ */
export function aheadOf(grid: Grid, at: Point, dir: Direction, count: number): Point {
  let cursor = { row: at.row, col: at.col }

  for (let step = 0; step < count; step++) {
    const next = stepInto(cursor, dir)
    if (!walkable(grid, next.row, next.col)) break
    cursor = next
  }

  return cursor
}

// ---------- สนาม ----------

export const MIN_HUNTERS = 1
export const MAX_HUNTERS = 4

/**
 * ความเร็วผู้ไล่ล่า เทียบกับตัวเอกที่เดินได้ 1 ช่องต่อจังหวะเสมอ
 * ต่ำกว่า 1 คือช้ากว่า — ถ้าเร็วเท่ากันและ AI เดินทางที่สั้นที่สุด จะหนีแทบไม่รอดเลย
 */
export const SPEED_LABEL: Array<{ value: number; label: string; note: string }> = [
  { value: 0.5, label: 'ช้า', note: 'เดินครึ่งความเร็วเรา — มีเวลาคิดเยอะ' },
  { value: 0.65, label: 'ปกติ', note: 'ช้ากว่าเราพอให้หนีทัน ถ้าไม่เดินเข้ามุม' },
  { value: 0.8, label: 'เร็ว', note: 'ตามติดจนต้องใช้ทางลัดและทางวน' }
]

export interface Arena {
  id: string
  name: string
  /** อธิบายว่าสนามนี้ทำให้การไล่กับการหนีต่างไปยังไง */
  note: string
  width: number
  height: number
  grid: Grid
  /** จุดเริ่มของตัวเอก */
  hero: Point
  /** จุดเกิดของผู้ไล่ล่า เรียงตามหมายเลขตัว */
  homes: Point[]
  gems: Point[]
  /** ประตูหนี — เปิดให้ออกเมื่อเก็บของครบแล้วเท่านั้น */
  exit: Point
}

/**
 * แปลงแผนที่ตัวอักษรเป็นสนาม — อ่านง่ายกว่าเขียนเป็นตัวเลขเรียงกัน
 * '#' กำแพง · '.' พื้น · '*' ของ · 'H' ตัวเอก · '1'–'4' จุดเกิดผู้ไล่ล่า · 'E' ประตูหนี
 */
export function parseArena(
  input: { id: string; name: string; note: string; rows: string[] }
): Arena {
  const grid: Grid = []
  const homes: Array<Point & { order: number }> = []
  const gems: Point[] = []

  let hero: Point | null = null
  let exit: Point | null = null

  for (const [row, line] of input.rows.entries()) {
    const cells: Cell[] = []

    for (const [col, mark] of [...line].entries()) {
      cells.push(mark === '#' ? WALL : FLOOR)

      if (mark === 'H') hero = { row, col }
      else if (mark === 'E') exit = { row, col }
      else if (mark === '*') gems.push({ row, col })
      else if (mark >= '1' && mark <= '9') homes.push({ row, col, order: Number(mark) })
    }

    grid.push(cells)
  }

  if (!hero) throw new Error(`สนาม '${input.id}' ไม่มีจุดเริ่มของตัวเอก (H)`)
  if (!exit) throw new Error(`สนาม '${input.id}' ไม่มีประตูหนี (E)`)

  return {
    id: input.id,
    name: input.name,
    note: input.note,
    width: grid[0]?.length ?? 0,
    height: grid.length,
    grid,
    hero,
    exit,
    gems,
    homes: homes.sort((a, b) => a.order - b.order).map(({ row, col }) => ({ row, col }))
  }
}

export const ARENAS: Arena[] = [
  parseArena({
    id: 'lattice',
    name: 'ลานสี่แยก',
    note: 'ทางวนเยอะ เลี้ยวหนีได้ทุกสี่แยก — ผู้ไล่ล่าตัวเดียวแทบไม่มีวันต้อนเราติด',
    rows: [
      '###############',
      '#H....*.*....*#',
      '#.##.##.##.##.#',
      '#....*...*....#',
      '#.##.##.##.##.#',
      '#..1.......2..#',
      '#.##.##.##.##.#',
      '#..3.....4....#',
      '#.##.##.##.##.#',
      '#*...........E#',
      '###############'
    ]
  }),
  parseArena({
    id: 'rooms',
    name: 'สี่ห้องกลางลาน',
    note: 'ห้องเล็กเป็นทางตัน เข้าไปเก็บของแล้วต้องออกทางเดิม — จังหวะที่ถูกดักได้ง่ายที่สุด',
    rows: [
      '###############',
      '#H...........*#',
      '#.###.###.###.#',
      '#...*.#1#.*...#',
      '#.#.#.#.#.#.#.#',
      '#.#3.......4#.#',
      '#.#.#.#.#.#.#.#',
      '#...*.#2#.*...#',
      '#.###.###.###.#',
      '#*...........E#',
      '###############'
    ]
  }),
  parseArena({
    id: 'wide',
    name: 'สนามใหญ่',
    note: 'กว้างกว่าจนวิ่งหนีได้นาน แต่ของกระจายไกล ต้องวางแผนลำดับการเก็บ',
    rows: [
      '###################',
      '#H....*.....*.....#',
      '#.##.##.##.##.##.##',
      '#.....*..1..*.....#',
      '#.##.##.##.##.##.##',
      '#..*....2.3....*..#',
      '#.##.##.##.##.##.##',
      '#.....*..4..*.....#',
      '#.##.##.##.##.##.##',
      '#*...............E#',
      '###################'
    ]
  })
]

export const findArena = (id: string): Arena => ARENAS.find((item) => item.id === id) ?? ARENAS[0]!

// ---------- การแข่งหนึ่งรอบ ----------

export type Outcome = 'escaped' | 'caught' | 'timeout'

export interface Hunter {
  /** หมายเลขตัว เริ่มที่ 0 — บล็อก "ฉันเป็นตัวที่" แสดงเป็น 1 */
  index: number
  at: Point
  facing: Direction
  home: Point
  /** เศษก้าวที่สะสมไว้ ครบ 1 เมื่อไรถึงได้เดิน */
  credit: number
}

export interface MatchOptions {
  hunters: number
  /** ช่องต่อจังหวะ เทียบกับตัวเอกที่ได้ 1 เสมอ */
  hunterSpeed: number

  /**
   * เลขสุ่มประจำรอบ — เปลี่ยนว่าผู้ไล่ล่าเกิดมุมไหน และใครได้ออกตัวก่อนกี่เศษก้าว
   *
   * ไม่ส่งมาก็ได้สนามแบบเดิมเป๊ะทุกครั้ง (หน้าความรู้กับเทสต์ต้องการแบบนั้น)
   * ส่วนหน้าเกมสุ่มใหม่ทุกรอบ ไม่งั้นเดินซ้ำรอยเดิมแล้วไปตายที่เดิมทุกที
   */
  seed?: number
}

export interface Match {
  arena: Arena
  hero: Point
  facing: Direction
  /** ทิศที่ผู้เล่นกดค้างไว้ รอจังหวะที่เลี้ยวได้จริง */
  queued: Direction | null
  hunters: Hunter[]
  /** ของที่ยังไม่ถูกเก็บ */
  gems: Point[]
  taken: number
  tick: number
  over: Outcome | null
  /** ผู้ไล่ล่าตัวที่จับได้ (นับจาก 0) — null ถ้ายังไม่โดนจับ */
  caughtBy: number | null
  /** ช่องที่เกิดการจับ ใช้วาดวงแหวนตรงจุดนั้น */
  caughtAt: Point | null
  /** ระยะที่ผู้ไล่ล่าเข้ามาใกล้ที่สุดตลอดรอบ ใช้เล่าความมันตอนจบ */
  closest: number
}

export const DEFAULT_OPTIONS: MatchOptions = { hunters: 2, hunterSpeed: 0.65 }

export const TICK_LIMIT = 900

export const normalizeHunters = (value: number): number =>
  Math.min(MAX_HUNTERS, Math.max(MIN_HUNTERS, Math.round(value)))

/** ตัวสุ่มเล็ก ๆ ที่ให้ลำดับเดิมเสมอเมื่อเมล็ดเดิม — รอบเดียวกันจึงเล่นซ้ำได้ถ้าอยาก */
function createRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** สลับลำดับจุดเกิด แล้วหยิบมาเท่าจำนวนผู้ไล่ล่า — รอบนี้เกิดมุมไหนก็ไม่เหมือนรอบก่อน */
function pickHomes(homes: Point[], count: number, rng: () => number): Point[] {
  const pool = [...homes]

  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1))
    ;[pool[index], pool[swap]] = [pool[swap]!, pool[index]!]
  }

  return pool.slice(0, count)
}

export function createMatch(arena: Arena, options: MatchOptions = DEFAULT_OPTIONS): Match {
  const count = Math.min(normalizeHunters(options.hunters), arena.homes.length)

  const rng = options.seed === undefined ? null : createRng(options.seed)
  const homes = rng ? pickHomes(arena.homes, count, rng) : arena.homes.slice(0, count)

  return {
    arena,
    hero: { ...arena.hero },
    facing: 'right',
    queued: null,
    hunters: homes.map((home, index) => ({
      index,
      at: { ...home },
      facing: 'up',
      home: { ...home },

      // ออกตัวไม่พร้อมกัน ไม่งั้นทุกตัวก้าวเป็นจังหวะเดียวกันทั้งรอบ ทางหนีก็เลยซ้ำเดิม
      credit: rng ? Math.round(rng() * 90) / 100 : 0
    })),
    gems: arena.gems.map((gem) => ({ ...gem })),
    taken: 0,
    tick: 0,
    over: null,
    caughtBy: null,
    caughtAt: null,
    closest: Number.POSITIVE_INFINITY
  }
}

export const exitOpen = (match: Match): boolean => match.gems.length === 0

/** ผู้เล่นกดปุ่ม — เลี้ยวทันทีถ้าเลี้ยวได้ ไม่งั้นจำไว้ใช้ตอนถึงทางแยก */
export function aim(match: Match, dir: Direction): void {
  match.queued = dir

  const next = stepInto(match.hero, dir)
  if (walkable(match.arena.grid, next.row, next.col)) match.facing = dir
}

/** เหยียบอะไรอยู่ก็จัดการตรงนี้ — เก็บของ และออกประตูได้เมื่อของหมดแล้ว */
function landHero(match: Match): void {
  const gem = match.gems.findIndex((item) => same(item, match.hero))
  if (gem >= 0) {
    match.gems.splice(gem, 1)
    match.taken++
  }

  if (exitOpen(match) && same(match.hero, match.arena.exit)) match.over = 'escaped'
}

/**
 * โหมดคนเล่น — ตัวเอกเดินต่อไปเรื่อย ๆ ตามทิศที่หันอยู่ ชนกำแพงก็ยืนรอ
 * ปุ่มที่กดค้างไว้จะถูกใช้ทันทีที่เลี้ยวได้จริง เหมือนเกมเดินช่องทั่วไป
 */
export function advanceHero(match: Match): void {
  const grid = match.arena.grid

  if (match.queued) {
    const turn = stepInto(match.hero, match.queued)
    if (walkable(grid, turn.row, turn.col)) {
      match.facing = match.queued
      match.queued = null
    }
  }

  const next = stepInto(match.hero, match.facing)
  if (walkable(grid, next.row, next.col)) match.hero = next

  landHero(match)
}

/**
 * โหมด AI — เดินตามทิศที่โปรแกรมสั่งทีละหนึ่งก้าว ไม่เดินต่อเอง
 * คืน false ถ้าสั่งไปชนกำแพง (ยืนอยู่กับที่แทน) เพื่อให้เกมฟ้องได้ว่าโปรแกรมสั่งผิด
 */
export function stepHero(match: Match, dir: Direction | null): boolean {
  if (!dir) {
    landHero(match)
    return true
  }

  const next = stepInto(match.hero, dir)
  const ok = walkable(match.arena.grid, next.row, next.col)

  if (ok) {
    match.facing = dir
    match.hero = next
  }

  landHero(match)
  return ok
}

/** ผู้ไล่ล่าตัวไหนได้เดินในจังหวะนี้ — สะสมเศษก้าวไว้จนครบหนึ่งช่อง */
export function dueHunters(match: Match, speed: number): Hunter[] {
  const due: Hunter[] = []

  for (const hunter of match.hunters) {
    hunter.credit += speed
    if (hunter.credit < 1) continue

    hunter.credit -= 1
    due.push(hunter)
  }

  return due
}

/** ช่องนั้นมีผู้ไล่ล่าตัวอื่นยืนอยู่ไหม — ตัวเองไม่นับ */
export const crowded = (match: Match, at: Point, except: number): boolean =>
  match.hunters.some((other) => other.index !== except && same(other.at, at))

/**
 * ขยับผู้ไล่ล่าหนึ่งตัว — คืนว่าคำสั่งนั้นเดินได้จริงไหม
 *
 * ผู้ไล่ล่ายืนทับกันไม่ได้ ไม่งั้นพอทุกตัวเล็งเป้าเดียวกัน มันจะเดินมาซ้อนกันจนเหลือดูเหมือนตัวเดียว
 * กติกานี้บังคับให้ "หลายตัว" แปลว่าหลายตัวจริง ๆ แล้วโปรแกรมที่ไม่แบ่งหน้าที่จะเห็นผลทันทีว่าติดกันเอง
 */
export function moveHunter(match: Match, hunter: Hunter, dir: Direction | null): boolean {
  if (!dir) return true

  const next = stepInto(hunter.at, dir)
  if (!walkable(match.arena.grid, next.row, next.col)) return false
  if (crowded(match, next, hunter.index)) return false

  hunter.facing = dir
  hunter.at = next
  return true
}

/**
 * ตัวไหนจับได้ — คืนหมายเลขผู้ไล่ล่า หรือ null ถ้ายังไม่โดน
 *
 * นับสองแบบ: เหยียบช่องเดียวกัน และเดินสวนกันคนละทาง
 * ถ้าไม่เช็กการเดินสวน ตัวเอกกับผู้ไล่ล่าจะแลกที่กันเฉย ๆ เหมือนทะลุผ่านกันไป
 * ผลที่ได้ถูกจดไว้ใน match ด้วย หน้าจอจะได้บอกได้ว่าใครเป็นคนจับ และจับตรงไหน
 */
export function catcher(match: Match, heroBefore: Point, hunterBefore: Point[]): number | null {
  for (const [index, hunter] of match.hunters.entries()) {
    const was = hunterBefore[index]
    const overlapped = same(hunter.at, match.hero)
    const swapped = Boolean(was && same(was, match.hero) && same(hunter.at, heroBefore))

    if (!overlapped && !swapped) continue

    match.caughtBy = index
    match.caughtAt = { ...match.hero }
    match.closest = 0
    return index
  }

  return null
}

/** ระยะเดินจริงจากผู้ไล่ล่าที่ใกล้ที่สุดถึงตัวเอก */
export function closestHunter(match: Match): number {
  const field = distanceField(match.arena.grid, match.hero)

  let best = Number.POSITIVE_INFINITY
  for (const hunter of match.hunters) {
    const steps = field[hunter.at.row]?.[hunter.at.col] ?? -1
    if (steps >= 0) best = Math.min(best, steps)
  }

  return best
}
