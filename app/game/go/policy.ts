/**
 * นโยบายที่เรียนน้ำหนักเอง (reinforcement learning แบบ policy gradient)
 *
 * ต่างจากตัว "ยิ่งเล่นยิ่งเก่ง" ที่จำเป็นกระดาน ๆ ไป — ตัวนี้เรียนเป็น "น้ำหนักของลักษณะ"
 * เช่น "ตาที่จับหมากได้ดีแค่ไหน" หรือ "ลงแล้วตัวเองเหลือลมหายใจเดียวแย่แค่ไหน"
 * พอเรียนเป็นน้ำหนัก ความรู้จึงใช้กับกระดานที่ไม่เคยเจอได้ และข้ามขนาดกระดานได้ด้วย
 *
 * วิธีเรียนคือ REINFORCE: จบเกมแล้วดูผลแพ้ชนะ (รางวัล R = +1 ชนะ, −1 แพ้)
 * แล้วดันน้ำหนักของลักษณะที่ "ตาที่เราเลือกมีมากกว่าค่าเฉลี่ยของตาที่เลือกได้" ไปตามทิศของรางวัล
 *
 *   w ← w + α · (R − b) · Σ_t [ φ(ตาที่เลือก) − ค่าเฉลี่ย φ ของตาที่เลือกได้ ]
 *
 * b คือค่าเฉลี่ยรางวัลที่ผ่านมา (baseline) มีไว้ลดความแกว่ง — เป็นสูตรมาตรฐานของ policy gradient
 */

/** ลักษณะของตาหนึ่งตา: รูป 4 ด้านรอบช่อง (หนึ่งในสองร้อยห้าสิบหกแบบ) + ตัวเลขอีกสิบตัว */
export const PATTERN_COUNT = 256
export const SCALAR_COUNT = 10

/** ชื่อของตัวเลขแต่ละตัว — ใช้ในการ์ดอธิบายและตอนดีบัก */
export const SCALAR_LABELS = [
  'จับหมากได้',
  'ลงแล้วเหลือลมหายใจเดียว',
  'ลงแล้วเหลือลมหายใจ 3 เส้นขึ้นไป',
  'ช่วยหมู่ตัวเองที่โดนอาตาริ',
  'ไล่หมู่เขาให้เหลือลมหายใจเดียว',
  'ห่างตาที่เขาเพิ่งลงไม่เกิน 2',
  'ห่างตาที่เขาเพิ่งลงไม่เกิน 4',
  'อยู่เส้นแรก',
  'อยู่เส้นที่สอง',
  'อยู่เส้นที่สามหรือสี่'
] as const

export interface Features {
  /** รูป 4 ด้านรอบช่อง 0–255 */
  pattern: number
  /** ตัวเลขประจำตา ความยาว SCALAR_COUNT */
  scalars: Float32Array
}

export interface Weights {
  /** น้ำหนักของแต่ละรูป */
  pattern: Float32Array
  /** น้ำหนักของตัวเลขแต่ละตัว */
  scalar: Float32Array
  /** ฝึกมาแล้วกี่เกม */
  games: number
  /** ค่าเฉลี่ยรางวัลที่ผ่านมา — baseline ของ policy gradient */
  baseline: number
}

/** อัตราการเรียนรู้ — ใหญ่ไปน้ำหนักแกว่งจนพัง เล็กไปก็ไม่ขยับสักที */
export const LEARNING_RATE = 0.02

export const emptyWeights = (): Weights => ({
  pattern: new Float32Array(PATTERN_COUNT),
  scalar: new Float32Array(SCALAR_COUNT),
  games: 0,
  baseline: 0
})

/** คะแนนของตาหนึ่ง = น้ำหนักของรูป + ผลรวมของน้ำหนักคูณตัวเลข */
export function scoreOf(weights: Weights, features: Features): number {
  let total = weights.pattern[features.pattern] ?? 0
  for (let index = 0; index < SCALAR_COUNT; index++) {
    total += (weights.scalar[index] ?? 0) * (features.scalars[index] ?? 0)
  }
  return total
}

/**
 * ทิศที่น้ำหนักควรขยับของการตัดสินใจหนึ่งครั้ง — สะสมไว้ทั้งเกมแล้วค่อยใช้ตอนจบ
 * (φ ของตาที่เลือก ลบด้วยค่าเฉลี่ย φ ของตาที่เลือกได้ทั้งหมด)
 */
export interface Gradient {
  pattern: Float32Array
  scalar: Float32Array
  /** ตัดสินใจไปแล้วกี่ครั้งในเกมนี้ */
  steps: number
}

export const emptyGradient = (): Gradient => ({
  pattern: new Float32Array(PATTERN_COUNT),
  scalar: new Float32Array(SCALAR_COUNT),
  steps: 0
})

/** บวกการตัดสินใจหนึ่งครั้งเข้าไปในทิศที่สะสมไว้ */
export function addChoice(gradient: Gradient, chosen: Features, candidates: Features[]): void {
  if (candidates.length === 0) return

  gradient.pattern[chosen.pattern]! += 1
  for (let index = 0; index < SCALAR_COUNT; index++) {
    gradient.scalar[index]! += chosen.scalars[index] ?? 0
  }

  const share = 1 / candidates.length
  for (const candidate of candidates) {
    gradient.pattern[candidate.pattern]! -= share
    for (let index = 0; index < SCALAR_COUNT; index++) {
      gradient.scalar[index]! -= share * (candidate.scalars[index] ?? 0)
    }
  }

  gradient.steps++
}

/**
 * จบเกมแล้วปรับน้ำหนักหนึ่งครั้ง — ชนะดันทิศที่สะสมไว้ขึ้น แพ้ก็ดึงลง
 * หารด้วยจำนวนตาที่ตัดสินใจ เกมยาวกับเกมสั้นจะได้มีน้ำหนักเท่า ๆ กัน
 */
export function learnWeights(weights: Weights, gradient: Gradient, won: boolean): Weights {
  if (gradient.steps === 0) return weights

  const reward = won ? 1 : -1
  const advantage = reward - weights.baseline
  const step = (LEARNING_RATE * advantage) / gradient.steps

  const pattern = Float32Array.from(weights.pattern)
  const scalar = Float32Array.from(weights.scalar)

  for (let index = 0; index < PATTERN_COUNT; index++) pattern[index]! += step * gradient.pattern[index]!
  for (let index = 0; index < SCALAR_COUNT; index++) scalar[index]! += step * gradient.scalar[index]!

  const games = weights.games + 1
  return {
    pattern,
    scalar,
    games,
    // baseline คือค่าเฉลี่ยรางวัลแบบวิ่ง — ขยับเข้าหารางวัลล่าสุดทีละนิด
    baseline: weights.baseline + (reward - weights.baseline) / Math.min(games, 50)
  }
}

/** แปลงน้ำหนักเป็นของที่เก็บลง JSON ได้ (ความจำของเกมเก็บได้แต่ของธรรมดา) */
export const packWeights = (weights: Weights) => ({
  pattern: Array.from(weights.pattern, (value) => Math.round(value * 1e4) / 1e4),
  scalar: Array.from(weights.scalar, (value) => Math.round(value * 1e4) / 1e4),
  games: weights.games,
  baseline: Math.round(weights.baseline * 1e4) / 1e4
})

/** อ่านน้ำหนักที่เก็บไว้ — รูปร่างไม่ตรงก็เริ่มจากศูนย์ */
export function readWeights(raw: unknown): Weights {
  if (!raw || typeof raw !== 'object') return emptyWeights()
  const box = raw as { pattern?: unknown; scalar?: unknown; games?: unknown; baseline?: unknown }

  if (!Array.isArray(box.pattern) || box.pattern.length !== PATTERN_COUNT) return emptyWeights()
  if (!Array.isArray(box.scalar) || box.scalar.length !== SCALAR_COUNT) return emptyWeights()

  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

  return {
    pattern: Float32Array.from(box.pattern.map(number)),
    scalar: Float32Array.from(box.scalar.map(number)),
    games: typeof box.games === 'number' ? box.games : 0,
    baseline: number(box.baseline)
  }
}

/** สรุปสั้น ๆ ให้โชว์บนการ์ดความจำ — บอกด้วยว่าตอนนี้มันให้ค่าอะไรมากที่สุด */
export function weightsLabel(weights: Weights): string {
  let best = 0
  let bestValue = -Infinity
  let worst = 0
  let worstValue = Infinity

  for (let index = 0; index < SCALAR_COUNT; index++) {
    const value = weights.scalar[index]!
    if (value > bestValue) {
      bestValue = value
      best = index
    }
    if (value < worstValue) {
      worstValue = value
      worst = index
    }
  }

  if (weights.games === 0) return 'ยังไม่ได้ฝึกเลย'
  return `ฝึกมา ${weights.games} เกม · ชอบ "${SCALAR_LABELS[best]}" ที่สุด · เลี่ยง "${SCALAR_LABELS[worst]}" ที่สุด`
}
