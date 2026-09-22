import {
  AIR_TIME,
  DECIDE_STEP,
  JUMP_PEAK,
  OBSTACLE_LABEL,
  SIGHT,
  ahead,
  bodyBox,
  gapTo,
  onGround,
  speedOf,
  type Action,
  type ObstacleKind,
  type Run
} from './engine'
import { DUCK_CLEAR } from './art'
import { fly, readSwarm, score, valueOf, type Range } from '../line/swarm'

/**
 * ขอบเขตที่ฝูงนกหาในเกมวิ่งหลบ — จังหวะกระโดดกับจังหวะหมอบ (วินาทีก่อนถึงตัว)
 * ช่วงเดียวกับที่ตัวอย่าง GA สุ่มยีนตั้งต้น จะได้เทียบสองวิธีกันตรง ๆ
 */
export const DINO_SPACE: ReadonlyArray<Range<'jump' | 'duck'>> = [
  { key: 'jump', label: 'จังหวะกระโดด', min: 0.05, max: 0.4 },
  { key: 'duck', label: 'จังหวะหมอบ', min: 0.05, max: 0.4 }
]

/** สิ่งกีดขวางหนึ่งชิ้นเท่าที่โปรแกรมมองเห็น */
export interface ObstacleView {
  kind: ObstacleKind
  /** อีกกี่พิกเซลจะถึงตัวเรา — 0 คือถึงตัวพอดี */
  distance: number
  /** อีกกี่วินาทีจะถึงตัวเรา */
  time: number
  width: number
  height: number
  /** ขอบล่างของมันอยู่สูงจากพื้นกี่พิกเซล — 0 คือติดพื้น */
  bottom: number
  /** มากี่ตัว — นกมาทีละตัวหรือเป็นฝูงสองตัว ของบนพื้นเป็น 1 เสมอ */
  count: number
}

/**
 * ทุกอย่างที่มอร์ทรู้ ณ ตอนที่ถูกถาม
 *
 * ส่งใหม่ทุกครั้งที่ตัดสินใจ (30 ครั้งต่อวินาที) และมีแต่ของที่ "มองเห็นได้จริง"
 * ไม่มีลู่ทั้งเส้น ไม่มีของที่ยังอยู่นอกจอ โปรแกรมจึงต้องตัดสินใจจากภาพตรงหน้าเหมือนคนเล่น
 */
export interface DinoState {
  /** วิ่งมาแล้วกี่พิกเซล */
  distance: number

  /** ระดับความยากตอนนี้ — ขึ้นหนึ่งขั้นทุก ๆ ระยะหนึ่ง และลู่ก็ยากขึ้นตาม */
  level: number

  /** เวลาในเกมที่ผ่านไป (วินาที) */
  time: number

  /** ตอนนี้ลู่วิ่งเร็วกี่พิกเซลต่อวินาที — ตัวเลขนี้โตขึ้นเรื่อย ๆ ระหว่างเล่น */
  speed: number

  /** ลอยอยู่กลางอากาศไหม — ลอยอยู่จะสั่งอะไรก็ไม่มีผล */
  airborne: boolean

  /** เท้าสูงจากพื้นกี่พิกเซลตอนนี้ */
  height: number

  ducking: boolean

  /** กระโดดหนึ่งครั้งลอยอยู่กี่วินาที — ค่าคงที่ ไม่ขึ้นกับความเร็วของลู่ */
  airTime: number

  /** กระโดดหนึ่งครั้งขึ้นได้สูงสุดกี่พิกเซล */
  jumpPeak: number

  /** ถูกถามทุกกี่วินาที */
  every: number

  /** สิ่งกีดขวางที่ยังไม่ผ่านตัว เรียงจากใกล้ไปไกล เห็นได้ไกลสุด sight พิกเซล */
  obstacles: ObstacleView[]

  /** ผ่านมาแล้วกี่ชิ้น */
  cleared: number

  /** มองเห็นไกลสุดกี่พิกเซล */
  sight: number

  /** เวลาคิดต่อหนึ่งครั้ง (ms) */
  timeBudget: number
}

/** ท่าที่ step() ตอบกลับมาได้ — ไม่ตอบอะไรเลยถือว่าวิ่งต่อ */
export type ActionResult = Action | null

/** ของที่จำไว้ข้ามรอบ — เก็บลงเครื่องเป็น JSON รอบหน้าเปิดมาก็ยังอยู่ */
export interface DinoMemory {
  label?: string
  [key: string]: unknown
}

export class DinoAgent {
  name = 'Agent'

  /** ความจำที่เก็บไว้จากรอบก่อน ๆ — ยังไม่เคยจำอะไรเลยก็เป็น null */
  memory: DinoMemory | null = null

  /** เรียกทุกครั้งที่ถึงเวลาตัดสินใจ */
  step(_state: DinoState): ActionResult {
    throw new Error('Agent ต้อง override เมธอด step(state)')
  }

  /** เรียกครั้งเดียวก่อนออกวิ่ง */
  onStart(_state: DinoState): void {}

  /** เรียกครั้งเดียวหลังชน — state คือสภาพลู่ตอนที่ชนพอดี ระยะที่วิ่งได้อยู่ในนั้น */
  onFinish(_state: DinoState): void {}

  /** บันทึกความจำลงเครื่อง — ตัวรันเป็นคนเขียนทับเมธอดนี้ */
  saveMemory(_data: DinoMemory): void {}

  /** ค่าของนกที่ลองอยู่รอบนี้ — ยังไม่ได้สั่งให้ฝูงบินก็เป็น null */
  private bird: number[] | null = null

  /** ฝูงนก: นกตัวถัดไปบินหนึ่งก้าวไปยังจังหวะชุดใหม่ แล้วจำฝูงไว้ข้ามรอบ */
  swarmFly(): void {
    const swarm = fly(readSwarm(this.memory?.swarm, DINO_SPACE), Math.random, DINO_SPACE)
    this.bird = swarm.birds[swarm.current]!.at
    this.saveMemory({ ...this.memory, swarm, label: `ฝูงนกบินไปแล้ว ${swarm.turn} ก้าว` })
  }

  /** ฝูงนก: จังหวะที่นกตัวนี้เลือก (วินาที) — ยังไม่ได้สั่งบินก็ได้ค่ากลางของช่วง */
  birdValue(dimension: 'jump' | 'duck'): number {
    if (this.bird) return valueOf(this.bird, dimension, DINO_SPACE)
    const range = DINO_SPACE.find((item) => item.key === dimension)
    return range ? (range.min + range.max) / 2 : 0
  }

  /** ฝูงนก: จังหวะที่ดีที่สุดที่ทั้งฝูงเคยเจอ — ยังไม่มีก็ได้ค่าของนกตัวนี้ */
  swarmBest(dimension: 'jump' | 'duck'): number {
    const swarm = readSwarm(this.memory?.swarm, DINO_SPACE)
    return swarm?.best ? valueOf(swarm.best, dimension, DINO_SPACE) : this.birdValue(dimension)
  }

  /** ฝูงนก: ให้คะแนนนกตัวนี้ — เกมนี้ยิ่งวิ่งไกลยิ่งดี ฝูงเก็บเป็นค่าติดลบเพื่อหาค่าที่น้อยที่สุด */
  swarmScore(value: number): void {
    const swarm = readSwarm(this.memory?.swarm, DINO_SPACE)
    if (!swarm) return
    const next = score(swarm, -Number(value))
    const best = next.bestScore === null ? '' : ` · ไกลสุด ${Math.round(-next.bestScore).toLocaleString()}`
    this.saveMemory({ ...this.memory, swarm: next, label: `ฝูงนกบินไปแล้ว ${next.turn} ก้าว${best}` })
  }

  /** บอกเกมว่ากำลังจ้องชิ้นไหนอยู่ — จอจะตีกรอบให้เห็นว่าโปรแกรมคิดถึงตัวไหน */
  watch(_index: number): void {}

  /** ชิ้นที่ใกล้ที่สุดคือลำดับที่ 1 ถัดไปคือ 2 — ไม่มีก็คืน null */
  look(rank = 1): ObstacleView | null {
    const spot = Math.max(1, Math.trunc(rank))
    const found = this.here.obstacles[spot - 1] ?? null
    if (found) this.watch(spot - 1)
    return found
  }

  /** มีชิ้นนั้นให้เห็นไหม */
  seen(rank = 1): boolean {
    return this.look(rank) !== null
  }

  /**
   * ระยะถึงชิ้นนั้นเป็นพิกเซล — มองไม่เห็นก็คืนระยะสายตา
   * คืนเลขใหญ่แทน null เพื่อให้เอาไปเทียบ "น้อยกว่า" ได้เลยโดยไม่ต้องเช็กก่อนทุกครั้ง
   */
  gap(rank = 1): number {
    return this.look(rank)?.distance ?? this.here.sight
  }

  /**
   * อีกกี่วินาทีชิ้นนั้นจะถึงตัว
   * นี่คือเลขที่ความหมายไม่เปลี่ยนเมื่อลู่เร่งความเร็ว ต่างจากระยะที่เป็นพิกเซล
   */
  timeTo(rank = 1): number {
    const found = this.look(rank)
    const speed = Math.max(1, this.here.speed)
    return found ? found.distance / speed : this.here.sight / speed
  }

  is(rank: number, kind: ObstacleKind): boolean {
    return this.look(rank)?.kind === kind
  }

  /**
   * หมอบแล้วลอดใต้ชิ้นนั้นได้ไหม — ดูจากขอบล่างของมัน ไม่ใช่ชนิด
   * นกที่บินเรี่ยพื้นหมอบก็ไม่พ้น ต้องกระโดด · มองไม่เห็นอะไรก็ตอบว่าไม่ได้
   */
  under(rank = 1): boolean {
    const found = this.look(rank)
    return found ? found.bottom >= DUCK_CLEAR : false
  }

  /** ขอบล่างของชิ้นนั้นสูงจากพื้นกี่พิกเซล — 0 คือติดพื้น */
  bottom(rank = 1): number {
    return this.look(rank)?.bottom ?? 0
  }

  width(rank = 1): number {
    return this.look(rank)?.width ?? 0
  }

  height(rank = 1): number {
    return this.look(rank)?.height ?? 0
  }

  label(kind: ObstacleKind): string {
    return OBSTACLE_LABEL[kind]
  }

  /** แปลงท่าที่สั่งให้เป็นคำตอบของครั้งนี้ */
  act(action: Action): Action {
    return action
  }

  /** สภาพลู่ของครั้งที่กำลังคิดอยู่ — codegen เขียนบรรทัด this.here = state ให้เองทุกครั้ง */
  here!: DinoState
}

/** แปลงรอบที่กำลังเล่นอยู่ ให้เป็นสิ่งที่โปรแกรมมองเห็น — คัดลอกทุกชั้น แก้ของจริงไม่ได้ */
export function viewOf(run: Run, timeBudget: number): DinoState {
  const speed = speedOf(run)

  const obstacles: ObstacleView[] = ahead(run)
    .filter((item) => gapTo(run, item) <= SIGHT)
    .sort((left, right) => left.x - right.x)
    .map((item) => {
      const distance = gapTo(run, item)
      return {
        kind: item.kind,
        distance,
        time: distance / Math.max(1, speed),
        width: item.box.width,
        height: item.box.height,
        bottom: item.box.bottom,
        count: item.count
      }
    })

  return {
    distance: run.distance,
    level: run.level,
    time: run.time,
    speed,
    airborne: !onGround(run),
    height: run.y,
    ducking: run.ducking && onGround(run),
    airTime: AIR_TIME,
    jumpPeak: JUMP_PEAK,
    every: DECIDE_STEP,
    obstacles,
    cleared: run.cleared,
    sight: SIGHT,
    timeBudget
  }
}

/** ความสูงของกล่องชนตอนนี้ — ใช้ตอนวาดภาพประกอบในหน้าความรู้ */
export const bodyHeightOf = (run: Run): number => bodyBox(run).height

export const AGENT_GLOBALS = { AIR_TIME, JUMP_PEAK } as const
