import type { AgentMemory, TurnState } from '~/game/othello/agent'
import {
  BLACK,
  WHITE,
  applyMove,
  cloneBoard,
  countDiscs,
  createBoard,
  findMove,
  getValidMoves,
  hasValidMove,
  opponent,
  toNotation,
  type Board,
  type Move,
  type Player
} from '~/game/othello/engine'
import { AgentRunner } from '~/game/othello/runner'
import { DEFAULT_TEMPLATE_ID, findTemplate } from '~/game/othello/templates'
import { DEFAULT_PRESET_ID, OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { importProgram } from '~/game/blocks/importer'
import { usesBlock } from '~/game/blocks/program'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'

export type SideKind = 'human' | 'code'
export type GameStatus = 'setup' | 'playing' | 'paused' | 'finished' | 'error'

export interface SideConfig {
  kind: SideKind
  /** ต่อบล็อกหรือพิมพ์โค้ดเอง */
  author: AuthorMode
  templateId: string
  code: string
  /** ชื่อที่ได้จาก agent หลังโหลดโค้ดสำเร็จ */
  agentName: string
}

/** สิ่งที่โค้ดฝั่งนั้นกำลังทำอยู่ ใช้แสดงบนหน้าจอระหว่างเกม */
export interface AgentTrace {
  running: boolean
  /** บรรทัดของโค้ดที่กำลังรัน */
  line: number | null
  /** จำนวนครั้งที่รันแต่ละบรรทัด */
  lines: Record<number, number>
  /** เมธอดที่กำลังรัน ณ ตอนนี้ */
  method: string | null
  /** ความลึกของการเรียกซ้อน */
  depth: number
  /** จำนวนครั้งที่เรียกเมธอดทั้งหมดในตานี้ */
  calls: number
  /** จำนวนครั้งแยกตามเมธอด (ได้ครบหลังคิดจบ) */
  counts: Record<string, number>
  /** เวลาที่ใช้คิดตาล่าสุด (ms) */
  ms: number
}

export interface LogEntry {
  turn: number
  player: Player
  notation: string
  flips: number
  pass: boolean
}

interface Snapshot {
  board: Board
  current: Player
  turn: number
  lastMove: { row: number; col: number } | null
  log: LogEntry[]
}

const templateCode = (id: string): string => findTemplate(id)?.code ?? ''

const createSide = (templateId: string): SideConfig => ({
  kind: 'human',
  author: 'blocks',
  templateId,
  code: templateCode(templateId),
  agentName: findTemplate(templateId)?.name ?? 'Agent'
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** เวลาที่แนะนำให้ agent ใช้คิดต่อหนึ่งตา (ms) — เพดานจริงของระบบคือ 3000 */
const TURN_BUDGET = 500
/** ตอนฝึกซ้อมให้คิดสั้นลงมาก จะได้เล่นจบหลายเกมในเวลาไม่นาน */
const TRAIN_BUDGET = 40

const MEMORY_PREFIX = 'othello:memory:'
/** กันไม่ให้ความจำใหญ่จนกิน localStorage */
const MEMORY_LIMIT = 256 * 1024

export interface MemoryInfo {
  label?: string
  bytes: number
  savedAt: number
}

/** จังหวะที่บอทลงหมาก — แถบเลือกจังหวะกับค่าเริ่มต้นต้องอ่านจากที่เดียวกัน */
export interface SpeedOption {
  value: number
  label: string
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ทันที' },
  { value: 200, label: 'เร็ว' },
  { value: 500, label: 'ปกติ' },
  { value: 1000, label: 'ช้า' }
]

const NORMAL_SPEED = SPEEDS[2]!.value

const emptyTrace = (): AgentTrace => ({
  running: false,
  line: null,
  lines: {},
  method: null,
  depth: 0,
  calls: 0,
  counts: {},
  ms: 0
})

export function useOthelloGame() {
  const board = shallowRef<Board>(createBoard())
  const current = ref<Player>(BLACK)
  const status = ref<GameStatus>('setup')
  const turn = ref(1)
  const lastMove = ref<{ row: number; col: number } | null>(null)
  const log = ref<LogEntry[]>([])
  const error = ref<string | null>(null)
  const thinking = ref<Player | null>(null)
  /**
   * หน่วงก่อนที่ agent จะลงหมาก เพื่อให้ดูทัน (ms)
   * ต้องเป็นค่าใดค่าหนึ่งใน SPEEDS ไม่งั้นแถบ "จังหวะบอท" จะไม่มีปุ่มไหนสว่างเลย
   */
  const speed = ref(NORMAL_SPEED)

  const sides = reactive<Record<Player, SideConfig>>({
    [BLACK]: createSide(DEFAULT_TEMPLATE_ID),
    [WHITE]: { ...createSide(DEFAULT_TEMPLATE_ID), kind: 'code' }
  }) as Record<Player, SideConfig>

  const traces = reactive<Record<Player, AgentTrace>>({
    [BLACK]: emptyTrace(),
    [WHITE]: emptyTrace()
  }) as Record<Player, AgentTrace>

  /** โปรแกรมบล็อกของแต่ละฝั่ง ใช้แกนกลางตัวเดียวกับเกมอื่น */
  const blocks = {
    [BLACK]: useBlockProgram(OTHELLO_PACK, DEFAULT_PRESET_ID),
    [WHITE]: useBlockProgram(OTHELLO_PACK, 'greedy')
  } as Record<Player, ReturnType<typeof useBlockProgram>>

  /** โค้ดที่จะส่งให้ worker ของฝั่งนั้นรันจริง */
  const sourceOf = (player: Player): string =>
    sides[player].author === 'blocks' ? blocks[player].generated.value.code : sides[player].code

  /** ชื่อที่โชว์บนหน้าจอ */
  const nameOf = (player: Player): string =>
    sides[player].author === 'blocks' ? blocks[player].program.name : sides[player].agentName

  /** บล็อกที่กำลังทำงานของแต่ละฝั่ง */
  const activeBlocks = reactive<Record<Player, BlockId | null>>({
    [BLACK]: null,
    [WHITE]: null
  }) as Record<Player, BlockId | null>

  /** ข้อความที่โปรแกรมแต่ละฝั่งพิมพ์ออกคอนโซล */
  const logs = reactive<Record<Player, LogLine[]>>({ [BLACK]: [], [WHITE]: [] }) as Record<
    Player,
    LogLine[]
  >
  const LOG_LIMIT = 300

  const clearLogs = (player: Player) => {
    logs[player] = []
  }

  const runners: Record<Player, AgentRunner | null> = { [BLACK]: null, [WHITE]: null }
  const history: Snapshot[] = []

  /** สรุปความจำของแต่ละฝั่ง สำหรับแสดงบนหน้าจอ */
  const memories = reactive<Record<Player, MemoryInfo | null>>({
    [BLACK]: null,
    [WHITE]: null
  }) as Record<Player, MemoryInfo | null>

  /** ฝึกฝั่งไหน — ฝั่งที่ไม่ได้ฝึกจะเล่นด้วยแต่ไม่บันทึกความจำ */
  type TrainFocus = Player | 'both'

  const training = reactive({
    running: false,
    done: 0,
    total: 0,
    blackWins: 0,
    whiteWins: 0,
    draws: 0,
    focus: 'both' as TrainFocus,
    error: null as string | null
  })

  // ---------- ความจำข้ามเกม ----------

  /** แยกช่องเก็บตามโค้ดตั้งต้นและสีที่เล่น จะได้ไม่ทับกันเวลาใช้เทมเพลตเดียวกันสองฝั่ง */
  const memoryKey = (player: Player) => {
    const side = sides[player]
    const program = side.author === 'blocks' ? `blocks:${blocks[player].presetId.value}` : side.templateId
    return `${MEMORY_PREFIX}${program}#${player === BLACK ? 'black' : 'white'}`
  }

  function readMemory(player: Player): AgentMemory | null {
    if (!import.meta.client) return null

    try {
      const raw = localStorage.getItem(memoryKey(player))
      return raw ? (JSON.parse(raw) as AgentMemory) : null
    } catch {
      return null
    }
  }

  function writeMemory(player: Player, data: AgentMemory): void {
    if (!import.meta.client) return

    try {
      const raw = JSON.stringify(data)

      // ใหญ่เกินโควตาก็แค่ไม่บันทึก ไม่ล้มเกมทิ้ง
      // (ไม่งั้น agent สั่ง saveMemory ก้อนใหญ่ ๆ เพื่อล้มเกมที่ตัวเองกำลังแพ้ได้)
      if (raw.length > MEMORY_LIMIT) return

      localStorage.setItem(memoryKey(player), raw)
      memories[player] = {
        label: typeof data.label === 'string' ? data.label : undefined,
        bytes: raw.length,
        savedAt: Date.now()
      }
    } catch {
      // localStorage เต็มหรือถูกปิด — ปล่อยผ่าน ไม่ให้เกมสะดุด
    }
  }

  function refreshMemory(player: Player): void {
    if (!import.meta.client) return

    const raw = (() => {
      try {
        return localStorage.getItem(memoryKey(player))
      } catch {
        return null
      }
    })()

    if (!raw) {
      memories[player] = null
      return
    }

    try {
      const data = JSON.parse(raw) as AgentMemory
      memories[player] = {
        label: typeof data.label === 'string' ? data.label : undefined,
        bytes: raw.length,
        savedAt: 0
      }
    } catch {
      memories[player] = null
    }
  }

  function clearMemory(player: Player): void {
    if (!import.meta.client) return

    try {
      localStorage.removeItem(memoryKey(player))
    } catch {
      // ไม่ต้องทำอะไร
    }

    memories[player] = null
  }

  /** เพิ่มค่าทุกครั้งที่เกมถูกรีเซ็ต/หยุด เพื่อทิ้งผลลัพธ์ที่ค้างอยู่ */
  let generation = 0

  const validMoves = computed<Move[]>(() =>
    status.value === 'playing' || status.value === 'paused' ? getValidMoves(board.value, current.value) : []
  )

  const scores = computed(() => countDiscs(board.value))

  const winner = computed<Player | null>(() => {
    if (status.value !== 'finished') return null
    const { black, white } = scores.value
    if (black === white) return null
    return black > white ? BLACK : WHITE
  })

  const isBusy = computed(() => thinking.value !== null)

  const canUndo = computed(() => history.length > 0 && status.value !== 'setup')

  const isHumanTurn = computed(
    () => status.value === 'playing' && sides[current.value].kind === 'human' && !isBusy.value
  )

  // ---------- ตัวช่วยภายใน ----------

  function snapshot(): Snapshot {
    return {
      board: cloneBoard(board.value),
      current: current.value,
      turn: turn.value,
      lastMove: lastMove.value ? { ...lastMove.value } : null,
      log: log.value.map((entry) => ({ ...entry }))
    }
  }

  function stopTraces() {
    for (const player of [BLACK, WHITE] as Player[]) {
      traces[player].running = false
      traces[player].method = null
      traces[player].depth = 0
    }
  }

  function fail(message: string) {
    generation++
    thinking.value = null
    stopTraces()
    error.value = message
    status.value = 'error'
  }

  function buildTurnState(player: Player): TurnState {
    return {
      board: cloneBoard(board.value),
      player,
      opponent: opponent(player),
      validMoves: getValidMoves(board.value, player),
      turn: turn.value,
      lastMove: lastMove.value ? { ...lastMove.value } : null,
      timeBudget: TURN_BUDGET
    }
  }

  function finish() {
    status.value = 'finished'
    thinking.value = null
    stopTraces()

    const result = countDiscs(board.value)
    const champion = result.black === result.white ? null : result.black > result.white ? BLACK : WHITE

    for (const player of [BLACK, WHITE] as Player[]) {
      runners[player]?.notifyEnd(cloneBoard(board.value), champion)
    }
  }

  /** ลงหมากจริง แล้วส่งตาต่อไป (จัดการกรณีต้องผ่านตาให้ด้วย) */
  function commitMove(row: number, col: number) {
    const player = current.value
    const move = findMove(getValidMoves(board.value, player), row, col)

    if (!move) {
      fail(`ตา ${toNotation(row, col)} ผิดกติกา`)
      return
    }

    history.push(snapshot())

    const next = cloneBoard(board.value)
    next[row]![col] = player
    for (const [r, c] of move.flips) next[r]![c] = player

    board.value = next
    lastMove.value = { row, col }
    log.value = [
      ...log.value,
      { turn: turn.value, player, notation: toNotation(row, col), flips: move.flips.length, pass: false }
    ]
    turn.value++

    const foe = opponent(player)

    if (hasValidMove(next, foe)) {
      current.value = foe
    } else if (hasValidMove(next, player)) {
      log.value = [
        ...log.value,
        { turn: turn.value, player: foe, notation: '—', flips: 0, pass: true }
      ]
      current.value = player
    } else {
      finish()
      return
    }

    void driveTurn()
  }

  /** ถ้าตาปัจจุบันเป็นของฝั่งโค้ด ให้ไปขอคำตอบจาก worker */
  async function driveTurn(): Promise<void> {
    if (status.value !== 'playing') return

    const player = current.value
    if (sides[player].kind !== 'code') return

    const runner = runners[player]
    if (!runner || !runner.alive) {
      fail('agent หยุดทำงานไปแล้ว กด "เริ่มใหม่" เพื่อโหลดโค้ดอีกครั้ง')
      return
    }

    const gen = generation
    thinking.value = player

    Object.assign(traces[player], emptyTrace(), { running: true, method: 'chooseMove', depth: 1 })

    try {
      const [move] = await Promise.all([runner.chooseMove(buildTurnState(player)), wait(speed.value)])

      if (gen !== generation || status.value !== 'playing') return

      thinking.value = null
      traces[player].running = false
      traces[player].method = null
      commitMove(move.row, move.col)
    } catch (caught) {
      if (gen !== generation) return
      const label = player === BLACK ? 'ดำ' : 'ขาว'
      fail(`โค้ดฝั่ง${label}: ${caught instanceof Error ? caught.message : String(caught)}`)
    }
    // ไม่เคลียร์ thinking ตรงนี้ เพราะถ้าอีกฝ่ายต้องผ่านตา
    // driveTurn รอบถัดไปของผู้เล่นคนเดิมอาจเริ่มคิดไปแล้ว
  }

  function disposeRunners() {
    for (const player of [BLACK, WHITE] as Player[]) {
      runners[player]?.dispose()
      runners[player] = null
    }
  }

  // ---------- คำสั่งที่ UI เรียกใช้ ----------

  /** โหลดโค้ดของทุกฝั่งที่เป็น code แล้วเริ่มเกมใหม่ */
  async function start(): Promise<void> {
    generation++
    disposeRunners()

    board.value = createBoard()
    current.value = BLACK
    turn.value = 1
    lastMove.value = null
    log.value = []
    error.value = null
    thinking.value = null
    history.length = 0

    for (const player of [BLACK, WHITE] as Player[]) {
      Object.assign(traces[player], emptyTrace())
    }

    for (const player of [BLACK, WHITE] as Player[]) {
      if (sides[player].kind !== 'code') continue

      const runner = createRunner(player)

      try {
        sides[player].agentName = await runner.start()
        runner.notifyStart(player)
        runners[player] = runner
      } catch (caught) {
        runner.dispose()
        const label = player === BLACK ? 'ดำ' : 'ขาว'
        fail(`โค้ดฝั่ง${label}: ${caught instanceof Error ? caught.message : String(caught)}`)
        return
      }
    }

    status.value = 'playing'
    void driveTurn()
  }

  /**
   * โปรแกรมของฝั่งนี้เรียนรู้ข้ามเกมได้ไหม
   * ฝั่งบล็อกดูจากว่ามีบล็อก "จำไว้ข้ามเกม" หรือเปล่า ฝั่งโค้ดดูจากการเรียก saveMemory() ในโค้ดที่เขียนเอง
   * (ดูจากโค้ดที่แปลงแล้วไม่ได้ เพราะตัวช่วยกลางที่ระบบเติมให้ก็มีคำนี้อยู่)
   */
  const learns = (player: Player): boolean =>
    sides[player].author === 'blocks'
      ? usesBlock(blocks[player].program, ['remember', 'forget'])
      : sides[player].code.includes('saveMemory(')

  /** จำนวนครั้งที่แต่ละบล็อกของฝั่งนั้นทำงาน */
  const blockCounts = (player: Player): Record<BlockId, number> =>
    sides[player].author === 'blocks' ? blocks[player].blockCounts(traces[player].lines) : {}

  function createRunner(player: Player, persist = true): AgentRunner {
    return new AgentRunner(sourceOf(player), {
      memory: readMemory(player),
      onMemory: (data) => {
        if (persist) writeMemory(player, data)
      },
      onLog: (lines) => {
        const next = [...logs[player], ...lines]
        logs[player] = next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
      },
      onTrace: (tick) => {
        const trace = traces[player]
        trace.method = tick.method
        trace.depth = tick.depth
        trace.calls = tick.calls

        if (tick.line > 0) {
          trace.line = tick.line
          const id = blocks[player].blockAtLine(tick.line)
          if (id) activeBlocks[player] = id
        }
      },
      onSummary: (summary) => {
        const trace = traces[player]
        trace.counts = summary.counts
        trace.calls = summary.calls
        trace.ms = summary.ms
        trace.lines = summary.lines
        trace.method = null
        trace.running = false
      }
    })
  }

  // ---------- โหมดฝึกซ้อม ----------

  /** เล่นหนึ่งเกมให้จบโดยไม่ผ่านสถานะของหน้าจอ ใช้เฉพาะตอนฝึกซ้อม */
  async function playHeadless(pair: Record<Player, AgentRunner>): Promise<Player | null> {
    let table = createBoard()
    let side: Player = BLACK
    let ply = 1
    let previous: { row: number; col: number } | null = null

    for (const player of [BLACK, WHITE] as Player[]) pair[player].notifyStart(player)

    while (ply < 200 && training.running) {
      const moves = getValidMoves(table, side)

      if (moves.length === 0) {
        if (!hasValidMove(table, opponent(side))) break
        side = opponent(side)
        continue
      }

      const move = await pair[side].chooseMove({
        board: cloneBoard(table),
        player: side,
        opponent: opponent(side),
        validMoves: moves,
        turn: ply,
        lastMove: previous,
        timeBudget: TRAIN_BUDGET
      })

      table = applyMove(table, move, side)
      previous = move
      side = opponent(side)
      ply++
    }

    const result = countDiscs(table)
    const champion = result.black === result.white ? null : result.black > result.white ? BLACK : WHITE

    for (const player of [BLACK, WHITE] as Player[]) pair[player].notifyEnd(cloneBoard(table), champion)

    // ให้ worker ได้ประมวลผล onGameEnd แล้วส่ง saveMemory กลับมาให้ครบ
    // ก่อนจะขึ้นเกมถัดไปหรือปิด worker ทิ้ง
    await wait(30)

    board.value = table
    return champion
  }

  /**
   * ให้โค้ดสองฝั่งซ้อมกันเองหลายเกมรวด โดยใช้ worker ชุดเดิมตลอด
   * agent จึงสะสมความรู้ข้ามเกมได้ และระบบจะเก็บ saveMemory() ลงเครื่องให้ทุกครั้ง
   */
  async function train(games: number, focus: TrainFocus = 'both'): Promise<void> {
    if (training.running) return

    if (sides[BLACK].kind !== 'code' || sides[WHITE].kind !== 'code') {
      training.error = 'ต้องตั้งให้ทั้งสองฝั่งเป็นบอทก่อนถึงจะฝึกได้'
      return
    }

    reset()

    training.running = true
    training.done = 0
    training.total = games
    training.blackWins = 0
    training.whiteWins = 0
    training.draws = 0
    training.focus = focus
    training.error = null

    const pair = {} as Record<Player, AgentRunner>

    try {
      for (const player of [BLACK, WHITE] as Player[]) {
        // ฝึกฝั่งเดียว = อีกฝั่งเล่นด้วยแต่ไม่จำอะไรกลับไป คู่ซ้อมจึงนิ่งตลอดการฝึก
        const runner = createRunner(player, focus === 'both' || focus === player)
        sides[player].agentName = await runner.start()
        pair[player] = runner
      }

      for (let game = 0; game < games && training.running; game++) {
        const champion = await playHeadless(pair)

        if (champion === BLACK) training.blackWins++
        else if (champion === WHITE) training.whiteWins++
        else training.draws++

        training.done++
      }
    } catch (caught) {
      training.error = caught instanceof Error ? caught.message : String(caught)
    } finally {
      // รอข้อความบันทึกความจำของเกมสุดท้ายให้มาถึงก่อนปิด worker
      await wait(100)

      for (const player of [BLACK, WHITE] as Player[]) pair[player]?.dispose()
      training.running = false
      board.value = createBoard()
    }
  }

  function stopTraining(): void {
    training.running = false
  }

  /** ผู้เล่นคนคลิกลงหมาก */
  function play(row: number, col: number): void {
    if (!isHumanTurn.value) return
    if (!findMove(validMoves.value, row, col)) return
    commitMove(row, col)
  }

  function pause(): void {
    if (status.value !== 'playing') return
    generation++
    thinking.value = null
    stopTraces()
    status.value = 'paused'
  }

  function resume(): void {
    if (status.value !== 'paused') return
    status.value = 'playing'
    void driveTurn()
  }

  /** ย้อนกลับหนึ่งตา แล้วพักเกมไว้ให้กดเล่นต่อเอง */
  function undo(): void {
    const previous = history.pop()
    if (!previous) return

    generation++
    thinking.value = null
    stopTraces()

    board.value = previous.board
    current.value = previous.current
    turn.value = previous.turn
    lastMove.value = previous.lastMove
    log.value = previous.log
    error.value = null
    status.value = 'paused'
  }

  function reset(): void {
    generation++
    disposeRunners()

    board.value = createBoard()
    current.value = BLACK
    turn.value = 1
    lastMove.value = null
    log.value = []
    error.value = null
    thinking.value = null
    history.length = 0
    status.value = 'setup'

    for (const player of [BLACK, WHITE] as Player[]) {
      Object.assign(traces[player], emptyTrace())
    }
  }

  /** ลองคอมไพล์โค้ดและขอหนึ่งตาบนกระดานเริ่มต้น เพื่อเช็กก่อนเริ่มเกมจริง */
  async function testCode(code: string): Promise<{ ok: boolean; message: string }> {
    const runner = new AgentRunner(code)

    try {
      const name = await runner.start()
      const fresh = createBoard()
      const move = await runner.chooseMove({
        board: fresh,
        player: BLACK,
        opponent: WHITE,
        validMoves: getValidMoves(fresh, BLACK),
        turn: 1,
        lastMove: null
      })

      return { ok: true, message: `"${name}" ทำงานได้ — ตาแรกที่เลือกคือ ${toNotation(move.row, move.col)}` }
    } catch (caught) {
      return { ok: false, message: caught instanceof Error ? caught.message : String(caught) }
    } finally {
      runner.dispose()
    }
  }

  function setSide(player: Player, patch: Partial<SideConfig>): void {
    Object.assign(sides[player], patch)
  }

  /**
   * สลับวิธีเขียนโปรแกรมของฝั่งนั้น แล้วแปลงของเดิมตามไปด้วย
   * บล็อก -> โค้ด: เอาโค้ดที่บล็อกแปลงไว้ไปเขียนต่อ
   * โค้ด -> บล็อก: อ่านโค้ดกลับมาเป็นบล็อก
   */
  function setAuthor(player: Player, mode: AuthorMode): void {
    if (sides[player].author === mode) return

    if (mode === 'code') {
      sides[player].code = blocks[player].generated.value.code
      sides[player].agentName = blocks[player].program.name
    } else {
      const imported = importProgram(sides[player].code, OTHELLO_PACK)

      if (!imported.ok || !imported.program) {
        error.value = `ฝั่ง${player === BLACK ? 'ดำ' : 'ขาว'}: ${imported.message}`
        return
      }

      blocks[player].replaceProgram(imported.program)
      error.value = null
    }

    sides[player].author = mode
  }

  function useTemplate(player: Player, templateId: string): void {
    const template = findTemplate(templateId)
    if (!template) return
    setSide(player, { templateId, code: template.code, agentName: template.name })
    refreshMemory(player)
  }

  onMounted(() => {
    for (const player of [BLACK, WHITE] as Player[]) refreshMemory(player)
  })

  onScopeDispose(disposeRunners)

  return {
    // สถานะ
    logs,
    clearLogs,
    blocks,
    activeBlocks,
    sourceOf,
    nameOf,
    learns,
    blockCounts,
    board,
    current,
    status,
    turn,
    lastMove,
    log,
    error,
    thinking,
    speed,
    sides,
    traces,
    memories,
    training,
    validMoves,
    scores,
    winner,
    canUndo,
    isHumanTurn,
    isBusy,
    // คำสั่ง
    start,
    play,
    pause,
    resume,
    undo,
    reset,
    testCode,
    setSide,
    setAuthor,
    useTemplate,
    train,
    stopTraining,
    refreshMemory,
    clearMemory
  }
}
