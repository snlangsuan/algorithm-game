import { BLACK, WHITE, type Board, type Player } from './engine'

/**
 * โหมดโหด — เอนจินโอเทลโลที่รวมหลายวิธีเข้าด้วยกันเพื่อเล่นให้ชนะอย่างเดียว
 *
 * 1. ค้นหาแบบ alpha-beta + PVS: มองล่วงหน้าหลายชั้นแต่ตัดกิ่งที่รู้แล้วว่าไม่ดีกว่าทิ้งไป
 * 2. ลึกขึ้นทีละชั้น (iterative deepening) จนหมดเวลา — ตอบตาที่ดีที่สุดจากชั้นลึกสุดที่คิดเสร็จ
 * 3. ตารางจำตำแหน่ง (transposition table + Zobrist hash): เจอกระดานเดิมจากคนละลำดับก็ไม่คิดซ้ำ
 * 4. ฟังก์ชันประเมินกระดานกลางเกม: ความคล่องตัว มุม ช่องอันตราย ขอบที่นิ่งแล้ว หมากที่ติดช่องว่าง
 * 5. ท้ายเกม (ช่องว่างเหลือไม่มาก) แก้โจทย์จริงจนจบเกม — ได้ผลแพ้ชนะที่แน่นอน ไม่ใช่การเดา
 *
 * เขียนเป็นฟังก์ชันล้วนแยกจาก OthelloAgent เพราะ worker ห่อทุกเมธอดของ agent ด้วยตัวนับ
 * ถ้าอยู่ในคลาส ทุกโหนดที่ค้นจะโดนนับซ้ำเป็นล้านครั้งจนช้าลงหลายเท่า
 */

// ---------- กระดาน: ช่อง 0–63 เรียงแถวต่อแถว ----------

const EMPTY = 0

/** ทุกแนวจากแต่ละช่องไป 8 ทิศ เก็บแบนเป็นแถวเดียว — RAY_START/RAY_LEN ชี้ว่าแนวไหนอยู่ตรงไหน */
const RAY_START = new Int16Array(64 * 8)
const RAY_LEN = new Int8Array(64 * 8)
const RAY_DATA: number[] = []

/** ช่องรอบ ๆ แต่ละช่อง — ใช้นับหมากที่ติดช่องว่าง */
const AROUND: number[][] = []

{
  const steps: Array<[number, number]> = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ]
  for (let sq = 0; sq < 64; sq++) {
    const row = sq >> 3
    const col = sq & 7
    AROUND.push([])
    for (let d = 0; d < 8; d++) {
      const [dr, dc] = steps[d]!
      RAY_START[sq * 8 + d] = RAY_DATA.length
      let r = row + dr
      let c = col + dc
      if (r >= 0 && r < 8 && c >= 0 && c < 8) AROUND[sq]!.push(r * 8 + c)
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        RAY_DATA.push(r * 8 + c)
        r += dr
        c += dc
      }
      RAY_LEN[sq * 8 + d] = RAY_DATA.length - RAY_START[sq * 8 + d]!
    }
  }
}

const RAY = Int8Array.from(RAY_DATA)

/**
 * ค่าประจำช่อง — มุมดีมาก ช่องติดมุมแย่มาก (ให้คู่ต่อสู้แย่งมุมได้)
 * ใช้ทั้งเรียงลำดับตาที่จะลองก่อน และเป็นส่วนเล็ก ๆ ของการประเมินกระดาน
 */
const SQUARE_VALUE = Int16Array.from([
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100
])

/** ลำดับช่องที่ลองก่อน — มุมก่อน ช่องติดมุมทีหลังสุด ตัดกิ่งได้เร็วขึ้นมาก */
const ORDER = Int8Array.from([...Array(64).keys()].sort((a, b) => SQUARE_VALUE[b]! - SQUARE_VALUE[a]!))

const CORNERS = [0, 7, 56, 63]
/** ช่อง X (ทแยงติดมุม) และช่อง C (ข้างมุม) ของแต่ละมุม เรียงตาม CORNERS */
const X_SQUARES = [9, 14, 49, 54]
const C_SQUARES = [
  [1, 8],
  [6, 15],
  [48, 57],
  [55, 62]
]
/** ขอบทั้งสี่ เดินจากมุมหนึ่งไปอีกมุม — ใช้นับหมากขอบที่ติดมุมเป็นแถว (พลิกไม่ได้อีกแล้ว) */
const EDGES = [
  [0, 1, 2, 3, 4, 5, 6, 7],
  [56, 57, 58, 59, 60, 61, 62, 63],
  [0, 8, 16, 24, 32, 40, 48, 56],
  [7, 15, 23, 31, 39, 47, 55, 63]
]

// ---------- สถานะของการค้นหา (ใช้ร่วมทั้งไฟล์ ไม่สร้างของใหม่ระหว่างค้น) ----------

const board = new Int8Array(64)
const count = new Int8Array(3)
let empties = 0

/** กองช่องที่ถูกพลิก — ถอยตาได้โดยไม่ต้องคัดลอกกระดาน */
const flipStack = new Int8Array(64 * 64)
let flipTop = 0

const MAX_PLY = 64
/** ตาที่ลงได้มากที่สุดในหนึ่งตาของโอเทลโลคือ 33 — เผื่อไว้ */
const WIDE = 40
/** ตาที่ลงได้ของแต่ละชั้น แยกที่เก็บกันจะได้ไม่เขียนทับ */
const moveBuf = new Int8Array(MAX_PLY * WIDE)
const scoreBuf = new Int32Array(MAX_PLY * WIDE)
let ply = 0

// ---------- Zobrist hash: ตัวเลขประจำกระดาน เปลี่ยนทีละช่องได้ถูก ๆ ----------

let seed = 0x2545f491
const rand32 = () => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return seed | 0
}
const ZA = [new Int32Array(64), new Int32Array(64), new Int32Array(64)]
const ZB = [new Int32Array(64), new Int32Array(64), new Int32Array(64)]
for (const color of [BLACK, WHITE]) {
  for (let sq = 0; sq < 64; sq++) {
    ZA[color]![sq] = rand32()
    ZB[color]![sq] = rand32()
  }
}
const SIDE_A = rand32()
const SIDE_B = rand32()
let hashA = 0
let hashB = 0

// ---------- ตารางจำตำแหน่ง ----------

const TT_BITS = 20
const TT_SIZE = 1 << TT_BITS
const TT_MASK = TT_SIZE - 1
const EXACT = 1
const LOWER = 2
const UPPER = 3

let ttA: Int32Array | null = null
let ttB: Int32Array
let ttValue: Int32Array
let ttDepth: Int8Array
let ttFlag: Uint8Array
let ttMove: Int8Array

function ensureTable() {
  if (ttA) return
  ttA = new Int32Array(TT_SIZE)
  ttB = new Int32Array(TT_SIZE)
  ttValue = new Int32Array(TT_SIZE)
  ttDepth = new Int8Array(TT_SIZE)
  ttFlag = new Uint8Array(TT_SIZE)
  ttMove = new Int8Array(TT_SIZE).fill(-1)
}

// ---------- ลง / ถอน ----------

function canPlay(sq: number, me: number, op: number): boolean {
  if (board[sq] !== EMPTY) return false
  const base = sq * 8
  for (let d = 0; d < 8; d++) {
    const start = RAY_START[base + d]!
    const len = RAY_LEN[base + d]!
    let k = 0
    while (k < len && board[RAY[start + k]!] === op) k++
    if (k > 0 && k < len && board[RAY[start + k]!] === me) return true
  }
  return false
}

/** ลงหมาก คืนจำนวนที่พลิก (0 = ลงไม่ได้ และไม่ได้เปลี่ยนอะไร) */
function play(sq: number, me: number, op: number): number {
  const base = sq * 8
  const before = flipTop
  for (let d = 0; d < 8; d++) {
    const start = RAY_START[base + d]!
    const len = RAY_LEN[base + d]!
    let k = 0
    while (k < len && board[RAY[start + k]!] === op) k++
    if (k > 0 && k < len && board[RAY[start + k]!] === me) {
      for (let i = 0; i < k; i++) {
        const at = RAY[start + i]!
        board[at] = me
        flipStack[flipTop++] = at
        hashA ^= ZA[op]![at]! ^ ZA[me]![at]!
        hashB ^= ZB[op]![at]! ^ ZB[me]![at]!
      }
    }
  }
  const flipped = flipTop - before
  if (flipped === 0) return 0

  board[sq] = me
  hashA ^= ZA[me]![sq]!
  hashB ^= ZB[me]![sq]!
  count[me]! += flipped + 1
  count[op]! -= flipped
  empties--
  return flipped
}

function undo(sq: number, flipped: number, me: number, op: number) {
  for (let i = 0; i < flipped; i++) {
    const at = flipStack[--flipTop]!
    board[at] = op
    hashA ^= ZA[op]![at]! ^ ZA[me]![at]!
    hashB ^= ZB[op]![at]! ^ ZB[me]![at]!
  }
  board[sq] = EMPTY
  hashA ^= ZA[me]![sq]!
  hashB ^= ZB[me]![sq]!
  count[me]! -= flipped + 1
  count[op]! += flipped
  empties++
}

/** ตาที่ลงได้ เขียนลง moveBuf ของชั้น at — คืนจำนวน */
function generate(at: number, me: number, op: number): number {
  let n = 0
  const base = at * WIDE
  for (let i = 0; i < 64; i++) {
    const sq = ORDER[i]!
    if (canPlay(sq, me, op)) moveBuf[base + n++] = sq
  }
  return n
}

function mobility(me: number, op: number): number {
  let n = 0
  for (let sq = 0; sq < 64; sq++) if (canPlay(sq, me, op)) n++
  return n
}

// ---------- ประเมินกระดานกลางเกม (มุมมองของฝ่ายที่กำลังจะลง) ----------

function evaluate(me: number, op: number): number {
  const myMoves = mobility(me, op)
  const opMoves = mobility(op, me)
  if (myMoves === 0 && opMoves === 0) return final(me, op)

  // ต้นเกมสนความคล่องตัวกับตำแหน่ง ท้ายเกมหันไปนับหมากจริง
  const late = 60 - empties

  // ความคล่องตัว: มีตาให้เลือกมากกว่า = บีบให้คู่ต่อสู้ต้องลงตาแย่
  let score = Math.round((120 * (myMoves - opMoves)) / (myMoves + opMoves + 2))

  let corner = 0
  let danger = 0
  for (let i = 0; i < 4; i++) {
    const c = CORNERS[i]!
    const owner = board[c]
    if (owner === me) corner++
    else if (owner === op) corner--
    else {
      // มุมยังว่าง: ยืนช่องติดมุมเท่ากับเปิดทางให้อีกฝ่ายยึดมุม
      const x = board[X_SQUARES[i]!]
      if (x === me) danger -= 3
      else if (x === op) danger += 3
      for (const cs of C_SQUARES[i]!) {
        if (board[cs] === me) danger -= 1
        else if (board[cs] === op) danger += 1
      }
    }
  }
  score += corner * 90 + danger * 18

  // หมากขอบที่ต่อจากมุมเป็นแถวเดียวกัน — ไม่มีทางถูกพลิกอีกแล้ว
  let stable = 0
  for (const edge of EDGES) {
    for (const [from, step] of [
      [0, 1],
      [7, -1]
    ] as const) {
      const color = board[edge[from]!]
      if (color === EMPTY) continue
      for (let k = from; k >= 0 && k < 8 && board[edge[k]!] === color; k += step) {
        stable += color === me ? 1 : -1
      }
    }
  }
  score += stable * 12

  // หมากที่ติดช่องว่าง (ขอบหน้า) ยิ่งมากยิ่งให้คู่ต่อสู้มีตาลง — มีน้อยดีกว่า
  let frontier = 0
  let position = 0
  for (let sq = 0; sq < 64; sq++) {
    const color = board[sq]
    if (color === EMPTY) continue
    const sign = color === me ? 1 : -1
    position += sign * SQUARE_VALUE[sq]!
    const around = AROUND[sq]!
    for (let k = 0; k < around.length; k++) {
      if (board[around[k]!] === EMPTY) {
        frontier -= sign
        break
      }
    }
  }
  score += frontier * 6 + (position * (empties > 20 ? 1 : 0)) / 2

  // ท้ายเกม: จำนวนหมากเริ่มสำคัญ และฝ่ายที่ได้ลงตาสุดท้ายในแต่ละพื้นที่ได้เปรียบ
  if (late > 40) score += (count[me]! - count[op]!) * (late - 40)
  if (empties < 18) score += empties & 1 ? 10 : -10

  return Math.round(score)
}

/** ค่าของกระดานที่จบเกมแล้ว — ชนะเท่าไรก็ต้องมากกว่าค่าประเมินกลางเกมทุกค่า */
const WIN = 1_000_000
function final(me: number, op: number): number {
  const diff = count[me]! - count[op]!
  return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0
}

// ---------- ค้นหากลางเกม ----------

const ABORT = new Error('หมดเวลา')
let deadline = 0
let nodes = 0

function tick() {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) throw ABORT
}

function search(depth: number, alpha: number, beta: number, me: number, op: number, passed: boolean): number {
  tick()
  if (depth <= 0) return evaluate(me, op)

  const keyA = me === BLACK ? hashA : hashA ^ SIDE_A
  const keyB = me === BLACK ? hashB : hashB ^ SIDE_B
  const slot = keyA & TT_MASK
  let ttBest = -1
  if (ttA![slot] === keyA && ttB[slot] === keyB) {
    ttBest = ttMove[slot]!
    if (ttDepth[slot]! >= depth) {
      const value = ttValue[slot]!
      const flag = ttFlag[slot]
      if (flag === EXACT) return value
      if (flag === LOWER && value >= beta) return value
      if (flag === UPPER && value <= alpha) return value
    }
  }

  const at = ply
  const n = generate(at, me, op)
  if (n === 0) {
    if (passed) return final(me, op)
    return -search(depth, -beta, -alpha, op, me, true)
  }

  // ตาที่จำไว้ว่าดีที่สุดจากคราวก่อน ลองก่อนเสมอ
  const base = at * WIDE
  if (ttBest >= 0) {
    for (let i = 1; i < n; i++) {
      if (moveBuf[base + i] === ttBest) {
        moveBuf[base + i] = moveBuf[base]!
        moveBuf[base] = ttBest
        break
      }
    }
  }

  const start = alpha
  let best = -Infinity
  let bestMove = moveBuf[base]!
  ply++
  try {
    for (let i = 0; i < n; i++) {
      const sq = moveBuf[base + i]!
      const flipped = play(sq, me, op)
      let value: number
      // PVS: ตาแรกค้นเต็มหน้าต่าง ตาที่เหลือแค่เช็คว่าดีกว่าไหม ดีกว่าจริงค่อยค้นเต็ม
      if (i === 0) value = -search(depth - 1, -beta, -alpha, op, me, false)
      else {
        value = -search(depth - 1, -alpha - 1, -alpha, op, me, false)
        if (value > alpha && value < beta) value = -search(depth - 1, -beta, -alpha, op, me, false)
      }
      undo(sq, flipped, me, op)

      if (value > best) {
        best = value
        bestMove = sq
      }
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
  } finally {
    ply--
  }

  ttA![slot] = keyA
  ttB[slot] = keyB
  ttValue[slot] = best
  ttDepth[slot] = depth
  ttMove[slot] = bestMove
  ttFlag[slot] = best <= start ? UPPER : best >= beta ? LOWER : EXACT
  return best
}

// ---------- แก้โจทย์ท้ายเกมจนจบจริง ----------

function solve(alpha: number, beta: number, me: number, op: number, passed: boolean): number {
  tick()
  if (empties === 0) return count[me]! - count[op]!

  const at = ply
  const n = generate(at, me, op)
  if (n === 0) {
    if (passed) return count[me]! - count[op]!
    return -solve(-beta, -alpha, op, me, true)
  }

  const base = at * WIDE
  // ลองตาที่ทำให้คู่ต่อสู้เหลือทางเลือกน้อยที่สุดก่อน — ตัดกิ่งได้มากที่สุดตอนท้ายเกม
  if (empties > 6 && n > 1) {
    for (let i = 0; i < n; i++) {
      const sq = moveBuf[base + i]!
      const flipped = play(sq, me, op)
      scoreBuf[base + i] = mobility(op, me) * 16 - SQUARE_VALUE[sq]! / 10
      undo(sq, flipped, me, op)
    }
    for (let i = 1; i < n; i++) {
      const move = moveBuf[base + i]!
      const key = scoreBuf[base + i]!
      let j = i - 1
      while (j >= 0 && scoreBuf[base + j]! > key) {
        moveBuf[base + j + 1] = moveBuf[base + j]!
        scoreBuf[base + j + 1] = scoreBuf[base + j]!
        j--
      }
      moveBuf[base + j + 1] = move
      scoreBuf[base + j + 1] = key
    }
  }

  let best = -64
  ply++
  try {
    for (let i = 0; i < n; i++) {
      const sq = moveBuf[base + i]!
      const flipped = play(sq, me, op)
      const value = -solve(-beta, -alpha, op, me, false)
      undo(sq, flipped, me, op)
      if (value > best) best = value
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
  } finally {
    ply--
  }
  return best
}

// ---------- ตาที่จะลง ----------

export interface RuthlessResult {
  row: number
  col: number
  /** มองลึกไปกี่ตา — ท้ายเกมที่แก้จนจบได้คือจำนวนช่องว่างทั้งหมด */
  depth: number
  /** แก้ท้ายเกมจนจบจริงแล้ว — score คือผลต่างหมากตอนจบที่แน่นอน */
  solved: boolean
  score: number
  nodes: number
}

/**
 * ช่องว่างเหลือเท่านี้ลงไปถึงลองแก้จนจบเกม — ใช้เวลาส่วนแรกมองล่วงหน้าไว้เป็นคำตอบสำรองก่อน
 * แล้วเอาเวลาที่เหลือทั้งหมดแก้จนจบ ถ้าไม่ทันก็ใช้คำตอบสำรอง
 */
const SOLVE_AT = 20
const BACKUP_SHARE = 0.3
/** ไม่เกินนี้แก้ละเอียดว่าชนะกี่เม็ด มากกว่านี้ (ถึง SOLVE_AT) ถามแค่ว่าชนะหรือแพ้ ซึ่งเร็วกว่าหลายเท่า */
const EXACT_AT = 15

function load(source: Board) {
  count[BLACK] = 0
  count[WHITE] = 0
  empties = 0
  hashA = 0
  hashB = 0
  for (let sq = 0; sq < 64; sq++) {
    const cell = source[sq >> 3]![sq & 7]!
    board[sq] = cell
    if (cell === EMPTY) empties++
    else {
      count[cell]!++
      hashA ^= ZA[cell]![sq]!
      hashB ^= ZB[cell]![sq]!
    }
  }
  flipTop = 0
  ply = 0
}

/** ค้นหาทุกตาที่ราก ด้วยฟังก์ชันค้นที่ให้มา คืนตาที่ดีที่สุดกับค่าของมัน */
function root(moves: number[], value: (sq: number, alpha: number) => number): { move: number; score: number } {
  let alpha = -Infinity
  let move = moves[0]!
  for (const sq of moves) {
    const score = value(sq, alpha)
    if (score > alpha) {
      alpha = score
      move = sq
    }
  }
  return { move, score: alpha }
}

export function ruthlessMove(source: Board, player: Player, budgetMs: number): RuthlessResult | null {
  ensureTable()
  load(source)
  const me = player
  const op = player === BLACK ? WHITE : BLACK

  let moves = [...moveBuf.subarray(0, generate(0, me, op))]
  if (moves.length === 0) return null

  const started = Date.now()
  const budget = Math.max(5, budgetMs)
  const trySolve = empties <= SOLVE_AT
  deadline = started + (trySolve ? budget * BACKUP_SHARE : budget)
  nodes = 0
  const answer = (sq: number, depth: number, solved: boolean, score: number): RuthlessResult => ({
    row: sq >> 3,
    col: sq & 7,
    depth,
    solved,
    score,
    nodes
  })

  if (moves.length === 1) return answer(moves[0]!, 0, false, 0)

  const ordered = (first: number) => [first, ...moves.filter((sq) => sq !== first)]
  let best = moves[0]!
  let bestScore = 0
  let reached = 0

  // กลางเกม: ลึกขึ้นทีละชั้น ชั้นไหนคิดไม่ทันก็ใช้คำตอบของชั้นก่อน
  try {
    for (let depth = 1; depth <= empties; depth++) {
      const found = root(moves, (sq, alpha) => {
        const flipped = play(sq, me, op)
        ply = 1
        try {
          if (alpha === -Infinity) return -search(depth - 1, -Infinity, Infinity, op, me, false)
          let value = -search(depth - 1, -alpha - 1, -alpha, op, me, false)
          if (value > alpha) value = -search(depth - 1, -Infinity, -alpha, op, me, false)
          return value
        } finally {
          ply = 0
          undo(sq, flipped, me, op)
        }
      })
      best = found.move
      bestScore = found.score
      reached = depth
      moves = ordered(best)
      // รู้ผลแพ้ชนะแน่นอนแล้ว มองลึกกว่านี้ก็ไม่เปลี่ยน
      if (Math.abs(bestScore) >= WIN / 2 && depth >= empties) break
    }
  } catch (error) {
    if (error !== ABORT) throw error
    flipTop = 0
  }

  // ท้ายเกม: แก้จนจบจริง ใช้เวลาที่เหลือทั้งหมด ถ้าไม่ทันก็ใช้คำตอบกลางเกมไป
  if (trySolve) {
    load(source)
    deadline = started + budget
    try {
      if (empties <= EXACT_AT) {
        const found = root(moves, (sq, alpha) => {
          const flipped = play(sq, me, op)
          ply = 1
          try {
            const low = alpha === -Infinity ? -65 : alpha
            return -solve(-65, -low, op, me, false)
          } finally {
            ply = 0
            undo(sq, flipped, me, op)
          }
        })
        return answer(found.move, empties, true, found.score)
      }

      // แพ้/ชนะ: หน้าต่างแคบ (−1, 1) ตอบได้แค่ว่าออกมาบวก ศูนย์ หรือลบ — ตัดกิ่งได้มากกว่าเยอะ
      // ลองตามลำดับที่การมองล่วงหน้าชอบ เจอตาที่ชนะแน่ก็ลงเลย
      let draw = -1
      for (const sq of moves) {
        const flipped = play(sq, me, op)
        ply = 1
        let value: number
        try {
          value = -solve(-1, 1, op, me, false)
        } finally {
          ply = 0
          undo(sq, flipped, me, op)
        }
        if (value > 0) return answer(sq, empties, true, value)
        if (value === 0 && draw < 0) draw = sq
      }
      // ไม่มีตาไหนชนะ: เสมอได้ก็เอาเสมอ แพ้ทุกทางก็ใช้ตาที่การมองล่วงหน้าเห็นว่าดีที่สุด (หวังให้อีกฝ่ายพลาด)
      if (draw >= 0) return answer(draw, empties, true, 0)
    } catch (error) {
      if (error !== ABORT) throw error
    }
  }

  return answer(best, reached, false, bestScore)
}
