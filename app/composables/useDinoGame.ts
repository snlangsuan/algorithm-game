import type { ShallowRef } from 'vue'
import { viewOf, type DinoMemory } from '~/game/dino/agent'
import {
  COURSES,
  DECIDE_EVERY,
  DEFAULT_OPTIONS,
  STEP,
  adviceFor,
  advance,
  createRun,
  findCourse,
  levelAt,
  metersOf,
  onGround,
  order,
  speedOf,
  type Action,
  type Outcome,
  type Run
} from '~/game/dino/engine'
import { DinoRunner } from '~/game/dino/runner'
import { SPEEDS, type SpeedOption } from '~/game/dino/pace'
import type { TraceSummary, TraceTick } from '~/game/dino/protocol'
import { DEFAULT_PRESET_ID, DINO_PACK } from '~/game/dino/blocks/pack'
import { usesBlock } from '~/game/blocks/program'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'

export type DinoStatus = 'idle' | 'playing' | 'paused' | 'over' | 'error'

/** ใครบังคับตัวละคร — ตัวผู้เล่นเอง หรือโปรแกรมที่ต่อไว้ */
export type Pilot = 'player' | 'agent'

export interface DinoTrace {
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

export interface DinoResult {
  outcome: Outcome
  distance: number
  /** ไปได้ถึงระดับไหน */
  level: number
  /** สถิติเดิมก่อนรอบนี้ (พิกเซล) — เอาไว้บอกว่ารอบนี้ทำลายสถิติไหม */
  best: number
  /** รอบนี้ทำลายสถิติของลู่นี้หรือเปล่า */
  record: boolean
  /** เวลาในเกมที่ใช้ไป (วินาที) */
  time: number
  cleared: number
  jumps: number
  ducks: number
  /** สั่งท่าตอนที่ทำไม่ได้ไปกี่ครั้ง */
  ignored: number
  topSpeed: number
  /** ชนอะไร และควรทำท่าอะไรถึงจะพ้น */
  hit: string | null
  pilot: Pilot
  ms: number
}

/** ความจำที่โปรแกรมบันทึกไว้ข้ามรอบ — การ์ดฝึกโชว์ขนาดกับข้อความสั้น ๆ */
export interface DinoMemoryInfo {
  label?: string
  bytes: number
}

/** ผลของการฝึกรอบล่าสุด — ระยะของทุกรอบเรียงตามลำดับ เอาไว้วาดกราฟให้เห็นว่าไต่ขึ้นไหม */
export interface DinoTraining {
  running: boolean
  /** เลขรอบฝึก — กดหยุดแล้วเริ่มใหม่เร็ว ๆ รอบเก่าจะได้ไม่ไปปิดสวิตช์ทับรอบใหม่ */
  session: number
  total: number
  /** ระยะของแต่ละรอบ (เมตร) */
  meters: number[]
  error: string | null
}

/** คิดนานเกินนี้ถือว่าโปรแกรมค้าง — เกมเดินตามเวลาจริง รอไม่ได้นาน */
const TIME_BUDGET = 500

/** หยุดเกมทันทีที่จบ แต่รอสักครู่ก่อนเปิดแผ่นสรุป จะได้เห็นจังหวะที่ชนเต็ม ๆ ก่อน */
const RESULT_DELAY = 900

const LOG_LIMIT = 200

const MEMORY_PREFIX = 'dino:memory:'

const MEMORY_LIMIT = 256 * 1024

/**
 * ตอนฝึก รอบหนึ่งวิ่งได้นานสุดกี่วินาทีของเวลาในเกม — กันไว้เผื่อโปรแกรมที่เก่งจนวิ่งไม่ยอมชน
 * ความเร็วไม่มีเพดาน ทุกกฎจึงชนในที่สุดอยู่แล้ว ตัวเลขนี้แค่เป็นเข็มขัดนิรภัย
 */
const TRAIN_LIMIT = 900

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const now = () => (typeof performance === 'object' ? performance.now() : Date.now())

/** เมล็ดสุ่มประจำรอบ — เปลี่ยนใหม่ทุกครั้งที่เริ่ม ลู่จะได้ไม่ซ้ำรอยเดิมทุกที */
const nextSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

const emptyTrace = (): DinoTrace => ({
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

/** ความจำผูกกับ "โปรแกรมไหน" — ตัวอย่างแต่ละชุด และโปรแกรมของฉันแต่ละอัน มีกล่องของตัวเอง */
const memoryKey = (programKey: string): string => `${MEMORY_PREFIX}blocks:${programKey}`

function readMemory(key: string): { data: DinoMemory; bytes: number } | null {
  if (!import.meta.client) return null

  try {
    const raw = localStorage.getItem(key)
    return raw ? { data: JSON.parse(raw) as DinoMemory, bytes: raw.length } : null
  } catch {
    return null
  }
}

interface DinoGame {
  run: Ref<Run>
  seed: Ref<number>
  status: Ref<DinoStatus>
  error: Ref<string | null>
  result: Ref<DinoResult | null>
  overlay: Ref<boolean>
  pilot: Ref<Pilot>
  trace: DinoTrace
  logs: Ref<LogLine[]>
  watched: ShallowRef<number[]>
  agentName: Ref<string>
  source: ComputedRef<string>
  pace: ComputedRef<SpeedOption>
  topSpeed: Ref<number>
  /** ระยะที่ไกลที่สุดของแต่ละลู่ในเซสชันนี้ */
  best: Ref<Record<string, number>>
  /** ท่าที่คนเล่นสั่งค้างไว้ รอใช้ตอนตัดสินใจครั้งถัดไป */
  queued: Ref<Action | null>
  /** กดปุ่มหมอบค้างไว้อยู่ไหม */
  held: Ref<boolean>
  runner: DinoRunner | null
  generation: number
  /** กล่องความจำของโปรแกรมที่เลือกอยู่ */
  memoryKey: ComputedRef<string>
  memory: Ref<DinoMemoryInfo | null>
}

function writeMemory(game: DinoGame, data: DinoMemory): void {
  if (!import.meta.client) return

  try {
    const raw = JSON.stringify(data)
    if (raw.length > MEMORY_LIMIT) return

    localStorage.setItem(game.memoryKey.value, raw)
    game.memory.value = { label: typeof data.label === 'string' ? data.label : undefined, bytes: raw.length }
  } catch {
    // เขียนลงเครื่องไม่ได้ (โหมดส่วนตัว / เต็ม) ก็แค่จำไม่ได้ เกมยังเล่นต่อได้
  }
}

function disposeRunner(game: DinoGame): void {
  game.runner?.dispose()
  game.runner = null
}

function fail(game: DinoGame, message: string): void {
  game.generation++
  disposeRunner(game)

  game.trace.running = false
  game.trace.method = null
  game.error.value = message
  game.status.value = 'error'
}

async function finish(game: DinoGame, outcome: Outcome): Promise<void> {
  const run = game.run.value
  const runner = game.runner

  game.trace.running = false
  game.trace.method = null

  const best = game.best.value[run.course.id] ?? 0
  const record = run.distance > best
  if (record) game.best.value = { ...game.best.value, [run.course.id]: run.distance }

  game.result.value = {
    outcome,
    distance: Math.round(run.distance),
    level: run.level,
    best: Math.round(best),
    record,
    time: run.time,
    cleared: run.cleared,
    jumps: run.jumps,
    ducks: run.ducks,
    ignored: run.ignored,
    topSpeed: Math.round(game.topSpeed.value),
    hit: adviceFor(run.hitBy),
    pilot: game.pilot.value,
    ms: game.trace.ms
  }

  game.status.value = 'over'

  const gen = game.generation

  // ปิด worker หลังโปรแกรมทำ "เมื่อชน" เสร็จแล้วเท่านั้น ความจำที่บันทึกตอนนั้นจะได้ไม่หายไปพร้อม worker
  if (runner) {
    try {
      await runner.finish(viewOf(run, TIME_BUDGET))
    } catch (caught) {
      if (gen === game.generation) game.error.value = caught instanceof Error ? caught.message : String(caught)
    }
    runner.dispose()
    if (game.runner === runner) game.runner = null
  }

  setTimeout(() => {
    if (gen === game.generation && game.status.value === 'over') game.overlay.value = true
  }, RESULT_DELAY)
}

function createRunner(game: DinoGame): DinoRunner {
  return new DinoRunner(game.source.value, {
    timeoutMs: TIME_BUDGET,
    memory: readMemory(game.memoryKey.value)?.data ?? null,
    onMemory: (data) => writeMemory(game, data),
    onTrace: (tick: TraceTick) => {
      game.trace.method = tick.method
      game.trace.depth = tick.depth
      game.trace.calls = tick.calls
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

/** ท่าของครั้งนี้ตอนที่คนเล่นบังคับเอง — ปุ่มกระโดดที่กดไว้มาก่อนปุ่มหมอบที่กดค้าง */
function playerAction(game: DinoGame): Action {
  const queued = game.queued.value
  game.queued.value = null

  if (queued === 'jump') return 'jump'
  return game.held.value ? 'duck' : 'run'
}

/** ถามท่าจากโปรแกรม — คืน null เมื่อรอบถูกยกเลิกไปแล้วระหว่างรอคำตอบ */
async function agentAction(game: DinoGame, gen: number): Promise<Action | null> {
  if (!game.runner) return 'run'

  game.trace.running = true
  const outcome = await game.runner.think(viewOf(game.run.value, TIME_BUDGET))
  if (gen !== game.generation) return null
  game.trace.running = false

  game.watched.value = outcome.watched
  return outcome.action
}

/**
 * หนึ่งช่วงตัดสินใจ — ถามท่าหนึ่งครั้ง แล้วเดินฟิสิกส์ DECIDE_EVERY เฟรม
 *
 * จำนวนเฟรมต่อการตัดสินใจหนึ่งครั้งตายตัว รอบเดียวกันจึงให้ผลเดิมเสมอ
 * ไม่ว่าเครื่องจะเร็วแค่ไหน หรือผู้เล่นจะตั้งความเร็วภาพไว้เท่าไร
 */
async function tickOnce(game: DinoGame, gen: number): Promise<void> {
  const run = game.run.value

  const action = game.pilot.value === 'player' ? playerAction(game) : await agentAction(game, gen)

  if (gen !== game.generation || action === null) return

  order(run, action)

  for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)

  game.topSpeed.value = Math.max(game.topSpeed.value, speedOf(run))

  if (run.over) await finish(game, run.over)
}

/**
 * นาฬิกาของเกม — นอนรอทีเดียวจนถึงเวลาของช่วงถัดไป ไม่ตื่นมาถามซ้ำ ๆ
 * ตัวจับเวลาของเบราว์เซอร์คลาดเคลื่อนได้เสมอ จึงนับเส้นตายสะสมไว้ ไม่ใช่บวกจากเวลาที่ตื่นจริง
 */
async function loop(game: DinoGame, gen: number): Promise<void> {
  const slice = () => (STEP * DECIDE_EVERY * 1000) / game.pace.value.scale

  let deadline = now() + slice()

  while (
    gen === game.generation &&
    (game.status.value === 'playing' || game.status.value === 'paused')
  ) {
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

async function startRun(game: DinoGame, courseId: string, first?: Action): Promise<void> {
  game.generation++
  const gen = game.generation

  disposeRunner(game)

  game.seed.value = nextSeed()
  game.run.value = createRun({ courseId, seed: game.seed.value })

  game.error.value = null
  game.result.value = null
  game.overlay.value = false
  game.watched.value = []
  game.logs.value = []
  game.queued.value = first ?? null
  game.held.value = false
  game.topSpeed.value = speedOf(game.run.value)
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
      await current.begin(viewOf(game.run.value, TIME_BUDGET))
      if (gen !== game.generation) return
    }

    await loop(game, gen)
  } catch (caught) {
    if (gen !== game.generation) return
    fail(game, caught instanceof Error ? caught.message : String(caught))
  }
}

/**
 * วิ่งหนึ่งรอบแบบไม่วาดภาพ ไม่รอนาฬิกา — ถามโปรแกรมรัว ๆ จนชน
 *
 * ใช้ worker ตัวใหม่ทุกรอบเหมือนตอนเล่นจริง โปรแกรมจึงเริ่มจากศูนย์ทุกรอบ
 * สิ่งเดียวที่ข้ามรอบได้คือความจำที่มันบันทึกเอง ซึ่งคือหัวใจของการฝึก
 */
async function trainOnce(game: DinoGame, courseId: string, alive: () => boolean): Promise<number | null> {
  const run = createRun({ courseId, seed: nextSeed() })
  const runner = new DinoRunner(game.source.value, {
    timeoutMs: TIME_BUDGET,
    memory: readMemory(game.memoryKey.value)?.data ?? null,
    onMemory: (data) => writeMemory(game, data)
  })

  try {
    await runner.start()
    await runner.begin(viewOf(run, TIME_BUDGET))

    while (!run.over && run.time < TRAIN_LIMIT) {
      if (!alive()) return null

      const { action } = await runner.think(viewOf(run, TIME_BUDGET))
      order(run, action)
      for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
    }

    await runner.finish(viewOf(run, TIME_BUDGET))
    return metersOf(run.distance)
  } finally {
    runner.dispose()
  }
}

async function train(game: DinoGame, training: DinoTraining, courseId: string, runs: number): Promise<void> {
  if (training.running) return

  training.session++
  const session = training.session
  const alive = () => training.running && training.session === session

  training.running = true
  training.total = runs
  training.meters = []
  training.error = null

  try {
    for (let round = 0; round < runs && alive(); round++) {
      const meters = await trainOnce(game, courseId, alive)
      if (meters === null || !alive()) break

      training.meters = [...training.meters, meters]
    }
  } catch (caught) {
    if (training.session === session) training.error = caught instanceof Error ? caught.message : String(caught)
  } finally {
    if (training.session === session) training.running = false
  }
}

/** กดปุ่มเปล่า ๆ ไม่ได้อยู่ในช่องพิมพ์ และไม่ได้กดพร้อมปุ่มคำสั่ง */
function plainKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false

  const target = event.target as HTMLElement | null
  if (target?.isContentEditable) return false

  return !(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W'])
const DUCK_KEYS = new Set(['ArrowDown', 's', 'S'])

export function useDinoGame() {
  const options = reactive({ ...DEFAULT_OPTIONS })

  const course = computed(() => findCourse(options.courseId))

  const seed = ref(nextSeed())

  // ref ธรรมดา ไม่ใช่ shallowRef — หน้าจออ่านค่าลึก ๆ อย่างตำแหน่งของสิ่งกีดขวางทุกเฟรม
  const run = ref<Run>(createRun({ courseId: options.courseId, seed: seed.value }))

  const status = ref<DinoStatus>('idle')
  const error = ref<string | null>(null)
  const result = ref<DinoResult | null>(null)
  const overlay = ref(false)
  const speed = ref(1)
  const author = ref<AuthorMode>('blocks')

  const pilot = ref<Pilot>('player')

  /**
   * ยุ่งกับบล็อกเมื่อไร ก็ยกพวงมาลัยให้บอทตั้งแต่ตรงนั้น
   * ไม่งั้นแก้บล็อกไปตั้งนาน กดเริ่มแล้วยังเป็นเราเล่นเองอยู่ดี งงว่าโปรแกรมไม่ทำงาน
   */
  const onEdit = () => {
    stop()
    setPilot('agent')
  }

  // ลบโปรแกรมของฉันทิ้ง ความจำที่ฝึกไว้ก็ไม่มีเจ้าของแล้ว ลบตามไปด้วย
  const blocks = useBlockProgram(DINO_PACK, DEFAULT_PRESET_ID, onEdit, {
    onRemove: (key) => {
      try {
        localStorage.removeItem(memoryKey(key))
      } catch {
        // ลบไม่ได้ก็แค่มีของค้างในเครื่อง ไม่กระทบการเล่น
      }
    }
  })

  const trace = reactive<DinoTrace>(emptyTrace())
  const logs = ref<LogLine[]>([])
  const watched = shallowRef<number[]>([])
  const agentName = ref('Agent')
  const source = computed(() => blocks.generated.value.code)

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[1]!)
  const playing = computed(() => status.value === 'playing' || status.value === 'paused')

  const topSpeed = ref(speedOf(run.value))

  /**
   * สถิติของแต่ละลู่ เก็บไว้เท่าที่เปิดหน้านี้ค้างไว้
   * ไม่เขียนลงเครื่อง เพราะเกมนี้วัดกันที่ "โปรแกรมไหนพาไปได้ไกลกว่า" ในรอบเดียวกัน
   * ไม่ใช่การไล่ทำลายสถิติข้ามวัน
   */
  const best = ref<Record<string, number>>({})

  const queued = ref<Action | null>(null)
  const held = ref(false)

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

  const memory = ref<DinoMemoryInfo | null>(null)
  const memoryKeyOf = computed(() => memoryKey(blocks.programKey.value))

  const refreshMemory = () => {
    const found = readMemory(memoryKeyOf.value)
    memory.value = found
      ? { label: typeof found.data.label === 'string' ? found.data.label : undefined, bytes: found.bytes }
      : null
  }

  watch(memoryKeyOf, refreshMemory)
  onMounted(refreshMemory)

  /** โปรแกรมนี้จำอะไรข้ามรอบไหม — ไม่จำก็ฝึกไปก็ไม่เก่งขึ้น */
  const learns = computed(() => usesBlock(blocks.program, ['remember', 'forget', 'dino.swarm-fly', 'dino.swarm-score']))

  const training = reactive<DinoTraining>({
    running: false,
    session: 0,
    total: 0,
    meters: [],
    error: null
  })

  const game: DinoGame = {
    run,
    seed,
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
    topSpeed,
    best,
    queued,
    held,
    runner: null,
    generation: 0,
    memoryKey: memoryKeyOf,
    memory
  }

  function start(first?: Action): Promise<void> {
    // กดวิ่งให้ดูระหว่างฝึก ก็หยุดฝึกก่อน สองงานจะได้ไม่แย่งกันเขียนความจำกล่องเดียวกัน
    training.running = false
    return startRun(game, options.courseId, first)
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
    queued.value = null
    held.value = false
    run.value = createRun({ courseId: options.courseId, seed: seed.value })
    topSpeed.value = speedOf(run.value)
  }

  function pause(): void {
    if (status.value === 'playing') status.value = 'paused'
  }

  function resume(): void {
    if (status.value === 'paused') status.value = 'playing'
  }

  /** ปิดแผ่นสรุปแต่ยังไม่เริ่มใหม่ — ลู่ค้างไว้ให้ดูว่าไปชนตรงไหน */
  function closeResult(): void {
    overlay.value = false
  }

  /** ผู้เล่นสั่งกระโดด — กดตอนยังไม่เริ่มถือว่าเริ่มเกมพร้อมกระโดดเลย */
  function jump(): void {
    if (pilot.value === 'agent') return

    if (status.value === 'idle') {
      void start('jump')
      return
    }

    if (status.value !== 'playing') return
    queued.value = 'jump'
  }

  /** ผู้เล่นกดหมอบค้าง — ปล่อยปุ่มเมื่อไรก็ลุกขึ้นยืน */
  function duck(on: boolean): void {
    if (pilot.value === 'agent') return

    if (on && status.value === 'idle') {
      void start()
      held.value = true
      return
    }

    held.value = on
  }

  function setCourse(id: string): void {
    if (id === options.courseId) return

    stop()
    options.courseId = id
    run.value = createRun({ courseId: id, seed: seed.value })
    topSpeed.value = speedOf(run.value)
  }

  /** สลับว่าใครบังคับ — เปลี่ยนตอนกำลังวิ่งอยู่ก็ถือว่ารอบนั้นจบไปเลย */
  function setPilot(value: Pilot): void {
    if (value === pilot.value) return

    stop()
    pilot.value = value
  }

  const clearLogs = () => {
    logs.value = []
  }

  /** ฝึกรัว ๆ หลายรอบบนลู่ที่เลือกอยู่ — ต้องไม่ได้กำลังวิ่งอยู่ */
  function trainRuns(runs: number): Promise<void> {
    stop()
    setPilot('agent')
    const count = Math.min(1000, Math.max(1, Math.round(Number(runs) || 1)))
    return train(game, training, options.courseId, count)
  }

  function stopTraining(): void {
    training.running = false
  }

  function clearMemory(): void {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(memoryKeyOf.value)
    } catch {
      // ลบไม่ได้ก็ปล่อยไว้ การ์ดจะยังโชว์ของเดิม
      return
    }

    memory.value = null
    training.meters = []
    training.total = 0
  }

  /** ความจำทั้งก้อนของโปรแกรมที่เลือกอยู่ — ไว้ส่งออกเป็นไฟล์ */
  const memoryData = (): DinoMemory | null => readMemory(memoryKeyOf.value)?.data ?? null

  /** เขียนความจำจากไฟล์ทับของเดิม — รอบหน้าโปรแกรมจะเริ่มจากความจำนี้ */
  function importMemory(data: DinoMemory): boolean {
    if (training.running) return false

    writeMemory(game, data)
    training.meters = []
    training.total = 0
    return memory.value !== null
  }

  /** ปุ่มเว้นวรรคทำหน้าที่ต่างกันไปตามสถานะ — เริ่ม กระโดด หรือเล่นต่อ */
  function toggle(): void {
    if (status.value === 'playing') pause()
    else if (status.value === 'paused') resume()
    else void start()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!plainKey(event)) return

    if (JUMP_KEYS.has(event.key)) {
      event.preventDefault()

      if (pilot.value === 'player' && (status.value === 'playing' || status.value === 'idle')) jump()
      else toggle()
      return
    }

    if (DUCK_KEYS.has(event.key)) {
      event.preventDefault()
      duck(true)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      toggle()
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (DUCK_KEYS.has(event.key)) duck(false)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  onScopeDispose(() => {
    training.running = false
    disposeRunner(game)
  })

  return {
    options,
    courses: COURSES,
    course,
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
    topSpeed,
    best,
    bestMeters: computed(() => metersOf(best.value[options.courseId] ?? 0)),
    meters: computed(() => metersOf(run.value.distance)),
    level: computed(() => levelAt(run.value.distance)),
    onGround: computed(() => onGround(run.value)),

    start,
    stop,
    pause,
    resume,
    closeResult,
    jump,
    duck,
    setCourse,
    setPilot,

    memory,
    learns,
    training,
    train: trainRuns,
    stopTraining,
    clearMemory,
    memoryData,
    importMemory
  }
}
