import type { ShallowRef } from 'vue'
import { heroAsMover, viewOf } from '~/game/chase/agent'
import {
  ARENAS,
  DEFAULT_OPTIONS,
  TICK_LIMIT,
  advanceHero,
  aim,
  catcher,
  closestHunter,
  createMatch,
  dueHunters,
  findArena,
  moveHunter,
  normalizeHunters,
  stepHero,
  type Arena,
  type Direction,
  type Match,
  type MatchOptions,
  type Outcome,
  type Point
} from '~/game/chase/engine'
import { ChaseRunner } from '~/game/chase/runner'
import { SPEEDS, type SpeedOption } from '~/game/chase/pace'
import type { TraceSummary, TraceTick } from '~/game/chase/protocol'
import { CHASE_PACK, DEFAULT_PRESET_ID } from '~/game/chase/blocks/pack'
import { DEFAULT_RUNNER_PRESET_ID, RUNNER_PACK } from '~/game/chase/blocks/runner'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'
import type { Reason } from '~/game/shared/reason'

export type ChaseStatus = 'idle' | 'playing' | 'paused' | 'over' | 'error'

/** สองฝ่ายที่เขียนอัลกอริทึมได้ — ฝ่ายไล่คุมผู้ไล่ล่าทุกตัว ฝ่ายหนีคุมคนหนี */
export type Side = 'hunter' | 'runner'

export const SIDES: Array<{ value: Side; label: string; note: string }> = [
  { value: 'hunter', label: 'ฝ่ายไล่', note: 'คุมผู้ไล่ล่าทุกตัวด้วยโปรแกรมชุดเดียว' },
  { value: 'runner', label: 'ฝ่ายหนี', note: 'คุมคนหนี ใช้เมื่อไม่ได้เล่นเอง' }
]

/** ใครบังคับคนหนี — ตัวผู้เล่นเอง หรือโปรแกรมที่ผู้เล่นต่อไว้ */
export type HeroControl = 'player' | 'agent'

/** ค่าตั้งสนามทั้งหมดที่หน้าจอปรับได้ */
export type ChaseOptions = MatchOptions & { arenaId: string }

export interface ChaseTrace {
  running: boolean
  method: string | null
  depth: number
  calls: number
  counts: Record<string, number>

  /** เวลาที่ AI ฝ่ายนี้ใช้คิดรวมทั้งรอบ (ms) */
  ms: number

  line: number | null
  lines: Record<number, number>
  traced: boolean
}

export interface ChaseResult {
  outcome: Outcome
  /** ผ่านไปกี่จังหวะ */
  ticks: number
  taken: number
  total: number

  /** ผู้ไล่ล่าตัวที่จับได้ — null ถ้าไม่ได้จบด้วยการโดนจับ */
  caughtBy: number | null

  /** ผู้ไล่ล่าเข้ามาใกล้ที่สุดกี่ช่องตลอดรอบ */
  closest: number

  /** รอบนี้คนหนีเป็นคนเล่นเอง หรือเป็น AI */
  control: HeroControl
  ms: number
}


/** คิดนานเกินนี้ถือว่าโปรแกรมค้าง — เกมเดินตามเวลาจริง รอไม่ได้นาน */
const TIME_BUDGET = 1000

/**
 * หยุดเกมทันทีที่จบรอบ แต่รอสักครู่ก่อนเปิดแผ่นสรุป
 * จะได้เห็นจังหวะที่โดนจับเต็ม ๆ ก่อน แล้วค่อยอ่านว่าเกิดอะไรขึ้น
 */
const RESULT_DELAY = 900

const LOG_LIMIT = 200

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * เมล็ดสุ่มประจำรอบ — เปลี่ยนใหม่ทุกครั้งที่กดเริ่ม
 *
 * กติกากับ AI ทั้งสองฝ่ายเป็นสูตรตายตัว ถ้าสนามตั้งต้นเหมือนเดิมเป๊ะด้วย
 * ทุกรอบก็จะเดินทางเดิมแล้วไปจบที่ช่องเดิมทุกครั้ง เมล็ดนี้เปลี่ยนว่าผู้ไล่ล่าเกิดมุมไหน
 * และใครออกตัวก่อนกี่เศษก้าว — กติกาไม่เปลี่ยน แต่เกมไม่ซ้ำรอยเดิม
 */
const nextSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

const now = () => (typeof performance === 'object' ? performance.now() : Date.now())

const emptyTrace = (): ChaseTrace => ({
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

/** สมองหนึ่งฝ่าย — โปรแกรมบล็อก, worker ที่รันโค้ดนั้น และร่องรอยการทำงานของมัน */
interface Brain {
  side: Side
  blocks: ReturnType<typeof useBlockProgram>
  trace: ChaseTrace
  logs: Ref<LogLine[]>
  /** ช่องที่ฝ่ายนี้เปิดดูตอนคิดจังหวะล่าสุด */
  looked: ShallowRef<Point[]>
  /** ตัวเลือกที่แต่ละตัวชั่งก่อนเดินจังหวะล่าสุด — ว่างถ้าบล็อกที่ใช้ไม่ได้บอกเหตุผลไว้ */
  reasons: ShallowRef<Reason[]>
  agentName: Ref<string>
  source: ComputedRef<string>
  runner: ChaseRunner | null
}

interface ChaseRun {
  match: Ref<Match>
  /** เมล็ดสุ่มของรอบที่กำลังจะเล่นหรือเล่นอยู่ */
  seed: Ref<number>
  status: Ref<ChaseStatus>
  error: Ref<string | null>
  notice: Ref<string | null>
  result: Ref<ChaseResult | null>
  overlay: Ref<boolean>
  brains: Record<Side, Brain>
  control: Ref<HeroControl>
  pace: ComputedRef<SpeedOption>
  options: MatchOptions
  generation: number
}

function makeBrain(side: Side, blocks: ReturnType<typeof useBlockProgram>): Brain {
  return {
    side,
    blocks,
    trace: reactive<ChaseTrace>(emptyTrace()),
    logs: ref<LogLine[]>([]),
    looked: shallowRef<Point[]>([]),
    reasons: shallowRef<Reason[]>([]),
    agentName: ref('Agent'),
    source: computed(() => blocks.generated.value.code),
    runner: null
  }
}

function disposeBrains(run: ChaseRun): void {
  for (const brain of Object.values(run.brains)) {
    brain.runner?.dispose()
    brain.runner = null
  }
}

/** ฝ่ายที่ต้องโหลดโค้ดในรอบนี้ — ถ้าคนเล่นบังคับเอง ฝ่ายหนีก็ไม่ต้องรัน worker */
const activeSides = (run: ChaseRun): Side[] =>
  run.control.value === 'agent' ? ['hunter', 'runner'] : ['hunter']

function fail(run: ChaseRun, message: string): void {
  run.generation++
  disposeBrains(run)

  for (const brain of Object.values(run.brains)) {
    brain.trace.running = false
    brain.trace.method = null
  }

  run.error.value = message
  run.status.value = 'error'
}

/**
 * จบรอบ — หยุดเกมค้างไว้แล้วเปิดแผ่นสรุปทับสนาม
 * ไม่ปล่อยให้วิ่งต่อทันที เพราะจังหวะที่โดนจับคือจังหวะที่ต้องดูให้ชัดว่าเกิดอะไรขึ้น
 */
function finish(run: ChaseRun, outcome: Outcome): void {
  const match = run.match.value

  match.over = outcome

  for (const brain of Object.values(run.brains)) {
    brain.trace.running = false
    brain.trace.method = null
    brain.runner?.notifyFinish(outcome === 'caught', match.tick)
  }

  run.result.value = {
    outcome,
    ticks: match.tick,
    taken: match.taken,
    total: match.arena.gems.length,
    caughtBy: match.caughtBy,
    closest: Number.isFinite(match.closest) ? match.closest : 0,
    control: run.control.value,
    ms: run.brains.hunter.trace.ms + run.brains.runner.trace.ms
  }

  run.status.value = 'over'
  disposeBrains(run)

  const gen = run.generation
  setTimeout(() => {
    if (gen === run.generation && run.status.value === 'over') run.overlay.value = true
  }, RESULT_DELAY)
}

function createRunner(brain: Brain): ChaseRunner {
  return new ChaseRunner(brain.source.value, {
    timeoutMs: TIME_BUDGET,
    onTrace: (tick: TraceTick) => {
      brain.trace.method = tick.method
      brain.trace.depth = tick.depth
      brain.trace.calls = tick.calls
      if (tick.line > 0) brain.trace.line = tick.line
    },
    onLog: (lines) => {
      const next = [...brain.logs.value, ...lines]
      brain.logs.value = next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
    },
    onSummary: (summary: TraceSummary) => {
      const counts = { ...brain.trace.counts }
      for (const [method, count] of Object.entries(summary.counts)) {
        counts[method] = (counts[method] ?? 0) + count
      }

      const lines = { ...brain.trace.lines }
      for (const [line, count] of Object.entries(summary.lines)) {
        lines[Number(line)] = (lines[Number(line)] ?? 0) + count
      }

      brain.trace.counts = counts
      brain.trace.lines = lines
      brain.trace.calls += summary.calls
      brain.trace.ms += summary.ms
      brain.trace.method = null
    }
  })
}

const reasonsOf = (moves: Array<{ reason?: Reason }>): Reason[] =>
  moves.flatMap((move) => (move.reason ? [move.reason] : []))

/** ให้ AI ฝ่ายหนีเลือกทางหนึ่งก้าว แล้วเดินตามนั้น */
async function moveHeroByAgent(run: ChaseRun, gen: number): Promise<void> {
  const brain = run.brains.runner
  const match = run.match.value
  if (!brain.runner) return

  brain.trace.running = true
  const outcome = await brain.runner.flee({
    ...viewOf(match, TIME_BUDGET),
    me: heroAsMover(match)
  })
  if (gen !== run.generation) return
  brain.trace.running = false

  const move = outcome.moves[0]
  brain.looked.value = outcome.looked
  brain.reasons.value = reasonsOf(outcome.moves)

  if (move && !move.ok && move.note) run.notice.value = move.note
  stepHero(match, move?.dir ?? null)
}

/** จบรอบตั้งแต่ตอนคนหนีเดินหรือยัง — ออกประตูได้ หรือเดินชนผู้ไล่ล่าเข้าเอง */
function endedByHero(run: ChaseRun, heroBefore: Point): boolean {
  const match = run.match.value

  if (match.over === 'escaped') {
    finish(run, 'escaped')
    return true
  }

  const standing = match.hunters.map((hunter) => ({ ...hunter.at }))
  if (catcher(match, heroBefore, standing) === null) return false

  finish(run, 'caught')
  return true
}

/** ให้ AI ฝ่ายไล่สั่งเดินทุกตัวที่ถึงตา — คืน false เมื่อรอบจบหรือถูกยกเลิกไปแล้ว */
async function moveHunters(run: ChaseRun, gen: number, heroBefore: Point): Promise<boolean> {
  const match = run.match.value
  const brain = run.brains.hunter

  const due = dueHunters(match, run.options.hunterSpeed)
  if (due.length === 0 || !brain.runner) return true

  const before = match.hunters.map((item) => ({ ...item.at }))

  brain.trace.running = true
  const outcome = await brain.runner.think(
    viewOf(match, TIME_BUDGET),
    due.map((item) => item.index)
  )
  if (gen !== run.generation) return false
  brain.trace.running = false

  for (const move of outcome.moves) {
    const target = match.hunters[move.index]
    if (!target) continue

    if (!move.ok && move.note) run.notice.value = move.note
    moveHunter(match, target, move.dir)
  }

  brain.looked.value = outcome.looked
  brain.reasons.value = reasonsOf(outcome.moves)

  if (catcher(match, heroBefore, before) === null) return true

  finish(run, 'caught')
  return false
}

/**
 * หนึ่งจังหวะของเกม — คนหนีขยับก่อนเสมอ แล้วผู้ไล่ล่าที่ถึงตาเดินค่อยขยับตาม
 * ลำดับนี้สำคัญ: ถ้าให้ฝ่ายไล่เดินก่อน คนเล่นจะรู้สึกว่าถูกจับทั้งที่ยังไม่ได้เดินเลย
 */
async function tickOnce(run: ChaseRun, gen: number): Promise<void> {
  const match = run.match.value

  match.tick++
  const heroBefore = { ...match.hero }

  if (run.control.value === 'agent') await moveHeroByAgent(run, gen)
  else advanceHero(match)

  if (gen !== run.generation) return
  if (endedByHero(run, heroBefore)) return
  if (!(await moveHunters(run, gen, heroBefore))) return

  match.closest = Math.min(match.closest, closestHunter(match))

  if (match.tick >= TICK_LIMIT) finish(run, 'timeout')
}

/**
 * นาฬิกาของเกม — นอนรอทีเดียวจนถึงเวลาของจังหวะถัดไป ไม่ตื่นมาถามซ้ำ ๆ
 * ตัวจับเวลาของเบราว์เซอร์คลาดเคลื่อนได้เสมอ จึงนับเส้นตายสะสมไว้ ไม่ใช่บวกจากเวลาที่ตื่นจริง
 */
async function loop(run: ChaseRun, gen: number): Promise<void> {
  let deadline = now() + run.pace.value.tickMs

  while (gen === run.generation && (run.status.value === 'playing' || run.status.value === 'paused')) {
    if (run.status.value === 'paused') {
      await wait(80)
      deadline = now() + run.pace.value.tickMs
      continue
    }

    const left = deadline - now()
    if (left > 4) {
      await wait(left)
      continue
    }

    await tickOnce(run, gen)
    if (gen !== run.generation) return

    // ตกจังหวะแล้วไม่ไล่เก็บย้อนหลัง ไม่งั้นภาพจะกระตุกรวดเดียวหลายช่อง
    deadline = Math.max(now(), deadline + run.pace.value.tickMs)
  }
}

/** เริ่มรอบใหม่ — facing คือทิศที่ผู้เล่นกดจนเป็นเหตุให้เกมเริ่ม จะได้ออกตัวไปทางนั้นเลย */
async function startRun(run: ChaseRun, arena: Arena, facing?: Direction): Promise<void> {
  run.generation++
  const gen = run.generation

  disposeBrains(run)

  // สนามที่โชว์อยู่ยังไม่ถูกเล่น ก็ใช้อันนั้นเลย ผู้ไล่ล่าจะได้เกิดตรงที่เห็นก่อนกดเริ่ม
  // เล่นไปแล้ว (รอบก่อนจบ) ค่อยสุ่มใหม่ ไม่งั้นทุกรอบเกิดซ้ำที่เดิม
  if (run.match.value.tick > 0 || run.match.value.over) run.seed.value = nextSeed()
  run.match.value = createMatch(arena, { ...run.options, seed: run.seed.value })
  if (facing && run.control.value === 'player') aim(run.match.value, facing)

  run.error.value = null
  run.notice.value = null
  run.result.value = null
  run.overlay.value = false

  for (const brain of Object.values(run.brains)) {
    Object.assign(brain.trace, emptyTrace())
    brain.logs.value = []
    brain.looked.value = []
    brain.reasons.value = []
  }

  run.status.value = 'playing'

  try {
    for (const side of activeSides(run)) {
      const brain = run.brains[side]
      const current = createRunner(brain)
      brain.runner = current

      const ready = await current.start()
      if (gen !== run.generation) return

      brain.agentName.value = ready.name
      brain.trace.traced = ready.traced
      current.notifyStart(viewOf(run.match.value, TIME_BUDGET))
    }

    await loop(run, gen)
  } catch (caughtError) {
    if (gen !== run.generation) return
    fail(run, caughtError instanceof Error ? caughtError.message : String(caughtError))
  }
}

/** กดปุ่มเปล่า ๆ ไม่ได้อยู่ในช่องพิมพ์ และไม่ได้กดพร้อมปุ่มคำสั่ง */
function plainKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false

  const target = event.target as HTMLElement | null
  if (target?.isContentEditable) return false

  return !(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left'
}

export function useChaseGame() {
  const options = reactive<ChaseOptions>({ ...DEFAULT_OPTIONS, arenaId: ARENAS[0]!.id })

  const arena = computed(() => findArena(options.arenaId))

  // ref ธรรมดา ไม่ใช่ shallowRef — หน้าจออ่านค่าลึก ๆ อย่าง match.taken กับตำแหน่งผู้ไล่ล่าอยู่ตลอด
  // สนามมีไม่กี่ร้อยช่อง ค่า reactive จึงถูกกว่าการต้องคอยสั่งวาดใหม่เองทุกจังหวะ
  const seed = ref(nextSeed())
  const match = ref<Match>(createMatch(arena.value, { ...options, seed: seed.value }))

  const status = ref<ChaseStatus>('idle')
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const result = ref<ChaseResult | null>(null)
  const overlay = ref(false)
  const speed = ref(1)
  const author = ref<AuthorMode>('blocks')

  /** ฝ่ายที่กำลังเปิดแก้บล็อกอยู่ */
  const side = ref<Side>('hunter')

  const control = ref<HeroControl>('player')

  // แก้บล็อกฝ่ายไหนก็ตาม ถือว่ากติกาเปลี่ยน รอบที่ค้างอยู่จึงถูกหยุดทิ้ง
  const onEdit = () => stop()

  /**
   * ยุ่งกับบล็อกของฝ่ายหนีเมื่อไร ก็ยกพวงมาลัยให้บอทตั้งแต่ตรงนั้น
   *
   * โหมดเล่นเองไม่ได้เรียกบล็อกชุดนี้เลย ตัวเอกเดินหน้าไปเรื่อย ๆ ตามทิศที่หันอยู่
   * เลือกอัลกอริทึมแล้วปล่อยไว้ในโหมดนั้น ทุกรอบจึงออกมาเหมือนเดิมเป๊ะ เหมือนเลือกไปก็เท่านั้น
   * อยากบังคับเองอีกก็กด "เล่นเอง" ได้ ปุ่มอยู่ข้างกันนั่นเอง
   */
  const onRunnerEdit = () => {
    stop()
    setControl('agent')
  }

  const brains: Record<Side, Brain> = {
    hunter: makeBrain('hunter', useBlockProgram(CHASE_PACK, DEFAULT_PRESET_ID, onEdit)),
    runner: makeBrain('runner', useBlockProgram(RUNNER_PACK, DEFAULT_RUNNER_PRESET_ID, onRunnerEdit))
  }

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[1]!)
  const playing = computed(() => status.value === 'playing' || status.value === 'paused')

  /** สมองของฝ่ายที่กำลังดูอยู่ — แผงบล็อก คอนโซล และตัวนับทั้งหมดอ่านจากตัวนี้ */
  const shown = computed(() => brains[side.value])

  const activeBlock = ref<BlockId | null>(null)

  watch(
    () => [side.value, shown.value.trace.line] as const,
    ([, line]) => {
      if (author.value !== 'blocks' || typeof line !== 'number') {
        activeBlock.value = null
        return
      }

      const id = shown.value.blocks.blockAtLine(line)
      activeBlock.value = id ?? null
    }
  )

  const blockCounts = computed<Record<BlockId, number>>(() =>
    author.value === 'blocks' ? shown.value.blocks.blockCounts(shown.value.trace.lines) : {}
  )

  const run: ChaseRun = {
    match,
    seed,
    status,
    error,
    notice,
    result,
    overlay,
    brains,
    control,
    pace,
    options,
    generation: 0
  }

  function start(facing?: Direction): Promise<void> {
    return startRun(run, arena.value, facing)
  }

  function stop(): void {
    if (status.value === 'idle') return

    run.generation++
    disposeBrains(run)

    for (const brain of Object.values(brains)) {
      brain.trace.running = false
      brain.trace.method = null
      brain.looked.value = []
      brain.reasons.value = []
    }

    status.value = 'idle'
    overlay.value = false
    result.value = null
    notice.value = null
    reroll()
  }

  /** สุ่มสนามชุดใหม่ให้เห็นก่อนกดเริ่ม — รอบที่เริ่มถัดไปจะใช้ชุดนี้เป๊ะ */
  function reroll(): void {
    seed.value = nextSeed()
    match.value = createMatch(arena.value, { ...options, seed: seed.value })
  }

  function pause(): void {
    if (status.value === 'playing') status.value = 'paused'
  }

  function resume(): void {
    if (status.value === 'paused') status.value = 'playing'
  }

  /** ปิดแผ่นสรุปแต่ยังไม่เริ่มใหม่ — สนามค้างไว้ให้ดูว่าถูกต้อนตรงไหน */
  function closeResult(): void {
    overlay.value = false
  }

  /**
   * ผู้เล่นสั่งเลี้ยว — กดตอนยังไม่เริ่มถือว่าเริ่มเกมเลย
   * ส่งทิศเข้าไปตั้งแต่ตอนเริ่ม ไม่ใช่รอให้ start() เสร็จ เพราะกว่าจะเสร็จคือจบรอบไปแล้ว
   * จบรอบแล้วปุ่มลูกศรจะไม่เริ่มรอบใหม่เอง ต้องสั่งจากแผ่นสรุปก่อน
   */
  function turn(dir: Direction): void {
    if (control.value === 'agent') return

    if (status.value === 'idle') {
      void start(dir)
      return
    }

    if (status.value !== 'playing') return

    aim(match.value, dir)
  }

  /** เปลี่ยนค่าตั้งสนาม — เปลี่ยนอะไรก็ตาม ถือว่ารอบเดิมใช้ไม่ได้แล้ว ต้องตั้งสนามใหม่ */
  function configure(patch: Partial<ChaseOptions>): void {
    const next: Partial<ChaseOptions> = { ...patch }
    if (typeof next.hunters === 'number') next.hunters = normalizeHunters(next.hunters)

    const keys = Object.keys(next) as Array<keyof ChaseOptions>
    if (keys.every((key) => options[key] === next[key])) return

    stop()
    Object.assign(options, next)
    reroll()
  }

  const setArena = (id: string) => configure({ arenaId: id })
  const setHunters = (count: number) => configure({ hunters: count })
  const setHunterSpeed = (value: number) => configure({ hunterSpeed: value })

  /** สลับว่าคนหนีเป็นคนเล่นเองหรือเป็น AI — เปลี่ยนแล้วพาไปดูบล็อกของฝ่ายนั้นเลย */
  function setControl(value: HeroControl): void {
    if (value === control.value) return

    stop()
    control.value = value
    side.value = value === 'agent' ? 'runner' : 'hunter'
  }

  const clearLogs = () => {
    shown.value.logs.value = []
  }

  /**
   * ปุ่มเว้นวรรค/Enter — พัก เล่นต่อ หรือเริ่มรอบใหม่ แล้วแต่ว่าตอนนี้อยู่สถานะไหน
   * จบรอบแล้วต้องกดปุ่มนี้หรือปุ่มบนแผ่นสรุปเท่านั้น ปุ่มลูกศรจะไม่เริ่มรอบใหม่ให้เอง
   */
  function toggle(): void {
    if (status.value === 'playing') pause()
    else if (status.value === 'paused') resume()
    else void start()
  }

  function onKey(event: KeyboardEvent): void {
    if (!plainKey(event)) return

    const dir = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]

    if (dir && control.value === 'player') {
      event.preventDefault()
      turn(dir)
      return
    }

    if (event.key !== ' ' && event.key !== 'Enter') return

    event.preventDefault()
    toggle()
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
  onScopeDispose(() => disposeBrains(run))

  return {
    options,
    arena,
    match,
    status,
    playing,
    error,
    notice,
    result,
    overlay,
    speed,
    pace,
    author,
    side,
    control,
    brains,
    shown,
    activeBlock,
    blockCounts,
    clearLogs,
    tickLimit: TICK_LIMIT,

    start,
    stop,
    pause,
    resume,
    closeResult,
    turn,
    setArena,
    setHunters,
    setHunterSpeed,
    setControl
  }
}
