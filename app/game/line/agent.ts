import {
  DECIDE_STEP,
  MAX_WHEEL,
  SEE_THRESHOLD,
  SENSOR_COUNT,
  clampPower,
  isLost,
  lapPercent,
  linePosition,
  type Paint,
  speedOf,
  type Drive,
  type Run
} from './engine'

/**
 * ทุกอย่างที่หุ่นรู้ ณ ตอนที่ถูกถาม
 *
 * ส่งใหม่ทุกครั้งที่ตัดสินใจ (30 ครั้งต่อวินาที) และมีแต่สิ่งที่เซนเซอร์ใต้ท้องอ่านได้จริง
 * ไม่มีแผนที่สนาม ไม่รู้ว่าโค้งถัดไปเลี้ยวทางไหน — หุ่นแข่งจริงก็ไม่รู้เหมือนกัน
 */
export interface LineState {
  /** ค่าที่เซนเซอร์ห้าตัวอ่านได้ เรียงจากซ้ายสุดไปขวาสุด — 0 คือพื้นขาว 100 คือเส้นดำเต็ม ๆ */
  sensors: number[]

  /** เซนเซอร์ตัวไหนเห็นเส้นบ้าง (ค่าตั้งแต่ 50 ขึ้นไป) */
  seen: boolean[]

  /**
   * เส้นอยู่ตรงไหนใต้แถวเซนเซอร์ — -100 ใต้ตัวซ้ายสุด · 0 ตรงกลาง · 100 ใต้ตัวขวาสุด
   * หลุดเส้นไปแล้วจะตอบสุดขอบฝั่งที่เห็นเส้นครั้งสุดท้าย
   */
  position: number

  /** ไม่มีเซนเซอร์ตัวไหนเห็นเส้นเลย */
  lost: boolean

  /** สีของเส้นที่เซนเซอร์แต่ละตัวเห็น ('black' / 'red') — ไม่เห็นเส้นเป็น null */
  colors: Array<Paint | null>

  /** ตัวหุ่นวิ่งเร็วกี่พิกเซลต่อวินาทีตอนนี้ — มอเตอร์ค่อย ๆ ไล่ตามคำสั่ง ไม่ได้เท่าที่สั่งทันที */
  speed: number

  /** มอเตอร์ 100% วิ่งได้เร็วสุดกี่พิกเซลต่อวินาที */
  topSpeed: number

  /** กำลังมอเตอร์ที่สั่งไว้ครั้งล่าสุด (เปอร์เซ็นต์) */
  left: number
  right: number

  /** เวลาในเกมที่ผ่านไป (วินาที) */
  time: number

  /** วิ่งไปได้กี่ % ของรอบ */
  progress: number

  /** ถูกถามทุกกี่วินาที */
  every: number

  /** เวลาคิดต่อหนึ่งครั้ง (ms) */
  timeBudget: number
}

/** สิ่งที่ step() ตอบกลับมาได้ — ไม่ตอบอะไรเลยถือว่าใช้กำลังมอเตอร์เดิมต่อ */
export type DriveResult = Drive | null

export class LineAgent {
  name = 'Agent'

  /** เรียกทุกครั้งที่ถึงเวลาตัดสินใจ */
  step(_state: LineState): DriveResult {
    throw new Error('Agent ต้อง override เมธอด step(state)')
  }

  /** บอกเกมว่ากำลังดูเซนเซอร์ตัวไหนอยู่ — จอจะวงให้เห็นว่าโปรแกรมใช้ตัวไหนตัดสินใจ */
  watch(_index: number): void {}

  /** เลขเซนเซอร์ที่ใช้ได้จริง — นอกช่วงถูกดันเข้าหาตัวริมสุด */
  private spot(index: number): number {
    return Math.max(0, Math.min(SENSOR_COUNT - 1, Math.trunc(Number(index) || 0)))
  }

  /** ค่าที่เซนเซอร์ตัวนั้นอ่านได้ 0–100 — 0 ซ้ายสุด ถึง 4 ขวาสุด */
  sensor(index: number): number {
    const at = this.spot(index)
    this.watch(at)
    return this.here.sensors[at] ?? 0
  }

  /** เซนเซอร์ตัวนั้นเห็นเส้นไหม */
  sees(index: number): boolean {
    return this.sensor(index) >= SEE_THRESHOLD
  }

  /** มีเซนเซอร์ตัวไหนเห็นเส้นสีนี้อยู่บ้าง — 'red' คือโซนจำกัดความเร็ว */
  seesColor(color: Paint): boolean {
    return this.here.colors.includes(color)
  }

  /** ตั้งกำลังมอเตอร์ซ้ายกับขวาตรง ๆ (−100 ถึง 100) */
  drive(left: number, right: number): Drive {
    return { left: clampPower(Number(left)), right: clampPower(Number(right)) }
  }

  /**
   * วิ่งไปข้างหน้าด้วยกำลัง speed แล้วเลี้ยวเท่ากับ turn
   * turn เป็นบวกคือเลี้ยวขวา (ล้อซ้ายเร็วขึ้น ล้อขวาช้าลง) ติดลบคือเลี้ยวซ้าย
   * ใช้คู่กับ "ตำแหน่งเส้น" ได้ตรง ๆ เพราะเส้นอยู่ขวาก็เป็นบวกเหมือนกัน
   */
  steer(speed: number, turn: number): Drive {
    // ไม่เรียก this.drive ต่อ — worker นับทุกเมธอดที่ถูกเรียก แผงสรุปจะนับว่าใช้บล็อกตั้งมอเตอร์ทั้งที่ไม่ได้ใช้
    return { left: clampPower(Number(speed) + Number(turn)), right: clampPower(Number(speed) - Number(turn)) }
  }

  /** ปิดมอเตอร์ทั้งสองข้าง — หุ่นไถลต่ออีกนิดก่อนหยุดสนิท */
  stop(): Drive {
    return { left: 0, right: 0 }
  }

  /** สภาพของครั้งที่กำลังคิดอยู่ — codegen เขียนบรรทัด this.here = state ให้เองทุกครั้ง */
  here!: LineState
}

/** แปลงรอบที่กำลังวิ่งอยู่ ให้เป็นสิ่งที่โปรแกรมมองเห็น — คัดลอกทุกชั้น แก้ของจริงไม่ได้ */
export function viewOf(run: Run, timeBudget: number): LineState {
  const sensors = [...run.sensors]

  return {
    sensors,
    seen: sensors.map((value) => value >= SEE_THRESHOLD),
    position: linePosition(sensors, run.lastSide),
    lost: isLost(sensors),
    colors: [...run.colors],
    speed: Math.round(speedOf(run)),
    topSpeed: MAX_WHEEL,
    left: run.drive.left,
    right: run.drive.right,
    time: run.time,
    progress: Math.floor(lapPercent(run)),
    every: DECIDE_STEP,
    timeBudget
  }
}
