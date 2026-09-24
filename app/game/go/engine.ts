/**
 * กติกาหมากล้อม (โกะ) — ตัวจริงที่หน้าเกมกับเทสต์ใช้ร่วมกัน
 *
 * กติกาที่ใช้ (แบบจีน / นับพื้นที่):
 * - ลงหมากในช่องว่าง แล้วจับหมู่ของคู่ต่อสู้ที่ "ลมหายใจ" หมดออกจากกระดาน
 * - ห้ามฆ่าตัวตาย: ลงแล้วหมู่ตัวเองลมหายใจหมด (และไม่ได้จับใครเลย) ถือว่าลงไม่ได้
 * - โค (ko): ห้ามลงตาที่ทำให้กระดานกลับไปเหมือนตาที่แล้วเป๊ะ ๆ จึงไม่วนจับกันไม่จบ
 * - ผ่านตาได้ตลอด สองฝ่ายผ่านติดกันถือว่าจบเกม
 * - คะแนน = จำนวนหมากของตัวเองบนกระดาน + ช่องว่างที่ถูกล้อมด้วยสีตัวเองล้วน แล้วขาวบวกโคมิ
 *
 * กระดานเก็บเป็นอาร์เรย์แบนความยาว size × size เพื่อให้คัดลอกเร็ว ๆ ได้ทั้งกระดาน
 */

export const EMPTY = 0 as const
export const BLACK = 1 as const
export const WHITE = 2 as const

export type Player = typeof BLACK | typeof WHITE
export type Cell = typeof EMPTY | Player
export type Board = Uint8Array

/** ขนาดกระดานที่เลือกได้ — 9 สำหรับเริ่มหัด 19 คือขนาดมาตรฐานของการแข่งจริง */
export const BOARD_SIZES = [9, 13, 19] as const
export type BoardSize = (typeof BOARD_SIZES)[number]

/**
 * โคมิ — แต้มชดเชยให้ฝ่ายขาวที่เสียเปรียบเพราะลงทีหลัง
 * ใช้ครึ่งแต้มเพื่อกันเสมอ (กระดานเล็กชดเชยน้อยกว่า เพราะได้เปรียบตาแรกน้อยกว่า)
 */
export const DEFAULT_KOMI: Record<BoardSize, number> = { 9: 5.5, 13: 6.5, 19: 6.5 }

/** ลงที่ช่องไหน หรือ pass = ผ่านตา */
export type Move = { row: number; col: number } | 'pass'

export interface Position {
  size: BoardSize
  board: Board
  /** ถึงตาของใคร */
  toPlay: Player
  /**
   * ช่องที่ห้ามลงในตานี้เพราะกติกาโค — เก็บเป็นตำแหน่งแบน (row * size + col)
   * เกิดเมื่อเพิ่งจับหมากไปหนึ่งเม็ดด้วยหมากที่ตัวเองก็เหลือลมหายใจเดียว
   */
  ko: number | null
  /** จับหมากของอีกฝ่ายไปแล้วกี่เม็ด */
  captures: Record<Player, number>
  /** ผ่านตาติดกันมากี่ครั้ง — ครบสองครั้งคือจบเกม */
  passes: number
  /** ลงไปแล้วกี่ตา (นับ pass ด้วย) */
  turn: number
  komi: number
}

export const opponent = (player: Player): Player => (player === BLACK ? WHITE : BLACK)

export const at = (position: Position, row: number, col: number): Cell =>
  (position.board[row * position.size + col] ?? EMPTY) as Cell

export const inside = (size: number, row: number, col: number): boolean =>
  row >= 0 && row < size && col >= 0 && col < size

export function createPosition(size: BoardSize, komi = DEFAULT_KOMI[size]): Position {
  return {
    size,
    board: new Uint8Array(size * size),
    toPlay: BLACK,
    ko: null,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    passes: 0,
    turn: 1,
    komi
  }
}

export const clonePosition = (position: Position): Position => ({
  ...position,
  board: Uint8Array.from(position.board),
  captures: { ...position.captures }
})

/** ช่องที่ติดกันทั้งสี่ทิศ (บน ล่าง ซ้าย ขวา) — โกะไม่นับแนวทแยง */
export function neighbors(size: number, index: number): number[] {
  const row = Math.floor(index / size)
  const col = index % size
  const out: number[] = []
  if (row > 0) out.push(index - size)
  if (row < size - 1) out.push(index + size)
  if (col > 0) out.push(index - 1)
  if (col < size - 1) out.push(index + 1)
  return out
}

export interface Group {
  /** หมากทุกเม็ดในหมู่ที่ติดกันเป็นผืนเดียว */
  stones: number[]
  /** ช่องว่างที่ติดกับหมู่นี้ — หมดเมื่อไรคือถูกจับ */
  liberties: number[]
  color: Player
}

/** หมู่ที่ช่อง index สังกัดอยู่ พร้อมลมหายใจทั้งหมด — ช่องว่างคืน null */
export function groupAt(board: Board, size: number, index: number): Group | null {
  const color = board[index]
  if (color !== BLACK && color !== WHITE) return null

  const stones: number[] = [index]
  const liberties: number[] = []
  const seen = new Uint8Array(board.length)
  const freed = new Uint8Array(board.length)
  seen[index] = 1

  for (let head = 0; head < stones.length; head++) {
    for (const next of neighbors(size, stones[head]!)) {
      const cell = board[next]
      if (cell === EMPTY) {
        if (!freed[next]) {
          freed[next] = 1
          liberties.push(next)
        }
      } else if (cell === color && !seen[next]) {
        seen[next] = 1
        stones.push(next)
      }
    }
  }

  return { stones, liberties, color: color as Player }
}

/** จำนวนลมหายใจของหมู่ที่ช่องนี้ — ช่องว่างได้ 0 */
export const libertiesAt = (board: Board, size: number, index: number): number =>
  groupAt(board, size, index)?.liberties.length ?? 0

export interface PlayResult {
  position: Position
  /** จับหมากของอีกฝ่ายไปกี่เม็ดในตานี้ */
  captured: number[]
}

/** ผลของการลองลงหมาก — ลงไม่ได้จะบอกเหตุผลไว้ */
export type Legality = 'ok' | 'occupied' | 'suicide' | 'ko' | 'outside' | 'finished'

export function legality(position: Position, move: Move, player: Player = position.toPlay): Legality {
  if (position.passes >= 2) return 'finished'
  if (move === 'pass') return 'ok'
  if (!inside(position.size, move.row, move.col)) return 'outside'

  const size = position.size
  const index = move.row * size + move.col
  if (position.board[index] !== EMPTY) return 'occupied'
  if (position.ko === index) return 'ko'

  // ลองวางจริงบนสำเนา แล้วดูว่าเหลือลมหายใจไหม
  const board = Uint8Array.from(position.board)
  board[index] = player
  const foe = opponent(player)

  let taken = 0
  for (const next of neighbors(size, index)) {
    if (board[next] !== foe) continue
    const group = groupAt(board, size, next)
    if (group && group.liberties.length === 0) {
      taken += group.stones.length
      for (const stone of group.stones) board[stone] = EMPTY
    }
  }

  if (taken === 0 && libertiesAt(board, size, index) === 0) return 'suicide'
  return 'ok'
}

export const isLegal = (position: Position, move: Move, player: Player = position.toPlay): boolean =>
  legality(position, move, player) === 'ok'

/**
 * ลงหมากหนึ่งตา คืนกระดานใหม่ (ของเดิมไม่ถูกแก้)
 * ลงไม่ได้จะโยน error — เรียก isLegal ก่อนเสมอ
 */
export function play(position: Position, move: Move, player: Player = position.toPlay): PlayResult {
  const why = legality(position, move, player)
  if (why !== 'ok') throw new Error(`ลงตานี้ไม่ได้: ${why}`)

  const next = clonePosition(position)
  next.toPlay = opponent(player)
  next.turn = position.turn + 1

  if (move === 'pass') {
    next.passes = position.passes + 1
    next.ko = null
    return { position: next, captured: [] }
  }

  next.passes = 0
  const size = position.size
  const index = move.row * size + move.col
  next.board[index] = player

  const foe = opponent(player)
  const captured: number[] = []
  for (const side of neighbors(size, index)) {
    if (next.board[side] !== foe) continue
    const group = groupAt(next.board, size, side)
    if (group && group.liberties.length === 0) {
      for (const stone of group.stones) {
        next.board[stone] = EMPTY
        captured.push(stone)
      }
    }
  }

  next.captures[player] = position.captures[player] + captured.length
  // โคเกิดเฉพาะตอนจับได้เม็ดเดียว ด้วยหมากเม็ดเดียวที่เหลือลมหายใจเดียว — ตาหน้าห้ามกินคืนทันที
  const mine = groupAt(next.board, size, index)
  next.ko =
    captured.length === 1 && mine?.stones.length === 1 && mine.liberties.length === 1
      ? captured[0]!
      : null

  return { position: next, captured }
}

/** ทุกช่องที่ลงได้ในตานี้ (ไม่รวม pass) */
export function legalMoves(position: Position, player: Player = position.toPlay): number[] {
  const out: number[] = []
  for (let index = 0; index < position.board.length; index++) {
    if (position.board[index] !== EMPTY) continue
    const move = { row: Math.floor(index / position.size), col: index % position.size }
    if (isLegal(position, move, player)) out.push(index)
  }
  return out
}

/**
 * ช่องนี้เป็น "ตา" ของสีนั้นไหม — ช่องว่างที่ล้อมด้วยสีตัวเองครบทุกด้าน
 * และมุมทแยงส่วนใหญ่ก็เป็นของตัวเอง (ตาจริง ๆ ที่ไม่ควรลงทับเอง)
 */
export function isEye(board: Board, size: number, index: number, color: Player): boolean {
  if (board[index] !== EMPTY) return false

  for (const side of neighbors(size, index)) {
    if (board[side] !== color) return false
  }

  const row = Math.floor(index / size)
  const col = index % size
  let foes = 0
  let corners = 0

  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ] as Array<[number, number]>) {
    const r = row + dr
    const c = col + dc
    if (!inside(size, r, c)) continue
    corners++
    if (board[r * size + c] === opponent(color)) foes++
  }

  // ตรงขอบกระดานพลาดไม่ได้เลยแม้มุมเดียว กลางกระดานยอมให้คู่ต่อสู้ยืนได้หนึ่งมุม
  return corners < 4 ? foes === 0 : foes <= 1
}

export interface Score {
  /** หมากบนกระดาน + พื้นที่ที่ล้อมได้ ของแต่ละฝ่าย */
  area: Record<Player, number>
  /** พื้นที่ว่างที่ล้อมได้อย่างเดียว */
  territory: Record<Player, number>
  stones: Record<Player, number>
  /** ช่องว่างที่ไม่ได้เป็นของใคร (ติดทั้งสองสี) */
  neutral: number
  komi: number
  /** แต้มของดำลบแต้มของขาว (รวมโคมิแล้ว) — บวกคือดำชนะ */
  lead: number
  winner: Player | null
}

/**
 * ไล่ดูช่องว่างทีละผืน แล้วบอกว่าผืนไหนเป็นของใคร
 *
 * ผืนที่ติดสีเดียวล้วนเป็นพื้นที่ของสีนั้น ผืนที่ติดทั้งสองสี (หรือไม่ติดใครเลย) ไม่เป็นของใคร
 * ทั้งการนับแต้มและการระบายสีพื้นที่บนกระดานใช้ฟังก์ชันนี้ตัวเดียวกัน จะได้ไม่มีทางบอกคนละอย่าง
 */
function regions(position: Position): { owner: Int8Array; counts: Record<Player, number>; neutral: number } {
  const { board, size } = position
  const owner = new Int8Array(board.length)
  const counts: Record<Player, number> = { [BLACK]: 0, [WHITE]: 0 }
  let neutral = 0

  const seen = new Uint8Array(board.length)
  for (let start = 0; start < board.length; start++) {
    if (board[start] !== EMPTY || seen[start]) continue

    const region = [start]
    seen[start] = 1
    let touchesBlack = false
    let touchesWhite = false

    for (let head = 0; head < region.length; head++) {
      for (const side of neighbors(size, region[head]!)) {
        const cell = board[side]
        if (cell === EMPTY) {
          if (!seen[side]) {
            seen[side] = 1
            region.push(side)
          }
        } else if (cell === BLACK) touchesBlack = true
        else touchesWhite = true
      }
    }

    if (touchesBlack && !touchesWhite) {
      counts[BLACK] += region.length
      for (const point of region) owner[point] = BLACK
    } else if (touchesWhite && !touchesBlack) {
      counts[WHITE] += region.length
      for (const point of region) owner[point] = WHITE
    } else neutral += region.length
  }

  return { owner, counts, neutral }
}

/**
 * ใครถือครองช่องไหนอยู่ — หมากของตัวเองนับเป็นของตัวเอง บวกช่องว่างที่ล้อมไว้ได้
 * ใช้ระบายพื้นที่บนกระดานให้เห็นว่าตอนนี้ใครกินพื้นที่ไปเท่าไร (นับแบบจีน = แต้มของฝ่ายนั้นพอดี)
 */
export function areaMap(position: Position): Record<number, Player> {
  const { owner } = regions(position)
  const out: Record<number, Player> = {}

  for (let index = 0; index < position.board.length; index++) {
    const stone = position.board[index]
    if (stone === BLACK || stone === WHITE) out[index] = stone
    else if (owner[index] === BLACK || owner[index] === WHITE) out[index] = owner[index] as Player
  }

  return out
}

/**
 * นับแต้มแบบจีน: หมากของตัวเอง + ช่องว่างที่ล้อมด้วยสีตัวเองล้วน
 *
 * (กติกาจริงต้องตกลงเรื่องหมากตายก่อน ที่นี่ถือว่าเล่นจนไม่มีอะไรให้จับแล้วค่อยผ่านตา)
 */
export function score(position: Position): Score {
  const stones: Record<Player, number> = { [BLACK]: 0, [WHITE]: 0 }

  for (const cell of position.board) {
    if (cell === BLACK) stones[BLACK]++
    else if (cell === WHITE) stones[WHITE]++
  }

  const { counts: territory, neutral } = regions(position)

  const area: Record<Player, number> = {
    [BLACK]: stones[BLACK] + territory[BLACK],
    [WHITE]: stones[WHITE] + territory[WHITE]
  }
  const lead = area[BLACK] - (area[WHITE] + position.komi)

  return {
    area,
    territory,
    stones,
    neutral,
    komi: position.komi,
    lead,
    winner: lead > 0 ? BLACK : lead < 0 ? WHITE : null
  }
}

export const isOver = (position: Position): boolean => position.passes >= 2

export const toIndex = (size: number, row: number, col: number): number => row * size + col
export const toRow = (size: number, index: number): number => Math.floor(index / size)
export const toCol = (size: number, index: number): number => index % size
export const toPoint = (size: number, index: number) => ({ row: toRow(size, index), col: toCol(size, index) })

/** ชื่อช่องแบบที่ใช้ในหนังสือโกะ — คอลัมน์ A–T (ไม่มี I) แถวนับจากล่างขึ้นบน */
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'
export const toNotation = (size: number, row: number, col: number): string =>
  `${COLUMN_LETTERS[col] ?? '?'}${size - row}`
