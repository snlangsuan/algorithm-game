import type { ShallowRef } from 'vue'
import type { HanoiState } from '~/game/hanoi/agent'
import {
  DEFAULT_OPTIONS,
  applyMove,
  canMove,
  cloneTowers,
  createHanoi,
  describeIllegal,
  isSolved,
  normalizeDisks,
  optimalMoves,
  pegName,
  solveMoves,
  validateMoves,
  type Hanoi,
  type HanoiOptions,
  type Move,
  type Towers
} from '~/game/hanoi/engine'
import { HanoiRunner } from '~/game/hanoi/runner'
import { SPEEDS, type SpeedOption } from '~/game/hanoi/pace'
import type { AgentMode, ExploredMove } from '~/game/hanoi/protocol'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'
import { DEFAULT_PRESET_ID, HANOI_PACK } from '~/game/hanoi/blocks/pack'

export type HanoiStatus = 'idle' | 'running' | 'paused' | 'finished' | 'error'

export interface HanoiAgentTrace {
  running: boolean
  method: string | null
  depth: number
  calls: number
  counts: Record<string, number>

  ms: number

  line: number | null
  lines: Record<number, number>
  traced: boolean
}

export interface HanoiRunResult {
  ok: boolean
  message: string

  moves: number

  best: number
  ms: number
}

const TIME_BUDGET = 2000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const frame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 16)
  })


const emptyTrace = (): HanoiAgentTrace => ({
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

interface HanoiRun {
  puzzle: ShallowRef<Hanoi>
  status: Ref<HanoiStatus>
  error: Ref<string | null>
  logs: Ref<LogLine[]>
  explored: ShallowRef<ExploredMove[]>
  exploredShown: Ref<number>
  moves: ShallowRef<Move[]>
  states: ShallowRef<Towers[]>
  movesShown: Ref<number>
  result: Ref<HanoiRunResult | null>
  agent: { name: string; mode: AgentMode }
  trace: HanoiAgentTrace
  pace: ComputedRef<SpeedOption>
  moveLimit: ComputedRef<number>
  best: ComputedRef<number>
  source: ComputedRef<string>
  logLimit: number
  timeline: number[]
  generation: number
  runner: HanoiRunner | null
  clear: () => void
}

function disposeRunner(run: HanoiRun): void {
  run.runner?.dispose()
  run.runner = null
}

function stateOf(run: HanoiRun, current: Towers, move: number, last: Move | null): HanoiState {
  const puzzle = run.puzzle.value

  return {
    towers: cloneTowers(current),
    disks: puzzle.disks,
    source: puzzle.source,
    target: puzzle.target,
    spare: puzzle.spare,
    move,
    last: last ? { ...last } : null,
    moveLimit: run.moveLimit.value,
    timeBudget: TIME_BUDGET
  }
}

function fail(run: HanoiRun, message: string): void {
  run.generation++
  disposeRunner(run)
  run.trace.running = false
  run.trace.method = null
  run.error.value = message
  run.status.value = 'error'
}

async function holdWhilePaused(run: HanoiRun, gen: number): Promise<boolean> {
  while (run.status.value === 'paused' && gen === run.generation) await wait(80)
  return gen === run.generation && run.status.value === 'running'
}

async function replay(
  run: HanoiRun,
  gen: number,
  frames: number[],
  offset: number,
  durationMs: number
): Promise<boolean> {
  const points = Math.floor(frames.length / 2)

  const settle = () => {
    const last = points > 0 ? frames[(points - 1) * 2]! : 0
    if (last > 0) run.trace.line = last
    run.exploredShown.value = run.explored.value.length
  }

  if (points === 0 || durationMs <= 0) {
    settle()
    return gen === run.generation
  }

  const perFrame =
    points <= 16 ? 1 : Math.max(1, Math.ceil(points / Math.max(1, (durationMs / 1000) * 60)))
  let cursor = 0

  while (cursor < points) {
    if (!(await holdWhilePaused(run, gen))) return false

    cursor = Math.min(points, cursor + perFrame)
    const index = (cursor - 1) * 2

    run.trace.line = frames[index]!
    run.exploredShown.value = offset + frames[index + 1]!
    await frame()
  }

  settle()
  return gen === run.generation
}

async function animate(run: HanoiRun, gen: number): Promise<boolean> {
  const last = run.moves.value.length

  if (run.pace.value.stepDelay === 0) {
    run.movesShown.value = last
    return true
  }

  while (run.movesShown.value < last) {
    if (!(await holdWhilePaused(run, gen))) return false
    run.movesShown.value++
    await wait(run.pace.value.stepDelay)
  }

  return gen === run.generation
}

function finish(
  run: HanoiRun,
  gen: number,
  current: HanoiRunner,
  ok: boolean,
  message: string,
  count: number
): void {
  if (gen !== run.generation) return

  run.trace.running = false
  run.trace.method = null

  run.result.value = { ok, message, moves: count, best: run.best.value, ms: run.trace.ms }
  run.status.value = 'finished'

  current.notifyFinish(ok, count)
  disposeRunner(run)
}

function createRunner(run: HanoiRun): HanoiRunner {
  return new HanoiRunner(run.source.value, {
    timeoutMs: 5000,
    onTrace: (tick) => {
      run.trace.method = tick.method
      run.trace.depth = tick.depth
      run.trace.calls = tick.calls
      if (tick.line > 0) run.trace.line = tick.line
    },
    onLog: (lines) => {
      const next = [...run.logs.value, ...lines]
      run.logs.value = next.length > run.logLimit ? next.slice(next.length - run.logLimit) : next
    },
    onSummary: (summary) => {
      for (const [method, count] of Object.entries(summary.counts)) {
        run.trace.counts = { ...run.trace.counts, [method]: (run.trace.counts[method] ?? 0) + count }
      }

      const lines = { ...run.trace.lines }
      for (const [line, count] of Object.entries(summary.lines)) {
        lines[Number(line)] = (lines[Number(line)] ?? 0) + count
      }

      run.trace.lines = lines
      run.trace.calls += summary.calls
      run.trace.ms += summary.ms
      run.trace.method = null
    }
  })
}

async function runPlan(run: HanoiRun, gen: number, current: HanoiRunner): Promise<void> {
  const outcome = await current.solve(stateOf(run, run.puzzle.value.towers, 1, null))
  if (gen !== run.generation) return

  run.trace.running = false
  run.explored.value = outcome.explored
  run.timeline = outcome.timeline

  const report = validateMoves(run.puzzle.value, outcome.moves, run.moveLimit.value)
  run.moves.value = report.moves
  run.states.value = report.states

  if (!(await replay(run, gen, run.timeline, 0, run.pace.value.replayMs))) return
  if (!(await animate(run, gen))) return

  finish(run, gen, current, report.ok, report.message, report.count)
}

async function runSteps(run: HanoiRun, gen: number, current: HanoiRunner): Promise<void> {
  const trail: Move[] = []
  const shots: Towers[] = [cloneTowers(run.puzzle.value.towers)]
  const found: ExploredMove[] = []

  let towersNow = run.puzzle.value.towers
  let last: Move | null = null

  run.states.value = shots

  for (let turn = 1; turn <= run.moveLimit.value; turn++) {
    if (!(await holdWhilePaused(run, gen))) return

    run.trace.running = true
    const outcome = await current.step(stateOf(run, towersNow, turn, last))
    if (gen !== run.generation) return
    run.trace.running = false

    const base = found.length

    if (outcome.explored.length > 0) {
      found.push(...outcome.explored)
      run.explored.value = [...found]
    }

    if (!(await replay(run, gen, outcome.timeline, base, run.pace.value.stepDelay))) return

    const move = outcome.move

    if (!move) {
      finish(
        run,
        gen,
        current,
        false,
        `หยุดที่ตาที่ ${turn} — อ่านโปรแกรมจนจบแล้วไม่เจอบล็อกที่สั่งย้าย`,
        trail.length
      )
      return
    }

    if (!canMove(towersNow, move.from, move.to)) {
      fail(run, describeIllegal(towersNow, move, turn))
      return
    }

    towersNow = applyMove(towersNow, move)
    trail.push(move)
    shots.push(cloneTowers(towersNow))

    run.moves.value = [...trail]
    run.states.value = [...shots]
    run.movesShown.value = trail.length
    last = move

    if (isSolved(towersNow, run.puzzle.value)) {
      finish(run, gen, current, true, 'ย้ายครบทุกใบแล้ว', trail.length)
      return
    }

    if (run.pace.value.stepDelay > 0) await wait(run.pace.value.stepDelay)
  }

  finish(
    run,
    gen,
    current,
    false,
    `ย้ายครบ ${run.moveLimit.value.toLocaleString()} ตาแล้วจานยังไม่อยู่ที่หมุด ${pegName(run.puzzle.value.target)} ครบ`,
    trail.length
  )
}

async function startRun(run: HanoiRun): Promise<void> {
  run.generation++
  const gen = run.generation

  disposeRunner(run)
  run.clear()
  run.status.value = 'running'
  run.trace.running = true

  const current = createRunner(run)
  run.runner = current

  try {
    const ready = await current.start()
    if (gen !== run.generation) return

    run.agent.name = ready.name
    run.agent.mode = ready.mode
    run.trace.traced = ready.traced
    current.notifyStart(stateOf(run, run.puzzle.value.towers, 1, null))

    if (ready.mode === 'plan') await runPlan(run, gen, current)
    else await runSteps(run, gen, current)
  } catch (caught) {
    if (gen !== run.generation) return
    fail(run, caught instanceof Error ? caught.message : String(caught))
  }
}

async function probeCode(run: HanoiRun, code: string): Promise<{ ok: boolean; message: string }> {
  const probe = new HanoiRunner(code, { timeoutMs: 5000 })
  const puzzle = run.puzzle.value

  try {
    const ready = await probe.start()

    if (ready.mode === 'plan') {
      const { moves: plan } = await probe.solve(stateOf(run, puzzle.towers, 1, null))
      const report = validateMoves(puzzle, plan, run.moveLimit.value)

      return report.ok
        ? { ok: true, message: `"${ready.name}" ย้ายครบใน ${report.count} ตา` }
        : { ok: false, message: `"${ready.name}" ยังย้ายไม่ครบ: ${report.message}` }
    }

    const { move } = await probe.step(stateOf(run, puzzle.towers, 1, null))

    if (!move) return { ok: false, message: `"${ready.name}" ไม่ได้คืนตาแรก` }
    if (!canMove(puzzle.towers, move.from, move.to)) {
      return { ok: false, message: describeIllegal(puzzle.towers, move, 1) }
    }

    return {
      ok: true,
      message: `"${ready.name}" ทำงานได้ (โหมดย้ายทีละตา) — ตาแรกย้าย ${pegName(move.from)} ไป ${pegName(move.to)}`
    }
  } catch (caught) {
    return { ok: false, message: caught instanceof Error ? caught.message : String(caught) }
  } finally {
    probe.dispose()
  }
}

function syncActiveBlock(
  author: Ref<AuthorMode>,
  blocks: ReturnType<typeof useBlockProgram>,
  activeBlock: Ref<BlockId | null>,
  line: number | null
): void {
  if (author.value !== 'blocks' || line === null) {
    activeBlock.value = null
    return
  }

  const id = blocks.blockAtLine(line)
  if (id) activeBlock.value = id
}

export function useHanoiGame() {
  const options = reactive<HanoiOptions>({ ...DEFAULT_OPTIONS })

  const puzzle = shallowRef<Hanoi>(createHanoi(options))
  const status = ref<HanoiStatus>('idle')
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  const logs = ref<LogLine[]>([])
  const LOG_LIMIT = 300

  const clearLogs = () => {
    logs.value = []
  }

  const speed = ref(2)
  const showBest = ref(false)

  const author = ref<AuthorMode>('blocks')

  const blocks = useBlockProgram(HANOI_PACK, DEFAULT_PRESET_ID, () => {
    clearRun()
    if (status.value !== 'idle') status.value = 'idle'
  })

  const source = computed(() => blocks.generated.value.code)

  const agent = reactive({ name: 'Agent', mode: 'plan' as AgentMode })

  const agentName = computed(() => blocks.program.name)

  const explored = shallowRef<ExploredMove[]>([])

  const exploredShown = ref(0)

  const moves = shallowRef<Move[]>([])
  const states = shallowRef<Towers[]>([cloneTowers(puzzle.value.towers)])

  const movesShown = ref(0)

  const trace = reactive<HanoiAgentTrace>(emptyTrace())
  const result = ref<HanoiRunResult | null>(null)

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[2]!)

  const towers = computed<Towers>(
    () => states.value[Math.min(movesShown.value, states.value.length - 1)] ?? puzzle.value.towers
  )

  const lastMove = computed<Move | null>(() =>
    movesShown.value > 0 ? (moves.value[movesShown.value - 1] ?? null) : null
  )

  const best = computed(() => optimalMoves(puzzle.value.disks))

  const solution = computed(() => solveMoves(puzzle.value))

  const moveLimit = computed(() => Math.min(20_000, Math.max(200, best.value * 4)))

  const busy = computed(() => status.value === 'running' || status.value === 'paused')

  const activeBlock = ref<BlockId | null>(null)

  watch(
    () => trace.line,
    (line) => syncActiveBlock(author, blocks, activeBlock, line)
  )

  const blockCounts = computed<Record<BlockId, number>>(() =>
    author.value === 'blocks' ? blocks.blockCounts(trace.lines) : {}
  )

  const run: HanoiRun = {
    puzzle,
    status,
    error,
    logs,
    explored,
    exploredShown,
    moves,
    states,
    movesShown,
    result,
    agent,
    trace,
    pace,
    moveLimit,
    best,
    source,
    logLimit: LOG_LIMIT,
    timeline: [],
    generation: 0,
    runner: null,
    clear: () => clearRun()
  }

  function clearRun() {
    run.timeline = []
    activeBlock.value = null
    clearLogs()
    explored.value = []
    exploredShown.value = 0
    moves.value = []
    states.value = [cloneTowers(puzzle.value.towers)]
    movesShown.value = 0
    result.value = null
    error.value = null
    notice.value = null
    Object.assign(trace, emptyTrace())
  }

  function build(): void {
    stop()
    puzzle.value = createHanoi(options)
    clearRun()
    status.value = 'idle'
  }

  function setDisks(value: number): void {
    const next = normalizeDisks(value)
    if (next === options.disks) return

    options.disks = next
    build()
  }

  function testCode(code?: string): Promise<{ ok: boolean; message: string }> {
    return probeCode(run, code ?? source.value)
  }

  function start(): Promise<void> {
    return startRun(run)
  }

  function pause(): void {
    if (status.value === 'running') status.value = 'paused'
  }

  function resume(): void {
    if (status.value === 'paused') status.value = 'running'
  }

  function stop(): void {
    if (status.value === 'idle') return

    run.generation++
    disposeRunner(run)
    trace.running = false
    trace.method = null
    status.value = 'idle'
  }

  function reset(): void {
    stop()
    clearRun()
    status.value = 'idle'
  }

  onScopeDispose(() => disposeRunner(run))

  return {

    options,
    puzzle,
    status,
    error,
    notice,
    logs,
    clearLogs,
    speed,
    showBest,
    agent,
    author,
    blocks,
    source,
    agentName,
    activeBlock,
    blockCounts,
    explored,
    exploredShown,
    moves,
    movesShown,
    towers,
    lastMove,
    trace,
    result,
    best,
    solution,
    moveLimit,
    pace,
    busy,

    build,
    setDisks,
    testCode,
    run: start,
    pause,
    resume,
    stop,
    reset
  }
}
