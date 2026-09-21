/**
 * สนามของหุ่นเดินตามเส้น — กติกาล้วน ๆ ไม่รู้จักหน้าจอและไม่รู้จัก AI
 *
 * หุ่นเป็นแบบสองล้อขับแยกกัน (differential drive) เหมือนหุ่นแข่งเดินตามเส้นจริง
 * ไม่มีพวงมาลัย เลี้ยวได้ด้วยการให้ล้อสองข้างหมุนเร็วไม่เท่ากันเท่านั้น
 * ใต้ท้องมีเซนเซอร์แสงห้าตัวเรียงเป็นแถวขวาง อ่านได้ว่าตรงนั้นเป็นเส้นดำหรือพื้นขาว
 *
 * มอเตอร์ไม่ได้เปลี่ยนความเร็วทันทีที่สั่ง — มันค่อย ๆ ไล่ตามคำสั่ง (MOTOR_LAG)
 * นี่คือสิ่งที่ทำให้หุ่นส่ายเลยเส้นไปมา และเป็นเหตุผลที่ตัวควบคุมแบบ PID มีอยู่
 *
 * ทุกอย่างวัดเป็นพิกเซลกับวินาที เวลาในเกมเดินเป็นก้าวคงที่ และถามสมองทุก ๆ กี่เฟรมก็ตายตัว
 * สนามไม่มีการสุ่มเลย โปรแกรมเดิมบนสนามเดิมจึงได้เวลาเดิมเป๊ะทุกครั้ง
 */

export interface Point {
  x: number
  y: number
}

/** หนึ่งเฟรมของฟิสิกส์กินเวลากี่วินาที */
export const STEP = 1 / 60

/** ถามสมองทุกกี่เฟรม — 2 เฟรมคือ 30 ครั้งต่อวินาที */
export const DECIDE_EVERY = 2

/** ช่วงเวลาระหว่างการตัดสินใจสองครั้ง (วินาที) */
export const DECIDE_STEP = STEP * DECIDE_EVERY

/** ขนาดของสนามทั้งผืน (พิกเซล) */
export const VIEW = { width: 960, height: 600 } as const

/** ระยะห่างระหว่างล้อซ้ายกับล้อขวา — ยิ่งห่าง ยิ่งเลี้ยวช้าเมื่อล้อต่างกันเท่าเดิม */
export const WHEEL_BASE = 30

/** มอเตอร์ 100% หมุนล้อได้เร็วกี่พิกเซลต่อวินาที */
export const MAX_WHEEL = 300

/** มอเตอร์ไล่ตามคำสั่งช้าแค่ไหน (วินาที) — ผ่านไปเท่านี้จะไปได้ราวสองในสามของทางที่สั่ง */
export const MOTOR_LAG = 0.12

/** แถวเซนเซอร์อยู่หน้าแกนล้อกี่พิกเซล */
export const SENSOR_AHEAD = 26

/** เซนเซอร์แต่ละตัวห่างกันกี่พิกเซล */
export const SENSOR_GAP = 8

/** ชื่อเซนเซอร์เรียงจากซ้ายไปขวาของตัวหุ่น — ลำดับตรงกับตัวเลขที่โปรแกรมใช้ */
export const SENSOR_LABEL = ['ซ้ายสุด', 'ซ้าย', 'กลาง', 'ขวา', 'ขวาสุด'] as const

export const SENSOR_COUNT = SENSOR_LABEL.length

/** เส้นดำกว้างกี่พิกเซล */
export const LINE_WIDTH = 12

/**
 * ขอบเส้นไม่ได้คมกริบในสายตาของเซนเซอร์ — มันมองเห็นเป็นวงเล็ก ๆ ไม่ใช่จุด
 * ค่าที่อ่านได้จึงค่อย ๆ ลดจากเต็มไปศูนย์ในช่วงกว้างเท่านี้รอบขอบเส้น
 */
export const SENSOR_BLUR = 3

/** ค่าที่อ่านได้ตั้งแต่เท่านี้ขึ้นไป ถือว่า "เห็นเส้น" (เต็ม 100) */
export const SEE_THRESHOLD = 50

/** ตัวหุ่นห่างจากเส้นเกินเท่านี้ ถือว่าหลุดสนามไปแล้ว */
export const OFF_TRACK = 60

/** วิ่งนานเกินเท่านี้ (วินาทีในเกม) แล้วยังไม่ครบรอบ ถือว่าหมดเวลา */
export const TIME_LIMIT = 90

/**
 * สีของเส้นแต่ละท่อน
 * ดำ = เส้นปกติ · แดง = โซนจำกัดความเร็ว (เซนเซอร์ยังเห็นเป็นเส้น แต่บอกสีได้ด้วย) · เว้น = เส้นขาด มองไม่เห็นอะไรเลย
 */
export type Paint = 'black' | 'red' | 'gap'

export const PAINTS: Paint[] = ['black', 'red', 'gap']

export const PAINT_LABEL: Record<Paint, string> = {
  black: 'เส้นดำ',
  red: 'โซนแดง',
  gap: 'เส้นขาด'
}

/** ในโซนแดงวิ่งเร็วได้ไม่เกินเท่านี้ (พิกเซลต่อวินาที) — เท่ากับกำลังมอเตอร์ 40% */
export const ZONE_LIMIT = 120

/**
 * เซนเซอร์ตัวกลางเข้าโซนแดงมาแล้วกี่พิกเซลถึงเริ่มจับความเร็ว — มอเตอร์ชะลอทันทีไม่ได้
 * ระยะนี้คือเวลาที่ให้เบรกหลังจากเซนเซอร์เห็นสีแดงครั้งแรก
 *
 * จับที่เซนเซอร์ ไม่ใช่ที่ตัวหุ่น เพราะหุ่นรู้แค่สิ่งที่เซนเซอร์เห็น
 * ถ้าจับที่ตัว หุ่นจะไม่มีทางรู้ว่าตัวเองพ้นโซนหรือยัง ทั้งที่เซนเซอร์เห็นเส้นดำไปแล้ว
 */
export const ZONE_GRACE = 60

/** จบรอบได้สี่แบบ — ครบรอบ หลุดสนาม หมดเวลา หรือวิ่งเร็วเกินในโซนแดง */
export type Outcome = 'finished' | 'lost' | 'timeout' | 'speeding'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  finished: 'ครบรอบ',
  lost: 'หลุดเส้น',
  timeout: 'หมดเวลา',
  speeding: 'วิ่งเร็วเกินในโซนแดง'
}

/** คำสั่งหนึ่งครั้ง — กำลังมอเตอร์ซ้ายกับขวา เป็นเปอร์เซ็นต์ ติดลบคือหมุนถอยหลัง */
export interface Drive {
  left: number
  right: number
}

export const clampPower = (value: number): number => Math.max(-100, Math.min(100, value))

export const isDrive = (value: unknown): value is Drive =>
  typeof value === 'object' &&
  value !== null &&
  Number.isFinite((value as Drive).left) &&
  Number.isFinite((value as Drive).right)

// ---------- สนาม ----------

export interface Course {
  id: string
  name: string
  /** อธิบายว่าสนามนี้ยากตรงไหน */
  note: string
  /** จุดที่เส้นลากผ่าน ตามลำดับที่หุ่นต้องวิ่ง — วนกลับมาจุดแรกเอง */
  points: Point[]
  /** true = ลากเส้นโค้งมนผ่านจุดพวกนี้ · false = ต่อด้วยเส้นตรง มุมคมตามจุดเป๊ะ */
  smooth: boolean
  /** สีของท่อนที่เริ่มจากจุดนั้นไปจุดถัดไป — ไม่ใส่ก็ดำทั้งสนาม */
  paint?: Paint[]
  /** สนามโจทย์ยาก — จัดกลุ่มแยกในรายการเลือกสนาม */
  challenge?: boolean
  /** สนามที่ผู้เล่นวาดเอง */
  custom?: boolean
}

export const COURSES: Course[] = [
  {
    id: 'oval',
    name: 'วงรี',
    note: 'ทางตรงสองเส้นกับโค้งกว้างสองโค้ง เลี้ยวซ้ายอย่างเดียวทั้งสนาม — สนามสำหรับลองครั้งแรก',
    smooth: true,
    points: [
      { x: 480, y: 500 },
      { x: 660, y: 500 },
      { x: 810, y: 440 },
      { x: 860, y: 300 },
      { x: 810, y: 160 },
      { x: 660, y: 100 },
      { x: 300, y: 100 },
      { x: 150, y: 160 },
      { x: 100, y: 300 },
      { x: 150, y: 440 },
      { x: 300, y: 500 }
    ]
  },
  {
    id: 'wave',
    name: 'ถนนคดเคี้ยว',
    note: 'โค้งซ้ายสลับโค้งขวาไม่หยุด ไม่มีทางตรงให้พักเลย — กฎที่เลี้ยวแรงเกินจะส่ายหนักขึ้นเรื่อย ๆ',
    smooth: true,
    points: [
      { x: 200, y: 530 },
      { x: 300, y: 530 },
      { x: 390, y: 440 },
      { x: 480, y: 520 },
      { x: 620, y: 540 },
      { x: 720, y: 450 },
      { x: 860, y: 460 },
      { x: 880, y: 320 },
      { x: 760, y: 300 },
      { x: 700, y: 200 },
      { x: 820, y: 130 },
      { x: 740, y: 60 },
      { x: 560, y: 110 },
      { x: 480, y: 240 },
      { x: 380, y: 140 },
      { x: 240, y: 70 },
      { x: 120, y: 140 },
      { x: 200, y: 280 },
      { x: 80, y: 400 },
      { x: 100, y: 530 }
    ]
  },
  {
    id: 'sharp',
    name: 'มุมหักศอก',
    note: 'ทางตรงต่อกันด้วยมุมฉากสิบมุม ทั้งเลี้ยวซ้ายและเลี้ยวขวา ไม่มีโค้งค่อย ๆ เลี้ยวเลย — เข้ามุมเร็วเกินเซนเซอร์จะหลุดเส้นก่อนตัวจะหันทัน',
    smooth: false,
    points: [
      { x: 140, y: 520 },
      { x: 520, y: 520 },
      { x: 520, y: 400 },
      { x: 840, y: 400 },
      { x: 840, y: 90 },
      { x: 640, y: 90 },
      { x: 640, y: 260 },
      { x: 400, y: 260 },
      { x: 400, y: 120 },
      { x: 140, y: 120 }
    ]
  },
  {
    id: 'eight',
    name: 'เลขแปด',
    note: 'เส้นวิ่งตัดกันเองกลางสนาม ตรงจุดตัดเซนเซอร์ทุกตัวเห็นเส้นพร้อมกัน — กฎที่ดูแค่ว่า "ซ้ายเห็นไหม" จะเลี้ยวผิดทางตรงนั้น',
    smooth: true,
    points: [
      { x: 780, y: 510 },
      { x: 900, y: 420 },
      { x: 900, y: 180 },
      { x: 780, y: 90 },
      { x: 620, y: 160 },
      { x: 480, y: 300 },
      { x: 340, y: 440 },
      { x: 180, y: 510 },
      { x: 60, y: 420 },
      { x: 60, y: 180 },
      { x: 180, y: 90 },
      { x: 340, y: 160 },
      { x: 480, y: 300 },
      { x: 620, y: 440 }
    ]
  },

  // ---------- โจทย์ยาก ----------
  {
    id: 'gaps',
    name: 'เส้นขาด',
    note: 'เส้นหายไปเป็นช่วง ๆ ทั้งบนทางตรงและทางโค้งอ่อน ๆ — กฎที่หมุนตัวหาเส้นทุกครั้งที่มองไม่เห็น จะหมุนออกนอกทางตรงช่องว่างแรก ต้องแยกให้ออกว่า "หลุดเพราะเลี้ยวไม่ทัน" กับ "เส้นขาดไปเฉย ๆ" ต่างกันยังไง',
    challenge: true,
    smooth: true,
    points: [
      { x: 440, y: 520 },
      { x: 540, y: 520 },
      { x: 650, y: 520 },
      { x: 780, y: 520 },
      { x: 870, y: 450 },
      { x: 890, y: 300 },
      { x: 870, y: 150 },
      { x: 780, y: 80 },
      { x: 660, y: 80 },
      { x: 560, y: 80 },
      { x: 420, y: 80 },
      { x: 320, y: 80 },
      { x: 180, y: 80 },
      { x: 90, y: 150 },
      { x: 74, y: 240 },
      { x: 74, y: 350 },
      { x: 90, y: 450 },
      { x: 180, y: 520 },
      { x: 300, y: 520 }
    ],
    paint: [
      'black', 'gap', 'black', 'black', 'black', 'black', 'black', 'black', 'gap', 'black',
      'gap', 'black', 'black', 'black', 'gap', 'black', 'black', 'black', 'black'
    ]
  },
  {
    id: 'zones',
    name: 'โซนแดง',
    note: `ถนนคดเคี้ยวที่มีเส้นสีแดงสามช่วง ในช่วงสีแดงห้ามวิ่งเร็วเกิน ${ZONE_LIMIT} พิกเซลต่อวินาที (กำลังราว 40) — เกินเมื่อไรจบรอบทันที ต้องใช้บล็อกดูสีเส้น และต้องชะลอตั้งแต่เซนเซอร์เห็นสีแดง เพราะมอเตอร์ชะลอทันทีไม่ได้`,
    challenge: true,
    smooth: true,
    points: [
      { x: 200, y: 530 },
      { x: 300, y: 530 },
      { x: 390, y: 440 },
      { x: 480, y: 520 },
      { x: 620, y: 540 },
      { x: 720, y: 450 },
      { x: 860, y: 460 },
      { x: 880, y: 320 },
      { x: 760, y: 300 },
      { x: 700, y: 200 },
      { x: 820, y: 130 },
      { x: 740, y: 60 },
      { x: 560, y: 110 },
      { x: 480, y: 240 },
      { x: 380, y: 140 },
      { x: 240, y: 70 },
      { x: 120, y: 140 },
      { x: 200, y: 280 },
      { x: 80, y: 400 },
      { x: 100, y: 530 }
    ],
    paint: [
      'black', 'red', 'red', 'black', 'black', 'black', 'black', 'black', 'black', 'red',
      'red', 'black', 'black', 'black', 'red', 'red', 'black', 'black', 'black', 'black'
    ]
  },
  {
    id: 'final',
    name: 'สนามรวมโจทย์',
    note: 'เลขแปดที่มีทุกอย่างรวมกัน — จุดตัดกลางสนาม เส้นขาดสองช่วง และโซนแดงสองช่วงที่พาเข้าจุดตัดพอดี โปรแกรมเดียวต้องรู้ว่าตอนไหนควรทำอะไร',
    challenge: true,
    smooth: true,
    points: [
      { x: 780, y: 510 },
      { x: 900, y: 420 },
      { x: 905, y: 350 },
      { x: 905, y: 250 },
      { x: 900, y: 180 },
      { x: 780, y: 90 },
      { x: 620, y: 160 },
      { x: 480, y: 300 },
      { x: 340, y: 440 },
      { x: 180, y: 510 },
      { x: 60, y: 420 },
      { x: 55, y: 350 },
      { x: 55, y: 250 },
      { x: 60, y: 180 },
      { x: 180, y: 90 },
      { x: 340, y: 160 },
      { x: 480, y: 300 },
      { x: 620, y: 440 }
    ],
    paint: [
      'black', 'black', 'gap', 'black', 'black', 'red', 'red', 'black', 'black', 'black',
      'black', 'gap', 'black', 'black', 'red', 'red', 'black', 'black'
    ]
  }
]

export const DEFAULT_COURSE = 'oval'

/** สนามที่วาดเองซึ่งเปิดอยู่ตอนนี้ — หน้าเกมลงทะเบียนไว้ เอนจินจะได้หาเจอด้วย id เหมือนสนามอื่น */
const extra = new Map<string, Course>()

export function registerCourse(course: Course): void {
  extra.set(course.id, course)
}

export function unregisterCourse(id: string): void {
  extra.delete(id)
}

export const findCourse = (id: string): Course =>
  COURSES.find((item) => item.id === id) ?? extra.get(id) ?? COURSES[0]!

/** สีของท่อนที่เริ่มจากจุดที่ index */
export const paintOf = (course: Course, index: number): Paint => course.paint?.[index] ?? 'black'

/** ระยะห่างระหว่างจุดที่ซอยไว้บนเส้น (พิกเซล) — ยิ่งถี่ยิ่งแม่น แต่ยิ่งช้า */
const SAMPLE = 4

/** ขนาดช่องของตารางค้นหาเส้น — ต้องกว้างกว่าระยะที่เซนเซอร์ต้องมองหาเส้น */
const CELL = 24

export interface Track {
  /** จุดบนเส้นห่างกันราว SAMPLE พิกเซล เรียงตามทางวิ่ง และวนกลับไปจุดแรก */
  points: Point[]
  /** ระยะทางสะสมจากจุดเริ่มถึงจุดนั้น */
  along: number[]
  /** ความยาวของเส้นทั้งวง */
  length: number
  /** สีของท่อนที่เริ่มจากจุดนั้นไปจุดถัดไป */
  paint: Paint[]
  /** อยู่ลึกเข้าไปในโซนแดงกี่พิกเซลแล้ว — นอกโซนเป็น -1 */
  redDepth: number[]
  /** ตารางช่องละ CELL พิกเซล บอกว่าช่องนั้นมีท่อนเส้นที่ "มองเห็นได้" ท่อนไหนผ่านบ้าง — เส้นขาดไม่อยู่ในตาราง */
  grid: Map<number, number[]>
}

/** เส้นโค้ง Catmull-Rom ผ่านจุด p1 → p2 ที่ตำแหน่ง t (0..1) */
function spline(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t
  const t3 = t2 * t
  const at = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)

  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) }
}

interface Sample extends Point {
  /** อยู่บนท่อนที่เริ่มจากจุดไหนของสนาม */
  from: number
}

/**
 * เส้นของแต่ละท่อนตามที่วาดจริง (โค้งหรือตรง) — หน้าวาดสนามใช้ทำให้คลิกที่ท่อนไหนก็ระบายสีท่อนนั้น
 * ท่อนที่ i เริ่มจากจุดที่ i ไปจุดถัดไป
 */
export function segmentsOf(course: Pick<Course, 'points' | 'smooth'>): Point[][] {
  const list = course.points
  const count = list.length

  return list.map((p1, index) => {
    const p0 = list[(index - 1 + count) % count]!
    const p2 = list[(index + 1) % count]!
    const p3 = list[(index + 2) % count]!
    const pieces = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 6))

    return Array.from({ length: pieces + 1 }, (_, piece) => {
      const t = piece / pieces
      return course.smooth ? spline(p0, p1, p2, p3, t) : { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
    })
  })
}

/** ซอยเส้นให้เป็นจุดถี่ ๆ ระยะห่างเท่า ๆ กัน — แต่ละจุดจำไว้ว่ามาจากท่อนไหน จะได้รู้สี */
function outline(course: Course): Sample[] {
  const raw: Sample[] = []
  const list = course.points
  const count = list.length

  for (let index = 0; index < count; index++) {
    const p0 = list[(index - 1 + count) % count]!
    const p1 = list[index]!
    const p2 = list[(index + 1) % count]!
    const p3 = list[(index + 2) % count]!
    const pieces = Math.max(8, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2))

    for (let piece = 0; piece < pieces; piece++) {
      const t = piece / pieces
      const at = course.smooth ? spline(p0, p1, p2, p3, t) : { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
      raw.push({ ...at, from: index })
    }
  }

  // เก็บจุดใหม่ทุก ๆ SAMPLE พิกเซลตามแนวเส้น แต่ห้ามทิ้งจุดที่เริ่มท่อนใหม่
  // ไม่งั้นมุมคมจะถูกตัดมน และสีจะเปลี่ยนคลาดจากตำแหน่งที่วาดไว้
  const points: Sample[] = [raw[0]!]
  let carried = 0

  for (let index = 1; index <= raw.length; index++) {
    const from = raw[index - 1]!
    const to = raw[index % raw.length]!
    carried += Math.hypot(to.x - from.x, to.y - from.y)

    if (index === raw.length) break
    if (carried >= SAMPLE || to.from !== from.from) {
      points.push(to)
      carried = 0
    }
  }

  return points
}

const cellKey = (cx: number, cy: number): number => cy * 1000 + cx

export function buildTrack(course: Course): Track {
  const samples = outline(course)
  const points: Point[] = samples.map(({ x, y }) => ({ x, y }))
  const paint = samples.map((sample) => paintOf(course, sample.from))
  const along: number[] = [0]

  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]!
    const to = points[index]!
    along.push(along[index - 1]! + Math.hypot(to.x - from.x, to.y - from.y))
  }

  const last = points[points.length - 1]!
  const first = points[0]!
  const length = along[along.length - 1]! + Math.hypot(first.x - last.x, first.y - last.y)

  // ลึกเข้าไปในโซนแดงเท่าไร — เดินสองรอบ โซนที่คร่อมจุดเริ่มจะได้นับต่อเนื่องถูก
  const redDepth = points.map(() => -1)
  let depth = -1
  for (let step = 0; step < points.length * 2; step++) {
    const index = step % points.length
    const before = (index - 1 + points.length) % points.length
    const seg = Math.hypot(points[index]!.x - points[before]!.x, points[index]!.y - points[before]!.y)
    depth = paint[index] === 'red' ? (depth < 0 ? 0 : depth + seg) : -1
    if (step >= points.length || redDepth[index] === -1) redDepth[index] = depth
  }

  const grid = new Map<number, number[]>()
  for (let index = 0; index < points.length; index++) {
    if (paint[index] === 'gap') continue
    const from = points[index]!
    const to = points[(index + 1) % points.length]!
    const cells = new Set<number>()

    for (const at of [from, to, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }]) {
      cells.add(cellKey(Math.floor(at.x / CELL), Math.floor(at.y / CELL)))
    }

    for (const key of cells) {
      const list = grid.get(key)
      if (list) list.push(index)
      else grid.set(key, [index])
    }
  }

  return { points, along, length, paint, redDepth, grid }
}

/** ช่วงของเส้นที่สีเดียวกันต่อกัน — ใช้วาดสนาม */
export interface PaintRun {
  paint: Paint
  points: Point[]
}

/** แบ่งเส้นทั้งวงเป็นช่วงสีเดียวกัน ช่วงสุดท้ายปิดวงกลับมาจุดแรก */
export function paintRuns(track: Track): PaintRun[] {
  const runs: PaintRun[] = []
  const count = track.points.length

  for (let index = 0; index < count; index++) {
    const paint = track.paint[index]!
    const from = track.points[index]!
    const to = track.points[(index + 1) % count]!
    const last = runs[runs.length - 1]

    if (last && last.paint === paint) last.points.push(to)
    else runs.push({ paint, points: [from, to] })
  }

  return runs
}

/** ระยะจากจุด p ถึงท่อนเส้น a→b */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = dx * dx + dy * dy
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / span))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/**
 * ระยะจากจุดนั้นถึงเส้นที่ใกล้ที่สุด — ดูแค่ช่องรอบ ๆ ในตาราง
 * ไกลเกินช่องข้างเคียงก็ตอบว่าไกลมาก ซึ่งพอสำหรับเซนเซอร์ที่สนใจแค่ระยะไม่กี่พิกเซล
 */
export function distanceToLine(track: Track, p: Point): number {
  return nearestLine(track, p).gap
}

/** เส้นที่มองเห็นได้ซึ่งใกล้จุดนั้นที่สุด — ห่างเท่าไร และท่อนนั้นสีอะไร */
export function nearestLine(track: Track, p: Point): { gap: number; paint: Paint } {
  const cx = Math.floor(p.x / CELL)
  const cy = Math.floor(p.y / CELL)
  let best = Number.POSITIVE_INFINITY
  let paint: Paint = 'black'

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = track.grid.get(cellKey(cx + dx, cy + dy))
      if (!list) continue

      for (const index of list) {
        const gap = toSegment(p, track.points[index]!, track.points[(index + 1) % track.points.length]!)
        if (gap < best) {
          best = gap
          paint = track.paint[index]!
        }
      }
    }
  }

  return { gap: best, paint }
}

/** เซนเซอร์ที่อยู่ห่างจากกึ่งกลางเส้นเท่านี้ อ่านได้เท่าไร (0–100) */
export function readingAt(gap: number): number {
  const half = LINE_WIDTH / 2
  const value = (half + SENSOR_BLUR - gap) / (2 * SENSOR_BLUR)
  return Math.round(Math.max(0, Math.min(1, value)) * 100)
}

// ---------- การวิ่งหนึ่งรอบ ----------

export interface Run {
  course: Course
  track: Track

  /** ตำแหน่งกึ่งกลางแกนล้อ */
  x: number
  y: number
  /** ทิศที่หัวหุ่นหันไป (เรเดียน) — 0 คือหันไปทางขวาของจอ */
  heading: number

  /** ความเร็วจริงของล้อซ้าย/ขวาตอนนี้ (พิกเซลต่อวินาที) — ไล่ตามคำสั่งอยู่ ยังไม่ถึงก็ได้ */
  wheelLeft: number
  wheelRight: number

  /** คำสั่งล่าสุด (เปอร์เซ็นต์) */
  drive: Drive

  /** ค่าที่เซนเซอร์ห้าตัวอ่านได้ตอนนี้ (0–100) เรียงจากซ้ายไปขวา */
  sensors: number[]
  /** สีของเส้นที่เซนเซอร์แต่ละตัวเห็น — ไม่เห็นเส้นเป็น null */
  colors: Array<Paint | null>
  /** เห็นเส้นครั้งล่าสุดทางไหน — -1 ซ้าย · 1 ขวา · 0 ยังไม่เคยหลุด */
  lastSide: number

  time: number
  frame: number

  /** จุดบนเส้นที่ใกล้เซนเซอร์ตัวกลางที่สุด — ใช้ดูว่าเซนเซอร์เข้าโซนแดงลึกแค่ไหน */
  sensorIndex: number
  /** จุดบนเส้นที่ใกล้ตัวที่สุดตอนนี้ — ใช้นับว่าวิ่งไปได้เท่าไรแล้ว */
  index: number
  /** วิ่งไปตามเส้นได้กี่พิกเซลแล้ว — ถอยหลังก็ลดลง */
  progress: number
  /** ไกลสุดที่เคยไปถึง */
  furthest: number

  /** ตัวหุ่นห่างจากเส้นกี่พิกเซลตอนนี้ */
  offset: number
  offsetSum: number
  offsetMax: number
  samples: number

  /** รอยที่วิ่งผ่านมา — เก็บทุก ๆ 3 เฟรม เอาไว้วาดให้เห็นว่าส่ายแค่ไหน */
  trail: Point[]

  over: Outcome | null
  /** หลุดจากทางของตัวเองไปเกาะเส้นอีกท่อนหนึ่ง — เกิดตอนเลี้ยวผิดทางที่จุดตัด */
  strayed: boolean
}

/** เซนเซอร์ตัวที่ index อยู่ตรงไหนบนสนาม */
export function sensorPoint(run: Pick<Run, 'x' | 'y' | 'heading'>, index: number): Point {
  const ahead = { x: Math.cos(run.heading), y: Math.sin(run.heading) }
  // ด้านซ้ายของตัวหุ่น — จอมีแกน y ชี้ลง ด้านซ้ายของทิศ (cos, sin) จึงเป็น (sin, -cos)
  const left = { x: Math.sin(run.heading), y: -Math.cos(run.heading) }
  const side = ((SENSOR_COUNT - 1) / 2 - index) * SENSOR_GAP

  return {
    x: run.x + ahead.x * SENSOR_AHEAD + left.x * side,
    y: run.y + ahead.y * SENSOR_AHEAD + left.y * side
  }
}

/** อ่านเซนเซอร์ทั้งห้าตัว — ได้ทั้งความเข้มกับสีของเส้นที่เห็น */
function scan(run: Run): void {
  const sensors: number[] = []
  const colors: Array<Paint | null> = []

  for (let index = 0; index < SENSOR_COUNT; index++) {
    const found = nearestLine(run.track, sensorPoint(run, index))
    const value = readingAt(found.gap)
    sensors.push(value)
    colors.push(value >= SEE_THRESHOLD ? found.paint : null)
  }

  run.sensors = sensors
  run.colors = colors
}

/** มีเซนเซอร์ตัวไหนเห็นเส้นสีนี้อยู่บ้าง */
export const seesPaint = (run: Pick<Run, 'colors'>, paint: Paint): boolean => run.colors.includes(paint)

/** ตัวหุ่นอยู่ลึกในโซนแดงจนถูกจับความเร็วแล้วหรือยัง */
export const inSpeedZone = (run: Run): boolean =>
  run.colors[2] === 'red' && (run.track.redDepth[run.sensorIndex] ?? -1) > ZONE_GRACE

/** ถ่วงน้ำหนักของเซนเซอร์แต่ละตัว — ซ้ายสุด -100 ถึงขวาสุด 100 */
const WEIGHTS = Array.from({ length: SENSOR_COUNT }, (_, index) =>
  Math.round(((index - (SENSOR_COUNT - 1) / 2) / ((SENSOR_COUNT - 1) / 2)) * 100)
)

/** อ่านรวมกันแล้วได้น้อยกว่านี้ ถือว่าไม่เห็นเส้นเลย */
const LOST_TOTAL = 30

export const isLost = (sensors: number[]): boolean =>
  sensors.reduce((sum, value) => sum + value, 0) < LOST_TOTAL

/**
 * เส้นอยู่ตรงไหนใต้แถวเซนเซอร์ — -100 คือใต้ตัวซ้ายสุด 0 คือตรงกลางพอดี 100 คือใต้ตัวขวาสุด
 *
 * คิดแบบถัวเฉลี่ยถ่วงน้ำหนัก ตัวที่เห็นเส้นชัดกว่าก็ดึงคำตอบเข้าหาตัวเองมากกว่า
 * หลุดเส้นไปแล้วจะตอบสุดขอบฝั่งที่เห็นเส้นครั้งสุดท้าย แบบเดียวกับไลบรารีของเซนเซอร์หุ่นแข่งจริง
 * ตัวควบคุมจึงยังรู้ว่าต้องหมุนกลับไปทางไหน
 */
export function linePosition(sensors: number[], lastSide: number): number {
  const total = sensors.reduce((sum, value) => sum + value, 0)
  if (total < LOST_TOTAL) return lastSide * 100

  const weighted = sensors.reduce((sum, value, index) => sum + value * WEIGHTS[index]!, 0)
  // || 0 กัน -0 ที่ได้จากการปัดเศษเลขติดลบเล็ก ๆ — โชว์บนจอเป็น "-0" แล้วงง
  return Math.round(weighted / total) || 0
}

/** ความเร็วของตัวหุ่นตอนนี้ (พิกเซลต่อวินาที) — เฉลี่ยของสองล้อ */
export const speedOf = (run: Run): number => (run.wheelLeft + run.wheelRight) / 2

/** วิ่งไปได้กี่ % ของรอบ */
export const lapPercent = (run: Run): number =>
  Math.max(0, Math.min(100, (run.progress / run.track.length) * 100))

/** ตัวหุ่นห่างจากเส้นเฉลี่ยกี่พิกเซล — ยิ่งน้อยยิ่งวิ่งเนียน */
export const averageOffset = (run: Run): number => (run.samples === 0 ? 0 : run.offsetSum / run.samples)

export interface RunOptions {
  courseId: string
  /** ส่งตัวสนามมาตรง ๆ — ใช้ตอนลองสนามที่กำลังวาดอยู่ ซึ่งยังไม่ได้บันทึก */
  course?: Course
}

export function createRun(options: Partial<RunOptions> = {}): Run {
  const course = options.course ?? findCourse(options.courseId ?? DEFAULT_COURSE)
  const track = buildTrack(course)

  // หันหัวไปหาจุดบนเส้นที่อยู่ห่างออกไปเท่าระยะแถวเซนเซอร์พอดี เซนเซอร์ตัวกลางจะได้อยู่บนเส้นตั้งแต่ออกตัว
  const start = track.points[0]!
  const next = track.points[track.along.findIndex((along) => along >= SENSOR_AHEAD)]!

  const run: Run = {
    course,
    track,
    x: start.x,
    y: start.y,
    heading: Math.atan2(next.y - start.y, next.x - start.x),
    wheelLeft: 0,
    wheelRight: 0,
    drive: { left: 0, right: 0 },
    sensors: [],
    colors: [],
    lastSide: 0,
    time: 0,
    frame: 0,
    index: 0,
    sensorIndex: 0,
    progress: 0,
    furthest: 0,
    offset: 0,
    offsetSum: 0,
    offsetMax: 0,
    samples: 0,
    trail: [{ x: start.x, y: start.y }],
    over: null,
    strayed: false
  }

  scan(run)
  return run
}

/** สั่งกำลังมอเตอร์ที่จะใช้จนกว่าจะตัดสินใจครั้งถัดไป — เกิน ±100 ถูกตัดเหลือ ±100 */
export function order(run: Run, drive: Drive): void {
  if (run.over) return
  run.drive = { left: clampPower(drive.left), right: clampPower(drive.right) }
}

/** ขยับได้ไกลสุดกี่พิกเซลต่อหนึ่งก้าวย่อย — เล็กพอให้การเลี้ยวแคบ ๆ ยังเป็นเส้นโค้ง ไม่ใช่เส้นหัก */
const MAX_SUB_STEP = 2

/** หาจุดบนเส้นที่ใกล้ตัวที่สุด โดยดูแค่แถว ๆ จุดเดิม — จุดตัดของเลขแปดจะได้ไม่พาข้ามไปอีกวง */
function follow(run: Run): void {
  const points = run.track.points
  const count = points.length
  let best = run.index
  let bestGap = Number.POSITIVE_INFINITY

  for (let shift = -20; shift <= 40; shift++) {
    const index = (run.index + shift + count) % count
    const point = points[index]!
    const gap = Math.hypot(point.x - run.x, point.y - run.y)
    if (gap < bestGap) {
      bestGap = gap
      best = index
    }
  }

  let moved = run.track.along[best]! - run.track.along[run.index]!
  if (moved < -run.track.length / 2) moved += run.track.length
  if (moved > run.track.length / 2) moved -= run.track.length

  run.index = best
  run.progress += moved
  run.furthest = Math.max(run.furthest, run.progress)
  run.offset = bestGap

  // เซนเซอร์ตัวกลางอยู่หน้าตัวราว SENSOR_AHEAD พิกเซล — หาจุดบนเส้นแถว ๆ นั้น
  const center = sensorPoint(run, 2)
  let sensorGap = Number.POSITIVE_INFINITY
  for (let shift = 0; shift <= 20; shift++) {
    const index = (best + shift) % count
    const point = points[index]!
    const gap = Math.hypot(point.x - center.x, point.y - center.y)
    if (gap < sensorGap) {
      sensorGap = gap
      run.sensorIndex = index
    }
  }
}

/**
 * เดินฟิสิกส์ไปหนึ่งเฟรม — คำสั่งต้องสั่งไว้ก่อนเรียกตัวนี้
 *
 * มอเตอร์ไล่ตามคำสั่งก่อน แล้วค่อยขยับตัวตามความเร็วของสองล้อ
 * ล้อขวาเร็วกว่าล้อซ้ายเท่าไร ตัวก็หมุนไปทางซ้ายเร็วเท่านั้น
 */
export function advance(run: Run): void {
  if (run.over) return

  run.frame++
  run.time += STEP

  const catchUp = 1 - Math.exp(-STEP / MOTOR_LAG)
  run.wheelLeft += ((run.drive.left / 100) * MAX_WHEEL - run.wheelLeft) * catchUp
  run.wheelRight += ((run.drive.right / 100) * MAX_WHEEL - run.wheelRight) * catchUp

  const fastest = Math.max(Math.abs(run.wheelLeft), Math.abs(run.wheelRight))
  const slices = Math.max(1, Math.ceil((fastest * STEP) / MAX_SUB_STEP))
  const slice = STEP / slices

  for (let part = 0; part < slices; part++) {
    const forward = (run.wheelLeft + run.wheelRight) / 2
    const turn = (run.wheelLeft - run.wheelRight) / WHEEL_BASE

    run.heading += turn * slice
    run.x += Math.cos(run.heading) * forward * slice
    run.y += Math.sin(run.heading) * forward * slice
  }

  follow(run)

  scan(run)
  if (!isLost(run.sensors)) {
    const position = linePosition(run.sensors, run.lastSide)
    if (position < -20) run.lastSide = -1
    else if (position > 20) run.lastSide = 1
  }

  run.offsetSum += run.offset
  run.offsetMax = Math.max(run.offsetMax, run.offset)
  run.samples++

  if (run.frame % 3 === 0) run.trail.push({ x: run.x, y: run.y })

  if (run.progress >= run.track.length) run.over = 'finished'
  else if (run.offset > OFF_TRACK) {
    run.over = 'lost'
    // ห่างจากทางของตัวเองก็จริง แต่ตัวยังคร่อมเส้นอยู่ — แปลว่าไปเกาะเส้นท่อนอื่นที่ตัดผ่านมา
    run.strayed = distanceToLine(run.track, run) < LINE_WIDTH
  } else if (inSpeedZone(run) && speedOf(run) > ZONE_LIMIT) run.over = 'speeding'
  else if (run.time >= TIME_LIMIT) run.over = 'timeout'
}

/** เดินไปหนึ่งช่วงตัดสินใจ (DECIDE_EVERY เฟรม) */
export function advanceDecision(run: Run): void {
  for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
}

/** สรุปว่ารอบนี้จบยังไง และควรแก้ตรงไหน — ใช้เขียนข้อความตอนจบ */
export function adviceFor(run: Run): string {
  if (run.over === 'finished') {
    return averageOffset(run) > 6
      ? 'ครบรอบแล้ว แต่ส่ายห่างเส้นอยู่มาก ลองเลี้ยวให้นุ่มลงแล้วดูว่าเร็วขึ้นไหม'
      : 'ครบรอบแล้ว และเกาะเส้นได้แนบ ลองเร่งกำลังมอเตอร์ดูว่ายังเกาะอยู่ไหม'
  }

  if (run.over === 'speeding') {
    return `วิ่งเข้าโซนแดงเร็วเกิน ${ZONE_LIMIT} px/วิ — มอเตอร์ชะลอทันทีไม่ได้ ต้องลดกำลังตั้งแต่เซนเซอร์เพิ่งเห็นสีแดง ไม่ใช่รอให้ตัวเข้าไปก่อน`
  }

  if (run.over === 'lost' && run.strayed) {
    return 'เลี้ยวเข้าเส้นผิดท่อนที่จุดตัด แล้วเกาะเส้นนั้นออกนอกทางของตัวเอง — ตรงจุดตัดเซนเซอร์หลายตัวเห็นเส้นพร้อมกัน กฎที่เขียนไว้ตัดสินใจยังไงตอนนั้น'
  }

  if (run.over === 'lost') {
    return 'หลุดออกจากเส้นไปไกลจนหาทางกลับไม่เจอ — มักเกิดตอนเข้าโค้งเร็วเกิน หรือเลี้ยวไม่แรงพอ ลองดูว่าตอนเซนเซอร์ไม่เห็นเส้นเลย โปรแกรมสั่งอะไร'
  }

  if (run.progress < run.furthest - 50) {
    return 'หมดเวลา — หุ่นกลับหัววิ่งย้อนทางเดิม ตอนเจอเส้นอีกครั้งมันหันไปผิดฝั่ง'
  }

  return 'หมดเวลาก่อนครบรอบ — หุ่นวนอยู่กับที่ หรือวิ่งช้าเกินไป'
}

/** เวลาที่โชว์บนจอ */
export const secondsOf = (time: number): string => time.toFixed(2)

// ---------- ตรวจสนามที่วาดเอง ----------

/** เส้นต้องห่างขอบสนามอย่างน้อยเท่านี้ — ตัวหุ่นกว้างราว 40 พิกเซล ชิดขอบกว่านี้จะวิ่งตกจอ */
const EDGE_MARGIN = 24

/** สนามสั้นกว่านี้วิ่งจบในไม่กี่วินาที เทียบวิธีเลี้ยวอะไรไม่ได้ */
const SHORTEST_TRACK = 600

/**
 * สนามนี้ใช้เล่นได้ไหม — ได้ก็คืน null ไม่ได้ก็คืนเหตุผลเป็นภาษาคน
 * ใช้กับสนามที่วาดเองก่อนบันทึก สนามที่มีมากับเกมก็ต้องผ่านด่านเดียวกัน (มีเทสต์ตรวจ)
 */
export function checkCourse(course: Course): string | null {
  const points = course.points

  if (points.length < 3) return 'วางจุดอย่างน้อย 3 จุด เส้นถึงจะวนกลับมาเป็นวงได้'

  for (let index = 0; index < points.length; index++) {
    const from = points[index]!
    const to = points[(index + 1) % points.length]!
    if (Math.hypot(to.x - from.x, to.y - from.y) < 12) return `จุดที่ ${index + 1} กับจุดถัดไปซ้อนกันเกือบสนิท — ลากแยกออกจากกันหรือลบทิ้งหนึ่งจุด`
  }

  if (paintOf(course, 0) === 'gap') return 'ท่อนแรกที่ออกจากจุดเริ่มต้องเป็นเส้นที่มองเห็นได้ ไม่งั้นหุ่นออกตัวมาก็ไม่เห็นเส้นเลย'

  const track = buildTrack(course)

  const outside = track.points.some(
    (at) => at.x < EDGE_MARGIN || at.y < EDGE_MARGIN || at.x > VIEW.width - EDGE_MARGIN || at.y > VIEW.height - EDGE_MARGIN
  )
  if (outside) return 'เส้นล้นขอบสนาม — โค้งที่ลากผ่านจุดอาจโป่งออกไปนอกจุดที่วาง ลองขยับจุดเข้ามาข้างใน'

  if (track.length < SHORTEST_TRACK) return `สนามสั้นเกินไป (${Math.round(track.length)} พิกเซล) ต้องยาวอย่างน้อย ${SHORTEST_TRACK} พิกเซล`

  if (track.paint.every((paint) => paint === 'gap')) return 'ทั้งสนามเป็นเส้นขาดหมด ไม่มีอะไรให้หุ่นมองเห็นเลย'

  const run = createRun({ course })
  if ((run.sensors[2] ?? 0) < SEE_THRESHOLD) {
    return 'ตรงจุดเริ่มเส้นโค้งแรงเกินไป หุ่นออกตัวมาแล้วเซนเซอร์ตัวกลางไม่เห็นเส้น — ให้ท่อนแรกเป็นทางตรงยาวหน่อย'
  }

  return null
}
