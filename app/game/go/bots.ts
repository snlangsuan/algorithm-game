import { BLACK, EMPTY, WHITE, type Player, type Position } from './engine'
import { SCALAR_COUNT, scoreOf, type Features, type Weights } from './policy'

/**
 * บอทหมากล้อมทั้งหมด — ระดับ 9 คิวถึง 1 คิว และอัลกอริทึมที่มีชื่อเรียกในวงการโกะ
 *
 * ไล่จากง่ายไปยาก ทุกตัวสร้างจากชิ้นส่วนเดิมที่เพิ่มขึ้นทีละอย่าง:
 *   สุ่มถูกกติกา → จับ/หนีอาตาริ → ตอบใกล้ตาที่เพิ่งลง → แพทเทิร์น 3×3 → ประเมินอิทธิพล
 *   → สุ่มเล่นจนจบ (Monte Carlo) → MCTS/UCT → UCT + RAVE
 *
 * กระดานในไฟล์นี้เป็นอาร์เรย์แบนที่แก้ในที่ (ไม่คัดลอก) เพราะการสุ่มเล่นจนจบหนึ่งครั้ง
 * ลงหมากเป็นร้อยตา และหนึ่งตาของ MCTS สุ่มเล่นหลายพันครั้ง — ถ้าคัดลอกกระดานทุกตาคงไม่ทันกิน
 */

export type BotKind =
  | 'kyu1'
  | 'kyu2'
  | 'kyu3'
  | 'kyu4'
  | 'kyu5'
  | 'kyu6'
  | 'kyu7'
  | 'kyu8'
  | 'kyu9'
  | 'random'
  | 'capture'
  | 'pattern'
  | 'influence'
  | 'montecarlo'
  | 'uct'
  | 'rave'
  | 'ruthless'

export type BotMove = { row: number; col: number } | 'pass'

// ---------- กระดานเร็ว ----------

const MAX_POINTS = 19 * 19

let size = 9
let points = 81
const board = new Uint8Array(MAX_POINTS)
let ko = -1

/** เพื่อนบ้านสี่ทิศของทุกช่อง เก็บแบนไว้ล่วงหน้าต่อขนาดกระดาน */
const NEIGHBOR_CACHE = new Map<number, { start: Int16Array; list: Int16Array }>()
let nbStart: Int16Array
let nbList: Int16Array

function useSize(next: number) {
  size = next
  points = next * next

  const found = NEIGHBOR_CACHE.get(next)
  if (found) {
    nbStart = found.start
    nbList = found.list
    return
  }

  const start = new Int16Array(points + 1)
  const list: number[] = []
  for (let index = 0; index < points; index++) {
    start[index] = list.length
    const row = (index / next) | 0
    const col = index % next
    if (row > 0) list.push(index - next)
    if (row < next - 1) list.push(index + next)
    if (col > 0) list.push(index - 1)
    if (col < next - 1) list.push(index + 1)
  }
  start[points] = list.length

  const made = { start, list: Int16Array.from(list) }
  NEIGHBOR_CACHE.set(next, made)
  nbStart = made.start
  nbList = made.list
}

/** ตัวช่วยเดินหมู่ — ใช้เลขรุ่นแทนการล้างอาร์เรย์ทุกครั้ง */
const mark = new Int32Array(MAX_POINTS)
const stack = new Int16Array(MAX_POINTS)
const group = new Int16Array(MAX_POINTS)
let era = 0

/** หมู่ที่ช่องนี้ยังมีลมหายใจไหม — เจอช่องว่างเมื่อไรก็เลิกเดินทันที */
function hasLiberty(from: number): boolean {
  const color = board[from]!
  era++
  let top = 0
  stack[top++] = from
  mark[from] = era

  while (top > 0) {
    const at = stack[--top]!
    for (let k = nbStart[at]!; k < nbStart[at + 1]!; k++) {
      const next = nbList[k]!
      const cell = board[next]!
      if (cell === EMPTY) return true
      if (cell === color && mark[next] !== era) {
        mark[next] = era
        stack[top++] = next
      }
    }
  }

  return false
}

/** เก็บหมากทั้งหมู่ออกจากกระดาน คืนจำนวนที่เก็บ และช่องสุดท้ายที่เก็บ (ใช้ดูโค) */
function takeGroup(from: number): { count: number; last: number } {
  const color = board[from]!
  era++
  let top = 0
  let count = 0
  let last = -1
  stack[top++] = from
  mark[from] = era

  while (top > 0) {
    const at = stack[--top]!
    board[at] = EMPTY
    count++
    last = at
    for (let k = nbStart[at]!; k < nbStart[at + 1]!; k++) {
      const next = nbList[k]!
      if (board[next] === color && mark[next] !== era) {
        mark[next] = era
        stack[top++] = next
      }
    }
  }

  return { count, last }
}

function groupStones(from: number): number {
  const color = board[from]!
  era++
  let top = 0
  let count = 0
  stack[top++] = from
  mark[from] = era

  while (top > 0) {
    const at = stack[--top]!
    count++
    group[count - 1] = at
    for (let k = nbStart[at]!; k < nbStart[at + 1]!; k++) {
      const next = nbList[k]!
      if (board[next] === color && mark[next] !== era) {
        mark[next] = era
        stack[top++] = next
      }
    }
  }

  return count
}

/** นับลมหายใจของหมู่ที่ช่องนี้ (ช้ากว่า hasLiberty ใช้เฉพาะตอนต้องรู้จำนวน) */
function countLiberties(from: number): number {
  const color = board[from]!
  era++
  let top = 0
  let free = 0
  stack[top++] = from
  mark[from] = era

  while (top > 0) {
    const at = stack[--top]!
    for (let k = nbStart[at]!; k < nbStart[at + 1]!; k++) {
      const next = nbList[k]!
      const cell = board[next]!
      if (mark[next] === era) continue
      if (cell === EMPTY) {
        mark[next] = era
        free++
      } else if (cell === color) {
        mark[next] = era
        stack[top++] = next
      }
    }
  }

  return free
}

const other = (color: number): number => (color === BLACK ? WHITE : BLACK)

/** ลงหมากจริงบนกระดานเร็ว — คืนจำนวนที่จับได้ หรือ -1 ถ้าลงไม่ได้ (กระดานไม่ถูกแตะ) */
function playFast(index: number, color: number): number {
  if (board[index] !== EMPTY || index === ko) return -1

  board[index] = color
  const foe = other(color)
  let captured = 0
  let lastTaken = -1

  for (let k = nbStart[index]!; k < nbStart[index + 1]!; k++) {
    const next = nbList[k]!
    if (board[next] === foe && !hasLiberty(next)) {
      const taken = takeGroup(next)
      captured += taken.count
      lastTaken = taken.last
    }
  }

  if (captured === 0 && !hasLiberty(index)) {
    board[index] = EMPTY
    return -1
  }

  ko = captured === 1 && groupStones(index) === 1 && countLiberties(index) === 1 ? lastTaken : -1
  return captured
}

/** ช่องนี้เป็นตาของสีนั้นไหม — ล้อมครบสี่ด้าน และมุมทแยงไม่เสียให้คู่ต่อสู้ */
function isEyeFast(index: number, color: number): boolean {
  if (board[index] !== EMPTY) return false

  for (let k = nbStart[index]!; k < nbStart[index + 1]!; k++) {
    if (board[nbList[k]!] !== color) return false
  }

  const row = (index / size) | 0
  const col = index % size
  const foe = other(color)
  let corners = 0
  let bad = 0

  for (const [dr, dc] of CORNERS) {
    const r = row + dr
    const c = col + dc
    if (r < 0 || c < 0 || r >= size || c >= size) continue
    corners++
    if (board[r * size + c] === foe) bad++
  }

  return corners < 4 ? bad === 0 : bad <= 1
}

const CORNERS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
]

function load(position: Position) {
  useSize(position.size)
  board.set(position.board.subarray(0, points))
  ko = position.ko ?? -1
}

/** สำเนากระดานไว้ย้อนกลับ — ใช้ตอนลองหลายตาจากตำแหน่งเดียวกัน */
const spare = new Uint8Array(MAX_POINTS)
let spareKo = -1
const keep = () => {
  spare.set(board.subarray(0, points))
  spareKo = ko
}
const restore = () => {
  board.set(spare.subarray(0, points))
  ko = spareKo
}

// ---------- สุ่มแบบมีเมล็ด ----------

let rngState = 12345
const random = (): number => {
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** ตั้งเมล็ดสุ่ม — เทสต์ใช้เพื่อให้ผลซ้ำได้ */
export const seedBots = (seed: number) => {
  rngState = seed | 0
}

/**
 * ย่อจำนวนรอบขั้นต่ำของการค้นลงทั้งกระดาน — มีไว้ให้เทสต์เท่านั้น
 * ทุกระดับที่ใช้ MCTS ย่อเท่ากันหมด ลำดับความเก่งจึงยังเหมือนเดิม แต่เทสต์วิ่งเร็วขึ้นหลายเท่า
 */
let searchScale = 1
export const setSearchScale = (scale: number) => {
  searchScale = Math.max(0.01, Math.min(1, scale))
}

// ---------- นโยบายการสุ่มเล่น ----------

/** ลำดับช่องที่จะไล่ดูในหนึ่งตาของการสุ่มเล่น — สับใหม่ทุกครั้งจะได้ไม่ลำเอียงไปมุมซ้ายบน */
const order = new Int16Array(MAX_POINTS)
function shuffleOrder() {
  for (let i = 0; i < points; i++) order[i] = i
  for (let i = points - 1; i > 0; i--) {
    const j = (random() * (i + 1)) | 0
    const swap = order[i]!
    order[i] = order[j]!
    order[j] = swap
  }
}

/**
 * ตาแก้อาตาริรอบ ๆ ช่องที่เพิ่งลง — จับหมู่ที่เหลือลมหายใจเดียว หรือต่อหมู่ตัวเองที่โดนจ่อ
 * เป็นกฎเดียวกับที่โปรแกรม MoGo ใช้ในการสุ่มเล่น ซึ่งทำให้การสุ่มดูเหมือนคนเล่นขึ้นมาก
 */
function atariAnswer(last: number, color: number): number {
  if (last < 0) return -1
  const foe = other(color)

  for (let k = nbStart[last]!; k < nbStart[last + 1]!; k++) {
    const next = nbList[k]!
    const cell = board[next]!
    if (cell === EMPTY) continue
    if (countLiberties(next) !== 1) continue

    // หาช่องลมหายใจสุดท้ายของหมู่นั้น แล้วลงตรงนั้น (จับได้ หรือหนีออกมา)
    const count = groupStones(next)
    for (let s = 0; s < count; s++) {
      const stone = group[s]!
      for (let n = nbStart[stone]!; n < nbStart[stone + 1]!; n++) {
        const spot = nbList[n]!
        if (board[spot] !== EMPTY) continue
        if (cell === foe || !isEyeFast(spot, color)) return spot
      }
    }
  }

  return -1
}

/**
 * แพทเทิร์น 3×3 รอบช่องว่างข้าง ๆ ตาที่เพิ่งลง — ลอกแนวคิดจากชุดแพทเทิร์นของ MoGo
 * ไม่ได้ไล่ทุกแบบเป๊ะ ๆ แต่เก็บรูปที่เจอบ่อยไว้: ตัด ต่อ กันหัว และแปะข้าง
 */
function patternAnswer(last: number, color: number): number {
  if (last < 0) return -1
  const foe = other(color)

  for (let k = nbStart[last]!; k < nbStart[last + 1]!; k++) {
    const spot = nbList[k]!
    if (board[spot] !== EMPTY || isEyeFast(spot, color)) continue

    let mine = 0
    let theirs = 0
    let empty = 0
    for (let n = nbStart[spot]!; n < nbStart[spot + 1]!; n++) {
      const cell = board[nbList[n]!]!
      if (cell === color) mine++
      else if (cell === foe) theirs++
      else empty++
    }

    // ติดหมากของอีกฝ่ายอย่างน้อยสองด้าน = จุดตัด/จุดกันหัว น่าลงที่สุด
    if (theirs >= 2) return spot
    // แปะข้างหมากของเราที่กำลังโดนล้อม
    if (mine >= 1 && theirs >= 1 && empty >= 1) return spot
  }

  return -1
}

/**
 * ตาตอบที่เรียนมาจากเกมก่อน ๆ — replies[ตาของอีกฝ่าย] = ตาที่เราเคยตอบแล้วชนะ
 * ตั้งจากข้างนอกก่อนเริ่มค้น (บอทที่ไม่ได้เรียนรู้อะไรจะเป็น null เหมือนเดิม)
 */
let learnedReplies: number[] | null = null

/** ตาถัดไปของการสุ่มเล่น — smart คือใช้กฎอาตาริกับแพทเทิร์นก่อนค่อยสุ่ม */
function nextPlayoutMove(color: number, last: number, smart: boolean): number {
  if (smart) {
    // น้ำหนักที่เรียนมาเอง: เลือกตาที่คะแนนดีที่สุดในละแวกตาที่เพิ่งลง
    if (learnedWeights && last >= 0) {
      let best = -1
      let bestScore = 0
      for (let k = nbStart[last]!; k < nbStart[last + 1]!; k++) {
        const spot = nbList[k]!
        if (board[spot] !== EMPTY || isEyeFast(spot, color)) continue
        const value = scoreOf(learnedWeights, featuresOf(spot, color, last))
        if (value > bestScore) {
          bestScore = value
          best = spot
        }
      }
      if (best >= 0 && playFast(best, color) >= 0) return best
    }

    // ตาตอบที่เคยพาไปชนะมาก่อน ลองก่อนเลย — ทำให้การสุ่มเล่นเหมือนเกมจริงขึ้น
    if (learnedReplies && last >= 0) {
      const reply = learnedReplies[last] ?? -1
      if (reply >= 0 && board[reply] === EMPTY && !isEyeFast(reply, color) && playFast(reply, color) >= 0) {
        return reply
      }
    }

    const save = atariAnswer(last, color)
    if (save >= 0 && playFast(save, color) >= 0) return save

    const shape = patternAnswer(last, color)
    if (shape >= 0 && playFast(shape, color) >= 0) return shape
  }

  shuffleOrder()
  for (let i = 0; i < points; i++) {
    const spot = order[i]!
    if (board[spot] !== EMPTY) continue
    if (isEyeFast(spot, color)) continue
    if (playFast(spot, color) >= 0) return spot
  }

  return -1
}

/** นับแต้มแบบจีนบนกระดานเร็ว — คืนแต้มดำลบแต้มขาว (ยังไม่รวมโคมิ) */
function areaLead(): number {
  let black = 0
  let white = 0

  era++
  for (let start = 0; start < points; start++) {
    const cell = board[start]!
    if (cell === BLACK) {
      black++
      continue
    }
    if (cell === WHITE) {
      white++
      continue
    }
    if (mark[start] === era) continue

    // ผืนช่องว่างที่ติดกัน — ดูว่าแตะสีเดียวหรือสองสี
    let top = 0
    let region = 0
    let touchBlack = false
    let touchWhite = false
    stack[top++] = start
    mark[start] = era

    while (top > 0) {
      const at = stack[--top]!
      region++
      for (let k = nbStart[at]!; k < nbStart[at + 1]!; k++) {
        const next = nbList[k]!
        const side = board[next]!
        if (side === EMPTY) {
          if (mark[next] !== era) {
            mark[next] = era
            stack[top++] = next
          }
        } else if (side === BLACK) touchBlack = true
        else touchWhite = true
      }
    }

    if (touchBlack && !touchWhite) black += region
    else if (touchWhite && !touchBlack) white += region
  }

  return black - white
}

/**
 * สุ่มเล่นจากกระดานตอนนี้จนจบเกม แล้วบอกว่าสีที่ถามชนะไหม
 * จบเมื่อทั้งสองฝ่ายหาที่ลงที่ไม่ใช่ตาตัวเองไม่ได้ หรือครบเพดานตาที่ตั้งไว้
 */
function runPlayout(toPlay: number, komi: number, forColor: number, smart: boolean, mercy = false): boolean {
  let color = toPlay
  let last = -1
  let passes = 0
  const limit = points * 2
  // ขาดกันเกินเท่านี้ถือว่ารู้ผลแล้ว ไม่ต้องเล่นต่อให้เสียเวลา (กฎเมตตา)
  const gap = points * 0.35

  for (let move = 0; move < limit && passes < 2; move++) {
    const spot = nextPlayoutMove(color, last, smart)
    if (spot < 0) {
      passes++
      ko = -1
    } else {
      passes = 0
      last = spot
    }
    color = other(color)

    if (mercy && (move & 15) === 15) {
      const gapNow = areaLead() - komi
      if (Math.abs(gapNow) > gap) return forColor === BLACK ? gapNow > 0 : gapNow < 0
    }
  }

  const lead = areaLead() - komi
  return forColor === BLACK ? lead > 0 : lead < 0
}

/** สุ่มเล่นจนจบหนึ่งครั้งหลังลงตาที่กำหนด — ใช้จากบล็อก "สุ่มเล่นจนจบ" */
export function playoutWinner(position: Position, move: { row: number; col: number }, color: Player): boolean {
  load(position)
  const index = move.row * position.size + move.col
  if (playFast(index, color) < 0) return false
  return runPlayout(other(color), position.komi, color, true)
}

/** ตาที่เข้าแพทเทิร์น 3×3 รอบตาที่เพิ่งลง — ไม่มีก็ null */
export function patternMove(position: Position, color: Player, last?: number | null): BotMove | null {
  load(position)
  const spot = patternAnswer(last ?? -1, color)
  if (spot < 0) return null
  return { row: (spot / position.size) | 0, col: spot % position.size }
}

// ---------- ประเมินกระดานแบบอิทธิพล ----------

/**
 * แผนที่อิทธิพล — หมากแต่ละเม็ดแผ่พลังออกรอบตัว จางลงตามระยะ
 * ช่องไหนพลังฝ่ายไหนมากกว่าก็นับเป็นพื้นที่ของฝ่ายนั้น เป็นวิธีประเมินพื้นที่แบบคร่าว ๆ
 * ที่โปรแกรมโกะยุคก่อนมอนติคาร์โลใช้กันมาตั้งแต่ Zobrist (1969)
 */
const influence = new Float32Array(MAX_POINTS)

function influenceLead(): number {
  influence.fill(0, 0, points)

  for (let index = 0; index < points; index++) {
    const cell = board[index]!
    if (cell === EMPTY) continue
    const sign = cell === BLACK ? 1 : -1
    const row = (index / size) | 0
    const col = index % size

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const distance = Math.abs(r - row) + Math.abs(c - col)
        if (distance > 4) continue
        influence[r * size + c]! += (sign * 64) / (1 << distance)
      }
    }
  }

  let lead = 0
  for (let index = 0; index < points; index++) {
    const cell = board[index]!
    if (cell === BLACK) lead += 1
    else if (cell === WHITE) lead -= 1
    else {
      const value = influence[index]!
      if (value > 8) lead += 1
      else if (value < -8) lead -= 1
    }
  }

  return lead
}

// ---------- MCTS / UCT ----------

interface Node {
  move: number
  visits: number
  wins: number
  children: Node[] | null
  untried: number[] | null
  /** สถิติ RAVE: ตานี้เคยถูกเล่นที่ไหนก็ได้ในเกมที่ค้นแล้วชนะกี่ครั้ง */
  raveVisits: Float32Array | null
  raveWins: Float32Array | null
}

const makeNode = (move: number): Node => ({
  move,
  visits: 0,
  wins: 0,
  children: null,
  untried: null,
  raveVisits: null,
  raveWins: null
})

/** ช่องที่พอมีเหตุผลจะลงในตานี้ (ไม่ถมตาตัวเอง) */
function sensibleList(color: number): number[] {
  const out: number[] = []
  keep()
  for (let index = 0; index < points; index++) {
    if (board[index] !== EMPTY || isEyeFast(index, color)) continue
    if (playFast(index, color) >= 0) out.push(index)
    restore()
  }
  return out
}

const UCT_C = 0.9
/** ค่าคงที่ของ RAVE — ยิ่งมาก ยิ่งเชื่อสถิติ RAVE นานก่อนจะหันไปเชื่อสถิติจริง */
const RAVE_BIAS = 700

function pickChild(node: Node, useRave: boolean): Node {
  const children = node.children!
  let best = children[0]!
  let bestValue = -Infinity
  const logParent = Math.log(Math.max(1, node.visits))

  for (const child of children) {
    if (child.visits === 0) return child

    let value = child.wins / child.visits
    if (useRave && node.raveVisits) {
      const raveVisits = node.raveVisits[child.move]!
      if (raveVisits > 0) {
        const raveValue = node.raveWins![child.move]! / raveVisits
        // ยิ่งเก็บสถิติจริงได้มาก ยิ่งลดน้ำหนักของ RAVE ลง
        const beta = raveVisits / (raveVisits + child.visits + (child.visits * raveVisits) / RAVE_BIAS)
        value = beta * raveValue + (1 - beta) * value
      }
    }

    value += UCT_C * Math.sqrt(logParent / child.visits)
    if (value > bestValue) {
      bestValue = value
      best = child
    }
  }

  return best
}

export interface SearchOptions {
  rounds?: number
  budgetMs?: number
  /**
   * จำนวนรอบขั้นต่ำที่ค้นให้ได้ก่อน ถึงจะยอมหยุดเพราะหมดเวลา
   * ทำให้ระดับคิวเรียงเหมือนเดิมแม้ตอนทดสอบที่ให้เวลาคิดน้อยกว่าในเกมจริงหลายเท่า
   */
  minRounds?: number
  /** ใช้สถิติ RAVE/AMAF ช่วยตัดสินใจไหม */
  rave?: boolean
  /** สุ่มเล่นแบบมีกฎ (อาตาริ + แพทเทิร์น) หรือสุ่มล้วน */
  smart?: boolean
  /** ใส่ความรู้เรื่องโกะให้กิ่งใหม่ตั้งแต่เกิด — กิ่งที่ดูดีได้เครดิตล่วงหน้า */
  priors?: boolean
  /** หยุดสุ่มเล่นทันทีที่ผลขาดกันชัด — ได้จำนวนรอบมากขึ้นในเวลาเท่าเดิม */
  mercy?: boolean
  /** ไม่ผ่านตาทิ้งเกมตอนตามหลัง — ผ่านเฉพาะตอนผ่านแล้วชนะจริง */
  patient?: boolean
  /** ตาตอบที่เรียนมาจากเกมก่อน ๆ ใช้ช่วยตอนสุ่มเล่น */
  replies?: number[] | null
  /** น้ำหนักที่เรียนเอง (RL) — ใช้แทนความรู้โกะที่เขียนมือไว้ */
  weights?: Weights | null
}

/**
 * ความรู้เรื่องโกะของตาหนึ่งตา ก่อนจะลงจริง — คืนค่าราว -1 (แย่) ถึง 1 (ดี)
 *
 * ใช้เป็น "เครดิตล่วงหน้า" ให้กิ่งที่เพิ่งเกิด MCTS จะได้ไม่ต้องเสียรอบไปพิสูจน์
 * สิ่งที่คนเล่นโกะรู้อยู่แล้ว เช่น ลงแล้วตัวเองเหลือลมหายใจเดียวคือยกหมากให้เขาฟรี ๆ
 */
function priorOf(move: number, color: number, last: number): number {
  keep()
  const captured = playFast(move, color)
  if (captured < 0) {
    restore()
    return -1
  }
  const libs = countLiberties(move)
  restore()

  let score = 0
  if (captured > 0) score += Math.min(1, captured / 3) * 0.8
  // ลงแล้วหมู่ตัวเองเหลือลมหายใจเดียว = ตาหน้าโดนจับ
  if (libs === 1) score -= 0.9
  else if (libs >= 3) score += 0.1

  if (last >= 0) {
    const distance =
      Math.abs(((move / size) | 0) - ((last / size) | 0)) + Math.abs((move % size) - (last % size))
    if (distance <= 2) score += 0.35
    else if (distance <= 4) score += 0.12
  }

  const row = (move / size) | 0
  const col = move % size
  const edge = Math.min(row, col, size - 1 - row, size - 1 - col)
  if (edge === 0) score -= 0.35
  else if (edge === 1) score -= 0.1
  else if (edge <= 3) score += 0.15

  return Math.max(-1, Math.min(1, score))
}

/** เครดิตล่วงหน้าคิดเป็นการสุ่มเล่นกี่ครั้ง — มากไปจะดื้อ น้อยไปก็ไม่ช่วยอะไร */
const PRIOR_WEIGHT = 10

// ---------- ลักษณะของตา สำหรับนโยบายที่เรียนน้ำหนักเอง ----------

/** รูปสี่ด้านรอบช่อง — แต่ละด้านเป็น ว่าง/ของเรา/ของเขา/นอกกระดาน รวมเป็นเลข 0–255 */
function patternAt(index: number, color: number): number {
  const foe = other(color)
  const row = (index / size) | 0
  const col = index % size
  let code = 0

  // เรียงบน-ขวา-ล่าง-ซ้าย เสมอ รูปเดียวกันจะได้เลขเดียวกันทุกครั้ง
  const sides: Array<[number, number]> = [
    [row - 1, col],
    [row, col + 1],
    [row + 1, col],
    [row, col - 1]
  ]

  for (const [r, c] of sides) {
    let value = 3
    if (r >= 0 && c >= 0 && r < size && c < size) {
      const cell = board[r * size + c]!
      value = cell === EMPTY ? 0 : cell === color ? 1 : cell === foe ? 2 : 0
    }
    code = code * 4 + value
  }

  return code
}

/** หมู่ของเราที่ติดช่องนี้ กำลังโดนอาตาริอยู่ไหม / หมู่ของเขาที่ติดช่องนี้ เหลือลมหายใจ 2 ไหม */
function aroundState(index: number, color: number): { saving: boolean; chasing: boolean } {
  const foe = other(color)
  let saving = false
  let chasing = false

  for (let k = nbStart[index]!; k < nbStart[index + 1]!; k++) {
    const next = nbList[k]!
    const cell = board[next]!
    if (cell === EMPTY) continue

    const libs = countLiberties(next)
    if (cell === color && libs === 1) saving = true
    if (cell === foe && libs <= 2) chasing = true
  }

  return { saving, chasing }
}

/** ลักษณะของตาหนึ่ง — ต้อง load กระดานไว้แล้ว และช่องนี้ต้องลงได้จริง */
export function featuresOf(index: number, color: number, last: number): Features {
  const scalars = new Float32Array(SCALAR_COUNT)
  const around = aroundState(index, color)

  keep()
  const captured = playFast(index, color)
  const libs = captured >= 0 ? countLiberties(index) : 0
  restore()

  scalars[0] = Math.min(1, captured > 0 ? captured / 3 : 0)
  scalars[1] = libs === 1 ? 1 : 0
  scalars[2] = libs >= 3 ? 1 : 0
  scalars[3] = around.saving && libs >= 2 ? 1 : 0
  scalars[4] = around.chasing ? 1 : 0

  if (last >= 0) {
    const distance =
      Math.abs(((index / size) | 0) - ((last / size) | 0)) + Math.abs((index % size) - (last % size))
    scalars[5] = distance <= 2 ? 1 : 0
    scalars[6] = distance <= 4 ? 1 : 0
  }

  const row = (index / size) | 0
  const col = index % size
  const edge = Math.min(row, col, size - 1 - row, size - 1 - col)
  scalars[7] = edge === 0 ? 1 : 0
  scalars[8] = edge === 1 ? 1 : 0
  scalars[9] = edge === 2 || edge === 3 ? 1 : 0

  return { pattern: patternAt(index, color), scalars }
}

/** ลักษณะของทุกตาที่ลงได้จากตำแหน่งนี้ — ใช้ตอนเรียนรู้ (ต้องรู้ค่าเฉลี่ยของตัวเลือกทั้งหมด) */
export function candidateFeatures(
  position: Position,
  color: Player,
  last: number | null
): Array<{ move: number; features: Features }> {
  load(position)
  const out: Array<{ move: number; features: Features }> = []
  for (const move of sensibleList(color)) {
    out.push({ move, features: featuresOf(move, color, last ?? -1) })
  }
  return out
}

/** น้ำหนักที่เรียนมา — ตั้งจากข้างนอกก่อนค้น ใช้ทั้งเป็นเครดิตล่วงหน้าและนโยบายตอนสุ่มเล่น */
let learnedWeights: Weights | null = null

/**
 * MCTS/UCT — วนสี่ขั้นซ้ำ ๆ จนหมดเวลา: เลือกกิ่ง → แตกกิ่งใหม่ → สุ่มเล่นจนจบ → เอาผลย้อนขึ้นไป
 * ตาที่ตอบคือกิ่งที่ถูกลองมากที่สุด ไม่ใช่กิ่งที่ชนะบ่อยที่สุด เพราะกิ่งที่ลองน้อยครั้งเชื่อไม่ได้
 */
export function uctMove(position: Position, color: Player, options: SearchOptions = {}): BotMove {
  const rounds = options.rounds ?? 2000
  const budget = options.budgetMs ?? 900
  // กระดานใหญ่ขึ้น หนึ่งรอบแพงขึ้นตามจำนวนช่อง จึงลดรอบขั้นต่ำลงตามส่วน
  const least = Math.round((options.minRounds ?? 0) * searchScale * (81 / (position.size * position.size)))
  const useRave = options.rave === true
  const smart = options.smart !== false
  const usePriors = options.priors === true
  const mercy = options.mercy === true
  const patient = options.patient === true
  learnedReplies = options.replies ?? null
  learnedWeights = options.weights ?? null

  load(position)
  const komi = position.komi
  const root = makeNode(-1)
  root.untried = sensibleList(color)
  if (root.untried.length === 0) return 'pass'
  root.children = []

  const deadline = Date.now() + budget
  // เพดานแข็ง: รอบขั้นต่ำต้องไม่ทำให้คิดนานจนเกมค้าง (กระดาน 19×19 หนึ่งรอบแพงมาก)
  const hardStop = Date.now() + budget * 2 + 200
  const path: Node[] = []
  const played: number[] = []

  for (let round = 0; round < rounds; round++) {
    if ((round & 15) === 0) {
      const now = Date.now()
      if (now > hardStop) break
      if (round >= least && now > deadline) break
    }

    load(position)
    let node = root
    let turn: number = color
    path.length = 0
    played.length = 0
    path.push(node)

    // 1) เลือกกิ่งลงไปเรื่อย ๆ ตราบใดที่กิ่งนี้แตกครบแล้ว
    while (node.untried !== null && node.untried.length === 0 && node.children && node.children.length > 0) {
      node = pickChild(node, useRave)
      playFast(node.move, turn)
      played.push(node.move)
      path.push(node)
      turn = other(turn)
    }

    // 2) แตกกิ่งใหม่หนึ่งกิ่ง
    if (node.untried === null) {
      node.untried = sensibleList(turn)
      node.children = []
    }
    if (node.untried.length > 0) {
      let pick = (random() * node.untried.length) | 0
      let prior = 0

      if (usePriors) {
        // แตกกิ่งที่ดูดีที่สุดก่อน แทนที่จะสุ่มหยิบ
        let bestPrior = -Infinity
        for (const [index, candidate] of node.untried.entries()) {
          const lastPlayed = played.length > 0 ? played[played.length - 1]! : -1
          const value = learnedWeights
            ? Math.tanh(scoreOf(learnedWeights, featuresOf(candidate, turn, lastPlayed)))
            : priorOf(candidate, turn, lastPlayed)
          if (value > bestPrior) {
            bestPrior = value
            pick = index
          }
        }
        prior = bestPrior
      }

      const move = node.untried.splice(pick, 1)[0]!
      playFast(move, turn)
      played.push(move)
      const child = makeNode(move)
      if (usePriors) {
        child.visits = PRIOR_WEIGHT
        child.wins = PRIOR_WEIGHT * (0.5 + 0.45 * prior)
      }
      node.children!.push(child)
      path.push(child)
      node = child
      turn = other(turn)
    }

    // 3) สุ่มเล่นจากตรงนั้นจนจบเกม
    const won = runPlayout(turn, komi, color, smart, mercy)

    // 4) เอาผลย้อนขึ้นไปทุกชั้นที่เดินผ่าน
    //
    // สถิติของกิ่งหนึ่งมองจากมุมของ "คนที่เดินตานั้น" เสมอ — กิ่งชั้น 1 คือตาของเรา
    // ชั้น 2 คือตาของอีกฝ่าย สลับกันไป ตอนเลือกกิ่งจึงเทียบอัตราชนะของคนที่ถึงตาได้ตรง ๆ
    for (const [depth, visited] of path.entries()) {
      visited.visits++
      const mine = depth % 2 === 1
      visited.wins += mine === won ? 1 : 0

      if (!useRave || !visited.children || visited.children.length === 0) continue
      if (!visited.raveVisits) {
        visited.raveVisits = new Float32Array(points)
        visited.raveWins = new Float32Array(points)
      }
      // RAVE: ตาที่ถูกเล่น "ที่ไหนก็ได้" ต่อจากจุดนี้ ก็เก็บสถิติให้กิ่งชื่อเดียวกัน
      // กิ่งของชั้นนี้เป็นตาของคนที่ถึงตาที่ชั้นนี้ ซึ่งสลับมุมกับตัวชั้นเอง
      const childIsMine = depth % 2 === 0
      const raveVisits = visited.raveVisits
      const raveWins = visited.raveWins!
      for (let i = depth; i < played.length; i += 2) {
        const move = played[i]!
        raveVisits[move]! += 1
        raveWins[move]! += childIsMine === won ? 1 : 0
      }
    }
  }

  learnedReplies = null
  learnedWeights = null

  if (!root.children || root.children.length === 0) return 'pass'

  let best = root.children[0]!
  for (const child of root.children) {
    if (child.visits > best.visits) best = child
  }

  if (patient) {
    // ตัวที่เล่นเอาชนะอย่างเดียว: ผ่านตาเฉพาะตอนที่ผ่านแล้วจบเกมโดยเรานำอยู่จริง ๆ
    // ตามหลังแล้วผ่านตาเท่ากับยกเกมให้เขา สู้ลงต่อแล้วรอให้เขาพลาดดีกว่า
    if (position.passes >= 1) {
      load(position)
      const lead = (areaLead() - komi) * (color === BLACK ? 1 : -1)
      if (lead > 0) return 'pass'
    }
  } else if (best.visits > 30 && best.wins / best.visits < 0.15) {
    // ทุกกิ่งดูแพ้หมด (ชนะไม่ถึง 15%) — ยอมผ่านตาดีกว่าลงให้เสียเปล่า
    return 'pass'
  }

  return { row: (best.move / size) | 0, col: best.move % size }
}

// ---------- บอทแบบกฎ ----------

/** ตาที่จับหมู่ของอีกฝ่ายที่เหลือลมหายใจเดียวได้ หรือหนีหมู่ของเราที่โดนจ่อ */
function captureOrEscape(color: number): number {
  const foe = other(color)
  let escape = -1

  for (let index = 0; index < points; index++) {
    const cell = board[index]!
    if (cell === EMPTY) continue
    if (countLiberties(index) !== 1) continue

    const count = groupStones(index)
    const stones = Array.from(group.subarray(0, count))
    for (const stone of stones) {
      for (let k = nbStart[stone]!; k < nbStart[stone + 1]!; k++) {
        const spot = nbList[k]!
        if (board[spot] !== EMPTY) continue

        keep()
        const ok = playFast(spot, color) >= 0
        const after = ok ? countLiberties(spot) : 0
        restore()
        if (!ok) continue

        // จับของอีกฝ่ายได้เลยทำก่อน ส่วนการหนีเก็บไว้เป็นตัวสำรอง (และต้องหนีแล้วรอด)
        if (cell === foe) return spot
        if (escape < 0 && after >= 2) escape = spot
      }
    }
  }

  return escape
}

/** ตาที่ดีที่สุดเมื่อวัดด้วยแผนที่อิทธิพล — ลองทีละตาแล้วประเมินกระดานที่ได้ */
function influenceMove(color: number): number {
  let best = -1
  let bestValue = -Infinity
  const sign = color === BLACK ? 1 : -1

  for (const move of sensibleList(color)) {
    keep()
    playFast(move, color)
    const value = influenceLead() * sign
    restore()

    // ต้นเกมชอบเส้นที่สามกับสี่มากกว่าริมกระดาน ตรงกับที่ตำราโกะสอน
    const row = (move / size) | 0
    const col = move % size
    const edge = Math.min(row, col, size - 1 - row, size - 1 - col)
    const bonus = edge === 0 ? -1.5 : edge === 1 ? -0.5 : edge <= 3 ? 0.5 : 0

    if (value + bonus > bestValue) {
      bestValue = value + bonus
      best = move
    }
  }

  return best
}

/** สุ่มเล่นจนจบแบบแบน — ลองทุกตา ตาละหลายครั้ง แล้วเลือกตาที่ชนะบ่อยที่สุด */
function flatMonteCarlo(position: Position, color: number, budgetMs: number, perMove: number): number {
  const moves = sensibleList(color)
  if (moves.length === 0) return -1

  const deadline = Date.now() + budgetMs
  let best = moves[0]!
  let bestRate = -1

  for (const move of moves) {
    let wins = 0
    let played = 0
    for (let i = 0; i < perMove; i++) {
      if ((i & 7) === 0 && Date.now() > deadline) break
      load(position)
      if (playFast(move, color) < 0) break
      if (runPlayout(other(color), position.komi, color, true)) wins++
      played++
    }

    const rate = played > 0 ? wins / played : 0
    if (rate > bestRate) {
      bestRate = rate
      best = move
    }
    if (Date.now() > deadline) break
  }

  return best
}

/** ตาสุ่มที่ถูกกติกาและไม่ถมตาตัวเอง */
function randomMove(color: number): number {
  shuffleOrder()
  for (let i = 0; i < points; i++) {
    const spot = order[i]!
    if (board[spot] !== EMPTY || isEyeFast(spot, color)) continue
    keep()
    const ok = playFast(spot, color) >= 0
    restore()
    if (ok) return spot
  }
  return -1
}

/** ตาที่อยู่ติดกับตาที่อีกฝ่ายเพิ่งลง — "ตอบที่เดิม" แบบที่มือใหม่ถูกสอนให้ทำ */
function localMove(last: number, color: number): number {
  if (last < 0) return -1
  const spots: number[] = []

  for (let k = nbStart[last]!; k < nbStart[last + 1]!; k++) {
    const spot = nbList[k]!
    if (board[spot] !== EMPTY || isEyeFast(spot, color)) continue
    keep()
    const ok = playFast(spot, color) >= 0
    restore()
    if (ok) spots.push(spot)
  }

  return spots.length > 0 ? spots[(random() * spots.length) | 0]! : -1
}

// ---------- รวมเป็นบอทแต่ละตัว ----------

interface Recipe {
  /** ใช้กฎง่าย ๆ ตามลำดับ (จับ/หนี → ตอบใกล้ ๆ → แพทเทิร์น → อิทธิพล → สุ่ม) */
  capture?: boolean
  local?: boolean
  pattern?: boolean
  influence?: boolean
  /** สุ่มเล่นจนจบแบบแบน กี่ครั้งต่อหนึ่งตา */
  flat?: number
  /** ค้นแบบ MCTS กี่รอบ */
  uct?: number
  /** ค้นอย่างน้อยกี่รอบ ถึงจะยอมหยุดเพราะหมดเวลา */
  minRounds?: number
  /** ใส่ความรู้เรื่องโกะให้กิ่งใหม่ */
  priors?: boolean
  /** หยุดสุ่มเล่นเมื่อผลขาดแล้ว */
  mercy?: boolean
  /** ไม่ผ่านตาทิ้งเกม */
  patient?: boolean
  rave?: boolean
  smartPlayout?: boolean
  /** ใช้เวลาคิดได้กี่ส่วนของโควตา */
  share?: number
  /**
   * โอกาสที่จะ "เผลอ" ลงมั่วแทนตาที่คิดมาแล้ว — ใช้ไล่ระดับความเก่งให้ห่างกันจริง
   * ระดับอ่อนจะพลาดบ่อย ระดับเก่งแทบไม่พลาด ซึ่งตรงกับคนเล่นจริงที่ต่างกันหลายคิว
   */
  blunder?: number
}

/**
 * บันไดความเก่ง 9 คิว → 1 คิว
 * แต่ละขั้นเพิ่มความคิดขึ้นหนึ่งอย่างจากขั้นก่อนหน้า จะได้เห็นว่าอะไรทำให้เก่งขึ้น
 */
const RECIPES: Record<BotKind, Recipe> = {
  // 9–6 คิว: เล่นด้วยกฎล้วน ๆ เพิ่มความคิดทีละอย่าง และเผลอน้อยลงทีละขั้น
  kyu9: {},
  kyu8: { capture: true, blunder: 0.4 },
  kyu7: { capture: true, local: true, pattern: true, blunder: 0.25 },
  kyu6: { capture: true, pattern: true, influence: true, blunder: 0.12 },
  // 5–1 คิว: ค้นแบบ MCTS เหมือนกันหมด ต่างกันที่ "ได้คิดนานแค่ไหน" กับ "เผลอบ่อยแค่ไหน"
  // ใช้สองปุ่มนี้เป็นตัวไล่ระดับ เพราะเวลาคิดคือตัวแปรที่ทำให้โปรแกรมโกะเก่งขึ้นจริง ๆ
  kyu5: { uct: 100000, smartPlayout: true, blunder: 0.15, share: 0.12, minRounds: 300 },
  kyu4: { uct: 100000, smartPlayout: true, blunder: 0.08, share: 0.22, minRounds: 600 },
  kyu3: { uct: 100000, smartPlayout: true, blunder: 0.04, share: 0.4, minRounds: 1200 },
  kyu2: { uct: 100000, smartPlayout: true, blunder: 0.01, share: 0.65, minRounds: 2400 },
  kyu1: { uct: 100000, smartPlayout: true, rave: true, share: 1, minRounds: 4000 },

  random: {},
  capture: { capture: true },
  pattern: { capture: true, local: true, pattern: true },
  influence: { capture: true, pattern: true, influence: true },
  montecarlo: { capture: true, flat: 30, share: 0.8 },
  uct: { uct: 100000, smartPlayout: true, share: 0.9 },
  // โหมดโหด — ทุกอย่างที่มีเปิดหมด: RAVE + ความรู้เรื่องโกะนำทางการค้น + สุ่มเล่นแบบหยุดเร็ว
  // และไม่ยอมผ่านตาทิ้งเกม ใช้เวลาคิดเต็มโควตาทุกตา
  ruthless: {
    uct: 200000,
    smartPlayout: true,
    rave: true,
    priors: true,
    mercy: true,
    patient: true,
    share: 1,
    minRounds: 6000
  },
  rave: { uct: 100000, smartPlayout: true, rave: true, share: 1 }
}

/** ตาที่บอทตัวนั้นเลือก — last คือช่องที่อีกฝ่ายเพิ่งลง (ถ้ามี) */
export function botMove(
  kind: BotKind,
  position: Position,
  color: Player,
  budgetMs = 900,
  last?: number | null
): BotMove {
  const recipe = RECIPES[kind] ?? RECIPES.kyu9
  const budget = Math.max(5, budgetMs * (recipe.share ?? 1))

  // เผลอลงมั่ว — ตัดสินใจก่อนคิด จะได้ไม่เสียเวลาคิดแล้วทิ้ง
  if (recipe.blunder && random() < recipe.blunder) {
    load(position)
    const slip = randomMove(color)
    if (slip >= 0) return { row: (slip / size) | 0, col: slip % size }
  }

  if (recipe.uct) {
    return uctMove(position, color, {
      rounds: recipe.uct,
      budgetMs: budget,
      minRounds: recipe.minRounds,
      rave: recipe.rave,
      smart: recipe.smartPlayout,
      priors: recipe.priors,
      mercy: recipe.mercy,
      patient: recipe.patient
    })
  }

  load(position)

  if (recipe.flat) {
    const spot = flatMonteCarlo(position, color, budget, recipe.flat)
    return spot < 0 ? 'pass' : { row: (spot / size) | 0, col: spot % size }
  }

  const lastIndex = last ?? -1
  let spot = -1

  if (recipe.capture) spot = captureOrEscape(color)
  if (spot < 0 && recipe.pattern) spot = patternAnswer(lastIndex, color)
  if (spot < 0 && recipe.local && random() < 0.7) spot = localMove(lastIndex, color)
  if (spot < 0 && recipe.influence) spot = influenceMove(color)
  if (spot < 0) spot = randomMove(color)

  if (spot < 0) return 'pass'

  // กันพลาด: ตาที่เลือกต้องลงได้จริง
  load(position)
  if (playFast(spot, color) < 0) {
    load(position)
    const fallback = randomMove(color)
    return fallback < 0 ? 'pass' : { row: (fallback / size) | 0, col: fallback % size }
  }

  return { row: (spot / size) | 0, col: spot % size }
}
