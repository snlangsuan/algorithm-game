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

import { trace } from './trace'

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
 * สีของเส้นแต่ละท่อน — ดำ = เส้นปกติ · เว้น = เส้นขาด มองไม่เห็นอะไรเลย
 */
export type Paint = 'black' | 'gap'

export const PAINTS: Paint[] = ['black', 'gap']

export const PAINT_LABEL: Record<Paint, string> = {
  black: 'เส้นดำ',
  gap: 'เส้นขาด'
}

/**
 * มาตราส่วนของสนามตามกติกา RoboCupJunior — แผ่นสนามจริงกว้าง 30 ซม. ในเกมคือ TILE พิกเซล
 * สนามทั้งผืน 960 × 600 จึงเท่ากับแผ่น 8 × 5 แผ่น
 */
export const TILE = 120

export const PX_PER_CM = TILE / 30

/**
 * ป้ายเขียวบอกทางที่ทางแยก — แบบเดียวกับ RoboCupJunior Rescue Line
 * วางไว้ข้างเส้นก่อนถึงทางแยก ฝั่งเดียวกับที่ทางของหุ่นเลี้ยวไป ไม่มีป้ายแปลว่าตรงไป
 *
 * ป้ายเป็นสี่เหลี่ยมจัตุรัสขนาด MARKER_SIZE ขอบในห่างขอบเส้น MARKER_CLEAR และขอบหน้าห่างขอบทางแยก MARKER_CLEAR
 * ยาวพอที่หุ่นกำลังเต็มจะยังเห็นอย่างน้อยหนึ่งครั้ง — ตัดสินใจครั้งละ 2 เฟรม ไปได้ไม่เกิน 10 พิกเซล
 */
export const MARKER_SIZE = 16

export const MARKER_CLEAR = 2

/** ป้ายอยู่ฝั่งไหนของเส้น เมื่อมองตามทิศที่หุ่นวิ่ง */
export type Side = 'left' | 'right'

export const SIDE_LABEL: Record<Side, string> = { left: 'ซ้าย', right: 'ขวา' }

/** จบรอบได้สามแบบ — ครบรอบ หลุดสนาม หรือหมดเวลา */
export type Outcome = 'finished' | 'lost' | 'timeout'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  finished: 'ครบรอบ',
  lost: 'หลุดเส้น',
  timeout: 'หมดเวลา'
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
  /**
   * ทางแยกหลอก — เส้นดำที่แตกออกจากทางของหุ่นตรงจุดที่ at แล้วไปสิ้นสุดเฉย ๆ
   * เข้าผิดทางก็วิ่งออกนอกทางของตัวเองจนหลุดสนาม ป้ายเขียวคำนวณจากทิศที่ทางจริงเลี้ยวไปเอง
   */
  branches?: Branch[]
  /**
   * จุดที่ความโค้งเปลี่ยน — เข้าโค้ง ออกโค้ง หรือเปลี่ยนรัศมี
   * แต่ละจุดมีเครื่องหมายวางไว้ข้างซ้ายของเส้น แบบสนาม Robotrace กับ UKMARS
   */
  corners?: number[]
  /** เขาวงกตบนเส้น — มีแล้วสนามนี้ไม่ใช่วงปิด points กับ paint ไม่ถูกใช้ */
  maze?: LineMaze
  /** สนามโจทย์ยาก — จัดกลุ่มแยกในรายการเลือกสนาม */
  challenge?: boolean
  /** สนามที่ผู้เล่นวาดเอง */
  custom?: boolean
}

/**
 * เขาวงกตบนเส้นแบบคู่มือของ Pololu — เส้นเทปบนตาราง หักมุมฉากเท่านั้น ไม่มีวงวน
 * มีจุดเริ่มกับเส้นชัยเป็นวงกลมดำ ทางที่เหลือเป็นทางตันทั้งหมด
 */
export interface LineMaze {
  /** จุดออกตัว (ต้องอยู่บนเส้น) กับทิศที่หันตอนออกตัว เป็นองศาบนจอ */
  start: Point
  heading: number
  /** เส้นทุกเส้น เป็นท่อนตรงแนวนอนหรือแนวตั้ง — ปลายของเส้นหนึ่งไปแตะกลางอีกเส้นได้ */
  lines: Array<[Point, Point]>
  /** ศูนย์กลางของวงกลมดำที่เป็นเส้นชัย — ต้องเป็นปลายของเส้นใดเส้นหนึ่ง */
  finish: Point
}

/** วงกลมเส้นชัยกว้าง 3 นิ้ว เส้นเทปกว้าง 3/4 นิ้ว — รัศมีจึงเท่ากับความกว้างเส้นสองเท่า */
export const FINISH_RADIUS = 2 * LINE_WIDTH

export interface Branch {
  /** แตกออกจากจุดที่เท่าไรของสนาม — ต้องเป็นมุมของสนามแบบเส้นตรง (smooth: false) */
  at: number
  /** ปลายของทางแยก ลากเป็นเส้นตรงจากจุดแยกไปถึงตรงนี้ */
  to: Point
}

/**
 * RoboCupJunior Rescue Line — เส้นขาดบนแผ่นสนาม
 *
 * ตามกติกาฉบับ 2025 ข้อ 3.3: เส้นขาดอยู่บนทางตรงเท่านั้น ยาวไม่เกิน 20 ซม.
 * และก่อนถึงช่องว่างทุกช่องต้องมีทางตรงอย่างน้อย 5 ซม. · ทางโค้งเป็นแผ่นโค้งหนึ่งในสี่วงกลม
 * ที่ต่อจากกึ่งกลางขอบแผ่นหนึ่งไปอีกขอบหนึ่ง จึงมีรัศมีครึ่งแผ่นพอดี
 */
const RCJ_GAPS_TRACE = trace({ x: 180, y: 540 }, 0)
  .forward(210)
  .gap(15 * PX_PER_CM)
  .forward(170)
  .gap(20 * PX_PER_CM)
  .forward(140)
  .arc(TILE / 2, 90)
  .forward(80)
  .gap(15 * PX_PER_CM)
  .forward(220)
  .arc(TILE / 2, 90)
  .forward(240)
  .turn(90)
  .forward(2 * TILE)
  .turn(-90)
  .forward(200)
  .gap(18 * PX_PER_CM)
  .forward(88)
  .arc(TILE / 2, 90)
  .forward(180)
  .turn(90)
  .close()

/**
 * RoboCupJunior Rescue Line — ทางแยกกับป้ายเขียว
 *
 * ตามกติกาฉบับ 2025 ข้อ 3.6: ทางแยกตั้งฉากเสมอ ป้ายเขียววางก่อนถึงทางแยก
 * ป้ายอยู่ฝั่งไหนให้เลี้ยวฝั่งนั้น ไม่มีป้ายให้ตรงไป · ทางที่ไม่ได้เลือกในเกมนี้เป็นทางตันยาวหนึ่งแผ่น
 */
const RCJ_JUNCTIONS_TRACE = trace({ x: 180, y: 540 }, 0)
  .forward(3 * TILE)
  .mark('left')
  .turn(90)
  .forward(TILE)
  .mark('straight-1')
  .forward(TILE)
  .mark('right')
  .turn(-90)
  .forward(2 * TILE)
  .arc(TILE / 2, 90)
  .forward(TILE)
  .arc(TILE / 2, 90)
  .forward(3 * TILE)
  .mark('straight-2')
  .forward(2 * TILE)
  .turn(90)
  .forward(4 * TILE)
  .turn(90)
  .close()

const RCJ_GAPS: Course = {
  id: 'rcj-gaps',
  name: 'RoboCupJunior · เส้นขาด',
  note: 'สนามแผ่นกระเบื้องแบบ RoboCupJunior Rescue Line ตามกติกาข้อ 3.3 — เส้นขาดสี่ช่วงบนทางตรงเท่านั้น ยาว 15–20 ซม. และมีทางตรงอย่างน้อย 5 ซม. ก่อนทุกช่อง ต้องแยกให้ออกว่า "หลุดเพราะเลี้ยวไม่ทัน" กับ "เส้นขาดไปเฉย ๆ" ต่างกันยังไง · ย่อส่วน 1 ซม. = 4 พิกเซล',
  challenge: true,
  smooth: false,
  points: RCJ_GAPS_TRACE.points,
  paint: RCJ_GAPS_TRACE.paint
}

const RCJ_JUNCTIONS: Course = {
  id: 'rcj-junctions',
  name: 'RoboCupJunior · ทางแยก',
  note: 'สนามแผ่นกระเบื้องแบบ RoboCupJunior Rescue Line ตามกติกาข้อ 3.6 — ทางแยกตั้งฉากสี่แห่ง ป้ายเขียวข้างเส้นบอกว่าต้องเลี้ยวทางไหน ไม่มีป้ายคือตรงไป เลี้ยวผิดก็เข้าทางตัน · ป้ายอยู่ก่อนถึงทางแยก พอถึงทางแยกจริงหุ่นก็เลยป้ายไปแล้ว โปรแกรมจึงต้องจำไว้ในตัวแปร · ย่อส่วน 1 ซม. = 4 พิกเซล',
  challenge: true,
  smooth: false,
  points: RCJ_JUNCTIONS_TRACE.points,
  branches: [
    // เลี้ยวซ้าย — ทางตรงไปคือทางตัน
    { at: RCJ_JUNCTIONS_TRACE.marks.left!, to: { x: 540 + TILE, y: 540 } },
    // ตรงไป ไม่มีป้าย แต่ทางตันแยกไปทางซ้ายมือ ฝั่งเดียวกับป้ายที่เพิ่งผ่านมา
    // โปรแกรมที่จำป้ายไว้ตลอดไปไม่ยอมลืม จะเลี้ยวเข้าตรงนี้
    { at: RCJ_JUNCTIONS_TRACE.marks['straight-1']!, to: { x: 540 - TILE, y: 420 } },
    // เลี้ยวขวา — ทางตรงขึ้นไปคือทางตัน
    { at: RCJ_JUNCTIONS_TRACE.marks.right!, to: { x: 540, y: 300 - TILE } },
    // ตรงไป ไม่มีป้าย — ทางที่แยกลงไปทางซ้ายมือคือทางตัน
    { at: RCJ_JUNCTIONS_TRACE.marks['straight-2']!, to: { x: 420, y: 60 + TILE } }
  ]
}

/**
 * สนามแข่งความเร็วแบบ Robotrace (All Japan Micromouse Contest) กับ UKMARS Line Follower
 *
 * ย่อส่วนจากกติกาที่เส้นกว้าง 19 มม. — เส้นในเกมกว้าง 12 พิกเซล จึงราว 6.3 พิกเซลต่อ 1 ซม.
 * ทำตามข้อกำหนดสามข้อ: จุดตัดตั้งฉาก 90° และมีทางตรงก่อนกับหลังจุดตัดอย่างน้อย 10 ซม.
 * ทุกโค้งรัศมีไม่ต่ำกว่า 10 ซม. และมีเครื่องหมายข้างซ้ายของเส้นทุกจุดที่ความโค้งเปลี่ยน
 *
 * รูปร่างเป็นเลขแปดที่สองวงไม่เท่ากัน แต่ละวงเลี้ยวรวม 270° ด้วยโค้ง 90° สามโค้งคั่นด้วยทางตรง
 * วงขวาโค้งแคบรัศมี RACE_TIGHT (ราว 10.5 ซม. ใกล้ขีดต่ำสุดของกติกา) วงซ้ายโค้งกว้างรัศมี RACE_WIDE
 * ทางตรงในวงยาวพอดีให้กึ่งกลางวงอยู่บนเส้นแนวนอนผ่านจุดตัด สองวงจึงสมมาตร และเส้นทแยงตัดกันเป็นมุมฉาก
 */
const RACE_TIGHT = 66

const RACE_WIDE = 100

/** ทางทแยงจากจุดตัดถึงโค้งแรกของแต่ละวง */
const RACE_REACH_RIGHT = 210

const RACE_REACH_LEFT = 180

const RACE_TRACE = trace({ x: 480 - RACE_REACH_LEFT / Math.SQRT2, y: 300 + RACE_REACH_LEFT / Math.SQRT2 }, -45)
  .forward(RACE_REACH_LEFT + RACE_REACH_RIGHT)
  .mark('r1')
  .arc(RACE_TIGHT, -90)
  .mark('r2')
  .forward(144)
  .mark('r3')
  .arc(RACE_TIGHT, -90)
  .mark('r4')
  .forward(144)
  .mark('r5')
  .arc(RACE_TIGHT, -90)
  .mark('r6')
  .forward(RACE_REACH_RIGHT + RACE_REACH_LEFT)
  .mark('l1')
  .arc(RACE_WIDE, 90)
  .mark('l2')
  .forward(80)
  .mark('l3')
  .arc(RACE_WIDE, 90)
  .mark('l4')
  .forward(80)
  .mark('l5')
  .arc(RACE_WIDE, 90)
  .close()

const ROBOTRACE: Course = {
  id: 'robotrace',
  name: 'Robotrace · เลขแปดแข่งความเร็ว',
  note: 'สนามแข่งความเร็วแบบ Robotrace ของญี่ปุ่นกับ UKMARS ของอังกฤษ — จุดตัดตั้งฉากกลางสนามที่ห้ามเลี้ยว วงขวาโค้งแคบเกือบถึงรัศมีต่ำสุด 10 ซม. ตามกติกา วงซ้ายโค้งกว้างกว่า และมีเครื่องหมายข้างซ้ายของเส้นทุกจุดที่เข้าหรือออกโค้ง ซึ่งหุ่นแข่งจริงใช้แบ่งสนามเป็นช่วง ๆ · ย่อส่วนจากเส้นกว้าง 19 มม.',
  challenge: true,
  smooth: false,
  points: RACE_TRACE.points,
  corners: [...['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'l1', 'l2', 'l3', 'l4', 'l5'].map((name) => RACE_TRACE.marks[name]!), 0]
}

/**
 * เขาวงกตบนเส้นแบบคู่มือ Pololu — เส้นบนตาราง หักมุมฉาก ไม่มีวงวน เส้นชัยเป็นวงกลมดำ
 *
 * Pololu ใช้ตารางห่าง 3 นิ้วกับหุ่น 3pi ที่ตัวเล็กกว่าช่อง แต่หุ่นในเกมมีแถวเซนเซอร์ยื่นหน้าล้อ 26 พิกเซล
 * ตารางจึงขยายเป็นช่องละ TILE พิกเซลให้หุ่นมีที่เลี้ยว — รูปแบบอื่นเป็นไปตามคู่มือทั้งหมด
 */
const node = (col: number, row: number): Point => ({ x: TILE / 2 + col * TILE, y: TILE / 2 + row * TILE })

const LINE_MAZE: Course = {
  id: 'line-maze',
  name: 'เขาวงกตบนเส้น (Pololu)',
  note: 'เขาวงกตแบบที่ Pololu ใช้แข่งหุ่นเดินตามเส้น — เส้นบนตารางหักมุมฉาก มีสามแยก สี่แยก และทางตันหลายทาง ไม่มีวงวน เส้นชัยคือวงกลมดำ · ไม่มีป้ายบอกทาง หุ่นต้องเลือกเองทุกทางแยก และกลับหลังเองเมื่อเจอทางตัน',
  challenge: true,
  smooth: false,
  points: [],
  maze: {
    start: node(0, 4),
    heading: -90,
    finish: node(7, 2),
    lines: [
      [node(0, 4), node(0, 1)],
      [node(0, 1), node(2, 1)],
      [node(2, 1), node(2, 0)],
      [node(0, 3), node(2, 3)],
      [node(2, 3), node(2, 2)],
      [node(2, 3), node(4, 3)],
      [node(4, 3), node(4, 4)],
      [node(4, 4), node(6, 4)],
      [node(4, 3), node(4, 1)],
      [node(4, 1), node(6, 1)],
      [node(6, 1), node(6, 0)],
      [node(6, 1), node(6, 2)],
      [node(6, 2), node(7, 2)]
    ]
  }
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

  // ---------- สนามตามกติกาการแข่งจริง ----------
  RCJ_GAPS,
  RCJ_JUNCTIONS,
  ROBOTRACE,
  LINE_MAZE
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
  /** ตารางช่องละ CELL พิกเซล บอกว่าช่องนั้นมีท่อนเส้นที่ "มองเห็นได้" ท่อนไหนผ่านบ้าง — เส้นขาดไม่อยู่ในตาราง */
  grid: Map<number, number[]>
  /**
   * ท่อนของทางแยกหลอก ซอยถี่เท่าเส้นหลัก — ในตารางเก็บเป็นเลขติดลบ (-1 คือท่อนแรก)
   * แยกจากเส้นหลักเพราะเส้นหลักต้องเป็นวงเดียวต่อกัน ใช้นับว่าวิ่งไปได้เท่าไรของรอบ
   */
  spurs: Array<[Point, Point]>
  /** ป้ายเขียวทุกป้ายของสนาม */
  markers: Marker[]
  /** เขาวงกตบนเส้น — null คือสนามวงปิดธรรมดา */
  maze: MazeGraph | null
}

/** เส้นของเขาวงกตที่หั่นเป็นท่อนระหว่างทางแยก พร้อมระยะทางตามเส้นจากปลายแต่ละข้างถึงเส้นชัย */
export interface MazeGraph {
  finish: Point
  edges: Array<{ from: Point; to: Point; fromLeft: number; toLeft: number }>
}

/** ป้ายเขียวหนึ่งป้าย — สี่เหลี่ยมที่หมุนตามแนวเส้นตรงก่อนถึงทางแยก */
export interface Marker {
  /**
   * green = ป้ายเขียวบอกทางที่ทางแยก (RoboCupJunior)
   * corner = เครื่องหมายข้างซ้ายของเส้นตรงจุดที่ความโค้งเปลี่ยน (Robotrace / UKMARS)
   */
  kind: 'green' | 'corner'
  /** จุดกึ่งกลางของป้าย */
  x: number
  y: number
  /** ทิศของเส้นตรงที่ป้ายวางอยู่ (เรเดียน) */
  angle: number
  side: Side
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

const unit = (from: Point, to: Point): Point => {
  const size = Math.hypot(to.x - from.x, to.y - from.y) || 1
  return { x: (to.x - from.x) / size, y: (to.y - from.y) / size }
}

/**
 * ทางของหุ่นเลี้ยวไปทางไหนที่มุม at — ดูจากทิศก่อนถึงมุมกับทิศหลังผ่านมุม
 * จอมีแกน y ชี้ลง ด้านซ้ายของทิศ (x, y) จึงเป็น (y, -x)
 */
export function turnAt(course: Pick<Course, 'points'>, at: number): Side | null {
  const list = course.points
  const count = list.length
  const incoming = unit(list[(at - 1 + count) % count]!, list[at]!)
  const outgoing = unit(list[at]!, list[(at + 1) % count]!)
  const leftward = outgoing.x * incoming.y - outgoing.y * incoming.x

  if (leftward > 0.5) return 'left'
  if (leftward < -0.5) return 'right'
  return null
}

/** ป้ายเขียวของทางแยกหนึ่งแห่ง — ทางตรงไปไม่มีป้าย */
function markerOf(course: Course, branch: Branch): Marker | null {
  const side = turnAt(course, branch.at)
  if (!side) return null

  const list = course.points
  const corner = list[branch.at]!
  const ahead = unit(list[(branch.at - 1 + list.length) % list.length]!, corner)
  const left = { x: ahead.y, y: -ahead.x }
  const reach = LINE_WIDTH / 2 + MARKER_CLEAR + MARKER_SIZE / 2
  const lateral = side === 'left' ? reach : -reach

  return {
    kind: 'green',
    x: corner.x - ahead.x * reach + left.x * lateral,
    y: corner.y - ahead.y * reach + left.y * lateral,
    angle: Math.atan2(ahead.y, ahead.x),
    side
  }
}

/** เครื่องหมายโค้ง — วางข้างซ้ายของเส้นตรงจุดนั้นพอดี ห่างขอบเส้นเท่าป้ายเขียว */
function cornerOf(course: Course, at: number): Marker {
  const list = course.points
  const point = list[at]!
  const ahead = unit(list[(at - 1 + list.length) % list.length]!, point)
  const reach = LINE_WIDTH / 2 + MARKER_CLEAR + MARKER_SIZE / 2

  return {
    kind: 'corner',
    x: point.x + ahead.y * reach,
    y: point.y - ahead.x * reach,
    angle: Math.atan2(ahead.y, ahead.x),
    side: 'left'
  }
}

/** จุดนั้นอยู่บนป้ายเขียวป้ายไหนไหม */
export function markerUnder(track: Pick<Track, 'markers'>, p: Point): Marker | null {
  const half = MARKER_SIZE / 2
  for (const marker of track.markers) {
    const dx = p.x - marker.x
    const dy = p.y - marker.y
    const along = dx * Math.cos(marker.angle) + dy * Math.sin(marker.angle)
    const across = -dx * Math.sin(marker.angle) + dy * Math.cos(marker.angle)
    if (Math.abs(along) <= half && Math.abs(across) <= half) return marker
  }
  return null
}

/** ซอยทางแยกหลอกเป็นท่อนสั้น ๆ ถี่เท่าเส้นหลัก */
function spursOf(course: Course): Array<[Point, Point]> {
  const pieces: Array<[Point, Point]> = []

  for (const branch of course.branches ?? []) {
    const from = course.points[branch.at]!
    const steps = Math.max(1, Math.ceil(Math.hypot(branch.to.x - from.x, branch.to.y - from.y) / SAMPLE))
    for (let step = 0; step < steps; step++) {
      const at = (t: number): Point => ({ x: from.x + (branch.to.x - from.x) * t, y: from.y + (branch.to.y - from.y) * t })
      pieces.push([at(step / steps), at((step + 1) / steps)])
    }
  }

  return pieces
}

/** หั่นเส้นของเขาวงกตตรงทุกจุดที่เส้นอื่นมาแตะ แล้วหาระยะตามเส้นจากทุกทางแยกถึงเส้นชัย */
function mazeGraph(maze: LineMaze): MazeGraph {
  const key = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`
  const ends = new Map<string, Point>()
  for (const [from, to] of maze.lines) {
    ends.set(key(from), from)
    ends.set(key(to), to)
  }

  const pieces: Array<[Point, Point]> = []
  for (const [from, to] of maze.lines) {
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const cuts = [...ends.values()]
      .map((at) => ({ at, t: ((at.x - from.x) * (to.x - from.x) + (at.y - from.y) * (to.y - from.y)) / (length * length) }))
      .filter(({ at, t }) => t >= 0 && t <= 1 && toSegment(at, from, to) < 0.5)
      .sort((a, b) => a.t - b.t)
    for (let index = 1; index < cuts.length; index++) pieces.push([cuts[index - 1]!.at, cuts[index]!.at])
  }

  // Dijkstra จากเส้นชัยย้อนออกไป — เขาวงกตเล็ก ไล่หาตัวที่ใกล้สุดทีละตัวก็พอ
  const left = new Map<string, number>([[key(maze.finish), 0]])
  const done = new Set<string>()
  for (;;) {
    let best: string | null = null
    for (const [name, value] of left) if (!done.has(name) && (best === null || value < left.get(best)!)) best = name
    if (best === null) break
    done.add(best)
    for (const [from, to] of pieces) {
      for (const [a, b] of [[from, to], [to, from]] as const) {
        if (key(a) !== best) continue
        const through = left.get(best)! + Math.hypot(b.x - a.x, b.y - a.y)
        if (through < (left.get(key(b)) ?? Number.POSITIVE_INFINITY)) left.set(key(b), through)
      }
    }
  }

  return {
    finish: maze.finish,
    edges: pieces.map(([from, to]) => ({
      from,
      to,
      fromLeft: left.get(key(from)) ?? Number.POSITIVE_INFINITY,
      toLeft: left.get(key(to)) ?? Number.POSITIVE_INFINITY
    }))
  }
}

/** จากจุดนั้นต้องวิ่งตามเส้นอีกไกลแค่ไหนถึงเส้นชัย — คิดจากท่อนเส้นที่ใกล้ที่สุด */
export function mazeLeft(graph: MazeGraph, p: Point): number {
  let best = Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY

  for (const edge of graph.edges) {
    const gap = toSegment(p, edge.from, edge.to)
    if (gap > best + 0.01) continue
    const viaFrom = edge.fromLeft + Math.hypot(p.x - edge.from.x, p.y - edge.from.y)
    const viaTo = edge.toLeft + Math.hypot(p.x - edge.to.x, p.y - edge.to.y)
    const here = Math.min(viaFrom, viaTo)
    if (gap < best - 0.01 || here < left) left = here
    best = Math.min(best, gap)
  }

  return left
}

function buildMazeTrack(maze: LineMaze): Track {
  const graph = mazeGraph(maze)
  const spurs: Array<[Point, Point]> = []

  for (const [from, to] of maze.lines) {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / SAMPLE))
    const at = (t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    for (let step = 0; step < steps; step++) spurs.push([at(step / steps), at((step + 1) / steps)])
  }

  const grid = new Map<number, number[]>()
  for (const [index, [from, to]] of spurs.entries()) {
    for (const at of [from, to]) {
      const key = cellKey(Math.floor(at.x / CELL), Math.floor(at.y / CELL))
      const list = grid.get(key)
      if (list?.includes(-(index + 1))) continue
      if (list) list.push(-(index + 1))
      else grid.set(key, [-(index + 1)])
    }
  }

  return {
    points: [{ ...maze.start }],
    along: [0],
    length: mazeLeft(graph, maze.start),
    paint: ['black'],
    grid,
    spurs,
    markers: [],
    maze: graph
  }
}

export function buildTrack(course: Course): Track {
  if (course.maze) return buildMazeTrack(course.maze)

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

  // ทางแยกหลอกเข้าตารางเดียวกัน แต่ใช้เลขติดลบ เซนเซอร์จะได้เห็นเหมือนเส้นดำธรรมดา
  const spurs = spursOf(course)
  for (const [index, [from, to]] of spurs.entries()) {
    for (const at of [from, to]) {
      const key = cellKey(Math.floor(at.x / CELL), Math.floor(at.y / CELL))
      const list = grid.get(key)
      if (list?.includes(-(index + 1))) continue
      if (list) list.push(-(index + 1))
      else grid.set(key, [-(index + 1)])
    }
  }

  const markers = [
    ...(course.branches ?? []).map((branch) => markerOf(course, branch)).filter((item) => item !== null),
    ...(course.corners ?? []).map((at) => cornerOf(course, at))
  ]

  return { points, along, length, paint, grid, spurs, markers, maze: null }
}

/** ช่วงของเส้นที่สีเดียวกันต่อกัน — ใช้วาดสนาม */
export interface PaintRun {
  paint: Paint
  points: Point[]
}

/** แบ่งเส้นทั้งวงเป็นช่วงสีเดียวกัน ช่วงสุดท้ายปิดวงกลับมาจุดแรก */
export function paintRuns(track: Track): PaintRun[] {
  if (track.maze) return []
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
        const [from, to] =
          index < 0 ? track.spurs[-index - 1]! : [track.points[index]!, track.points[(index + 1) % track.points.length]!]
        const gap = toSegment(p, from, to)
        if (gap < best) {
          best = gap
          paint = index < 0 ? 'black' : track.paint[index]!
        }
      }
    }
  }

  // วงกลมเส้นชัยของเขาวงกตเป็นสีดำทั้งวง — ข้างในวงอ่านได้เต็มเหมือนอยู่กลางเส้น
  if (track.maze) {
    const disk = Math.max(0, Math.hypot(p.x - track.maze.finish.x, p.y - track.maze.finish.y) - FINISH_RADIUS)
    if (disk < best) best = disk
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
  /** เซนเซอร์แต่ละตัวอยู่บนป้ายเขียวไหม */
  greens: boolean[]
  /** เซนเซอร์แต่ละตัวอยู่บนเครื่องหมายโค้งไหม */
  corners: boolean[]
  /** เห็นเส้นครั้งล่าสุดทางไหน — -1 ซ้าย · 1 ขวา · 0 ยังไม่เคยหลุด */
  lastSide: number

  time: number
  frame: number

  /** จุดบนเส้นที่ใกล้เซนเซอร์ตัวกลางที่สุด */
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
  const greens: boolean[] = []
  const corners: boolean[] = []

  for (let index = 0; index < SENSOR_COUNT; index++) {
    const at = sensorPoint(run, index)
    const found = nearestLine(run.track, at)
    const value = readingAt(found.gap)
    sensors.push(value)
    colors.push(value >= SEE_THRESHOLD ? found.paint : null)
    const marker = markerUnder(run.track, at)
    greens.push(marker?.kind === 'green')
    corners.push(marker?.kind === 'corner')
  }

  run.sensors = sensors
  run.colors = colors
  run.greens = greens
  run.corners = corners
}

/** เห็นเครื่องหมายโค้งข้างซ้ายไหม — ดูเซนเซอร์ซ้ายสุดกับซ้าย */
export const seesCorner = (run: Pick<Run, 'corners'>): boolean => Boolean(run.corners[0] || run.corners[1])

/**
 * เห็นป้ายเขียวทางฝั่งนั้นไหม — ดูแค่เซนเซอร์สองตัวของฝั่งนั้น (ซ้ายสุด/ซ้าย หรือ ขวา/ขวาสุด)
 * เซนเซอร์ตัวกลางไม่นับ เพราะป้ายอยู่ข้างเส้น ตัวกลางไปอยู่บนป้ายได้ก็ต่อเมื่อหุ่นเบี้ยวออกนอกเส้นแล้ว
 */
export const seesMarker = (run: Pick<Run, 'greens'>, side: Side): boolean =>
  side === 'left' ? Boolean(run.greens[0] || run.greens[1]) : Boolean(run.greens[3] || run.greens[4])

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
  // เขาวงกตไม่มีทางวิ่งตายตัว จึงใช้ทิศที่ตั้งไว้กับสนามแทน
  const start = track.points[0]!
  const next = course.maze
    ? {
        x: start.x + Math.cos((course.maze.heading * Math.PI) / 180),
        y: start.y + Math.sin((course.maze.heading * Math.PI) / 180)
      }
    : track.points[track.along.findIndex((along) => along >= SENSOR_AHEAD)]!

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
    greens: [],
    corners: [],
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
  // เขาวงกต — ห่างจากเส้นไหนก็ได้ที่ใกล้สุด และคืบหน้าเท่ากับระยะตามเส้นที่หายไปจากตอนออกตัว
  const maze = run.track.maze
  if (maze) {
    run.offset = distanceToLine(run.track, run)
    run.progress = run.track.length - mazeLeft(maze, run)
    run.furthest = Math.max(run.furthest, run.progress)
    return
  }

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

  const maze = run.track.maze
  const arrived = maze
    ? Math.hypot(run.x - maze.finish.x, run.y - maze.finish.y) <= FINISH_RADIUS
    : run.progress >= run.track.length

  if (arrived) {
    run.over = 'finished'
    // ตัวหุ่นแตะขอบวงกลมเส้นชัยก็นับว่าถึง ไม่ต้องรอให้ถึงจุดกลางวง
    run.progress = run.furthest = run.track.length
  } else if (run.offset > OFF_TRACK) {
    run.over = 'lost'
    // ห่างจากทางของตัวเองก็จริง แต่ตัวยังคร่อมเส้นอยู่ — แปลว่าไปเกาะเส้นท่อนอื่นที่ตัดผ่านมา
    run.strayed = !maze && distanceToLine(run.track, run) < LINE_WIDTH
  } else if (run.time >= TIME_LIMIT) run.over = 'timeout'
}

/** เดินไปหนึ่งช่วงตัดสินใจ (DECIDE_EVERY เฟรม) */
export function advanceDecision(run: Run): void {
  for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
}

/** คำที่ใช้เรียกการจบแบบสำเร็จ — สนามวงปิดคือครบรอบ เขาวงกตคือถึงเส้นชัย */
export const goalWord = (course: Pick<Course, 'maze'>): string => (course.maze ? 'ถึงเส้นชัย' : 'ครบรอบ')

/** ความคืบหน้าเทียบกับอะไร — รอบของสนาม หรือทางจากจุดเริ่มถึงเส้นชัย */
export const progressWord = (course: Pick<Course, 'maze'>): string => (course.maze ? 'ของทาง' : 'ของรอบ')

/** สรุปว่ารอบนี้จบยังไง และควรแก้ตรงไหน — ใช้เขียนข้อความตอนจบ */
export function adviceFor(run: Run): string {
  if (run.over === 'finished') {
    if (run.track.maze) {
      return `ถึงเส้นชัยแล้ว — ทางที่สั้นที่สุดยาว ${Math.round(run.track.length)} พิกเซล ลองดูรอยว่าเข้าทางตันไปกี่แห่ง ถ้าจำทางไว้ได้ รอบหน้าจะไม่ต้องเข้าเลย`
    }
    return averageOffset(run) > 6
      ? 'ครบรอบแล้ว แต่ส่ายห่างเส้นอยู่มาก ลองเลี้ยวให้นุ่มลงแล้วดูว่าเร็วขึ้นไหม'
      : 'ครบรอบแล้ว และเกาะเส้นได้แนบ ลองเร่งกำลังมอเตอร์ดูว่ายังเกาะอยู่ไหม'
  }

  if (run.over === 'lost' && run.track.maze) {
    return 'หลุดออกจากเส้นของเขาวงกต — มักเกิดตอนเลี้ยวเข้าทางแยกแรงเกินจนเลยเส้น หรือหมุนกลับที่ทางตันแล้วหาเส้นไม่เจอ'
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

/** เขาวงกตใช้ได้ไหม — เส้นอยู่ในกรอบ หักมุมฉาก จุดเริ่มอยู่บนเส้น และจากจุดเริ่มไปถึงเส้นชัยได้ */
function checkMaze(course: Course): string | null {
  const maze = course.maze!
  const inside = (at: Point) =>
    at.x >= EDGE_MARGIN && at.y >= EDGE_MARGIN && at.x <= VIEW.width - EDGE_MARGIN && at.y <= VIEW.height - EDGE_MARGIN

  for (const [from, to] of maze.lines) {
    if (!inside(from) || !inside(to)) return 'เส้นของเขาวงกตล้นขอบสนาม'
    if (from.x !== to.x && from.y !== to.y) return 'เส้นของเขาวงกตต้องเป็นแนวนอนหรือแนวตั้งเท่านั้น'
  }

  const track = buildTrack(course)
  if (!Number.isFinite(track.length)) return 'จากจุดเริ่มไปไม่ถึงเส้นชัย'
  if (!Number.isFinite(mazeLeft(track.maze!, maze.finish)) || mazeLeft(track.maze!, maze.finish) > 0.5) {
    return 'เส้นชัยต้องอยู่ที่ปลายของเส้นใดเส้นหนึ่ง'
  }

  const run = createRun({ course })
  if ((run.sensors[2] ?? 0) < SEE_THRESHOLD) return 'หุ่นออกตัวมาแล้วเซนเซอร์ตัวกลางไม่เห็นเส้น'

  return null
}

/** เส้นต้องห่างขอบสนามอย่างน้อยเท่านี้ — ตัวหุ่นกว้างราว 40 พิกเซล ชิดขอบกว่านี้จะวิ่งตกจอ */
const EDGE_MARGIN = 24

/** สนามสั้นกว่านี้วิ่งจบในไม่กี่วินาที เทียบวิธีเลี้ยวอะไรไม่ได้ */
const SHORTEST_TRACK = 600

/**
 * สนามนี้ใช้เล่นได้ไหม — ได้ก็คืน null ไม่ได้ก็คืนเหตุผลเป็นภาษาคน
 * ใช้กับสนามที่วาดเองก่อนบันทึก สนามที่มีมากับเกมก็ต้องผ่านด่านเดียวกัน (มีเทสต์ตรวจ)
 */
export function checkCourse(course: Course): string | null {
  if (course.maze) return checkMaze(course)

  const points = course.points

  if (points.length < 3) return 'วางจุดอย่างน้อย 3 จุด เส้นถึงจะวนกลับมาเป็นวงได้'

  for (let index = 0; index < points.length; index++) {
    const from = points[index]!
    const to = points[(index + 1) % points.length]!
    if (Math.hypot(to.x - from.x, to.y - from.y) < 6) return `จุดที่ ${index + 1} กับจุดถัดไปซ้อนกันเกือบสนิท — ลากแยกออกจากกันหรือลบทิ้งหนึ่งจุด`
  }

  if (paintOf(course, 0) === 'gap') return 'ท่อนแรกที่ออกจากจุดเริ่มต้องเป็นเส้นที่มองเห็นได้ ไม่งั้นหุ่นออกตัวมาก็ไม่เห็นเส้นเลย'

  const track = buildTrack(course)

  const outside = track.points.some(
    (at) => at.x < EDGE_MARGIN || at.y < EDGE_MARGIN || at.x > VIEW.width - EDGE_MARGIN || at.y > VIEW.height - EDGE_MARGIN
  )
  if (outside) return 'เส้นล้นขอบสนาม — โค้งที่ลากผ่านจุดอาจโป่งออกไปนอกจุดที่วาง ลองขยับจุดเข้ามาข้างใน'

  if (track.length < SHORTEST_TRACK) return `สนามสั้นเกินไป (${Math.round(track.length)} พิกเซล) ต้องยาวอย่างน้อย ${SHORTEST_TRACK} พิกเซล`

  if (track.paint.every((paint) => paint === 'gap')) return 'ทั้งสนามเป็นเส้นขาดหมด ไม่มีอะไรให้หุ่นมองเห็นเลย'

  for (const branch of course.branches ?? []) {
    if (course.smooth) return 'ทางแยกใช้ได้กับสนามแบบเส้นตรงเท่านั้น — เส้นโค้งไม่ผ่านมุมที่ทางแยกแตกออกพอดี'
    if (!Number.isInteger(branch.at) || branch.at < 1 || branch.at >= points.length) {
      return 'ทางแยกต้องแตกออกจากมุมของสนาม และห้ามแตกจากจุดเริ่ม'
    }
    const { to } = branch
    if (to.x < EDGE_MARGIN || to.y < EDGE_MARGIN || to.x > VIEW.width - EDGE_MARGIN || to.y > VIEW.height - EDGE_MARGIN) {
      return 'ปลายทางแยกล้นขอบสนาม'
    }
    const from = points[branch.at]!
    if (Math.hypot(to.x - from.x, to.y - from.y) < OFF_TRACK + 20) {
      return `ทางแยกสั้นเกินไป — ต้องยาวอย่างน้อย ${OFF_TRACK + 20} พิกเซล หุ่นที่เข้าผิดทางจะได้หลุดสนามจริง ไม่ใช่วิ่งเลยปลายแล้ววกกลับมาได้`
    }
  }

  const run = createRun({ course })
  if ((run.sensors[2] ?? 0) < SEE_THRESHOLD) {
    return 'ตรงจุดเริ่มเส้นโค้งแรงเกินไป หุ่นออกตัวมาแล้วเซนเซอร์ตัวกลางไม่เห็นเส้น — ให้ท่อนแรกเป็นทางตรงยาวหน่อย'
  }

  return null
}
