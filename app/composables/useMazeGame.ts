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
import { DEFAULT_TEMPLATE_ID, findTemplate } from '~/game/maze/templates'
import type { AgentMode, ExploredCell } from '~/game/maze/protocol'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'
import { importProgram } from '~/game/blocks/importer'
import { DEFAULT_PRESET_ID, MAZE_PACK } from '~/game/maze/blocks/pack'


export type MazeStatus = 'idle' | 'running' | 'paused' | 'finished' | 'error'

/** เครื่องมือแก้แผนที่ด้วยมือ */
export type EditTool = 'none' | 'wall' | 'mud' | 'floor' | 'start' | 'goal'

/** สิ่งที่โค้ดกำลังทำอยู่ ใช้แสดงบนหน้าจอระหว่างค้นหา */
export interface MazeAgentTrace {
  running: boolean
  method: string | null
  depth: number
  calls: number
  counts: Record<string, number>
  /** เวลาที่โค้ดใช้คิดจริง ไม่รวมเวลาที่หน้าจอใช้วาด (ms) */
  ms: number
  /** บรรทัดของโค้ดผู้เล่นที่กำลังรัน (null = ยังไม่เริ่ม/ไม่ทราบ) */
  line: number | null
  /** จำนวนครั้งที่รันแต่ละบรรทัด */
  lines: Record<number, number>
  /** ไฮไลต์บรรทัดได้ไหม — โค้ดที่ syntax ยังไม่ผ่านจะแทรกตัวนับไม่ได้ */
  traced: boolean
}

export interface RunResult {
  ok: boolean
  message: string
  steps: number
  cost: number
  explored: number
  ms: number
}

/** เวลาที่แนะนำให้ agent ใช้คิด (ms) — เพดานจริงของระบบคือ 5000 */
const TIME_BUDGET = 2000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const frame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 16)
  })

export interface SpeedOption {
  value: number
  label: string
  /** เวลาที่ใช้เล่นย้อนการค้นหาทั้งรอบ (ms) — 0 = ข้ามไปผลลัพธ์เลย */
  replayMs: number
  /** หน่วงต่อหนึ่งก้าวตอนเดินตามเส้นทาง (ms) */
  stepDelay: number
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ทันที', replayMs: 0, stepDelay: 0 },
  { value: 1, label: 'เร็ว', replayMs: 1600, stepDelay: 8 },
  { value: 2, label: 'ปกติ', replayMs: 5000, stepDelay: 32 },
  { value: 3, label: 'ช้า', replayMs: 14000, stepDelay: 90 }
]

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

export function useMazeGame() {
  const options = reactive<MazeOptions>({ ...DEFAULT_OPTIONS, seed: 1 })

  const maze = shallowRef<Maze>(createMaze(options))
  const status = ref<MazeStatus>('idle')
  const error = ref<string | null>(null)
  /** ข้อความบอกผลการแปลงโค้ดเป็นบล็อก */
  const notice = ref<string | null>(null)

  /** ข้อความที่โปรแกรมพิมพ์ออกคอนโซล (เก็บเฉพาะช่วงท้าย) */
  const logs = ref<LogLine[]>([])
  const LOG_LIMIT = 300

  const clearLogs = () => {
    logs.value = []
  }
  const speed = ref(2)
  const tool = ref<EditTool>('none')
  const showOptimal = ref(false)

  /** โค้ดที่พิมพ์เอง (ใช้ในโหมด 'code') */
  const agent = reactive({
    templateId: DEFAULT_TEMPLATE_ID,
    code: templateCode(DEFAULT_TEMPLATE_ID),
    name: findTemplate(DEFAULT_TEMPLATE_ID)?.name ?? 'Agent',
    mode: 'plan' as AgentMode
  })

  /** วิธีเขียนโปรแกรมที่ใช้อยู่ — เริ่มที่บล็อกลากวาง */
  const author = ref<AuthorMode>('blocks')

  /** โปรแกรมบล็อกของเกมนี้ ใช้แกนกลางตัวเดียวกับเกมอื่น */
  const blocks = useBlockProgram(MAZE_PACK, DEFAULT_PRESET_ID, () => {
    clearRun()
    if (status.value !== 'idle') status.value = 'idle'
  })

  /** โค้ดที่จะส่งให้ worker รันจริง */
  const source = computed(() =>
    author.value === 'blocks' ? blocks.generated.value.code : agent.code
  )

  /** ชื่อที่โชว์บนหน้าจอ */
  const agentName = computed(() => (author.value === 'blocks' ? blocks.program.name : agent.name))

  /** ช่องที่โค้ดสำรวจ เรียงตามลำดับที่เรียก this.visit() พร้อมบรรทัดที่สั่ง */
  const explored = shallowRef<ExploredCell[]>([])
  /** ลำดับบรรทัดที่โค้ดรัน คู่กับจำนวนช่องที่สำรวจแล้ว ณ ตอนนั้น */
  let timeline: number[] = []
  /** ระบายไปแล้วกี่ช่อง (ไล่ขึ้นตอนแสดงผล) */
  const exploredShown = ref(0)

  /** เส้นทางเต็มตั้งแต่จุดเริ่ม — index 0 คือช่องเริ่มต้นเสมอ */
  const path = shallowRef<Point[]>([])
  /** เดินไปถึง index ไหนแล้ว */
  const walkShown = ref(0)

  const trace = reactive<MazeAgentTrace>(emptyTrace())
  const result = ref<RunResult | null>(null)

  let runner: MazeRunner | null = null
  /** เพิ่มค่าทุกครั้งที่หยุด/รีเซ็ต เพื่อทิ้งงานที่ค้างอยู่ */
  let generation = 0

  // ---------- ค่าอนุพันธ์ ----------

  const pace = computed(() => SPEEDS.find((item) => item.value === speed.value) ?? SPEEDS[2]!)

  /** เฉลยของแผนที่นี้: ทางที่ต้นทุนถูกที่สุด กับทางที่ก้าวน้อยที่สุด */
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

  /**
   * บล็อกที่กำลังทำงาน — ย้อนจากบรรทัดที่รันอยู่ผ่านตารางของตัวแปลงโค้ด
   * ถ้าบรรทัดนั้นเป็นตัวช่วยที่ระบบเติมให้ (เช่น blocked()) จะคงไฮไลต์ไว้ที่บล็อกเดิม
   * ไม่งั้นไฟจะกะพริบดับทุกครั้งที่โปรแกรมแวะไปคิดเงื่อนไข
   */
  const activeBlock = ref<BlockId | null>(null)

  watch(
    () => trace.line,
    (line) => {
      if (author.value !== 'blocks' || line === null) {
        activeBlock.value = null
        return
      }

      const id = blocks.blockAtLine(line)
      if (id) activeBlock.value = id
    }
  )

  /** จำนวนครั้งที่แต่ละบล็อกทำงาน */
  const blockCounts = computed<Record<BlockId, number>>(() =>
    author.value === 'blocks' ? blocks.blockCounts(trace.lines) : {}
  )

  const busy = computed(() => status.value === 'running' || status.value === 'paused')

  /** แก้แผนที่ได้เฉพาะตอนที่ยังไม่ได้เริ่มค้นหา */
  const editable = computed(() => !busy.value && tool.value !== 'none')

  const stepLimit = computed(() => Math.min(60_000, maze.value.width * maze.value.height * 6))

  // ---------- ตัวช่วยภายใน ----------

  function clearRun() {
    timeline = []
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

  function disposeRunner() {
    runner?.dispose()
    runner = null
  }

  function buildState(position: Point, step: number, previous: Point | null, visits: Record<string, number>): MazeState {
    return {
      grid: cloneGrid(maze.value.grid),
      width: maze.value.width,
      height: maze.value.height,
      start: { ...maze.value.start },
      goal: { ...maze.value.goal },
      costFloor: COST_FLOOR,
      costMud: COST_MUD,
      position: { ...position },
      step,
      previous: previous ? { ...previous } : null,
      visits,
      stepLimit: stepLimit.value,
      timeBudget: TIME_BUDGET
    }
  }

  function fail(message: string) {
    generation++
    disposeRunner()
    trace.running = false
    trace.method = null
    error.value = message
    status.value = 'error'
  }

  /** ค้างไว้ระหว่างที่ผู้เล่นกดพัก — คืน false ถ้างานถูกยกเลิกไปแล้ว */
  async function holdWhilePaused(gen: number): Promise<boolean> {
    while (status.value === 'paused' && gen === generation) await wait(80)
    return gen === generation && status.value === 'running'
  }

  /**
   * เล่นย้อนสิ่งที่โค้ดทำไปตามไทม์ไลน์บรรทัด
   * ไฮไลต์ในโค้ดกับสีบนแผนที่จึงเดินไปพร้อมกัน — เห็นว่าบรรทัดไหนทำให้ช่องไหนถูกสำรวจ
   *
   * @param offset จำนวนช่องที่สำรวจไปแล้วก่อนรอบนี้ (โหมดเดินทีละก้าวสะสมไปเรื่อย ๆ)
   * @param durationMs เวลาที่อยากให้เล่นย้อนชุดนี้จบ — 0 คือข้ามไปผลลัพธ์เลย
   */
  async function replay(gen: number, frames: number[], offset: number, durationMs: number): Promise<boolean> {
    const points = Math.floor(frames.length / 2)

    const settle = () => {
      const last = points > 0 ? frames[(points - 1) * 2]! : 0
      if (last > 0) trace.line = last
      exploredShown.value = explored.value.length
    }

    if (points === 0 || durationMs <= 0) {
      settle()
      return gen === generation
    }

    // กระจายจุดให้ครบภายในเวลาที่ตั้งไว้ ไม่ว่าโค้ดจะรันไปกี่บรรทัดก็ตาม
    // ยกเว้นชุดสั้น ๆ (โปรแกรมบล็อกหนึ่งก้าว) ที่ไล่ทีละจุด ทุกบล็อกจะได้สว่างให้เห็น
    const perFrame =
      points <= 16 ? 1 : Math.max(1, Math.ceil(points / Math.max(1, (durationMs / 1000) * 60)))
    let cursor = 0

    while (cursor < points) {
      if (!(await holdWhilePaused(gen))) return false

      cursor = Math.min(points, cursor + perFrame)
      const index = (cursor - 1) * 2

      trace.line = frames[index]!
      exploredShown.value = offset + frames[index + 1]!
      await frame()
    }

    settle()
    return gen === generation
  }

  /** เดินตามเส้นทางที่ได้มาทีละก้าว */
  async function walk(gen: number): Promise<boolean> {
    const last = path.value.length - 1

    if (pace.value.stepDelay === 0) {
      walkShown.value = last
      return true
    }

    while (walkShown.value < last) {
      if (!(await holdWhilePaused(gen))) return false
      walkShown.value++
      await wait(pace.value.stepDelay)
    }

    return gen === generation
  }

  // ---------- แผนที่ ----------

  function build(): void {
    stop()
    clearRun()
    maze.value = createMaze(options)
    status.value = 'idle'
  }

  /** เปลี่ยนค่าตั้งแผนที่แล้วสร้างใหม่ทันที */
  function setOption<K extends keyof MazeOptions>(field: K, value: MazeOptions[K]): void {
    if (field === 'width' || field === 'height') {
      options[field] = normalizeSize(value as number) as MazeOptions[K]
    } else {
      options[field] = value
    }

    build()
  }

  /** สุ่มแผนที่ใหม่ด้วย seed ใหม่ */
  function shuffle(): void {
    options.seed = randomSeed()
    build()
  }

  /** แก้แผนที่ด้วยมือ: วางกำแพง โคลน จุดเริ่ม หรือทางออก */
  function editCell(row: number, col: number): void {
    if (!editable.value) return

    const current = maze.value
    if (row < 0 || row >= current.height || col < 0 || col >= current.width) return

    const next: Maze = { ...current, grid: cloneGrid(current.grid) }
    const cell = next.grid[row]![col]!

    switch (tool.value) {
      case 'wall': {
        if (same({ row, col }, next.start) || same({ row, col }, next.goal)) return
        next.grid[row]![col] = (cell === WALL ? FLOOR : WALL) as Cell
        break
      }
      case 'mud': {
        if (same({ row, col }, next.start) || same({ row, col }, next.goal)) return
        next.grid[row]![col] = (cell === MUD ? FLOOR : MUD) as Cell
        break
      }
      case 'floor': {
        next.grid[row]![col] = FLOOR
        break
      }
      case 'start': {
        if (same({ row, col }, next.goal)) return
        next.grid[row]![col] = cell === WALL ? FLOOR : cell
        next.start = { row, col }
        break
      }
      case 'goal': {
        if (same({ row, col }, next.start)) return
        next.grid[row]![col] = cell === WALL ? FLOOR : cell
        next.goal = { row, col }
        break
      }
      default:
        return
    }

    maze.value = next
    clearRun()
    status.value = 'idle'
  }

  // ---------- โค้ดของผู้เล่น ----------

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

  /**
   * สลับวิธีเขียนโปรแกรม แล้วแปลงของเดิมตามไปด้วย
   * บล็อก -> โค้ด: เอาโค้ดที่บล็อกแปลงไว้ไปเขียนต่อ
   * โค้ด -> บล็อก: อ่านโค้ดกลับมาเป็นบล็อก ส่วนที่ยังไม่มีบล็อกรองรับจะกลายเป็นบล็อก "โค้ดของฉัน"
   */
  function setAuthor(mode: AuthorMode): void {
    if (author.value === mode) return

    let pending: string | null = null

    if (mode === 'code') {
      agent.code = blocks.generated.value.code
      agent.name = blocks.program.name
    } else {
      const imported = importProgram(agent.code, MAZE_PACK)

      if (!imported.ok || !imported.program) {
        error.value = imported.message
        return
      }

      pending = imported.message

      blocks.replaceProgram(imported.program)
    }

    author.value = mode
    clearRun()
    if (status.value !== 'idle') status.value = 'idle'

    // ตั้งข้อความหลัง clearRun เพราะ clearRun ล้างข้อความเดิมทิ้ง
    if (mode === 'blocks') notice.value = pending
  }

  function createRunner(): MazeRunner {
    return new MazeRunner(source.value, {
      timeoutMs: 5000,
      onTrace: (tick) => {
        trace.method = tick.method
        trace.depth = tick.depth
        trace.calls = tick.calls
        if (tick.line > 0) trace.line = tick.line
      },
      onLog: (lines) => {
        const next = [...logs.value, ...lines]
        logs.value = next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
      },
      onSummary: (summary) => {
        // โหมดเดินทีละก้าวได้สรุปทุกก้าว จึงบวกสะสมให้เห็นยอดรวมทั้งรอบ
        for (const [method, count] of Object.entries(summary.counts)) {
          trace.counts = { ...trace.counts, [method]: (trace.counts[method] ?? 0) + count }
        }

        const lines = { ...trace.lines }
        for (const [line, count] of Object.entries(summary.lines)) {
          lines[Number(line)] = (lines[Number(line)] ?? 0) + count
        }

        trace.lines = lines
        trace.calls += summary.calls
        trace.ms += summary.ms
        trace.method = null
      }
    })
  }

  /** ลองคอมไพล์โค้ดและให้หาทางบนแผนที่ปัจจุบัน เพื่อเช็กก่อนรันจริง */
  async function testCode(code?: string): Promise<{ ok: boolean; message: string }> {
    const probe = new MazeRunner(code ?? source.value, { timeoutMs: 5000 })

    try {
      const ready = await probe.start()

      if (ready.mode === 'plan') {
        const { path: raw } = await probe.solve(buildState(maze.value.start, 1, null, {}))
        const report = validatePath(maze.value, raw)

        return report.ok
          ? { ok: true, message: `"${ready.name}" หาทางออกได้ — ${report.steps} ก้าว ต้นทุน ${report.cost}` }
          : { ok: false, message: `"${ready.name}" ยังไปไม่ถึง: ${report.message}` }
      }

      const { move } = await probe.step(
        buildState(maze.value.start, 1, null, { [key(maze.value.start.row, maze.value.start.col)]: 1 })
      )

      if (!move) return { ok: false, message: `"${ready.name}" ไม่ได้คืนก้าวแรก` }
      if (!walkable(maze.value.grid, move.row, move.col)) {
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

  // ---------- เริ่มหาทาง ----------

  async function run(): Promise<void> {
    generation++
    const gen = generation

    disposeRunner()
    clearRun()
    status.value = 'running'
    trace.running = true

    const current = createRunner()
    runner = current

    try {
      const ready = await current.start()
      if (gen !== generation) return

      if (author.value === 'code') agent.name = ready.name
      agent.mode = ready.mode
      trace.traced = ready.traced
      current.notifyStart(buildState(maze.value.start, 1, null, {}))

      if (ready.mode === 'plan') await runPlan(gen, current)
      else await runSteps(gen, current)
    } catch (caught) {
      if (gen !== generation) return
      fail(caught instanceof Error ? caught.message : String(caught))
    }
  }

  /** โหมดวางแผน: ขอเส้นทางทีเดียว แล้วค่อยเล่นภาพการค้นหาให้ดู */
  async function runPlan(gen: number, current: MazeRunner): Promise<void> {
    const outcome = await current.solve(buildState(maze.value.start, 1, null, {}))
    if (gen !== generation) return

    trace.running = false
    explored.value = outcome.explored
    timeline = outcome.timeline

    const report = validatePath(maze.value, outcome.path)
    path.value = report.cells

    if (!(await replay(gen, timeline, 0, pace.value.replayMs))) return
    if (!(await walk(gen))) return

    finish(gen, current, report.ok, report.message, report.steps, report.cost)
  }

  /** โหมดเดินทีละก้าว: ถาม agent ทีละก้าวจนถึงทางออกหรือหมดโควตา */
  async function runSteps(gen: number, current: MazeRunner): Promise<void> {
    const start = maze.value.start
    const visits: Record<string, number> = { [key(start.row, start.col)]: 1 }
    const trail: Point[] = [start]
    const found: Point[] = []

    let position = start
    let previous: Point | null = null
    let cost = 0

    path.value = trail

    for (let step = 1; step <= stepLimit.value; step++) {
      if (!(await holdWhilePaused(gen))) return

      trace.running = true
      const outcome = await current.step(buildState(position, step, previous, { ...visits }))
      if (gen !== generation) return
      trace.running = false

      const base = found.length

      if (outcome.explored.length > 0) {
        found.push(...outcome.explored)
        explored.value = [...found]
      }

      // เล่นย้อนบรรทัดของก้าวนี้ให้พอดีกับจังหวะหน่วง จะได้เห็นว่า step() ตัดสินใจยังไง
      if (!(await replay(gen, outcome.timeline, base, pace.value.stepDelay))) return

      const move = outcome.move

      if (!move) {
        const why =
          author.value === 'blocks'
            ? `หยุดที่ (${position.row}, ${position.col}) — อ่านโปรแกรมจนจบแล้วไม่เจอบล็อกที่สั่งเดิน`
            : `หยุดเดินที่ (${position.row}, ${position.col}) — step() คืน null`

        finish(gen, current, false, why, trail.length - 1, cost)
        return
      }

      if (manhattan(position, move) !== 1) {
        fail(`ก้าวที่ ${step} กระโดดข้ามช่อง จาก (${position.row}, ${position.col}) ไป (${move.row}, ${move.col})`)
        return
      }

      if (!walkable(maze.value.grid, move.row, move.col)) {
        fail(`ก้าวที่ ${step} ชนกำแพงที่ (${move.row}, ${move.col})`)
        return
      }

      trail.push(move)
      path.value = [...trail]
      walkShown.value = trail.length - 1

      cost += stepCost(maze.value.grid, move.row, move.col)
      previous = position
      position = move

      const id = key(move.row, move.col)
      visits[id] = (visits[id] ?? 0) + 1

      if (same(move, maze.value.goal)) {
        finish(gen, current, true, 'ถึงทางออกแล้ว', trail.length - 1, cost)
        return
      }
    }

    finish(gen, current, false, `เดินครบ ${stepLimit.value} ก้าวแล้วยังไม่ถึงทางออก`, trail.length - 1, cost)
  }

  function finish(
    gen: number,
    current: MazeRunner,
    ok: boolean,
    message: string,
    steps: number,
    cost: number
  ): void {
    if (gen !== generation) return

    trace.running = false
    trace.method = null

    result.value = { ok, message, steps, cost, explored: explored.value.length, ms: trace.ms }
    status.value = 'finished'

    current.notifyFinish(ok, steps, cost)
    disposeRunner()
  }

  // ---------- ปุ่มควบคุม ----------

  function pause(): void {
    if (status.value === 'running') status.value = 'paused'
  }

  function resume(): void {
    if (status.value === 'paused') status.value = 'running'
  }

  function stop(): void {
    if (status.value === 'idle') return

    generation++
    disposeRunner()
    trace.running = false
    trace.method = null
    status.value = 'idle'
  }

  function reset(): void {
    stop()
    clearRun()
    status.value = 'idle'
  }

  onScopeDispose(disposeRunner)

  return {
    // สถานะ
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
    // คำสั่ง
    build,
    setOption,
    shuffle,
    editCell,
    useTemplate,
    setAuthor,
    setCode,
    testCode,
    run,
    pause,
    resume,
    stop,
    reset
  }
}
