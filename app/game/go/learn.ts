import { BLACK, WHITE, type Player, type Position } from './engine'

/**
 * บอทที่ "ยิ่งเล่นยิ่งเก่ง" — เก็บสิ่งที่ได้จากเกมก่อน ๆ ไว้ในความจำ แล้วเอามาใช้เกมถัดไป
 *
 * จำสองอย่าง ซึ่งเป็นสองวิธีที่โปรแกรมโกะใช้กันจริง:
 *
 * 1. ตำราเปิดหมาก (opening book) — ช่วงต้นเกมกระดานยังซ้ำกันบ่อย จดไว้ว่าจากกระดานหน้าตานี้
 *    เคยลงตาไหนแล้วจบเกมด้วยการชนะกี่ครั้งจากกี่ครั้ง เจอกระดานเดิมอีกก็หยิบตาที่สถิติดีที่สุดมาใช้เลย
 *    ไม่ต้องเสียเวลาค้นใหม่ และไม่พลาดซ้ำรอยเดิม
 *
 * 2. ตาตอบที่เคยได้ผล (Last Good Reply) — จดว่า "พอเขาลงตรงนี้ เราตอบตรงไหนแล้วชนะ"
 *    แล้วเอาไปใช้ตอนสุ่มเล่นใน MCTS ทำให้การสุ่มเล่นดูเหมือนเกมจริงขึ้น ผลที่ได้จึงเชื่อถือได้กว่า
 *    (แนวคิดจาก Drake 2009 และ LGRF ของ Baier & Drake 2010 — แพ้เมื่อไรก็ลืมตาตอบนั้นทิ้ง)
 *
 * ความจำถูกเก็บเป็น JSON ธรรมดาผ่าน saveMemory() ของเกม จึงอยู่ข้ามเกมและข้ามการปิดหน้าเว็บ
 */

export interface Brain {
  /** ขนาดกระดานที่เรียนมา — เปลี่ยนขนาดแล้วของเก่าใช้ไม่ได้ ต้องเริ่มใหม่ */
  size: number
  /** เล่นมาแล้วกี่เกม */
  games: number
  wins: number
  /**
   * ตำราเปิดหมาก: รหัสกระดาน → สถิติของแต่ละตา เก็บเป็น [ตา, จำนวนครั้งที่ลง, จำนวนครั้งที่ชนะ] เรียงต่อกัน
   * เก็บเป็นอาร์เรย์แบนเพื่อให้ JSON เล็กที่สุด (ความจำมีเพดาน 256 KB)
   */
  book: Record<string, number[]>
  /** ตาตอบที่เคยพาไปชนะ — replies[ตาของอีกฝ่าย] = ตาที่เราตอบ (−1 คือยังไม่มี) */
  replies: number[]
}

/** ตำราเปิดหมากจดถึงตาที่เท่าไร — ลึกกว่านี้กระดานแทบไม่ซ้ำกันแล้ว จดไปก็เปลืองที่ */
export const BOOK_DEPTH = 20

/** จำนวนกระดานที่จดไว้ได้มากที่สุด — เกินนี้ตัดกระดานที่เจอน้อยที่สุดทิ้ง */
const BOOK_LIMIT = 3000

/** ต้องเคยลองตานี้กี่ครั้ง ถึงจะเชื่อสถิติมันพอจะหยิบมาใช้แทนการค้น */
const TRUST_AFTER = 3

export const emptyBrain = (size: number): Brain => ({
  size,
  games: 0,
  wins: 0,
  book: {},
  replies: new Array<number>(size * size).fill(-1)
})

/** อ่านความจำที่เก็บไว้ — รูปร่างไม่ตรงหรือคนละขนาดกระดานก็เริ่มใหม่ */
export function readBrain(raw: unknown, size: number): Brain {
  if (!raw || typeof raw !== 'object') return emptyBrain(size)
  const box = raw as Partial<Brain>

  if (box.size !== size || typeof box.games !== 'number' || !box.book || typeof box.book !== 'object') {
    return emptyBrain(size)
  }

  const replies = Array.isArray(box.replies) && box.replies.length === size * size
    ? box.replies.map((value) => (Number.isInteger(value) ? (value as number) : -1))
    : new Array<number>(size * size).fill(-1)

  return {
    size,
    games: box.games,
    wins: typeof box.wins === 'number' ? box.wins : 0,
    book: box.book as Record<string, number[]>,
    replies
  }
}

/**
 * รหัสประจำกระดาน — ย่อทั้งกระดานกับตาของใครให้เหลือสตริงสั้น ๆ
 * ใช้วิธีคูณ-แล้ว-XOR (FNV) ซึ่งเร็วและกระจายดีพอสำหรับตำราเปิดหมากขนาดนี้
 */
export function signature(position: Position): string {
  let hash = 0x811c9dc5
  for (const cell of position.board) {
    hash ^= cell
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= position.toPlay
  hash = Math.imul(hash, 0x01000193)
  return (hash >>> 0).toString(36)
}

/** สถิติของตาหนึ่งในตำรา — [จำนวนครั้งที่ลง, จำนวนครั้งที่ชนะ] */
function statsOf(row: number[], move: number): { at: number; plays: number; wins: number } | null {
  for (let at = 0; at < row.length; at += 3) {
    if (row[at] === move) return { at, plays: row[at + 1]!, wins: row[at + 2]! }
  }
  return null
}

/**
 * ตาที่ตำราแนะนำสำหรับกระดานนี้ — ยังไม่มีข้อมูลพอก็คืน null แล้วปล่อยให้ค้นเอง
 *
 * เลือกจากอัตราชนะ แต่ต้องเคยลองมาแล้วอย่างน้อย TRUST_AFTER ครั้ง
 * และต้องชนะเกินครึ่ง ไม่งั้นค้นใหม่ดีกว่าเดินตามตาที่เคยแพ้
 */
export function bookMove(brain: Brain, position: Position): number | null {
  if (position.turn > BOOK_DEPTH) return null

  const row = brain.book[signature(position)]
  if (!row) return null

  let best = -1
  let bestRate = 0.5

  for (let at = 0; at < row.length; at += 3) {
    const plays = row[at + 1]!
    if (plays < TRUST_AFTER) continue

    const rate = row[at + 2]! / plays
    if (rate > bestRate) {
      bestRate = rate
      best = row[at]!
    }
  }

  return best >= 0 ? best : null
}

/** ตาของเราในเกมหนึ่ง คู่กับกระดานตอนนั้น — ใช้ตอนจบเกมเพื่ออัปเดตความจำ */
export interface PlayedMove {
  /** รหัสกระดานก่อนเราลง (null = ลึกเกินตำรา ไม่ต้องจด) */
  key: string | null
  /** ตาที่เราลง */
  move: number
  /** ตาที่อีกฝ่ายลงก่อนหน้านั้น (−1 = ไม่มี) */
  answering: number
}

/**
 * จบเกมแล้วเก็บบทเรียน — ชนะก็จดว่าตานี้ใช้ได้ แพ้ก็จดว่าเคยลองแล้วไม่เวิร์ก
 *
 * ตำราเก็บทั้งแพ้และชนะ เพราะ "เคยลองแล้วแพ้ 3 ครั้ง" มีค่าพอ ๆ กับ "เคยลองแล้วชนะ"
 * ส่วนตาตอบเก็บเฉพาะตอนชนะ และลบทิ้งเมื่อแพ้ (LGRF) ไม่งั้นมันจะยึดติดกับตาที่พาไปแพ้
 */
export function learnFrom(brain: Brain, played: PlayedMove[], won: boolean): Brain {
  const book = { ...brain.book }
  const replies = [...brain.replies]

  for (const step of played) {
    if (step.key) {
      const row = book[step.key] ? [...book[step.key]!] : []
      const found = statsOf(row, step.move)

      if (found) {
        row[found.at + 1] = found.plays + 1
        row[found.at + 2] = found.wins + (won ? 1 : 0)
      } else {
        row.push(step.move, 1, won ? 1 : 0)
      }

      book[step.key] = row
    }

    if (step.answering >= 0 && step.answering < replies.length) {
      replies[step.answering] = won ? step.move : -1
    }
  }

  return {
    size: brain.size,
    games: brain.games + 1,
    wins: brain.wins + (won ? 1 : 0),
    book: prune(book),
    replies
  }
}

/** ตัดกระดานที่เจอน้อยที่สุดทิ้งเมื่อตำราใหญ่เกินเพดาน — ความจำมีขนาดจำกัด */
function prune(book: Record<string, number[]>): Record<string, number[]> {
  const keys = Object.keys(book)
  if (keys.length <= BOOK_LIMIT) return book

  const weight = (row: number[]) => {
    let total = 0
    for (let at = 1; at < row.length; at += 3) total += row[at]!
    return total
  }

  const kept = keys
    .map((key) => ({ key, seen: weight(book[key]!) }))
    .sort((a, b) => b.seen - a.seen)
    .slice(0, BOOK_LIMIT)

  const out: Record<string, number[]> = {}
  for (const item of kept) out[item.key] = book[item.key]!
  return out
}

/** สรุปสั้น ๆ ให้โชว์บนการ์ดความจำในหน้าเกม */
export const brainLabel = (brain: Brain): string =>
  `เล่นมา ${brain.games} เกม ชนะ ${brain.wins} · จำกระดานเปิดได้ ${Object.keys(brain.book).length} แบบ`

/** ฝ่ายที่กำลังคิดเป็นสีอะไร แปลงเป็นชื่อไว้เก็บแยกความจำของแต่ละสี */
export const sideKey = (player: Player): string => (player === BLACK ? 'black' : player === WHITE ? 'white' : 'other')
