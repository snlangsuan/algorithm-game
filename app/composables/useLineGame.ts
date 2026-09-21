import { markRaw, type ShallowRef } from 'vue'
import { viewOf } from '~/game/line/agent'
import {
  COURSES,
  DECIDE_EVERY,
  DEFAULT_COURSE,
  STEP,
  adviceFor,
  advance,
  averageOffset,
  createRun,
  findCourse,
  lapPercent,
  order,
  registerCourse,
  unregisterCourse,
  type Course,
  type Drive,
  type Outcome,
  type Run
} from '~/game/line/engine'
import { LineRunner } from '~/game/line/runner'
import { STORAGE_KEY, parseCourses, serializeCourses } from '~/game/line/custom'
import { SPEEDS, type SpeedOption } from '~/game/line/pace'
import type { TraceSummary, TraceTick } from '~/game/line/protocol'
import { DEFAULT_PRESET_ID, LINE_PACK } from '~/game/line/blocks/pack'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'

export type LineStatus = 'idle' | 'playing' | 'paused' | 'over' | 'error'

/** ใครบังคับหุ่น — ตัวผู้เล่นเองด้วยปุ่มลูกศร หรือโปรแกรมที่ต่อไว้ */
export type LinePilot = 'player' | 'agent'

export interface LineTrace {
  running: boolean
  method: string | null
  depth: number
  calls: number
  counts: Record<string, number>
  /** เวลาที่โปรแกรมใช้คิดรวมทั้งรอบ (ms) */
  ms: number
  line: number | null
  lines: Record<number, number>
  traced: boolean
}

export interface LineResult {
  outcome: Outcome
  /** เวลาในเกมที่ใช้ไป (วินาที) */
  time: number
  /** ไปได้กี่ % ของรอบ */
  percent: number
  /** ห่างเส้นเฉลี่ย / มากสุด (พิกเซล) */
  offset: number
  maxOffset: number
  /** เวลาที่ดีที่สุดของสนามนี้ก่อนรอบนี้ — null คือยังไม่เคยครบรอบ */
  best: number | null
  /** รอบนี้ทำเวลาดีที่สุดของสนามนี้หรือเปล่า */
  record: boolean
  /** จบยังไง และควรแก้อะไรต่อ */
  advice: string
  pilot: LinePilot
  ms: number
}

/** กดปุ่มลูกศรค้างไว้อยู่กี่ปุ่ม — คนเล่นบังคับด้วยการกดค้าง ไม่ใช่กดทีละครั้ง */
export interface LineKeys {
  up: boolean
  left: boolean
  right: boolean
}

/** คิดนานเกินนี้ถือว่าโปรแกรมค้าง — เกมเดินตามเวลาจริง รอไม่ได้นาน */
const TIME_BUDGET = 500

/** หยุดเกมทันทีที่จบ แต่รอสักครู่ก่อนเปิดแผ่นสรุป จะได้เห็นว่าไปจบตรงไหน */
const RESULT_DELAY = 900

const LOG_LIMIT = 200

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const now = () => (typeof performance === 'object' ? performance.now() : Date.now())

/**
 * รอบใหม่บนสนามนั้น — สนามไม่เปลี่ยนตลอดรอบ จึงไม่ต้องให้ Vue คอยจับตา
 * เอนจินค้นหาเส้นหลายร้อยครั้งต่อวินาที ถ้าผ่าน proxy ของ Vue ทุกครั้งจะช้าลงไปเปล่า ๆ
 */
function freshRun(courseId: string): Run {
  const run = createRun({ courseId })
  markRaw(run.track)
  markRaw(run.course)
  return run
}

const emptyTrace = (): LineTrace => ({
  running: false,
  method: null,
  depth: 0,
  calls: 0,
  counts: {},
  ms: 0,
  line: null,
  lines: {},
  traced: false
})

/**
 * กำลังมอเตอร์ตอนคนเล่นบังคับเอง — ลูกศรขึ้นคือวิ่ง ซ้าย/ขวาคือเลี้ยว
 * กดเลี้ยวอย่างเดียวไม่กดขึ้น หุ่นจะหมุนอยู่กับที่ ใช้กู้ตัวตอนหลุดเส้นได้
 */
export function playerDrive(keys: LineKeys): Drive {
  if (keys.up && keys.left && !keys.right) return { left: 25, right: 70 }
  if (keys.up && keys.right && !keys.left) return { left: 70, right: 25 }
  if (keys.up) return { left: 70, right: 70 }
  if (keys.left && !keys.right) return { left: -40, right: 40 }
  if (keys.right && !keys.left) return { left: 40, right: -40 }
  return { left: 0, right: 0 }
}

interface LineGame {
  run: Ref<Run>
  status: Ref<LineStatus>
  error: Ref<string | null>
  result: Ref<LineResult | null>
  overlay: Ref<boolean>
  pilot: Ref<LinePilot>
  trace: LineTrace
  logs: Ref<LogLine[]>
  watched: ShallowRef<number[]>
  agentName: Ref<string>
  source: ComputedRef<string>
  pace: ComputedRef<SpeedOption>
  /** เวลาที่ดีที่สุดของแต่ละสนามในเซสชันนี้ (วินาที) */
  best: Ref<Record<string, number>>
  keys: LineKeys
  runner: LineRunner | null
  generation: number
}

function disposeRunner(game: LineGame): void {
  game.runner?.dispose()
  game.runner = null
}

function fail(game: LineGame, message: string): void {
  game.generation++
  disposeRunner(game)

  game.trace.running = false
  game.trace.method = null
  game.error.value = message
  game.status.value = 'error'
}

function finish(game: LineGame, outcome: Outcome): void {
  const run = game.run.value

  game.trace.running = false
  game.trace.method = null
  disposeRunner(game)

  const best = game.best.value[run.course.id] ?? null
  const record = outcome === 'finished' && (best === null || run.time < best)
  if (record) game.best.value = { ...game.best.value, [run.course.id]: run.time }

  game.result.value = {
    outcome,
    time: run.time,
    percent: Math.floor(lapPercent(run)),
    offset: averageOffset(run),
    maxOffset: run.offsetMax,
    best,
    record,
    advice: adviceFor(run),
    pilot: game.pilot.value,
    ms: game.trace.ms
  }

  game.status.value = 'over'

  const gen = game.generation
  setTimeout(() => {
    if (gen === game.generation && game.status.value === 'over') game.overlay.value = true
  }, RESULT_DELAY)
}

function createRunner(game: LineGame): LineRunner {
  return new LineRunner(game.source.value, {
    timeoutMs: TIME_BUDGET,
    // ไม่แตะยอด calls ตรงนี้ — tick นับแค่ในการคิดครั้งเดียว ถ้าเขียนทับ ยอดรวมทั้งรอบจะหายไป
    onTrace: (tick: TraceTick) => {
      game.trace.method = tick.method
      game.trace.depth = tick.depth
      if (tick.line > 0) game.trace.line = tick.line
    },
    onLog: (lines) => {
      const next = [...game.logs.value, ...lines]
      game.logs.value = next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
    },
    onSummary: (summary: TraceSummary) => {
      const counts = { ...game.trace.counts }
      for (const [method, count] of Object.entries(summary.counts)) {
        counts[method] = (counts[method] ?? 0) + count
      }

      const lines = { ...game.trace.lines }
      for (const [line, count] of Object.entries(summary.lines)) {
        lines[Number(line)] = (lines[Number(line)] ?? 0) + count
      }

      game.trace.counts = counts
      game.trace.lines = lines
      game.trace.calls += summary.calls
      game.trace.ms += summary.ms
      game.trace.method = null
    }
  })
}

/** ถามกำลังมอเตอร์จากโปรแกรม — คืน null เมื่อรอบถูกยกเลิกไปแล้วระหว่างรอคำตอบ */
async function agentDrive(game: LineGame, gen: number): Promise<Drive | null> {
  if (!game.runner) return { left: 0, right: 0 }

  game.trace.running = true
  const outcome = await game.runner.think(viewOf(game.run.value, TIME_BUDGET))
  if (gen !== game.generation) return null
  game.trace.running = false

  game.watched.value = outcome.watched
  return outcome.drive
}

/**
 * หนึ่งช่วงตัดสินใจ — ถามกำลังมอเตอร์หนึ่งครั้ง แล้วเดินฟิสิกส์ DECIDE_EVERY เฟรม
 *
 * จำนวนเฟรมต่อการตัดสินใจหนึ่งครั้งตายตัว โปรแกรมเดิมบนสนามเดิมจึงได้เวลาเดิมเสมอ
 * ไม่ว่าเครื่องจะเร็วแค่ไหน หรือผู้เล่นจะตั้งความเร็วภาพไว้เท่าไร
 */
async function tickOnce(game: LineGame, gen: number): Promise<void> {
  const run = game.run.value

  const drive = game.pilot.value === 'player' ? playerDrive(game.keys) : await agentDrive(game, gen)
  if (gen !== game.generation || drive === null) return

  order(run, drive)
  for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)

  if (run.over) finish(game, run.over)
}

/**
 * นาฬิกาของเกม — นอนรอทีเดียวจนถึงเวลาของช่วงถัดไป ไม่ตื่นมาถามซ้ำ ๆ
 * ตัวจับเวลาของเบราว์เซอร์คลาดเคลื่อนได้เสมอ จึงนับเส้นตายสะสมไว้ ไม่ใช่บวกจากเวลาที่ตื่นจริง
 */
async function loop(game: LineGame, gen: number): Promise<void> {
  const slice = () => (STEP * DECIDE_EVERY * 1000) / game.pace.value.scale

  let deadline = now() + slice()

  while (gen === game.generation && (game.status.value === 'playing' || game.status.value === 'paused')) {
    if (game.status.value === 'paused') {
      await wait(80)
      deadline = now() + slice()
      continue
    }

    const left = deadline - now()
    if (left > 3) {
      await wait(left)
      continue
    }

    await tickOnce(game, gen)
    if (gen !== game.generation) return

    // ตกจังหวะแล้วไม่ไล่เก็บย้อนหลัง ไม่งั้นภาพจะกระโดดรวดเดียวหลายเฟรม
    deadline = Math.max(now(), deadline + slice())
  }
}

async function startRun(game: LineGame, courseId: string): Promise<void> {
  game.generation++
  const gen = game.generation

  disposeRunner(game)

  game.run.value = freshRun(courseId)
  game.error.value = null
  game.result.value = null
  game.overlay.value = false
  game.watched.value = []
  game.logs.value = []
  Object.assign(game.trace, emptyTrace())

  game.status.value = 'playing'

  try {
    if (game.pilot.value === 'agent') {
      const current = createRunner(game)
      game.runner = current

      const ready = await current.start()
      if (gen !== game.generation) return

      game.agentName.value = ready.name
      game.trace.traced = ready.traced
    }

    await loop(game, gen)
  } catch (caught) {
    if (gen !== game.generation) return
    fail(game, caught instanceof Error ? caught.message : String(caught))
  }
}

/** กดปุ่มเปล่า ๆ ไม่ได้อยู่ในช่องพิมพ์ และไม่ได้กดพร้อมปุ่มคำสั่ง */
function plainKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false

  const target = event.target as HTMLElement | null
  if (target?.isContentEditable) return false

  return !(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

const KEY_OF: Record<string, keyof LineKeys> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right'
}

export function useLineGame() {
  const options = reactive({ courseId: DEFAULT_COURSE })

  /** สนามที่วาดเอง — อ่านจากเครื่องตอนเปิดหน้า แล้วลงทะเบียนให้เอนจินหาเจอด้วย id */
  const customCourses = ref<Course[]>([])

  // อ่าน customCourses ด้วย เพื่อให้เปลี่ยนตามเมื่อแก้สนามที่วาดเองซึ่งใช้ id เดิม
  const course = computed(() => customCourses.value.find((item) => item.id === options.courseId) ?? findCourse(options.courseId))

  /** สนามทั้งหมดที่เลือกได้ — ที่มากับเกมก่อน แล้วค่อยสนามที่วาดเอง */
  const courseList = computed(() => [...COURSES, ...customCourses.value])

  const persistCourses = () => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeCourses(customCourses.value))
    } catch {
      // เขียนลงเครื่องไม่ได้ (โหมดส่วนตัว / เต็ม) — สนามยังเล่นได้จนกว่าจะปิดหน้า
    }
  }

  const loadCourses = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      customCourses.value = raw ? parseCourses(JSON.parse(raw)) : []
    } catch {
      customCourses.value = []
    }

    for (const item of customCourses.value) registerCourse(markRaw(item))
  }

  // ref ธรรมดา ไม่ใช่ shallowRef — หน้าจออ่านค่าลึก ๆ อย่างตำแหน่งกับเซนเซอร์ทุกเฟรม
  const run = ref<Run>(freshRun(options.courseId))

  const status = ref<LineStatus>('idle')
  const error = ref<string | null>(null)
  const result = ref<LineResult | null>(null)
  const overlay = ref(false)
  const speed = ref(1)
  const author = ref<AuthorMode>('blocks')

  const pilot = ref<LinePilot>('agent')

  /**
   * ยุ่งกับบล็อกเมื่อไร ก็ยกการบังคับให้บอทตั้งแต่ตรงนั้น
   * ไม่งั้นแก้บล็อกไปตั้งนาน กดเริ่มแล้วยังเป็นเราขับเองอยู่ดี งงว่าโปรแกรมไม่ทำงาน
   */
  const onEdit = () => {
    stop()
    setPilot('agent')
  }

  const blocks = useBlockProgram(LINE_PACK, DEFAULT_PRESET_ID, onEdit)

  const trace = reactive<LineTrace>(emptyTrace())
  const logs = ref<LogLine[]>([])
  const watched = shallowRef<number[]>([])
  const agentName = ref('Agent')
  const source = computed(() => blocks.generated.value.code)

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[1]!)
  const playing = computed(() => status.value === 'playing' || status.value === 'paused')

  /**
   * เวลาที่ดีที่สุดของแต่ละสนาม เก็บไว้เท่าที่เปิดหน้านี้ค้างไว้
   * ไม่เขียนลงเครื่อง เพราะเกมนี้วัดกันที่ "วิธีเลี้ยวแบบไหนเร็วกว่า" ในรอบเดียวกัน
   */
  const best = ref<Record<string, number>>({})

  const keys = reactive<LineKeys>({ up: false, left: false, right: false })

  const activeBlock = ref<BlockId | null>(null)

  watch(
    () => trace.line,
    (line) => {
      if (author.value !== 'blocks' || typeof line !== 'number') {
        activeBlock.value = null
        return
      }

      activeBlock.value = blocks.blockAtLine(line) ?? null
    }
  )

  const blockCounts = computed<Record<BlockId, number>>(() =>
    author.value === 'blocks' ? blocks.blockCounts(trace.lines) : {}
  )

  const game: LineGame = {
    run,
    status,
    error,
    result,
    overlay,
    pilot,
    trace,
    logs,
    watched,
    agentName,
    source,
    pace,
    best,
    keys,
    runner: null,
    generation: 0
  }

  function start(): Promise<void> {
    return startRun(game, options.courseId)
  }

  const releaseKeys = () => {
    keys.up = false
    keys.left = false
    keys.right = false
  }

  function stop(): void {
    if (status.value === 'idle') return

    game.generation++
    disposeRunner(game)

    trace.running = false
    trace.method = null
    watched.value = []
    status.value = 'idle'
    overlay.value = false
    result.value = null
    error.value = null
    releaseKeys()
    run.value = freshRun(options.courseId)
  }

  function pause(): void {
    if (status.value === 'playing') status.value = 'paused'
  }

  function resume(): void {
    if (status.value === 'paused') status.value = 'playing'
  }

  /** ปิดแผ่นสรุปแต่ยังไม่เริ่มใหม่ — สนามค้างไว้ให้ดูรอยที่วิ่งมา */
  function closeResult(): void {
    overlay.value = false
  }

  /** ผู้เล่นกดหรือปล่อยปุ่มบังคับ — กดตอนยังไม่เริ่มถือว่าเริ่มเลย */
  function press(key: keyof LineKeys, on: boolean): void {
    if (pilot.value !== 'player') return

    keys[key] = on
    if (on && status.value === 'idle') void start()
  }

  function setCourse(id: string, force = false): void {
    if (id === options.courseId && !force) return

    stop()
    options.courseId = id
    run.value = freshRun(id)
  }

  /** บันทึกสนามที่วาด — id เดิมคือแก้ทับ id ใหม่คือเพิ่ม แล้วเลือกสนามนั้นให้เลย */
  function saveCourse(next: Course): void {
    const list = customCourses.value.filter((item) => item.id !== next.id)
    const at = customCourses.value.findIndex((item) => item.id === next.id)
    list.splice(at < 0 ? list.length : at, 0, markRaw(next))

    customCourses.value = list
    registerCourse(next)
    persistCourses()
    setCourse(next.id, true)
  }

  function removeCourse(id: string): void {
    customCourses.value = customCourses.value.filter((item) => item.id !== id)
    unregisterCourse(id)
    persistCourses()
    if (options.courseId === id) setCourse(DEFAULT_COURSE, true)
  }

  /** สลับว่าใครบังคับ — เปลี่ยนตอนกำลังวิ่งอยู่ก็ถือว่ารอบนั้นจบไปเลย */
  function setPilot(value: LinePilot): void {
    if (value === pilot.value) return

    stop()
    pilot.value = value
  }

  const clearLogs = () => {
    logs.value = []
  }

  /** ปุ่มเว้นวรรคทำหน้าที่ต่างกันไปตามสถานะ — เริ่ม พัก หรือวิ่งต่อ */
  function toggle(): void {
    if (status.value === 'playing') pause()
    else if (status.value === 'paused') resume()
    else void start()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!plainKey(event)) return

    const key = KEY_OF[event.key]
    if (key && pilot.value === 'player') {
      event.preventDefault()
      press(key, true)
      return
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      toggle()
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    const key = KEY_OF[event.key]
    if (key) keys[key] = false
  }

  onMounted(() => {
    loadCourses()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    // สลับแท็บไปทั้งที่ยังกดปุ่มค้าง keyup จะไม่มาถึง — ปล่อยทุกปุ่มไว้ก่อน หุ่นจะได้ไม่วิ่งเตลิด
    window.addEventListener('blur', releaseKeys)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', releaseKeys)
  })

  onScopeDispose(() => {
    disposeRunner(game)
  })

  return {
    options,
    courses: courseList,
    course,
    saveCourse,
    removeCourse,
    run,
    status,
    playing,
    error,
    result,
    overlay,
    speed,
    pace,
    author,
    pilot,
    blocks,
    source,
    agentName,
    trace,
    logs,
    watched,
    clearLogs,
    activeBlock,
    blockCounts,
    best,
    bestTime: computed<number | null>(() => best.value[options.courseId] ?? null),
    keys,

    start,
    stop,
    pause,
    resume,
    closeResult,
    press,
    setCourse,
    setPilot
  }
}
