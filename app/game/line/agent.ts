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
  type Side,
  speedOf,
  type Drive,
  type Run
} from './engine'
import { DIMENSIONS, fly, readSwarm, score, valueOf, type Dimension } from './swarm'

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

  /** รอบนี้จบแบบสำเร็จแล้ว (ครบรอบ หรือถึงเส้นชัย) — มีความหมายตอนจบรอบ */
  finished: boolean

  /** สีของเส้นที่เซนเซอร์แต่ละตัวเห็น — ไม่เห็นเส้นเป็น null */
  colors: Array<Paint | null>

  /** เซนเซอร์แต่ละตัวอยู่บนป้ายเขียวข้างเส้นไหม — ป้ายบอกทางที่ทางแยก เรียงจากซ้ายสุดไปขวาสุด */
  greens: boolean[]

  /** เซนเซอร์แต่ละตัวอยู่บนเครื่องหมายโค้งข้างซ้ายของเส้นไหม — เครื่องหมายวางตรงจุดที่เข้าหรือออกโค้ง */
  corners: boolean[]

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

/** ของที่จำไว้ข้ามรอบ — เก็บลงเครื่องเป็น JSON รอบหน้าเปิดมาก็ยังอยู่ */
export interface LineMemory {
  label?: string
  [key: string]: unknown
}

export class LineAgent {
  name = 'Agent'

  /** ความจำที่เก็บไว้จากรอบก่อน ๆ — ยังไม่เคยจำอะไรเลยก็เป็น null */
  memory: LineMemory | null = null

  /** ค่าของนกที่ลองอยู่รอบนี้ — ยังไม่ได้สั่งให้ฝูงบินก็เป็น null */
  private bird: number[] | null = null

  /** เรียกครั้งเดียวก่อนออกวิ่ง */
  onStart(_state: LineState): void {}

  /** เรียกครั้งเดียวตอนรอบจบ ไม่ว่าจะครบรอบ หลุดเส้น หรือหมดเวลา */
  onFinish(_state: LineState): void {}

  /** บันทึกความจำลงเครื่อง — ตัวรันเป็นคนเขียนทับเมธอดนี้ */
  saveMemory(_data: LineMemory): void {}

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

  /**
   * เห็นป้ายเขียวทางฝั่งนั้นไหม ('left' / 'right') — ดูแค่เซนเซอร์สองตัวของฝั่งนั้น
   * ป้ายอยู่ก่อนถึงทางแยก พอถึงทางแยกจริงก็เลยป้ายไปแล้ว ต้องจำไว้เอง
   */
  seesMarker(side: Side): boolean {
    const [outer, inner] = side === 'left' ? [0, 1] : [4, 3]
    return Boolean(this.here.greens[outer!] || this.here.greens[inner!])
  }

  /** เห็นเครื่องหมายโค้งข้างซ้ายไหม — ดูเซนเซอร์ซ้ายสุดกับซ้าย */
  seesCorner(): boolean {
    return Boolean(this.here.corners[0] || this.here.corners[1])
  }

  /** ฝูงนก: นกตัวถัดไปบินหนึ่งก้าวไปยังค่าชุดใหม่ แล้วจำฝูงไว้ข้ามรอบ */
  swarmFly(): void {
    const swarm = fly(readSwarm(this.memory?.swarm), Math.random)
    this.bird = swarm.birds[swarm.current]!.at
    this.saveMemory({ ...this.memory, swarm, label: `ฝูงนกบินไปแล้ว ${swarm.turn} ก้าว` })
  }

  /** ฝูงนก: ค่าที่นกตัวนี้เลือก — ยังไม่ได้สั่งบินก็ได้ค่ากลางของช่วง */
  birdValue(dimension: Dimension): number {
    if (this.bird) return valueOf(this.bird, dimension)
    const range = DIMENSIONS.find((item) => item.key === dimension)
    return range ? (range.min + range.max) / 2 : 0
  }

  /** ฝูงนก: ค่าที่ดีที่สุดที่ทั้งฝูงเคยเจอ — ยังไม่มีก็ได้ค่าของนกตัวนี้ */
  swarmBest(dimension: Dimension): number {
    const swarm = readSwarm(this.memory?.swarm)
    return swarm?.best ? valueOf(swarm.best, dimension) : this.birdValue(dimension)
  }

  /** ฝูงนก: ให้คะแนนนกตัวนี้ — ยิ่งน้อยยิ่งดี ดีกว่าที่เคยก็จำไว้ */
  swarmScore(value: number): void {
    const swarm = readSwarm(this.memory?.swarm)
    if (!swarm) return
    const next = score(swarm, Number(value))
    const best = next.bestScore === null ? '' : ` · ดีที่สุด ${next.bestScore.toFixed(2)}`
    this.saveMemory({ ...this.memory, swarm: next, label: `ฝูงนกบินไปแล้ว ${next.turn} ก้าว${best}` })
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
    finished: run.over === 'finished',
    colors: [...run.colors],
    greens: [...run.greens],
    corners: [...run.corners],
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
