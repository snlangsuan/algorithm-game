/**
 * ลู่วิ่งของมอร์ท — กติกาล้วน ๆ ไม่รู้จักหน้าจอและไม่รู้จัก AI
 *
 * เกมแนววิ่งข้างเดียวแบบไดโนของ Chrome: ตัวละครวิ่งไปเรื่อย ๆ แล้วหลบสิ่งกีดขวางที่วิ่งเข้ามาหา
 * การเคลื่อนที่เป็นฟิสิกส์ต่อเนื่องจริง ๆ — มีความเร็ว มีแรงโน้มถ่วง ตำแหน่งเป็นทศนิยม
 * ไม่ใช่การเดินทีละช่อง เพราะการกระโดดที่ขยับทีละขั้นไม่เหมือนการกระโดดเลย
 *
 * ทุกอย่างวัดเป็นพิกเซลของภาพกับวินาที ซึ่งเป็นหน่วยเดียวกับที่คนทำเกมใช้จริง
 * เวลาในเกมเดินเป็นก้าวคงที่ (STEP วินาทีต่อเฟรม) และสมองถูกถามทุก ๆ กี่เฟรมก็ตายตัว
 * เมล็ดสุ่มเดิมกับโปรแกรมเดิมจึงได้ผลเดิมเป๊ะทุกครั้ง ซึ่งจำเป็นทั้งกับเทสต์และหน้าความรู้
 */
import { ART, BODY, BODY_X, DUCK_CLEAR, FLOCK, VIEW, birdBox, type Box, type ObstacleArt } from './art'

/** หนึ่งเฟรมของฟิสิกส์กินเวลากี่วินาที */
export const STEP = 1 / 60

/** ถามสมองทุกกี่เฟรม — 2 เฟรมคือ 30 ครั้งต่อวินาที */
export const DECIDE_EVERY = 2

/** ช่วงเวลาระหว่างการตัดสินใจสองครั้ง (วินาที) */
export const DECIDE_STEP = STEP * DECIDE_EVERY

/** แรงโน้มถ่วง (พิกเซลต่อวินาที²) กับความเร็วตอนดีดตัวขึ้น (พิกเซลต่อวินาที) */
export const GRAVITY = 1150

export const JUMP_SPEED = 350

/** ลอยอยู่กลางอากาศนานกี่วินาทีต่อการกระโดดหนึ่งครั้ง — ไม่เปลี่ยนตามความเร็วของลู่ */
export const AIR_TIME = (2 * JUMP_SPEED) / GRAVITY

/** กระโดดครั้งหนึ่งขึ้นได้สูงสุดกี่พิกเซล — ต้องมากกว่าสิ่งกีดขวางที่สูงที่สุด */
export const JUMP_PEAK = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)

export type ObstacleKind = 'ground' | 'bird'

export const OBSTACLE_LABEL: Record<ObstacleKind, string> = {
  ground: 'ของกีดขวางบนพื้น',
  bird: 'นก'
}

/** สิ่งกีดขวางแต่ละแบบเป็นชนิดไหน */
export const KIND_OF: Record<ObstacleArt, ObstacleKind> = {
  barrel: 'ground',
  stump: 'ground',
  rock: 'ground',
  bird: 'bird'
}

export interface Obstacle {
  id: number
  art: ObstacleArt
  kind: ObstacleKind
  /** ตำแหน่งบนลู่แบบสัมบูรณ์ (พิกเซล) — ขอบซ้ายของกล่องชน */
  x: number
  box: Box
  /** นกมากี่ตัว — ของบนพื้นเป็น 1 เสมอ */
  count: number
}

/** ท่าที่สั่งได้ในหนึ่งครั้งที่ตัดสินใจ */
export type Action = 'jump' | 'duck' | 'run'

export const ACTION_LABEL: Record<Action, string> = {
  jump: 'กระโดด',
  duck: 'หมอบ',
  run: 'วิ่งต่อ'
}

export const isAction = (value: unknown): value is Action =>
  value === 'jump' || value === 'duck' || value === 'run'

// ---------- สนามวิ่ง ----------

export interface Course {
  id: string
  name: string
  /** อธิบายว่าลู่นี้ยากตรงไหน */
  note: string
  /** ความเร็วตอนออกตัว (พิกเซลต่อวินาที) */
  startSpeed: number
  /** วิ่งครบหนึ่งช่วง speedEvery พิกเซล แล้วเร็วขึ้นอีก speedStep — ไต่ขึ้นเรื่อย ๆ ไม่มีเพดาน */
  speedEvery: number
  speedStep: number
  /** ชิ้นถัดไปโผล่ห่างจากชิ้นก่อนกี่วินาที (สุ่มในช่วงนี้) */
  gapSeconds: { min: number; max: number }
  /** สิ่งกีดขวางบนพื้นที่ลู่นี้ใช้ */
  ground: ObstacleArt[]
  /** โอกาสที่ชิ้นถัดไปจะเป็นนก (0 = ลู่นี้ไม่มีนกเลย) */
  birdChance: number
  /** เริ่มมีนกหลังวิ่งไปกี่พิกเซล */
  birdAfter: number
}

export const COURSES: Course[] = [
  {
    id: 'practice',
    name: 'ลู่ฝึกหัด',
    note: 'มีแต่ของบนพื้น ไม่มีนก และเร่งความเร็วช้า ๆ — ลู่สำหรับลองเล่นเองครั้งแรก',
    startSpeed: 260,
    speedEvery: 1200,
    speedStep: 60,
    gapSeconds: { min: 1.1, max: 2 },
    ground: ['barrel', 'stump'],
    birdChance: 0,
    birdAfter: 0
  },
  {
    id: 'classic',
    name: 'ลู่คลาสสิก',
    note: 'ของบนพื้นปนกับนก — นกมาทีละตัวหรือเป็นฝูงสองตัว บินสูงต่ำไม่เท่ากัน บางฝูงต้องกระโดด บางฝูงต้องหมอบลอด ต้องดูก่อนแล้วค่อยเลือกท่า',
    startSpeed: 300,
    speedEvery: 1300,
    speedStep: 62,
    gapSeconds: { min: 1, max: 1.9 },
    ground: ['barrel', 'stump', 'rock'],
    birdChance: 0.32,
    birdAfter: 1200
  },
  {
    id: 'express',
    name: 'ลู่ด่วน',
    note: 'ออกตัวเร็วกว่าและไต่ระดับถี่กว่า — กฎที่ไม่คิดจากความเร็วจะไปได้ไม่ไกลเลย',
    startSpeed: 400,
    speedEvery: 1400,
    speedStep: 70,
    gapSeconds: { min: 0.95, max: 1.75 },
    ground: ['barrel', 'stump', 'rock'],
    birdChance: 0.36,
    birdAfter: 700
  }
]

export const findCourse = (id: string): Course => COURSES.find((item) => item.id === id) ?? COURSES[1]!

// ---------- การวิ่งหนึ่งรอบ ----------

/**
 * วิ่งกี่พิกเซลถึงจะขึ้นระดับหนึ่งขั้น
 *
 * เกมนี้ไม่มีเส้นชัย วิ่งไปเรื่อย ๆ จนกว่าจะชน ระดับจึงเป็นทั้งตัวบอกความยาก
 * และเป็นเป้าหมายแทนเส้นชัย — ยิ่งระดับสูง ลู่ยิ่งเร็วและของยิ่งถี่
 */
export const LEVEL_SPAN = 1200

/** ระดับตอนวิ่งมาได้เท่านี้ — เริ่มที่ 1 */
export const levelAt = (distance: number): number => 1 + Math.floor(Math.max(0, distance) / LEVEL_SPAN)

/** จบรอบได้ทางเดียวคือชน — เกมนี้วิ่งไม่รู้จบ */
export type Outcome = 'crashed'

export interface RunOptions {
  courseId: string
  /**
   * เลขสุ่มประจำรอบ — เปลี่ยนว่าสิ่งกีดขวางเรียงกันยังไง
   * ส่งเลขเดิมมาก็ได้ลู่เดิมเป๊ะ (เทสต์กับหน้าความรู้ต้องการแบบนั้น)
   */
  seed: number
}

export interface Run {
  course: Course
  seed: number
  /** สถานะของตัวสุ่ม เก็บไว้ในรอบเลย รอบเดียวกันจึงเล่นซ้ำได้เสมอ */
  rng: number

  /** วิ่งมาแล้วกี่พิกเซล — เป็นทั้งคะแนนและตำแหน่งของตัวละครบนลู่ */
  distance: number
  /** ระดับความยากตอนนี้ */
  level: number
  /** เวลาในเกมที่ผ่านไป (วินาที) */
  time: number
  frame: number

  /** ความสูงของเท้าจากพื้น (พิกเซล) */
  y: number
  /** ความเร็วแนวตั้ง (พิกเซลต่อวินาที) */
  vy: number
  ducking: boolean

  obstacles: Obstacle[]
  /** สร้างสิ่งกีดขวางไว้ถึงพิกเซลไหนแล้ว */
  frontier: number
  nextId: number

  over: Outcome | null
  /** ชิ้นที่ชน — เอาไว้บอกว่าควรกระโดดหรือควรหมอบ */
  hitBy: Obstacle | null

  jumps: number
  ducks: number
  /** สั่งท่าตอนที่ทำไม่ได้ไปกี่ครั้ง — คำสั่งพวกนั้นตกหายไปเฉย ๆ */
  ignored: number
  /** ผ่านสิ่งกีดขวางมาแล้วกี่ชิ้น */
  cleared: number
}

export const DEFAULT_OPTIONS: RunOptions = { courseId: 'classic', seed: 1 }

/** มองเห็นไปข้างหน้าได้ไกลสุดกี่พิกเซล — เท่ากับขอบขวาของจอพอดี */
export const SIGHT = VIEW.width - BODY_X

/** ตัวสุ่มเล็ก ๆ ที่ให้ลำดับเดิมเสมอเมื่อเมล็ดเดิม — เก็บสถานะไว้ในรอบ ไม่ใช่ในตัวแปรปิด */
function random(run: Run): number {
  run.rng = (run.rng + 0x6d2b79f5) >>> 0
  let t = Math.imul(run.rng ^ (run.rng >>> 15), 1 | run.rng)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * ความเร็วเมื่อวิ่งมาได้เท่านี้ (พิกเซลต่อวินาที)
 *
 * ไต่ขึ้นแบบต่อเนื่อง ไม่ใช่กระโดดเป็นขั้น ผู้เล่นจึงไม่เจอจังหวะที่เกมเปลี่ยนกติกากลางคัน
 * และโปรแกรมที่คำนวณระยะเผื่อจากความเร็ว ก็ไม่มีวันคำนวณจากความเร็วที่ล้าสมัยไปแล้ว
 *
 * ไม่มีเพดาน — นี่คือสิ่งที่ทำให้เกมจบเสมอไม่ว่าจะเขียนกฎเก่งแค่ไหน
 * เพราะสายตามองได้ไกลเท่าเดิม (SIGHT) พอเร็วขึ้นเรื่อย ๆ เวลาที่เห็นของล่วงหน้าก็สั้นลงเรื่อย ๆ
 * จนน้อยกว่าเวลาที่กฎนั้นต้องใช้ กฎที่เผื่อเวลาน้อยกว่าจึงไปได้ไกลกว่า — ระยะทางคือคะแนนของอัลกอริทึม
 */
export function speedAt(course: Course, distance: number): number {
  return course.startSpeed + (Math.max(0, distance) / course.speedEvery) * course.speedStep
}

/**
 * ช่องว่างระหว่างสิ่งกีดขวางที่ระดับนั้น (วินาที)
 *
 * ยิ่งระดับสูงของยิ่งถี่ แต่ไม่ถี่กว่าเวลาที่ใช้กระโดดหนึ่งครั้งบวกเผื่อ
 * ไม่งั้นจะมีจังหวะที่หลบยังไงก็ไม่รอด ซึ่งไม่ใช่ความยาก แต่เป็นความไม่ยุติธรรม
 */
export function gapRangeAt(course: Course, distance: number): { min: number; max: number } {
  const level = levelAt(distance)
  const tighten = Math.min(0.45, (level - 1) * 0.05)
  const floor = AIR_TIME * 1.6

  return {
    min: Math.max(floor, course.gapSeconds.min - tighten),
    max: Math.max(floor + 0.25, course.gapSeconds.max - tighten)
  }
}

export const speedOf = (run: Run): number => speedAt(run.course, run.distance)

export const onGround = (run: Run): boolean => run.y <= 0 && run.vy <= 0

/** กล่องชนของตัวละครตอนนี้ */
export const bodyBox = (run: Run): Box => (run.ducking && onGround(run) ? BODY.duck : BODY.stand)

/** ระยะจากหน้าของตัวละครถึงชิ้นนั้น (พิกเซล) — 0 คือถึงตัวพอดี ติดลบคือผ่านไปแล้ว */
export const gapTo = (run: Run, obstacle: Obstacle): number =>
  obstacle.x - (run.distance + BODY.stand.width)

/** ชิ้นที่ยังไม่ผ่านตัวไป เรียงจากใกล้ไปไกล */
export const ahead = (run: Run): Obstacle[] =>
  run.obstacles.filter((item) => item.x + item.box.width > run.distance)

/** ชิ้นที่มองเห็นอยู่บนจอตอนนี้ — รวมชิ้นที่เพิ่งผ่านไปด้วย จะได้วาดมันวิ่งออกไป */
export const visible = (run: Run): Obstacle[] =>
  run.obstacles.filter(
    (item) => item.x + item.box.width >= run.distance - BODY_X && item.x <= run.distance + SIGHT + 40
  )

/** จำนวนเต็มสุ่มในช่วง [min, max] */
const between = (run: Run, range: { min: number; max: number }): number =>
  range.min + Math.floor(random(run) * (range.max - range.min + 1))

/**
 * สุ่มนกหนึ่งฝูง — มากี่ตัว และบินสูงแค่ไหน
 * ทุกแบบที่ออกมาได้ กระโดดข้ามได้หรือหมอบลอดได้เสมอ (ดูกติกาที่ FLOCK ใน art.ts)
 */
function flockOf(run: Run): { count: number; box: Box } {
  if (random(run) < FLOCK.pairChance) return { count: 2, box: birdBox(2, between(run, FLOCK.pair)) }

  const band = random(run) < FLOCK.lowChance ? FLOCK.low : FLOCK.high
  return { count: 1, box: birdBox(1, between(run, band)) }
}

/**
 * เติมสิ่งกีดขวางให้เต็มระยะที่มองเห็น
 *
 * ระยะห่างคิดเป็น "วินาที" แล้วคูณด้วยความเร็ว ไม่ใช่กำหนดเป็นพิกเซลตายตัว
 * ไม่งั้นพอวิ่งเร็วขึ้น ช่องว่างเท่าเดิมจะเหลือเวลาไม่พอลงพื้นแล้วกระโดดใหม่ — ด่านจะเล่นไม่จบเอง
 */
function fill(run: Run): void {
  const course = run.course

  while (run.frontier < run.distance + SIGHT + 80) {
    const speed = speedAt(course, run.frontier)
    const { min, max } = gapRangeAt(course, run.frontier)
    const seconds = min + random(run) * (max - min)
    const x = run.frontier + seconds * speed

    const bird = course.birdChance > 0 && x >= course.birdAfter && random(run) < course.birdChance

    if (bird) {
      const { count, box } = flockOf(run)
      run.obstacles.push({ id: run.nextId++, art: 'bird', kind: 'bird', x, box, count })
      run.frontier = x + box.width
      continue
    }

    const art: ObstacleArt = course.ground[Math.floor(random(run) * course.ground.length)] ?? 'barrel'
    run.obstacles.push({ id: run.nextId++, art, kind: KIND_OF[art], x, box: ART[art].box, count: 1 })
    run.frontier = x + ART[art].box.width
  }
}

export function createRun(options: Partial<RunOptions> = {}): Run {
  const config: RunOptions = { ...DEFAULT_OPTIONS, ...options }
  const course = findCourse(config.courseId)

  const run: Run = {
    course,
    seed: config.seed,
    rng: config.seed >>> 0,
    distance: 0,
    level: 1,
    time: 0,
    frame: 0,
    y: 0,
    vy: 0,
    ducking: false,
    obstacles: [],
    // ออกตัวมาแล้วมีที่ว่างให้ตั้งตัวก่อน แต่ชิ้นแรกต้องอยู่ในสายตาตั้งแต่ยังไม่กดเริ่ม
    // ไม่งั้นหน้าจอตอนรอเริ่มจะเป็นลู่โล่ง ๆ ที่ไม่บอกอะไรเลยว่าเกมนี้ต้องทำอะไร
    frontier: 120,
    nextId: 1,
    over: null,
    hitBy: null,
    jumps: 0,
    ducks: 0,
    ignored: 0,
    cleared: 0
  }

  fill(run)
  return run
}

/** สั่งกระโดด — กระโดดซ้อนกลางอากาศไม่ได้ คืน false เมื่อสั่งตอนยังลอยอยู่ */
export function jump(run: Run): boolean {
  if (run.over || !onGround(run)) return false

  run.vy = JUMP_SPEED
  run.y = 0.01
  run.ducking = false
  run.jumps++
  return true
}

/** สั่งหมอบหรือเลิกหมอบ — กลางอากาศหมอบไม่ได้ */
export function duck(run: Run, on: boolean): boolean {
  if (run.over) return false
  if (on && !onGround(run)) return false

  if (on && !run.ducking) run.ducks++
  run.ducking = on
  return true
}

/**
 * สั่งท่าที่จะใช้จนกว่าจะตัดสินใจครั้งถัดไป — คืน false ถ้าสั่งสิ่งที่ตอนนี้ทำไม่ได้
 *
 * สั่งกระโดดตอนยังลอยอยู่ คำสั่งนั้นตกหายไปเฉย ๆ ไม่ได้ต่อคิวไว้ให้
 * เกมนับไว้ในช่อง ignored เพื่อบอกได้ว่าโปรแกรมสั่งรัวไปโดยที่มันไม่มีผลอะไรเลย
 */
export function order(run: Run, action: Action): boolean {
  const done = action === 'jump' ? jump(run) : duck(run, action === 'duck')

  if (!done && action !== 'run') run.ignored++
  return done
}

/** ตัวละครกับชิ้นนั้นทับกันอยู่ไหม */
function overlaps(run: Run, obstacle: Obstacle): boolean {
  const body = bodyBox(run)
  const left = run.distance
  const right = left + body.width

  if (obstacle.x >= right || obstacle.x + obstacle.box.width <= left) return false

  const low = run.y + body.bottom
  const high = low + body.height
  const at = obstacle.box

  return at.bottom < high && low < at.bottom + at.height
}

/**
 * เดินฟิสิกส์ไปหนึ่งเฟรม — ท่าที่จะใช้ต้องสั่งไว้ก่อนเรียกตัวนี้
 *
 * ขยับก่อน แล้วค่อยดูว่าทับอะไรอยู่หรือเปล่า เหมือนเกมทั่วไป
 * ก้าวเวลาเล็กพอ (1/60 วินาที คือราว 13 พิกเซลที่ความเร็วสูงสุด) จนไม่มีทางที่ของชิ้นหนึ่ง
 * จะกระโดดข้ามตัวละครไปโดยไม่ถูกตรวจ เพราะของที่แคบที่สุดยังกว้าง 22 พิกเซล
 */
/** ขยับได้ไกลสุดกี่พิกเซลต่อหนึ่งก้าวย่อย — ต้องน้อยกว่าของที่แคบที่สุด ไม่งั้นทะลุกันได้ */
const MAX_SUB_STEP = 8

export function advance(run: Run): void {
  if (run.over) return

  run.frame++
  run.time += STEP

  const speed = speedOf(run)
  const before = run.distance

  /*
   * ยิ่งเร็วยิ่งซอยก้าวถี่ขึ้น — ที่ความเร็วสูงมาก หนึ่งเฟรมของฟิสิกส์กินระยะหลายสิบพิกเซล
   * ถ้าขยับรวดเดียวแล้วค่อยเช็ก ถังที่กว้าง 22 พิกเซลจะข้ามตัวเราไปได้โดยไม่ชนเลย
   */
  const slices = Math.max(1, Math.ceil((speed * STEP) / MAX_SUB_STEP))
  const slice = STEP / slices

  for (let part = 0; part < slices; part++) {
    run.distance += speed * slice

    if (run.y > 0 || run.vy > 0) {
      run.vy -= GRAVITY * slice
      run.y += run.vy * slice

      if (run.y <= 0) {
        run.y = 0
        run.vy = 0
      }
    }

    for (const obstacle of run.obstacles) {
      if (!overlaps(run, obstacle)) continue

      run.level = levelAt(run.distance)
      run.over = 'crashed'
      run.hitBy = obstacle
      return
    }
  }

  run.level = levelAt(run.distance)

  for (const obstacle of run.obstacles) {
    const tail = obstacle.x + obstacle.box.width
    if (tail <= run.distance && tail > before) run.cleared++
  }

  run.obstacles = run.obstacles.filter((item) => item.x + item.box.width >= run.distance - BODY_X)
  fill(run)
}

/** เดินไปหนึ่งช่วงตัดสินใจ (DECIDE_EVERY เฟรม) */
export function advanceDecision(run: Run): void {
  for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
}

/** สรุปว่าควรทำท่าอะไรถึงจะรอด — ใช้เขียนข้อความตอนชน */
export function adviceFor(obstacle: Obstacle | null): string {
  if (!obstacle) return ''
  if (obstacle.kind === 'ground') return 'ของชิ้นนี้อยู่ติดพื้น ต้องกระโดดข้าม'

  const flock = obstacle.count > 1 ? 'ฝูงนกสองตัว' : 'นกตัวนี้'
  return canDuckUnder(obstacle.box)
    ? `${flock}บินสูงพอให้หมอบลอดได้ — ขอบล่างอยู่สูงจากพื้น ${obstacle.box.bottom} พิกเซล`
    : `${flock}บินเรี่ยพื้น หมอบก็ไม่พ้น ต้องกระโดดข้าม`
}

/** ลอดใต้กล่องนี้ได้ไหมถ้าหมอบ */
export const canDuckUnder = (box: Box): boolean => box.bottom >= DUCK_CLEAR

/** วิ่งอีกกี่พิกเซลถึงจะขึ้นระดับถัดไป */
export const toNextLevel = (distance: number): number =>
  LEVEL_SPAN - (Math.max(0, distance) % LEVEL_SPAN)

/** คะแนนที่โชว์บนจอ — นับเป็นเมตร อ่านง่ายกว่าพิกเซล */
export const metersOf = (pixels: number): number => Math.floor(pixels / 10)
