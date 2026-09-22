/**
 * ฝูงมดหาทาง — Ant Colony Optimization (Dorigo, 1992)
 *
 * หนึ่งรอบเดินคือมดหนึ่งตัว มดไม่มีแผนที่ มันเห็นแค่ช่องข้าง ๆ ตัวว่าเดินได้ไหม เป็นโคลนไหม
 * และได้กลิ่นฟีโรโมนที่มดตัวก่อน ๆ ทิ้งไว้บนทางเชื่อมแต่ละทาง มันสุ่มเลือกทาง
 * โดยทางที่กลิ่นแรงกว่า ถูกกว่า และตัวเองยังไม่เคยเหยียบ มีโอกาสถูกเลือกมากกว่า
 *
 * พอถึงทางออก มันตัดวงวนที่เดินวนออกจากทางของตัวเอง แล้วทิ้งกลิ่นตามทางนั้น
 * ทางยิ่งถูก กลิ่นที่ทิ้งยิ่งแรง และกลิ่นเก่าระเหยไปทุกรอบ ทางที่ถูกจึงค่อย ๆ มีกลิ่นแรงที่สุด
 *
 * ไฟล์นี้ไม่รู้จัก worker และรับตัวสุ่มจากข้างนอก เทสต์จะได้ใส่เมล็ดสุ่มตายตัวได้
 */
import { DIRECTIONS, key, neighbors, stepCost, type Direction, type Grid, type Point } from './engine'

/** กลิ่นแรงแค่ไหนถึงมีผลต่อการเลือก — ยกกำลังนี้ */
export const ALPHA = 2

/** ความถูกของช่องถัดไปมีผลแค่ไหน — ยกกำลังนี้ (โคลนแพงกว่าพื้นห้าเท่า) */
export const BETA = 1

/** กลิ่นระเหยไปรอบละเท่านี้ */
export const EVAPORATION = 0.1

/** กลิ่นที่มดหนึ่งตัวทิ้ง = DEPOSIT ÷ ราคาทางของมัน */
export const DEPOSIT = 100

/** ทางที่ถูกที่สุดที่ฝูงเคยเจอได้กลิ่นเพิ่มทุกรอบ เท่ากับมดอีกกี่ตัว (elitist ant system) */
export const ELITE = 1

export interface Colony {
  /** เขาวงกตที่กลิ่นพวกนี้เป็นของ — เปลี่ยนแผนที่แล้วกลิ่นเก่าไม่มีความหมาย */
  maze: string
  /** กลิ่นบนทางเชื่อมระหว่างสองช่อง */
  scent: Record<string, number>
  /** ทางที่ถูกที่สุดที่เคยมีมดเดินถึง */
  best: Point[] | null
  bestCost: number | null
  /** ปล่อยมดไปแล้วกี่ตัว / ถึงทางออกกี่ตัว */
  ants: number
  arrived: number
}

/** ลายเซ็นของเขาวงกต — ขนาดกับแผนที่ทั้งแผ่น */
export const mazeSignature = (grid: Grid): string => `${grid.length}x${grid[0]?.length ?? 0}:${grid.map((line) => line.join('')).join('/')}`

/** ชื่อของทางเชื่อมระหว่างสองช่อง — ไปหรือกลับก็ชื่อเดียวกัน */
export function edgeKey(a: Point, b: Point): string {
  const from = key(a.row, a.col)
  const to = key(b.row, b.col)
  return from < to ? `${from}|${to}` : `${to}|${from}`
}

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' && value !== null && Number.isInteger((value as Point).row) && Number.isInteger((value as Point).col)

/** อ่านฝูงมดจากความจำ — ของเสีย หรือเป็นกลิ่นของเขาวงกตอื่น ถือว่ายังไม่มีฝูง */
export function readColony(raw: unknown, grid: Grid): Colony | null {
  if (typeof raw !== 'object' || raw === null) return null
  const colony = raw as Colony

  if (colony.maze !== mazeSignature(grid)) return null
  if (typeof colony.scent !== 'object' || colony.scent === null) return null
  if (!Object.values(colony.scent).every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  if (colony.best !== null && (!Array.isArray(colony.best) || !colony.best.every(isPoint))) return null
  if (!Number.isInteger(colony.ants) || !Number.isInteger(colony.arrived)) return null

  return colony
}

export const emptyColony = (grid: Grid): Colony => ({
  maze: mazeSignature(grid),
  scent: {},
  best: null,
  bestCost: null,
  ants: 0,
  arrived: 0
})

const directionTo = (from: Point, to: Point): Direction =>
  DIRECTIONS.find((dir) => from.row + dir.dr === to.row && from.col + dir.dc === to.col)!.name

/**
 * มดหนึ่งตัวเลือกทางหนึ่งก้าว
 *
 * น้ำหนักของแต่ละทาง = (1 + กลิ่น)^ALPHA × (1 ÷ ราคาช่องนั้น)^BETA ÷ (1 + จำนวนครั้งที่เคยเหยียบ)²
 * ตัวหารสุดท้ายคือสิ่งที่ทำให้มดตัวแรก ๆ ซึ่งยังไม่มีกลิ่นให้ตาม ไม่เดินวนอยู่ที่เดิมจนหมดก้าว
 */
export function chooseStep(
  colony: Colony | null,
  grid: Grid,
  at: Point,
  visits: Record<string, number>,
  random: () => number
): Direction | null {
  const options = neighbors(grid, at.row, at.col)
  if (options.length === 0) return null

  const weights = options.map((next) => {
    const scent = colony?.scent[edgeKey(at, next)] ?? 0
    const cheap = 1 / stepCost(grid, next.row, next.col)
    const seen = visits[key(next.row, next.col)] ?? 0
    return Math.pow(1 + scent, ALPHA) * Math.pow(cheap, BETA) / Math.pow(1 + seen, 2)
  })

  let left = random() * weights.reduce((sum, value) => sum + value, 0)
  for (let index = 0; index < options.length; index++) {
    left -= weights[index]!
    if (left <= 0) return directionTo(at, options[index]!)
  }
  return directionTo(at, options[options.length - 1]!)
}

/** ตามกลิ่นที่แรงที่สุด ไม่สุ่ม และไม่เดินกลับช่องที่เคยเหยียบ — ใช้ดูว่าฝูงเรียนรู้ทางไหนไว้ */
export function strongestStep(colony: Colony | null, grid: Grid, at: Point, visits: Record<string, number>): Direction | null {
  const fresh = neighbors(grid, at.row, at.col).filter((next) => !visits[key(next.row, next.col)])
  const options = fresh.length > 0 ? fresh : neighbors(grid, at.row, at.col)
  if (options.length === 0) return null

  let best = options[0]!
  for (const next of options) {
    if ((colony?.scent[edgeKey(at, next)] ?? 0) > (colony?.scent[edgeKey(at, best)] ?? 0)) best = next
  }
  return directionTo(at, best)
}

/** ตัดวงวนออกจากทางที่เดินมา — เดินกลับมาช่องเดิมเมื่อไร ทุกอย่างระหว่างนั้นคือวงวนที่ไม่จำเป็น */
export function eraseLoops(path: Point[]): Point[] {
  const out: Point[] = []
  const at = new Map<string, number>()

  for (const point of path) {
    const id = key(point.row, point.col)
    const seen = at.get(id)
    if (seen === undefined) {
      at.set(id, out.length)
      out.push(point)
      continue
    }
    for (const dropped of out.splice(seen + 1)) at.delete(key(dropped.row, dropped.col))
  }

  return out
}

export const pathCost = (grid: Grid, path: Point[]): number =>
  path.slice(1).reduce((sum, point) => sum + stepCost(grid, point.row, point.col), 0)

/**
 * มดหนึ่งตัวจบรอบ — กลิ่นเก่าระเหย แล้วถ้ามันถึงทางออก ก็ทิ้งกลิ่นตามทางที่ตัดวงวนแล้ว
 * ทางที่ถูกที่สุดที่ฝูงเคยเจอได้กลิ่นเพิ่มอีกชุดทุกรอบ ฝูงจะได้ไม่ลืมมันเร็วเกินไป
 */
export function layScent(previous: Colony, grid: Grid, walked: Point[], arrived: boolean): Colony {
  const colony: Colony = { ...previous, scent: { ...previous.scent }, ants: previous.ants + 1 }

  for (const [edge, value] of Object.entries(colony.scent)) {
    const next = value * (1 - EVAPORATION)
    if (next < 0.001) delete colony.scent[edge]
    else colony.scent[edge] = next
  }

  const drop = (path: Point[], amount: number) => {
    for (let index = 1; index < path.length; index++) {
      const edge = edgeKey(path[index - 1]!, path[index]!)
      colony.scent[edge] = (colony.scent[edge] ?? 0) + amount
    }
  }

  if (arrived) {
    const path = eraseLoops(walked)
    const cost = pathCost(grid, path)
    colony.arrived++
    drop(path, DEPOSIT / cost)

    if (colony.bestCost === null || cost < colony.bestCost) {
      colony.best = path
      colony.bestCost = cost
    }
  }

  if (colony.best && colony.bestCost) drop(colony.best, (ELITE * DEPOSIT) / colony.bestCost)

  return colony
}

/**
 * ปล่อยมดทีละตัวจนครบ โดยไม่ผ่าน worker — ใช้วาดภาพในหน้าความรู้ ซึ่งต้องได้ภาพเดิมทุกครั้ง
 * กติกาเดียวกับบล็อกของฝูงมดทุกอย่าง ต่างกันแค่ตัวสุ่มที่ส่งเข้ามาเป็นแบบกำหนดเมล็ด
 */
export function trainColony(
  grid: Grid,
  start: Point,
  goal: Point,
  ants: number,
  random: () => number
): { colony: Colony; walks: Point[][] } {
  const limit = grid.length * (grid[0]?.length ?? 0) * 6
  let colony = emptyColony(grid)
  const walks: Point[][] = []

  for (let ant = 0; ant < ants; ant++) {
    const walked: Point[] = [start]
    const visits: Record<string, number> = { [key(start.row, start.col)]: 1 }
    let at = start

    for (let step = 0; step < limit && !(at.row === goal.row && at.col === goal.col); step++) {
      const direction = chooseStep(colony, grid, at, visits, random)
      if (!direction) break
      const dir = DIRECTIONS.find((item) => item.name === direction)!
      at = { row: at.row + dir.dr, col: at.col + dir.dc }
      walked.push(at)
      visits[key(at.row, at.col)] = (visits[key(at.row, at.col)] ?? 0) + 1
    }

    walks.push(walked)
    colony = layScent(colony, grid, walked, at.row === goal.row && at.col === goal.col)
  }

  return { colony, walks }
}

/** เดินตามกลิ่นแรงที่สุดจากจุดเริ่มจนถึงทางออก (หรือจนครบก้าว) — ทางที่ฝูงเลือก */
export function followScent(colony: Colony, grid: Grid, start: Point, goal: Point): Point[] {
  const limit = grid.length * (grid[0]?.length ?? 0) * 6
  const walked: Point[] = [start]
  const visits: Record<string, number> = { [key(start.row, start.col)]: 1 }
  let at = start

  for (let step = 0; step < limit && !(at.row === goal.row && at.col === goal.col); step++) {
    const direction = strongestStep(colony, grid, at, visits)
    if (!direction) break
    const dir = DIRECTIONS.find((item) => item.name === direction)!
    at = { row: at.row + dir.dr, col: at.col + dir.dc }
    walked.push(at)
    visits[key(at.row, at.col)] = (visits[key(at.row, at.col)] ?? 0) + 1
  }

  return walked
}
