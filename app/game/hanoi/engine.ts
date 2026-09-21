export const PEG_COUNT = 3

export const MIN_DISKS = 3
export const MAX_DISKS = 10

export const PEG_LABEL = ['ก', 'ข', 'ค'] as const

export type Tower = number[]
export type Towers = Tower[]

export interface Move {
  from: number
  to: number
}

export interface HanoiOptions {
  disks: number

  source: number

  target: number
}

export interface Hanoi {
  disks: number
  source: number
  target: number

  spare: number
  towers: Towers
}

export const DEFAULT_OPTIONS: HanoiOptions = { disks: 4, source: 0, target: 2 }

export const spareOf = (from: number, to: number): number => 3 - from - to

export const cloneTowers = (towers: Towers): Towers => towers.map((tower) => [...tower])

export const topOf = (towers: Towers, peg: number): number =>
  towers[peg]?.[towers[peg]!.length - 1] ?? 0

export const heightOf = (towers: Towers, peg: number): number => towers[peg]?.length ?? 0

export const insidePeg = (peg: number): boolean => Number.isInteger(peg) && peg >= 0 && peg < PEG_COUNT

export function smallestPeg(towers: Towers): number {
  for (let peg = 0; peg < PEG_COUNT; peg++) {
    if (topOf(towers, peg) === 1) return peg
  }
  return -1
}

export function canMove(towers: Towers, from: number, to: number): boolean {
  if (!insidePeg(from) || !insidePeg(to) || from === to) return false

  const lifted = topOf(towers, from)
  if (lifted === 0) return false

  const landing = topOf(towers, to)
  return landing === 0 || lifted < landing
}

export function applyMove(towers: Towers, move: Move): Towers {
  const next = cloneTowers(towers)
  const disk = next[move.from]!.pop()
  if (disk !== undefined) next[move.to]!.push(disk)
  return next
}

export const sameMove = (a: Move | null, b: Move | null): boolean =>
  a !== null && b !== null && a.from === b.from && a.to === b.to

export function legalMoves(towers: Towers): Move[] {
  const list: Move[] = []

  for (let from = 0; from < PEG_COUNT; from++) {
    for (let to = 0; to < PEG_COUNT; to++) {
      if (canMove(towers, from, to)) list.push({ from, to })
    }
  }

  return list
}

export const isSolved = (towers: Towers, puzzle: Hanoi): boolean =>
  heightOf(towers, puzzle.target) === puzzle.disks

export const normalizeDisks = (value: number): number =>
  Math.min(MAX_DISKS, Math.max(MIN_DISKS, Math.round(value)))

export function createTowers(disks: number, source: number): Towers {
  const towers: Towers = [[], [], []]
  for (let size = disks; size >= 1; size--) towers[source]!.push(size)
  return towers
}

export function createHanoi(options: Partial<HanoiOptions> = {}): Hanoi {
  const config: HanoiOptions = { ...DEFAULT_OPTIONS, ...options }
  const disks = normalizeDisks(config.disks)
  const source = insidePeg(config.source) ? config.source : 0
  const target = insidePeg(config.target) && config.target !== source ? config.target : (source + 2) % 3

  return {
    disks,
    source,
    target,
    spare: spareOf(source, target),
    towers: createTowers(disks, source)
  }
}

export const optimalMoves = (disks: number): number => 2 ** disks - 1

export function solveMoves(puzzle: Hanoi): Move[] {
  const moves: Move[] = []

  const walk = (count: number, from: number, to: number, via: number): void => {
    if (count <= 0) return
    walk(count - 1, from, via, to)
    moves.push({ from, to })
    walk(count - 1, via, to, from)
  }

  walk(puzzle.disks, puzzle.source, puzzle.target, puzzle.spare)
  return moves
}

export interface MoveReport {
  ok: boolean
  message: string

  count: number

  moves: Move[]

  states: Towers[]
}

export const pegName = (peg: number): string => PEG_LABEL[peg] ?? `#${peg}`

export function validateMoves(puzzle: Hanoi, moves: Move[], limit: number): MoveReport {
  const states: Towers[] = [cloneTowers(puzzle.towers)]
  const done: Move[] = []

  let towers = puzzle.towers

  if (moves.length > limit) {
    return {
      ok: false,
      message: `ย้ายเกิน ${limit.toLocaleString()} ตา — ลำดับนี้ยาวเกินกว่าจะเป็นคำตอบที่ถูก`,
      count: 0,
      moves: done,
      states
    }
  }

  for (const [index, move] of moves.entries()) {
    if (!move || !insidePeg(move.from) || !insidePeg(move.to)) {
      return {
        ok: false,
        message: `ตาที่ ${index + 1} ไม่ใช่หมุดที่มีอยู่: ${JSON.stringify(move)}`,
        count: done.length,
        moves: done,
        states
      }
    }

    if (!canMove(towers, move.from, move.to)) {
      return {
        ok: false,
        message: describeIllegal(towers, move, index + 1),
        count: done.length,
        moves: done,
        states
      }
    }

    towers = applyMove(towers, move)
    done.push({ from: move.from, to: move.to })
    states.push(cloneTowers(towers))
  }

  if (!isSolved(towers, puzzle)) {
    return {
      ok: false,
      message: `ย้ายไป ${done.length} ตาแล้วยังไม่ครบ — หมุด ${pegName(puzzle.target)} มีจาน ${heightOf(towers, puzzle.target)} ใบ จาก ${puzzle.disks} ใบ`,
      count: done.length,
      moves: done,
      states
    }
  }

  return { ok: true, message: 'ย้ายครบทุกใบแล้ว', count: done.length, moves: done, states }
}

export function describeIllegal(towers: Towers, move: Move, ordinal: number): string {
  const from = pegName(move.from)
  const to = pegName(move.to)

  if (move.from === move.to) return `ตาที่ ${ordinal} ย้ายจากหมุด ${from} กลับไปหมุดเดิม`

  const lifted = topOf(towers, move.from)
  if (lifted === 0) return `ตาที่ ${ordinal} หยิบจากหมุด ${from} ที่ไม่มีจานเหลือแล้ว`

  const landing = topOf(towers, move.to)
  return `ตาที่ ${ordinal} เอาจานใบที่ ${lifted} วางทับจานใบที่ ${landing} บนหมุด ${to} — จานใหญ่ห้ามทับจานเล็ก`
}
