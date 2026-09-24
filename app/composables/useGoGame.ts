import type { ShallowRef } from 'vue'
import { SPEEDS } from '~/game/go/pace'
import type { AgentMemory, TurnState } from '~/game/go/agent'
import { viewOf } from '~/game/go/agent'
import {
  BLACK,
  BOARD_SIZES,
  DEFAULT_KOMI,
  WHITE,
  clonePosition,
  createPosition,
  isLegal,
  isOver,
  areaMap,
  legalMoves,
  legality,
  opponent,
  play,
  score,
  toNotation,
  type Board,
  type BoardSize,
  type Legality,
  type Move,
  type Player,
  type Position,
  type Score
} from '~/game/go/engine'
import { AgentRunner } from '~/game/go/runner'
import { DEFAULT_PRESET_ID, GO_PACK } from '~/game/go/blocks/pack'
import { importProgram } from '~/game/blocks/importer'
import { usesBlock } from '~/game/blocks/program'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'

export type GoSideKind = 'human' | 'code'
export type GoGameStatus = 'setup' | 'playing' | 'paused' | 'finished' | 'error'

export interface GoSideSetup {
  kind: GoSideKind

  author: AuthorMode

  /** โค้ด JS ของฝั่งนี้ — โหมดบล็อกไม่ได้ใช้ ใช้ตอนสลับไปดูโค้ดเท่านั้น */
  code: string

  agentName: string
}

export interface GoAgentTrace {
  running: boolean

  line: number | null

  lines: Record<number, number>

  method: string | null

  depth: number

  calls: number

  counts: Record<string, number>

  ms: number
}

export interface GoLogEntry {
  turn: number
  player: Player
  /** ชื่อช่องแบบหนังสือโกะ เช่น D4 — ผ่านตาใช้ขีด */
  notation: string
  /** จับหมากของอีกฝ่ายได้กี่เม็ดในตานี้ */
  captured: number
  pass: boolean
}

interface Snapshot {
  position: Position
  lastMove: Move | null
  log: GoLogEntry[]
}

const createSide = (): GoSideSetup => ({
  kind: 'human',
  author: 'blocks',
  code: '',
  agentName: 'Agent'
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** เวลาคิดต่อหนึ่งตา — โกะค้นหนักกว่าโอเทลโล (สุ่มเล่นจนจบ/MCTS) จึงให้มากกว่า */
const TURN_BUDGET = 900

/** ตอนฝึกต้องเล่นหลายร้อยเกมรวด คิดนานเท่าเกมจริงไม่ได้ */
const TRAIN_BUDGET = 60

/** เผื่อเวลาให้ worker ตอบกลับหลังหมดงบคิด ก่อนจะถือว่ามันค้าง */
const WATCHDOG = 2500

const MEMORY_PREFIX = 'go:memory:'

const MEMORY_LIMIT = 256 * 1024

export interface GoMemoryInfo {
  label?: string
  bytes: number
  savedAt: number
}

const NORMAL_SPEED = SPEEDS[2]!.value

const emptyTrace = (): GoAgentTrace => ({
  running: false,
  line: null,
  lines: {},
  method: null,
  depth: 0,
  calls: 0,
  counts: {},
  ms: 0
})

type TrainFocus = Player | 'both'

type Blocks = Record<Player, ReturnType<typeof useBlockProgram>>

interface Training {
  running: boolean

  /**
   * เลขรอบฝึก — เพิ่มขึ้นทุกครั้งที่กดเริ่มฝึกใหม่
   *
   * รอบที่ถูกสั่งหยุดยังเก็บกวาดของตัวเองไม่เสร็จทันที ถ้าผู้ใช้กดเริ่มใหม่ในจังหวะนั้น
   * รอบเก่าจะไปปิดสวิตช์ทับรอบใหม่ที่เพิ่งติด เลขนี้จึงมีไว้ให้แต่ละรอบเก็บกวาดเฉพาะของตัวเอง
   */
  session: number
  done: number
  total: number
  blackWins: number
  whiteWins: number
  draws: number
  focus: TrainFocus
  error: string | null
}

interface Go {
  position: ShallowRef<Position>
  size: Ref<BoardSize>
  komi: Ref<number>
  status: Ref<GoGameStatus>
  lastMove: Ref<Move | null>
  log: Ref<GoLogEntry[]>
  error: Ref<string | null>
  notice: Ref<string | null>
  overlay: Ref<boolean>
  thinking: Ref<Player | null>
  speed: Ref<number>
  sides: Record<Player, GoSideSetup>
  traces: Record<Player, GoAgentTrace>
  blocks: Blocks
  activeBlocks: Record<Player, BlockId | null>
  logs: Record<Player, LogLine[]>
  memories: Record<Player, GoMemoryInfo | null>
  training: Training
  runners: Record<Player, AgentRunner | null>
  history: Snapshot[]
  logLimit: number
  generation: number
  reset: () => void
}

const PLAYERS = [BLACK, WHITE] as Player[]

const sideLabel = (player: Player): string => (player === BLACK ? 'ดำ' : 'ขาว')

const reason = (caught: unknown): string => (caught instanceof Error ? caught.message : String(caught))

/** เหตุผลที่ลงตานั้นไม่ได้ เป็นภาษาที่ผู้เล่นอ่านรู้เรื่อง */
const WHY: Record<Legality, string> = {
  ok: '',
  occupied: 'ช่องนั้นมีหมากอยู่แล้ว',
  suicide: 'ลงตรงนั้นแล้วหมู่ของตัวเองจะไม่เหลือลมหายใจ',
  ko: 'ติดกติกาโค — กินคืนทันทีไม่ได้ ต้องไปลงที่อื่นก่อนหนึ่งตา',
  outside: 'ช่องนั้นอยู่นอกกระดาน',
  finished: 'เกมจบแล้ว'
}

/** ลงได้มากสุดกี่ตาก่อนจะบังคับให้จบ — กันบอทที่ลงวนไปเรื่อยไม่ยอมผ่านตา */
const moveCap = (size: BoardSize): number => size * size * 3

const describe = (size: BoardSize, move: Move): string =>
  move === 'pass' ? 'ผ่านตา' : toNotation(size, move.row, move.col)

function memoryKey(game: Go, player: Player): string {
  const side = game.sides[player]
  const program = side.author === 'blocks' ? `blocks:${game.blocks[player].programKey.value}` : 'code'

  /*
   * ความจำผูกกับขนาดกระดานด้วย — สิ่งที่เรียนมาจากกระดาน 9 ใช้กับ 19 แทบไม่ได้เลย
   * ปนกันเมื่อไรจะกลายเป็นยิ่งฝึกยิ่งมั่ว
   */
  return `${MEMORY_PREFIX}${program}@${game.size.value}#${player === BLACK ? 'black' : 'white'}`
}

function storedMemory(game: Go, player: Player): string | null {
  if (!import.meta.client) return null

  try {
    return localStorage.getItem(memoryKey(game, player))
  } catch {
    return null
  }
}

function readMemory(game: Go, player: Player): AgentMemory | null {
  const raw = storedMemory(game, player)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AgentMemory
  } catch {
    return null
  }
}

const infoOf = (data: AgentMemory, bytes: number, savedAt: number): GoMemoryInfo => ({
  label: typeof data.label === 'string' ? data.label : undefined,
  bytes,
  savedAt
})

function writeMemory(game: Go, player: Player, data: AgentMemory): void {
  if (!import.meta.client) return

  try {
    const raw = JSON.stringify(data)
    if (raw.length > MEMORY_LIMIT) return

    localStorage.setItem(memoryKey(game, player), raw)
    game.memories[player] = infoOf(data, raw.length, Date.now())
  } catch {
    game.memories[player] = game.memories[player]
  }
}

function refreshMemory(game: Go, player: Player): void {
  if (!import.meta.client) return

  const raw = storedMemory(game, player)
  if (!raw) {
    game.memories[player] = null
    return
  }

  try {
    game.memories[player] = infoOf(JSON.parse(raw) as AgentMemory, raw.length, 0)
  } catch {
    game.memories[player] = null
  }
}

function clearMemory(game: Go, player: Player): void {
  if (!import.meta.client) return

  try {
    localStorage.removeItem(memoryKey(game, player))
  } catch {
    game.memories[player] = game.memories[player]
  }

  game.memories[player] = null
}

function snapshot(game: Go): Snapshot {
  return {
    position: clonePosition(game.position.value),
    lastMove: game.lastMove.value === 'pass' ? 'pass' : game.lastMove.value ? { ...game.lastMove.value } : null,
    log: game.log.value.map((entry) => ({ ...entry }))
  }
}

function stopTraces(game: Go): void {
  for (const player of PLAYERS) {
    game.traces[player].running = false
    game.traces[player].method = null
    game.traces[player].depth = 0
  }
}

function fail(game: Go, message: string): void {
  game.generation++
  game.thinking.value = null
  stopTraces(game)
  game.error.value = message
  game.status.value = 'error'
}

const buildTurnState = (game: Go, budget = TURN_BUDGET): TurnState =>
  viewOf(game.position.value, budget, game.lastMove.value)

function finish(game: Go, note: string | null = null): void {
  game.status.value = 'finished'
  game.thinking.value = null
  stopTraces(game)
  game.overlay.value = true
  if (note) game.notice.value = note

  const final = score(game.position.value)
  const board = Uint8Array.from(game.position.value.board)
  for (const player of PLAYERS) game.runners[player]?.finish(board, final.winner, final.lead)
}

/** ลงหนึ่งตาให้ฝ่ายที่ถึงตา — ผิดกติกาจะคืน false พร้อมบอกเหตุผลไว้ใน notice */
function commitMove(game: Go, move: Move): boolean {
  const position = game.position.value
  const player = position.toPlay
  const why = legality(position, move, player)

  if (why !== 'ok') {
    game.notice.value = `${describe(position.size, move)} ลงไม่ได้ — ${WHY[why]}`
    return false
  }

  game.history.push(snapshot(game))
  game.notice.value = null

  const { position: next, captured } = play(position, move, player)

  game.position.value = next
  game.lastMove.value = move === 'pass' ? 'pass' : { row: move.row, col: move.col }
  game.log.value = [
    ...game.log.value,
    {
      turn: position.turn,
      player,
      notation: move === 'pass' ? '—' : toNotation(position.size, move.row, move.col),
      captured: captured.length,
      pass: move === 'pass'
    }
  ]

  if (isOver(next)) {
    // ไม่ต้องขึ้นข้อความบอก — แผ่นสรุป แผงคะแนน และประวัติการเดิน (ผ่านตาสองแถวท้าย) บอกอยู่แล้ว
    finish(game)
    return true
  }

  // บอทที่ยังไม่ยอมผ่านตาสักทีต้องมีคนเรียกจบให้ ไม่งั้นวนไม่รู้จบ
  if (next.turn > moveCap(next.size)) {
    finish(game, `ลงครบ ${moveCap(next.size)} ตาแล้วยังไม่จบ — ปิดเกมแล้วนับแต้มตามกระดานนี้`)
    return true
  }

  void driveTurn(game)
  return true
}

async function driveTurn(game: Go): Promise<void> {
  if (game.status.value !== 'playing') return

  const player = game.position.value.toPlay
  if (game.sides[player].kind !== 'code') return

  const runner = game.runners[player]
  if (!runner?.alive) {
    fail(game, 'agent หยุดทำงานไปแล้ว กด "เริ่มใหม่" เพื่อโหลดโค้ดอีกครั้ง')
    return
  }

  const gen = game.generation
  game.thinking.value = player

  Object.assign(game.traces[player], emptyTrace(), { running: true, method: 'chooseMove', depth: 1 })

  try {
    const [move] = await Promise.all([
      runner.think(buildTurnState(game), TURN_BUDGET + WATCHDOG),
      wait(game.speed.value)
    ])

    if (gen !== game.generation || game.status.value !== 'playing') return

    game.thinking.value = null
    game.traces[player].running = false
    game.traces[player].method = null

    if (!commitMove(game, move)) {
      fail(
        game,
        `โค้ดฝั่ง${sideLabel(player)}เลือกตาที่ลงไม่ได้: ${game.notice.value ?? describe(game.position.value.size, move)}`
      )
    }
  } catch (caught) {
    if (gen !== game.generation) return
    fail(game, `โค้ดฝั่ง${sideLabel(player)}: ${reason(caught)}`)
  }
}

function disposeRunners(game: Go): void {
  for (const player of PLAYERS) {
    game.runners[player]?.dispose()
    game.runners[player] = null
  }
}

const sourceOf = (game: Go, player: Player): string =>
  game.sides[player].author === 'blocks'
    ? game.blocks[player].generated.value.code
    : game.sides[player].code

function createRunner(game: Go, player: Player, persist = true): AgentRunner {
  return new AgentRunner(sourceOf(game, player), {
    timeoutMs: TURN_BUDGET + WATCHDOG,

    memory: readMemory(game, player),

    /*
     * ฝึกทีละฝั่ง ฝั่งที่ไม่ได้ฝึกต้องเป็นคู่ซ้อมที่นิ่ง ไม่ใช่แค่ "ไม่บันทึกลงเครื่อง"
     * ถ้าปล่อยให้มันจำในหัวตัวเองระหว่างรอบ มันจะปรับตัวสู้ฝั่งที่กำลังฝึกไปเรื่อย ๆ
     * ฝั่งที่ฝึกก็เลยเจอคู่ต่อสู้ที่แข็งขึ้นทุกรอบ ยิ่งฝึกยิ่งดูเหมือนแย่ลง
     */
    frozen: !persist,

    onMemory: (data) => {
      if (persist) writeMemory(game, player, data)
    },
    onLog: (lines) => {
      const next = [...game.logs[player], ...lines]
      game.logs[player] = next.length > game.logLimit ? next.slice(next.length - game.logLimit) : next
    },
    onTrace: (tick) => {
      const trace = game.traces[player]
      trace.method = tick.method
      trace.depth = tick.depth
      trace.calls = tick.calls

      if (tick.line > 0) {
        trace.line = tick.line
        const id = game.blocks[player].blockAtLine(tick.line)
        if (id) game.activeBlocks[player] = id
      }
    },
    onSummary: (summary) => {
      const trace = game.traces[player]
      trace.counts = summary.counts
      trace.calls = summary.calls
      trace.ms = summary.ms
      trace.lines = summary.lines
      trace.method = null
      trace.running = false
    }
  })
}

function blankBoard(game: Go): void {
  game.position.value = createPosition(game.size.value, game.komi.value)
  game.lastMove.value = null
  game.log.value = []
  game.error.value = null
  game.notice.value = null
  game.overlay.value = false
  game.thinking.value = null
  game.history.length = 0

  for (const player of PLAYERS) Object.assign(game.traces[player], emptyTrace())
}

async function bootRunner(game: Go, player: Player): Promise<boolean> {
  const runner = createRunner(game, player)

  try {
    game.sides[player].agentName = await runner.start()
    runner.notifyStart(player)
    game.runners[player] = runner
    return true
  } catch (caught) {
    runner.dispose()
    fail(game, `โค้ดฝั่ง${sideLabel(player)}: ${reason(caught)}`)
    return false
  }
}

async function startGame(game: Go): Promise<void> {
  game.generation++
  disposeRunners(game)
  blankBoard(game)

  for (const player of PLAYERS) {
    if (game.sides[player].kind !== 'code') continue
    if (!(await bootRunner(game, player))) return
  }

  game.status.value = 'playing'
  void driveTurn(game)
}

async function playHeadless(
  game: Go,
  pair: Record<Player, AgentRunner>,
  alive: () => boolean
): Promise<Score> {
  let position = createPosition(game.size.value, game.komi.value)
  let previous: Move | null = null
  const cap = moveCap(position.size)

  for (const player of PLAYERS) pair[player].notifyStart(player)

  while (!isOver(position) && position.turn <= cap && alive()) {
    const side = position.toPlay
    const move = await pair[side].think(viewOf(position, TRAIN_BUDGET, previous), TRAIN_BUDGET + WATCHDOG)

    // ฝึกแล้วเจอตาที่ลงไม่ได้ก็ไม่ต้องล้มทั้งรอบ ถือว่าผ่านตาไปแทน
    const chosen: Move = isLegal(position, move, side) ? move : 'pass'

    position = play(position, chosen, side).position
    previous = chosen
  }

  const final = score(position)
  const board = Uint8Array.from(position.board)
  for (const player of PLAYERS) pair[player].finish(board, final.winner, final.lead)

  await wait(30)

  if (alive()) game.position.value = position
  return final
}

function tally(training: Training, winner: Player | null): void {
  if (winner === BLACK) training.blackWins++
  else if (winner === WHITE) training.whiteWins++
  else training.draws++

  training.done++
}

function beginTraining(training: Training, games: number, focus: TrainFocus): number {
  training.session++
  training.running = true
  training.done = 0
  training.total = games
  training.blackWins = 0
  training.whiteWins = 0
  training.draws = 0
  training.focus = focus
  training.error = null

  return training.session
}

async function train(game: Go, games: number, focus: TrainFocus = 'both'): Promise<void> {
  if (game.training.running) return

  if (game.sides[BLACK].kind !== 'code' || game.sides[WHITE].kind !== 'code') {
    game.training.error = 'ต้องตั้งให้ทั้งสองฝั่งเป็นบอทก่อนถึงจะฝึกได้'
    return
  }

  game.reset()

  const session = beginTraining(game.training, games, focus)

  /** รอบนี้ยังเป็นรอบที่หน้าจอสนใจอยู่ไหม — กดหยุดหรือกดเริ่มใหม่แล้วก็ไม่ใช่แล้ว */
  const alive = () => game.training.running && game.training.session === session

  const pair = {} as Record<Player, AgentRunner>

  try {
    for (const player of PLAYERS) {
      const runner = createRunner(game, player, focus === 'both' || focus === player)
      game.sides[player].agentName = await runner.start()
      pair[player] = runner
    }

    for (let round = 0; round < games && alive(); round++) {
      const final = await playHeadless(game, pair, alive)
      if (alive()) tally(game.training, final.winner)
    }
  } catch (caught) {
    if (game.training.session === session) game.training.error = reason(caught)
  } finally {
    await wait(100)

    for (const player of PLAYERS) pair[player]?.dispose()

    // รอบใหม่เริ่มไปแล้วก็ปล่อยเขาไป อย่าไปปิดสวิตช์หรือล้างกระดานทับของเขา
    if (game.training.session === session) {
      game.training.running = false
      game.position.value = createPosition(game.size.value, game.komi.value)
    }
  }
}

async function probeCode(code: string, size: BoardSize): Promise<{ ok: boolean; message: string }> {
  const runner = new AgentRunner(code, { timeoutMs: TURN_BUDGET + WATCHDOG })

  try {
    const name = await runner.start()
    const fresh = createPosition(size)
    const move = await runner.think(viewOf(fresh, TURN_BUDGET), TURN_BUDGET + WATCHDOG)

    return { ok: true, message: `"${name}" ทำงานได้ — ตาแรกที่เลือกคือ ${describe(size, move)}` }
  } catch (caught) {
    return { ok: false, message: reason(caught) }
  } finally {
    runner.dispose()
  }
}

const nameOfSide = (game: Go, player: Player): string =>
  game.sides[player].author === 'blocks' ? game.blocks[player].program.name : game.sides[player].agentName

/** ฝั่งนี้มีบล็อกจำของข้ามเกมไหม — การ์ดความจำจะได้โชว์เฉพาะฝั่งที่ใช้จริง */
const learnsBy = (game: Go, player: Player): boolean =>
  game.sides[player].author === 'blocks'
    ? usesBlock(game.blocks[player].program, ['remember', 'forget', 'go.learned', 'go.remember', 'go.rl-play', 'go.rl-learn'])
    : game.sides[player].code.includes('saveMemory(')

const countsOf = (game: Go, player: Player): Record<BlockId, number> =>
  game.sides[player].author === 'blocks'
    ? game.blocks[player].blockCounts(game.traces[player].lines)
    : {}

/** แก้ค่าตั้งต้น (ขนาดกระดาน โคมิ) ได้เฉพาะตอนยังไม่เริ่มเล่น */
function inSetup(game: Go, what: string): boolean {
  if (game.status.value === 'setup') return true

  game.notice.value = `เปลี่ยน${what}ได้ก่อนเริ่มเกมเท่านั้น — กด "เริ่มใหม่" ก่อน`
  return false
}

function switchAuthor(game: Go, player: Player, mode: AuthorMode): void {
  if (game.sides[player].author === mode) return

  if (mode === 'code') {
    game.sides[player].code = game.blocks[player].generated.value.code
    game.sides[player].agentName = game.blocks[player].program.name
  } else {
    const imported = importProgram(game.sides[player].code, GO_PACK)

    if (!imported.ok || !imported.program) {
      game.error.value = `ฝั่ง${sideLabel(player)}: ${imported.message}`
      return
    }

    game.blocks[player].replaceProgram(imported.program)
    game.error.value = null
  }

  game.sides[player].author = mode
}

export function useGoGame() {
  const size = ref<BoardSize>(9)
  const komi = ref(DEFAULT_KOMI[9])

  const position = shallowRef<Position>(createPosition(size.value, komi.value))
  const status = ref<GoGameStatus>('setup')
  const lastMove = ref<Move | null>(null)
  const log = ref<GoLogEntry[]>([])
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const overlay = ref(false)
  const thinking = ref<Player | null>(null)

  const speed = ref(NORMAL_SPEED)

  const sides = reactive<Record<Player, GoSideSetup>>({
    [BLACK]: createSide(),
    [WHITE]: { ...createSide(), kind: 'code' }
  }) as Record<Player, GoSideSetup>

  const traces = reactive<Record<Player, GoAgentTrace>>({
    [BLACK]: emptyTrace(),
    [WHITE]: emptyTrace()
  }) as Record<Player, GoAgentTrace>

  const blocks = {
    [BLACK]: useBlockProgram(GO_PACK, DEFAULT_PRESET_ID),
    [WHITE]: useBlockProgram(GO_PACK, DEFAULT_PRESET_ID)
  } as Record<Player, ReturnType<typeof useBlockProgram>>

  const activeBlocks = reactive<Record<Player, BlockId | null>>({
    [BLACK]: null,
    [WHITE]: null
  }) as Record<Player, BlockId | null>

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

  const memories = reactive<Record<Player, GoMemoryInfo | null>>({
    [BLACK]: null,
    [WHITE]: null
  }) as Record<Player, GoMemoryInfo | null>

  const training = reactive<Training>({
    running: false,
    session: 0,
    done: 0,
    total: 0,
    blackWins: 0,
    whiteWins: 0,
    draws: 0,
    focus: 'both',
    error: null
  })

  const game: Go = {
    position,
    size,
    komi,
    status,
    lastMove,
    log,
    error,
    notice,
    overlay,
    thinking,
    speed,
    sides,
    traces,
    blocks,
    activeBlocks,
    logs,
    memories,
    training,
    runners,
    history,
    logLimit: LOG_LIMIT,
    generation: 0,
    reset: () => reset()
  }

  const board = computed<Board>(() => position.value.board)

  const current = computed<Player>(() => position.value.toPlay)

  const turn = computed(() => position.value.turn)

  /** จับหมากของอีกฝ่ายไปแล้วกี่เม็ด แยกตามฝั่ง */
  const captures = computed<Record<Player, number>>(() => position.value.captures)

  const ko = computed<number | null>(() => position.value.ko)

  const passes = computed(() => position.value.passes)

  /** ช่องที่ฝ่ายที่ถึงตาลงได้ เก็บเป็นตำแหน่งแบน — กระดานใช้ไฮไลต์ว่าคลิกตรงไหนได้ */
  const legal = computed<number[]>(() =>
    status.value === 'playing' || status.value === 'paused' ? legalMoves(position.value) : []
  )

  const legalSet = computed<Set<number>>(() => new Set(legal.value))

  /** แต้มตามกระดานตอนนี้ — โชว์ได้ตลอดเกม ไม่ต้องรอจบ */
  const scores = computed<Score>(() => score(position.value))

  /**
   * ใครถือครองช่องไหนอยู่ — ใช้ระบายพื้นที่บนกระดาน
   * คิดจากกระดานตอนนี้ตรง ๆ ต้นเกมจึงยังแทบไม่มีใครถือครองอะไร ซึ่งตรงกับความจริง
   */
  const area = computed<Record<number, Player>>(() => areaMap(position.value))

  /** ผลสรุปตอนจบ — ยังไม่จบเป็น null */
  const result = computed<Score | null>(() => (status.value === 'finished' ? scores.value : null))

  const winner = computed<Player | null>(() => result.value?.winner ?? null)

  const isBusy = computed(() => thinking.value !== null)

  const canUndo = computed(() => history.length > 0 && status.value !== 'setup')

  const isHumanTurn = computed(
    () => status.value === 'playing' && sides[current.value].kind === 'human' && !isBusy.value
  )

  const canPass = computed(() => isHumanTurn.value)

  const learns = (player: Player): boolean => learnsBy(game, player)

  const blockCounts = (player: Player): Record<BlockId, number> => countsOf(game, player)

  const sourceOfSide = (player: Player): string => sourceOf(game, player)

  const nameOf = (player: Player): string => nameOfSide(game, player)

  function stopTraining(): void {
    training.running = false
  }

  const start = (): Promise<void> => startGame(game)

  const testCode = (code: string): Promise<{ ok: boolean; message: string }> => probeCode(code, size.value)

  const setAuthor = (player: Player, mode: AuthorMode): void => switchAuthor(game, player, mode)

  const clearMemoryOf = (player: Player): void => clearMemory(game, player)

  const refreshMemoryOf = (player: Player): void => refreshMemory(game, player)

  const trainGames = (games: number, focus: TrainFocus = 'both'): Promise<void> =>
    train(game, games, focus)

  /** คนคลิกลงหมาก — ช่องที่ลงไม่ได้แค่บอกเหตุผล ไม่ถือว่าเกมพัง */
  function playAt(row: number, col: number): boolean {
    if (!isHumanTurn.value) return false
    return commitMove(game, { row, col })
  }

  /** คนขอผ่านตา — ผ่านติดกันสองครั้งคือจบเกม */
  function pass(): boolean {
    if (!isHumanTurn.value) return false
    return commitMove(game, 'pass')
  }

  function pause(): void {
    if (status.value !== 'playing') return
    game.generation++
    thinking.value = null
    stopTraces(game)
    status.value = 'paused'
  }

  function resume(): void {
    if (status.value !== 'paused') return
    status.value = 'playing'
    void driveTurn(game)
  }

  function undo(): void {
    const previous = history.pop()
    if (!previous) return

    game.generation++
    thinking.value = null
    stopTraces(game)

    position.value = previous.position
    lastMove.value = previous.lastMove
    log.value = previous.log
    error.value = null
    notice.value = null
    overlay.value = false
    status.value = 'paused'
  }

  function reset(): void {
    game.generation++
    disposeRunners(game)

    blankBoard(game)
    status.value = 'setup'
  }

  /** ปิดแผ่นสรุปแต่ยังไม่เริ่มใหม่ — กระดานค้างไว้ให้นับแต้มดูได้ */
  function closeResult(): void {
    overlay.value = false
  }

  /** เปลี่ยนขนาดกระดานได้เฉพาะตอนยังไม่เริ่มเล่น แล้วโคมิกลับไปเป็นค่ามาตรฐานของขนาดนั้น */
  function setSize(next: BoardSize): void {
    if (!inSetup(game, 'ขนาดกระดาน') || !BOARD_SIZES.includes(next)) return

    size.value = next
    komi.value = DEFAULT_KOMI[next]
    blankBoard(game)
  }

  function setKomi(value: number): void {
    if (!inSetup(game, 'โคมิ')) return

    komi.value = Number.isFinite(value) ? value : DEFAULT_KOMI[size.value]
    blankBoard(game)
  }

  function setSide(player: Player, patch: Partial<GoSideSetup>): void {
    Object.assign(sides[player], patch)
  }

  /**
   * ความจำผูกกับ "โปรแกรมไหน บนกระดานขนาดไหน" ไม่ใช่ "ฝั่งไหน"
   * เปลี่ยนโปรแกรมหรือเปลี่ยนขนาดเมื่อไรก็ต้องไปอ่านความจำชุดใหม่ทันที
   * ไม่งั้นการ์ดจะโชว์ของเก่าหรือโชว์ว่าง ทั้งที่ของที่ฝึกไว้ยังอยู่ในเครื่อง
   */
  for (const player of PLAYERS) {
    watch(
      () => memoryKey(game, player),
      () => refreshMemory(game, player)
    )
  }

  onMounted(() => {
    for (const player of PLAYERS) refreshMemory(game, player)
  })

  onScopeDispose(() => disposeRunners(game))

  return {
    logs,
    clearLogs,
    blocks,
    activeBlocks,
    sourceOf: sourceOfSide,
    nameOf,
    learns,
    blockCounts,
    position,
    board,
    size,
    komi,
    sizes: BOARD_SIZES,
    current,
    status,
    turn,
    captures,
    ko,
    passes,
    lastMove,
    log,
    error,
    notice,
    overlay,
    thinking,
    speed,
    sides,
    traces,
    memories,
    training,
    legal,
    legalSet,
    area,
    scores,
    result,
    winner,
    canUndo,
    canPass,
    isHumanTurn,
    isBusy,

    start,
    playAt,
    pass,
    pause,
    resume,
    undo,
    reset,
    closeResult,
    setSize,
    setKomi,
    testCode,
    setSide,
    setAuthor,
    train: trainGames,
    stopTraining,
    refreshMemory: refreshMemoryOf,
    clearMemory: clearMemoryOf
  }
}
