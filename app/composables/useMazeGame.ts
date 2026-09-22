import type { ShallowRef } from 'vue'
import { usesBlock } from '~/game/blocks/program'
import type { MazeMemory } from '~/game/maze/agent'
import { eraseLoops, pathCost } from '~/game/maze/ants'
import type { MazeState } from '~/game/maze/agent'
import {
  DEFAULT_OPTIONS,
  FLOOR,
  MUD,
  WALL,
  COST_FLOOR,
  COST_MUD,
  cloneGrid,
  createMaze,
  key,
  manhattan,
  normalizeSize,
  randomSeed,
  same,
  solve,
  solveSteps,
  stepCost,
  validatePath,
  walkable,
  type Cell,
  type Maze,
  type MazeOptions,
  type Point
} from '~/game/maze/engine'
import { MazeRunner } from '~/game/maze/runner'
import { SPEEDS, type SpeedOption } from '~/game/maze/pace'
import { DEFAULT_TEMPLATE_ID, findTemplate } from '~/game/maze/templates'
import type { AgentMode, ExploredCell } from '~/game/maze/protocol'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'
import { importProgram } from '~/game/blocks/importer'
import { DEFAULT_PRESET_ID, MAZE_PACK } from '~/game/maze/blocks/pack'

export type MazeStatus = 'idle' | 'running' | 'paused' | 'finished' | 'error'

export type EditTool = 'none' | 'wall' | 'mud' | 'floor' | 'start' | 'goal'

export interface MazeAgentTrace {
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

export interface MazeRunResult {
  ok: boolean
  message: string
  steps: number
  cost: number
  explored: number
  ms: number
}

const TIME_BUDGET = 2000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const frame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 16)
  })


const emptyTrace = (): MazeAgentTrace => ({
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

const templateCode = (id: string): string => findTemplate(id)?.code ?? ''

type EditFn = (next: Maze, row: number, col: number, cell: Cell) => boolean

const blocked = (next: Maze, row: number, col: number): boolean =>
  same({ row, col }, next.start) || same({ row, col }, next.goal)

const EDITS: Record<string, EditFn> = {
  wall: (next, row, col, cell) => {
    if (blocked(next, row, col)) return false
    next.grid[row]![col] = (cell === WALL ? FLOOR : WALL) as Cell
    return true
  },
  mud: (next, row, col, cell) => {
    if (blocked(next, row, col))
      return false
    next.grid[row]![col] = (cell === MUD ? FLOOR : MUD) as Cell
    return true
  },
  floor: (next, row, col) => {
    next.grid[row]![col] = FLOOR
    return true
  },
  start: (next, row, col, cell) => {
    if (same({ row, col }, next.goal)) return false
    next.grid[row]![col] = cell === WALL ? FLOOR : cell
    next.start = { row, col }
    return true
  },
  goal: (next, row, col, cell) => {
    if (same({ row, col }, next.start)) return false
    next.grid[row]![col] = cell === WALL ? FLOOR : cell
    next.goal = { row, col }
    return true
  }
}

function applyEdit(current: Maze, tool: EditTool, row: number, col: number): Maze | null {
  if (row < 0 || row >= current.height || col < 0 || col >= current.width) return null

  const edit = EDITS[tool]
  if (!edit) return null

  const next: Maze = { ...current, grid: cloneGrid(current.grid) }
  const cell = next.grid[row]![col]!

  return edit(next, row, col, cell) ? next : null
}

function moveProblem(maze: Maze, from: Point, move: Point, step: number): string | null {
  if (manhattan(from, move) !== 1) {
    return `ก้าวที่ ${step} กระโดดข้ามช่อง จาก (${from.row}, ${from.col}) ไป (${move.row}, ${move.col})`
  }

  if (!walkable(maze.grid, move.row, move.col)) {
    return `ก้าวที่ ${step} ชนกำแพงที่ (${move.row}, ${move.col})`
  }

  return null
}

const stuckMessage = (mode: AuthorMode, at: Point): string =>
  mode === 'blocks'
    ? `หยุดที่ (${at.row}, ${at.col}) — อ่านโปรแกรมจนจบแล้วไม่เจอบล็อกที่สั่งเดิน`
    : `หยุดเดินที่ (${at.row}, ${at.col}) — step() คืน null`

export interface MazeMemoryInfo {
  label?: string
  bytes: number
}

/** ผลของการฝึกแต่ละรอบ — ราคาของทางที่เดิน กับว่าถึงทางออกไหม */
export interface MazeTrainingRound {
  ok: boolean
  /** ราคาที่เดินจริงทั้งหมด รวมวงวน */
  cost: number
  steps: number
  /** ราคาของทางหลังตัดวงวนออก — ทางที่มดทิ้งกลิ่นไว้ (ไม่ถึงทางออกเป็น null) */
  shortcut: number | null
}

export interface MazeTraining {
  running: boolean
  /** เลขรอบฝึก — กดหยุดแล้วเริ่มใหม่เร็ว ๆ รอบเก่าจะได้ไม่ไปปิดสวิตช์ทับรอบใหม่ */
  session: number
  total: number
  rounds: MazeTrainingRound[]
  error: string | null
}

const MEMORY_PREFIX = 'maze:memory:'

const MEMORY_LIMIT = 256 * 1024

/** ความจำผูกกับ "โปรแกรมไหน" — ตัวอย่างแต่ละชุด และโปรแกรมของฉันแต่ละอัน มีกล่องของตัวเอง */
const memoryKey = (programKey: string): string => `${MEMORY_PREFIX}blocks:${programKey}`

function readMemory(key: string): { data: MazeMemory; bytes: number } | null {
  if (!import.meta.client) return null

  try {
    const raw = localStorage.getItem(key)
    return raw ? { data: JSON.parse(raw) as MazeMemory, bytes: raw.length } : null
  } catch {
    return null
  }
}

interface MazeRun {
  maze: ShallowRef<Maze>
  status: Ref<MazeStatus>
  error: Ref<string | null>
  notice: Ref<string | null>
  logs: Ref<LogLine[]>
  explored: ShallowRef<ExploredCell[]>
  exploredShown: Ref<number>
  path: ShallowRef<Point[]>
  walkShown: Ref<number>
  result: Ref<MazeRunResult | null>
  author: Ref<AuthorMode>
  agent: { templateId: string; code: string; name: string; mode: AgentMode }
  trace: MazeAgentTrace
  pace: ComputedRef<SpeedOption>
  stepLimit: ComputedRef<number>
  source: ComputedRef<string>
  logLimit: number
  timeline: number[]
  generation: number
  runner: MazeRunner | null
  clear: () => void
  /** กล่องความจำของโปรแกรมที่เลือกอยู่ */
  memoryKey: ComputedRef<string>
  memory: Ref<MazeMemoryInfo | null>
}

function writeMemory(run: MazeRun, data: MazeMemory): void {
  if (!import.meta.client) return

  try {
    const raw = JSON.stringify(data)
    if (raw.length > MEMORY_LIMIT) return

    localStorage.setItem(run.memoryKey.value, raw)
    run.memory.value = { label: typeof data.label === 'string' ? data.label : undefined, bytes: raw.length }
  } catch {
    // เขียนลงเครื่องไม่ได้ (โหมดส่วนตัว / เต็ม) ก็แค่จำไม่ได้ เกมยังเล่นต่อได้
  }
}

function disposeRunner(run: MazeRun): void {
  run.runner?.dispose()
  run.runner = null
}

function stateOf(
  run: MazeRun,
  position: Point,
  step: number,
  previous: Point | null,
  visits: Record<string, number>
): MazeState {
  const maze = run.maze.value

  return {
    grid: cloneGrid(maze.grid),
    width: maze.width,
    height: maze.height,
    start: { ...maze.start },
    goal: { ...maze.goal },
    costFloor: COST_FLOOR,
    costMud: COST_MUD,
    position: { ...position },
    step,
    previous: previous ? { ...previous } : null,
    visits,
    stepLimit: run.stepLimit.value,
    timeBudget: TIME_BUDGET
  }
}

function fail(run: MazeRun, message: string): void {
  run.generation++
  disposeRunner(run)
  run.trace.running = false
  run.trace.method = null
  run.error.value = message
  run.status.value = 'error'
}

async function holdWhilePaused(run: MazeRun, gen: number): Promise<boolean> {
  while (run.status.value === 'paused' && gen === run.generation) await wait(80)
  return gen === run.generation && run.status.value === 'running'
}

async function replay(
  run: MazeRun,
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

async function walkTrail(run: MazeRun, gen: number): Promise<boolean> {
  const last = run.path.value.length - 1

  if (run.pace.value.stepDelay === 0) {
    run.walkShown.value = last
    return true
  }

  while (run.walkShown.value < last) {
    if (!(await holdWhilePaused(run, gen))) return false
    run.walkShown.value++
    await wait(run.pace.value.stepDelay)
  }

  return gen === run.generation
}

function finish(
  run: MazeRun,
  gen: number,
  current: MazeRunner,
  ok: boolean,
  message: string,
  steps: number,
  cost: number
): void {
  if (gen !== run.generation) return

  run.trace.running = false
  run.trace.method = null

  run.result.value = { ok, message, steps, cost, explored: run.explored.value.length, ms: run.trace.ms }
  run.status.value = 'finished'

  // ปล่อยตัวรันออกจากรอบนี้ แต่รอให้ onFinish ทำเสร็จก่อนค่อยปิด — ความจำที่บันทึกตอนจบรอบจะได้ไม่หาย
  if (run.runner === current) run.runner = null
  void current
    .finish(ok, steps, cost)
    .catch(() => {})
    .finally(() => current.dispose())
}

function createRunner(run: MazeRun): MazeRunner {
  return new MazeRunner(run.source.value, {
    timeoutMs: 5000,
    memory: readMemory(run.memoryKey.value)?.data ?? null,
    onMemory: (data) => writeMemory(run, data),
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

async function runPlan(run: MazeRun, gen: number, current: MazeRunner): Promise<void> {
  const outcome = await current.solve(stateOf(run, run.maze.value.start, 1, null, {}))
  if (gen !== run.generation) return

  run.trace.running = false
  run.explored.value = outcome.explored
  run.timeline = outcome.timeline

  const report = validatePath(run.maze.value, outcome.path)
  run.path.value = report.cells

  if (!(await replay(run, gen, run.timeline, 0, run.pace.value.replayMs))) return
  if (!(await walkTrail(run, gen))) return

  finish(run, gen, current, report.ok, report.message, report.steps, report.cost)
}

async function runSteps(run: MazeRun, gen: number, current: MazeRunner): Promise<void> {
  const start = run.maze.value.start
  const visits: Record<string, number> = { [key(start.row, start.col)]: 1 }
  const trail: Point[] = [start]
  const found: ExploredCell[] = []

  let position = start
  let previous: Point | null = null
  let cost = 0

  run.path.value = trail

  for (let step = 1; step <= run.stepLimit.value; step++) {
    if (!(await holdWhilePaused(run, gen))) return

    run.trace.running = true
    const outcome = await current.step(stateOf(run, position, step, previous, { ...visits }))
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
      finish(run, gen, current, false, stuckMessage(run.author.value, position), trail.length - 1, cost)
      return
    }

    const problem = moveProblem(run.maze.value, position, move, step)

    if (problem) {
      fail(run, problem)
      return
    }

    trail.push(move)
    run.path.value = [...trail]
    run.walkShown.value = trail.length - 1

    cost += stepCost(run.maze.value.grid, move.row, move.col)
    previous = position
    position = move

    const id = key(move.row, move.col)
    visits[id] = (visits[id] ?? 0) + 1

    if (same(move, run.maze.value.goal)) {
      finish(run, gen, current, true, 'ถึงทางออกแล้ว', trail.length - 1, cost)
      return
    }
  }

  finish(
    run,
    gen,
    current,
    false,
    `เดินครบ ${run.stepLimit.value} ก้าวแล้วยังไม่ถึงทางออก`,
    trail.length - 1,
    cost
  )
}

async function startRun(run: MazeRun): Promise<void> {
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

    if (run.author.value === 'code') run.agent.name = ready.name
    run.agent.mode = ready.mode
    run.trace.traced = ready.traced
    current.notifyStart(stateOf(run, run.maze.value.start, 1, null, {}))

    if (ready.mode === 'plan') await runPlan(run, gen, current)
    else await runSteps(run, gen, current)
  } catch (caught) {
    if (gen !== run.generation) return
    fail(run, caught instanceof Error ? caught.message : String(caught))
  }
}

/**
 * เดินหนึ่งรอบแบบไม่วาดภาพ ไม่รอนาฬิกา — ถามโปรแกรมรัว ๆ จนถึงทางออกหรือครบก้าว
 * ใช้ worker ตัวใหม่ทุกรอบ สิ่งเดียวที่ข้ามรอบได้คือความจำที่โปรแกรมบันทึกเอง (เช่นกลิ่นของมด)
 */
async function trainOnce(run: MazeRun, alive: () => boolean): Promise<MazeTrainingRound | null> {
  const maze = run.maze.value
  const runner = new MazeRunner(run.source.value, {
    timeoutMs: 5000,
    memory: readMemory(run.memoryKey.value)?.data ?? null,
    onMemory: (data) => writeMemory(run, data)
  })

  try {
    const ready = await runner.start()
    if (ready.mode !== 'step') throw new Error('การฝึกใช้ได้กับโปรแกรมแบบเดินทีละก้าวเท่านั้น — โปรแกรมที่วางแผนเห็นแผนที่ทั้งใบอยู่แล้ว ไม่มีอะไรให้ฝึก')

    const visits: Record<string, number> = { [key(maze.start.row, maze.start.col)]: 1 }
    let position = maze.start
    let previous: Point | null = null
    let cost = 0
    let steps = 0
    let ok = false
    const walked: Point[] = [position]

    runner.notifyStart(stateOf(run, position, 1, null, {}))

    for (let step = 1; step <= run.stepLimit.value; step++) {
      if (!alive()) return null

      const { move } = await runner.step(stateOf(run, position, step, previous, { ...visits }))
      if (!move || moveProblem(maze, position, move, step)) break

      cost += stepCost(maze.grid, move.row, move.col)
      steps = step
      previous = position
      position = move
      visits[key(move.row, move.col)] = (visits[key(move.row, move.col)] ?? 0) + 1
      walked.push(move)

      if (same(move, maze.goal)) {
        ok = true
        break
      }
    }

    await runner.finish(ok, steps, cost)
    return { ok, cost, steps, shortcut: ok ? pathCost(maze.grid, eraseLoops(walked)) : null }
  } finally {
    runner.dispose()
  }
}

async function train(run: MazeRun, training: MazeTraining, runs: number): Promise<void> {
  if (training.running) return

  training.session++
  const session = training.session
  const alive = () => training.running && training.session === session

  training.running = true
  training.total = runs
  training.rounds = []
  training.error = null

  try {
    for (let round = 0; round < runs && alive(); round++) {
      const result = await trainOnce(run, alive)
      if (result === null || !alive()) break

      training.rounds = [...training.rounds, result]
    }
  } catch (caught) {
    if (training.session === session) training.error = caught instanceof Error ? caught.message : String(caught)
  } finally {
    if (training.session === session) training.running = false
  }
}

async function probeCode(run: MazeRun, code: string): Promise<{ ok: boolean; message: string }> {
  const probe = new MazeRunner(code, { timeoutMs: 5000 })
  const maze = run.maze.value

  try {
    const ready = await probe.start()

    if (ready.mode === 'plan') {
      const { path: raw } = await probe.solve(stateOf(run, maze.start, 1, null, {}))
      const report = validatePath(maze, raw)

      return report.ok
        ? { ok: true, message: `"${ready.name}" หาทางออกได้ — ${report.steps} ก้าว ต้นทุน ${report.cost}` }
        : { ok: false, message: `"${ready.name}" ยังไปไม่ถึง: ${report.message}` }
    }

    const { move } = await probe.step(
      stateOf(run, maze.start, 1, null, { [key(maze.start.row, maze.start.col)]: 1 })
    )

    if (!move) return { ok: false, message: `"${ready.name}" ไม่ได้คืนก้าวแรก` }
    if (!walkable(maze.grid, move.row, move.col)) {
      return { ok: false, message: `"${ready.name}" ก้าวแรกชนกำแพงที่ (${move.row}, ${move.col})` }
    }

    return {
      ok: true,
      message: `"${ready.name}" ทำงานได้ (โหมดเดินทีละก้าว) — ก้าวแรกไปที่ (${move.row}, ${move.col})`
    }
  } catch (caught) {
    return { ok: false, message: caught instanceof Error ? caught.message : String(caught) }
  } finally {
    probe.dispose()
  }
}

type MazeBlocks = ReturnType<typeof useBlockProgram>

function switchAuthor(run: MazeRun, blocks: MazeBlocks, mode: AuthorMode): void {
  if (run.author.value === mode) return

  let pending: string | null = null

  if (mode === 'code') {
    run.agent.code = blocks.generated.value.code
    run.agent.name = blocks.program.name
  } else {
    const imported = importProgram(run.agent.code, MAZE_PACK)

    if (!imported.ok || !imported.program) {
      run.error.value = imported.message
      return
    }

    pending = imported.message
    blocks.replaceProgram(imported.program)
  }

  run.author.value = mode
  run.clear()
  if (run.status.value !== 'idle') run.status.value = 'idle'

  if (mode === 'blocks') run.notice.value = pending
}

function syncActiveBlock(
  run: MazeRun,
  blocks: MazeBlocks,
  activeBlock: Ref<BlockId | null>,
  line: number | null
): void {
  if (run.author.value !== 'blocks' || line === null) {
    activeBlock.value = null
    return
  }

  const id = blocks.blockAtLine(line)
  if (id) activeBlock.value = id
}

export function useMazeGame() {
  const options = reactive<MazeOptions>({ ...DEFAULT_OPTIONS, seed: 1 })

  const maze = shallowRef<Maze>(createMaze(options))
  const status = ref<MazeStatus>('idle')
  const error = ref<string | null>(null)

  const notice = ref<string | null>(null)

  const logs = ref<LogLine[]>([])
  const LOG_LIMIT = 300

  const clearLogs = () => {
    logs.value = []
  }
  const speed = ref(2)
  const tool = ref<EditTool>('none')
  const showOptimal = ref(false)

  const agent = reactive({
    templateId: DEFAULT_TEMPLATE_ID,
    code: templateCode(DEFAULT_TEMPLATE_ID),
    name: findTemplate(DEFAULT_TEMPLATE_ID)?.name ?? 'Agent',
    mode: 'plan' as AgentMode
  })

  const author = ref<AuthorMode>('blocks')

  const blocks = useBlockProgram(MAZE_PACK, DEFAULT_PRESET_ID, () => {
    clearRun()
    if (status.value !== 'idle') status.value = 'idle'
  })

  const source = computed(() =>
    author.value === 'blocks' ? blocks.generated.value.code : agent.code
  )

  const agentName = computed(() => (author.value === 'blocks' ? blocks.program.name : agent.name))

  const explored = shallowRef<ExploredCell[]>([])


  const exploredShown = ref(0)

  const path = shallowRef<Point[]>([])

  const walkShown = ref(0)

  const trace = reactive<MazeAgentTrace>(emptyTrace())
  const result = ref<MazeRunResult | null>(null)

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[2]!)

  const best = computed(() => {
    const cheapest = solve(maze.value)
    const shortest = solveSteps(maze.value)

    return {
      solvable: cheapest !== null,
      cost: cheapest?.cost ?? 0,
      steps: shortest ? shortest.path.length - 1 : 0,
      path: cheapest?.path ?? []
    }
  })

  const position = computed<Point>(() => path.value[walkShown.value] ?? maze.value.start)

  const activeBlock = ref<BlockId | null>(null)

  watch(
    () => trace.line,
    (line) => syncActiveBlock(run, blocks, activeBlock, line)
  )

  const blockCounts = computed<Record<BlockId, number>>(() =>
    author.value === 'blocks' ? blocks.blockCounts(trace.lines) : {}
  )

  const busy = computed(() => status.value === 'running' || status.value === 'paused')

  const editable = computed(() => !busy.value && tool.value !== 'none')

  const stepLimit = computed(() => Math.min(60_000, maze.value.width * maze.value.height * 6))

  const memory = ref<MazeMemoryInfo | null>(null)
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
  const learns = computed(() => usesBlock(blocks.program, ['remember', 'forget', 'maze.ant-scent']))

  const training = reactive<MazeTraining>({ running: false, session: 0, total: 0, rounds: [], error: null })

  const run: MazeRun = {
    maze,
    status,
    error,
    notice,
    logs,
    explored,
    exploredShown,
    path,
    walkShown,
    result,
    author,
    agent,
    trace,
    pace,
    stepLimit,
    source,
    logLimit: LOG_LIMIT,
    timeline: [],
    generation: 0,
    runner: null,
    clear: () => clearRun(),
    memoryKey: memoryKeyOf,
    memory
  }

  /** ฝึกรัว ๆ หลายรอบบนเขาวงกตที่เปิดอยู่ — ต้องไม่ได้กำลังเดินอยู่ */
  function trainRuns(runs: number): Promise<void> {
    stop()
    const count = Math.min(1000, Math.max(1, Math.round(Number(runs) || 1)))
    return train(run, training, count)
  }

  function stopTraining(): void {
    training.running = false
  }

  function clearMemory(): void {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(memoryKeyOf.value)
    } catch {
      return
    }

    memory.value = null
    training.rounds = []
    training.total = 0
  }

  function clearRun() {
    run.timeline = []
    activeBlock.value = null
    clearLogs()
    explored.value = []
    exploredShown.value = 0
    path.value = []
    walkShown.value = 0
    result.value = null
    error.value = null
    notice.value = null
    Object.assign(trace, emptyTrace())
  }

  function build(): void {
    stop()
    clearRun()
    maze.value = createMaze(options)
    status.value = 'idle'
  }

  function setOption<K extends keyof MazeOptions>(field: K, value: MazeOptions[K]): void {
    if (field === 'width' || field === 'height') {
      options[field] = normalizeSize(value as number) as MazeOptions[K]
    } else {
      options[field] = value
    }

    build()
  }

  function shuffle(): void {
    options.seed = randomSeed()
    build()
  }

  function editCell(row: number, col: number): void {
    if (!editable.value) return

    const next = applyEdit(maze.value, tool.value, row, col)
    if (!next) return

    maze.value = next
    clearRun()
    status.value = 'idle'
  }

  function useTemplate(templateId: string): void {
    const template = findTemplate(templateId)
    if (!template) return

    agent.templateId = templateId
    agent.code = template.code
    agent.name = template.name
    agent.mode = template.mode
    clearRun()
    if (status.value !== 'idle') status.value = 'idle'
  }

  function setCode(code: string): void {
    agent.code = code
  }

  function setAuthor(mode: AuthorMode): void {
    switchAuthor(run, blocks, mode)
  }

  function testCode(code?: string): Promise<{ ok: boolean; message: string }> {
    return probeCode(run, code ?? source.value)
  }

  function run_(): Promise<void> {
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
    maze,
    status,
    error,
    notice,
    logs,
    clearLogs,
    speed,
    tool,
    showOptimal,
    agent,
    author,
    blocks,
    source,
    agentName,
    activeBlock,
    blockCounts,
    explored,
    exploredShown,
    path,
    walkShown,
    position,
    trace,
    result,
    best,
    busy,
    editable,
    stepLimit,
    memory,
    learns,
    training,
    /** ราคาของทางที่ถูกที่สุดจริงบนเขาวงกตที่เปิดอยู่ — ไว้เทียบกับฝูงมด */
    optimalCost: computed(() => solve(maze.value)?.cost ?? null),
    train: trainRuns,
    stopTraining,
    clearMemory,

    build,
    setOption,
    shuffle,
    editCell,
    useTemplate,
    setAuthor,
    setCode,
    testCode,
    run: run_,
    pause,
    resume,
    stop,
    reset
  }
}
