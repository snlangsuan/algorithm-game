/**
 * ฝูงนกหาค่าที่ดีที่สุด — Particle Swarm Optimization (Kennedy & Eberhart, 1995)
 *
 * นกหนึ่งตัวคือชุดค่าหนึ่งชุด เช่นกำลังมอเตอร์ Kp และ Kd ของตัวควบคุม PD ในเกมเดินตามเส้น
 * หรือจังหวะกระโดดกับจังหวะหมอบในเกมวิ่งหลบ — ชุดของค่าส่งมาเป็น space
 * หนึ่งรอบวิ่งคือนกหนึ่งตัวได้ลองบินไปจุดใหม่หนึ่งก้าวแล้วรับคะแนน (ยิ่งน้อยยิ่งดี)
 * นกแต่ละตัวจำจุดที่ดีที่สุดของตัวเองไว้ และทั้งฝูงรู้จุดที่ดีที่สุดที่เคยมีใครเจอ
 * ก้าวต่อไปจึงถูกดึงเข้าหาทั้งสองจุด บวกแรงเฉื่อยจากก้าวเดิม
 *
 * ไฟล์นี้ไม่รู้จักเกม ไม่รู้จัก worker และรับตัวสุ่มจากข้างนอก เทสต์จะได้ใส่เมล็ดสุ่มตายตัวได้
 */

export type Dimension = 'power' | 'kp' | 'kd'

/** ขอบเขตของค่าหนึ่งค่าที่ฝูงหา — แต่ละเกมมีชุดของตัวเอง */
export interface Range<Key extends string = string> {
  key: Key
  label: string
  min: number
  max: number
}

/** ขอบเขตที่นกบินได้ในเกมเดินตามเส้น — กว้างพอที่ค่าสุ่มตอนเริ่มจะมีทั้งตัวที่หลุดเส้นและตัวที่วิ่งช้า */
export const DIMENSIONS: ReadonlyArray<Range<Dimension>> = [
  { key: 'power', label: 'กำลัง', min: 40, max: 100 },
  { key: 'kp', label: 'Kp', min: 0, max: 2 },
  { key: 'kd', label: 'Kd', min: 0, max: 10 }
]

/** จำนวนนกในฝูง — น้อยพอที่ทุกตัวได้บินหลายก้าวภายในการฝึกร้อยรอบ */
export const BIRDS = 6

/** แรงเฉื่อย — ก้าวใหม่ยังไปทางเดิมอยู่เท่าไร */
export const INERTIA = 0.6

/** แรงดึงเข้าหาจุดดีที่สุดของตัวเอง กับของทั้งฝูง */
export const SELF_PULL = 1.5

export const FLOCK_PULL = 1.5

export interface Bird {
  at: number[]
  speed: number[]
  /** จุดที่ดีที่สุดที่ตัวนี้เคยไป — ยังไม่เคยได้คะแนนเลยเป็น null */
  best: number[] | null
  bestScore: number | null
}

export interface Swarm {
  birds: Bird[]
  /** จุดที่ดีที่สุดที่ทั้งฝูงเคยเจอ */
  best: number[] | null
  bestScore: number | null
  /** บินไปแล้วกี่ก้าวทั้งฝูง */
  turn: number
  /** ตัวที่กำลังลองอยู่รอบนี้ */
  current: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const isNumbers = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number' && Number.isFinite(item))

/** อ่านฝูงจากความจำ — ของเสียหรือรูปร่างไม่ตรงถือว่ายังไม่มีฝูง */
export function readSwarm(raw: unknown, space: ReadonlyArray<Range> = DIMENSIONS): Swarm | null {
  if (typeof raw !== 'object' || raw === null) return null
  const swarm = raw as Swarm
  const size = space.length

  if (!Array.isArray(swarm.birds) || swarm.birds.length !== BIRDS) return null
  for (const bird of swarm.birds) {
    if (!isNumbers(bird?.at, size) || !isNumbers(bird.speed, size)) return null
    if (bird.best !== null && !isNumbers(bird.best, size)) return null
    if (bird.bestScore !== null && typeof bird.bestScore !== 'number') return null
  }
  if (swarm.best !== null && !isNumbers(swarm.best, size)) return null
  if (!Number.isInteger(swarm.turn) || !Number.isInteger(swarm.current)) return null

  return swarm
}

function hatch(random: () => number, space: ReadonlyArray<Range>): Swarm {
  return {
    birds: Array.from({ length: BIRDS }, () => ({
      at: space.map(({ min, max }) => min + random() * (max - min)),
      speed: space.map(() => 0),
      best: null,
      bestScore: null
    })),
    best: null,
    bestScore: null,
    turn: 0,
    current: 0
  }
}

/**
 * นกตัวถัดไปบินหนึ่งก้าว — คืนฝูงใหม่ ไม่แก้ของเดิม
 *
 * ตัวที่ยังไม่เคยได้คะแนนอยู่ที่จุดสุ่มตอนเกิดไปก่อน จะได้รู้ว่าจุดนั้นดีแค่ไหน
 * ตัวที่เคยได้แล้วบินตามสูตรของ PSO:
 *   ความเร็วใหม่ = แรงเฉื่อย × ความเร็วเดิม + ดึงเข้าหาจุดดีสุดของตัวเอง + ดึงเข้าหาจุดดีสุดของฝูง
 */
export function fly(previous: Swarm | null, random: () => number, space: ReadonlyArray<Range> = DIMENSIONS): Swarm {
  const swarm: Swarm = previous ? structuredClone(previous) : hatch(random, space)
  const current = swarm.turn % BIRDS
  const bird = swarm.birds[current]!

  if (bird.best && swarm.best) {
    space.forEach(({ min, max }, d) => {
      const toSelf = SELF_PULL * random() * (bird.best![d]! - bird.at[d]!)
      const toFlock = FLOCK_PULL * random() * (swarm.best![d]! - bird.at[d]!)
      bird.speed[d] = INERTIA * bird.speed[d]! + toSelf + toFlock
      bird.at[d] = clamp(bird.at[d]! + bird.speed[d]!, min, max)
    })
  }

  swarm.current = current
  swarm.turn++
  return swarm
}

/** ให้คะแนนตัวที่เพิ่งลอง — ยิ่งน้อยยิ่งดี ดีกว่าที่เคยก็จำจุดนี้ไว้ */
export function score(previous: Swarm, value: number): Swarm {
  const swarm = structuredClone(previous)
  const bird = swarm.birds[swarm.current]!
  if (!Number.isFinite(value)) return swarm

  if (bird.bestScore === null || value < bird.bestScore) {
    bird.best = [...bird.at]
    bird.bestScore = value
  }

  if (swarm.bestScore === null || value < swarm.bestScore) {
    swarm.best = [...bird.at]
    swarm.bestScore = value
  }

  return swarm
}

/** ค่าหนึ่งมิติของจุด — เรียกด้วยชื่อแทนตำแหน่งในลิสต์ */
export const valueOf = (point: number[], dimension: string, space: ReadonlyArray<Range> = DIMENSIONS): number =>
  point[space.findIndex((item) => item.key === dimension)] ?? 0
