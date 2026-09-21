import type { ShallowRef } from 'vue'
import { SPEEDS, type SpeedOption } from '~/game/othello/pace'
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

  author: AuthorMode
  templateId: string
  code: string

  agentName: string
}

export interface AgentTrace {
  running: boolean

  line: number | null

  lines: Record<number, number>

  method: string | null

  depth: number

  calls: number

  counts: Record<string, number>

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

const TURN_BUDGET = 500

const TRAIN_BUDGET = 40

const MEMORY_PREFIX = 'othello:memory:'

const MEMORY_LIMIT = 256 * 1024

export interface MemoryInfo {
  label?: string
  bytes: number
  savedAt: number
}


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

interface Othello {
  board: ShallowRef<Board>
  current: Ref<Player>
  status: Ref<GameStatus>
  turn: Ref<number>
  lastMove: Ref<{ row: number; col: number } | null>
  log: Ref<LogEntry[]>
  error: Ref<string | null>
  thinking: Ref<Player | null>
  speed: Ref<number>
  sides: Record<Player, SideConfig>
  traces: Record<Player, AgentTrace>
  blocks: Blocks
  activeBlocks: Record<Player, BlockId | null>
  logs: Record<Player, LogLine[]>
  memories: Record<Player, MemoryInfo | null>
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

const championOf = (board: Board): Player | null => {
  const { black, white } = countDiscs(board)
  if (black === white) return null
  return black > white ? BLACK : WHITE
}

function memoryKey(game: Othello, player: Player): string {
  const side = game.sides[player]
  const program =
    side.author === 'blocks' ? `blocks:${game.blocks[player].programKey.value}` : side.templateId

  return `${MEMORY_PREFIX}${program}#${player === BLACK ? 'black' : 'white'}`
}

function storedMemory(game: Othello, player: Player): string | null {
  if (!import.meta.client) return null

  try {
    return localStorage.getItem(memoryKey(game, player))
  } catch {
    return null
  }
}

function readMemory(game: Othello, player: Player): AgentMemory | null {
  const raw = storedMemory(game, player)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AgentMemory
  } catch {
    return null
  }
}

const infoOf = (data: AgentMemory, bytes: number, savedAt: number): MemoryInfo => ({
  label: typeof data.label === 'string' ? data.label : undefined,
  bytes,
  savedAt
})

function writeMemory(game: Othello, player: Player, data: AgentMemory): void {
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

function refreshMemory(game: Othello, player: Player): void {
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

function clearMemory(game: Othello, player: Player): void {
  if (!import.meta.client) return

  try {
    localStorage.removeItem(memoryKey(game, player))
  } catch {
    game.memories[player] = game.memories[player]
  }

  game.memories[player] = null
}

function snapshot(game: Othello): Snapshot {
  return {
    board: cloneBoard(game.board.value),
    current: game.current.value,
    turn: game.turn.value,
    lastMove: game.lastMove.value ? { ...game.lastMove.value } : null,
    log: game.log.value.map((entry) => ({ ...entry }))
  }
}

function stopTraces(game: Othello): void {
  for (const player of PLAYERS) {
    game.traces[player].running = false
    game.traces[player].method = null
    game.traces[player].depth = 0
  }
}

function fail(game: Othello, message: string): void {
  game.generation++
  game.thinking.value = null
  stopTraces(game)
  game.error.value = message
  game.status.value = 'error'
}

function buildTurnState(game: Othello, player: Player): TurnState {
  return {
    board: cloneBoard(game.board.value),
    player,
    opponent: opponent(player),
    validMoves: getValidMoves(game.board.value, player),
    turn: game.turn.value,
    lastMove: game.lastMove.value ? { ...game.lastMove.value } : null,
    timeBudget: TURN_BUDGET
  }
}

function finish(game: Othello): void {
  game.status.value = 'finished'
  game.thinking.value = null
  stopTraces(game)

  const champion = championOf(game.board.value)
  for (const player of PLAYERS) game.runners[player]?.notifyEnd(cloneBoard(game.board.value), champion)
}

function passOrFinish(game: Othello, next: Board, player: Player): boolean {
  const foe = opponent(player)

  if (hasValidMove(next, foe)) {
    game.current.value = foe
    return true
  }

  if (hasValidMove(next, player)) {
    game.log.value = [
      ...game.log.value,
      { turn: game.turn.value, player: foe, notation: '—', flips: 0, pass: true }
    ]
    game.current.value = player
    return true
  }

  finish(game)
  return false
}

function commitMove(game: Othello, row: number, col: number): void {
  const player = game.current.value
  const move = findMove(getValidMoves(game.board.value, player), row, col)

  if (!move) {
    fail(game, `ตา ${toNotation(row, col)} ผิดกติกา`)
    return
  }

  game.history.push(snapshot(game))

  const next = cloneBoard(game.board.value)
  next[row]![col] = player
  for (const [r, c] of move.flips) next[r]![c] = player

  game.board.value = next
  game.lastMove.value = { row, col }
  game.log.value = [
    ...game.log.value,
    { turn: game.turn.value, player, notation: toNotation(row, col), flips: move.flips.length, pass: false }
  ]
  game.turn.value++

  if (!passOrFinish(game, next, player)) return

  void driveTurn(game)
}

async function driveTurn(game: Othello): Promise<void> {
  if (game.status.value !== 'playing') return

  const player = game.current.value
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
      runner.chooseMove(buildTurnState(game, player)),
      wait(game.speed.value)
    ])

    if (gen !== game.generation || game.status.value !== 'playing') return

    game.thinking.value = null
    game.traces[player].running = false
    game.traces[player].method = null
    commitMove(game, move.row, move.col)
  } catch (caught) {
    if (gen !== game.generation) return
    fail(game, `โค้ดฝั่ง${sideLabel(player)}: ${reason(caught)}`)
  }
}

function disposeRunners(game: Othello): void {
  for (const player of PLAYERS) {
    game.runners[player]?.dispose()
    game.runners[player] = null
  }
}

function createRunner(game: Othello, player: Player, persist = true): AgentRunner {
  return new AgentRunner(sourceOf(game, player), {
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

function blankBoard(game: Othello): void {
  game.board.value = createBoard()
  game.current.value = BLACK
  game.turn.value = 1
  game.lastMove.value = null
  game.log.value = []
  game.error.value = null
  game.thinking.value = null
  game.history.length = 0

  for (const player of PLAYERS) Object.assign(game.traces[player], emptyTrace())
}

async function bootRunner(game: Othello, player: Player): Promise<boolean> {
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

async function startGame(game: Othello): Promise<void> {
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

const sourceOf = (game: Othello, player: Player): string =>
  game.sides[player].author === 'blocks'
    ? game.blocks[player].generated.value.code
    : game.sides[player].code

async function playHeadless(
  game: Othello,
  pair: Record<Player, AgentRunner>,
  alive: () => boolean
): Promise<Player | null> {
  let table = createBoard()
  let side: Player = BLACK
  let ply = 1
  let previous: { row: number; col: number } | null = null

  for (const player of PLAYERS) pair[player].notifyStart(player)

  while (ply < 200 && alive()) {
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

  const champion = championOf(table)
  for (const player of PLAYERS) pair[player].notifyEnd(cloneBoard(table), champion)

  await wait(30)

  if (alive()) game.board.value = table
  return champion
}

function tally(training: Training, champion: Player | null): void {
  if (champion === BLACK) training.blackWins++
  else if (champion === WHITE) training.whiteWins++
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

async function train(game: Othello, games: number, focus: TrainFocus = 'both'): Promise<void> {
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
      const champion = await playHeadless(game, pair, alive)
      if (alive()) tally(game.training, champion)
    }
  } catch (caught) {
    if (game.training.session === session) game.training.error = reason(caught)
  } finally {
    await wait(100)

    for (const player of PLAYERS) pair[player]?.dispose()

    // รอบใหม่เริ่มไปแล้วก็ปล่อยเขาไป อย่าไปปิดสวิตช์หรือล้างกระดานทับของเขา
    if (game.training.session === session) {
      game.training.running = false
      game.board.value = createBoard()
    }
  }
}

async function probeCode(code: string): Promise<{ ok: boolean; message: string }> {
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
    return { ok: false, message: reason(caught) }
  } finally {
    runner.dispose()
  }
}

function switchAuthor(game: Othello, player: Player, mode: AuthorMode): void {
  if (game.sides[player].author === mode) return

  if (mode === 'code') {
    game.sides[player].code = game.blocks[player].generated.value.code
    game.sides[player].agentName = game.blocks[player].program.name
  } else {
    const imported = importProgram(game.sides[player].code, OTHELLO_PACK)

    if (!imported.ok || !imported.program) {
      game.error.value = `ฝั่ง${sideLabel(player)}: ${imported.message}`
      return
    }

    game.blocks[player].replaceProgram(imported.program)
    game.error.value = null
  }

  game.sides[player].author = mode
}

export function useOthelloGame() {
  const board = shallowRef<Board>(createBoard())
  const current = ref<Player>(BLACK)
  const status = ref<GameStatus>('setup')
  const turn = ref(1)
  const lastMove = ref<{ row: number; col: number } | null>(null)
  const log = ref<LogEntry[]>([])
  const error = ref<string | null>(null)
  const thinking = ref<Player | null>(null)

  const speed = ref(NORMAL_SPEED)

  const sides = reactive<Record<Player, SideConfig>>({
    [BLACK]: createSide(DEFAULT_TEMPLATE_ID),
    [WHITE]: { ...createSide(DEFAULT_TEMPLATE_ID), kind: 'code' }
  }) as Record<Player, SideConfig>

  const traces = reactive<Record<Player, AgentTrace>>({
    [BLACK]: emptyTrace(),
    [WHITE]: emptyTrace()
  }) as Record<Player, AgentTrace>

  const blocks = {
    [BLACK]: useBlockProgram(OTHELLO_PACK, DEFAULT_PRESET_ID),
    [WHITE]: useBlockProgram(OTHELLO_PACK, 'greedy')
  } as Record<Player, ReturnType<typeof useBlockProgram>>

  const sourceOf = (player: Player): string => sides[player].author === 'blocks'
    ? blocks[player].generated.value.code
    : sides[player].code

  const nameOf = (player: Player): string =>
    sides[player].author === 'blocks' ? blocks[player].program.name : sides[player].agentName

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

  const memories = reactive<Record<Player, MemoryInfo | null>>({
    [BLACK]: null,
    [WHITE]: null
  }) as Record<Player, MemoryInfo | null>

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

  const game: Othello = {
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

  const learns = (player: Player): boolean =>
    sides[player].author === 'blocks'
      ? usesBlock(blocks[player].program, ['remember', 'forget'])
      : sides[player].code.includes('saveMemory(')

  const blockCounts = (player: Player): Record<BlockId, number> =>
    sides[player].author === 'blocks' ? blocks[player].blockCounts(traces[player].lines) : {}

  function stopTraining(): void {
    training.running = false
  }

  const start = (): Promise<void> => startGame(game)

  const testCode = (code: string): Promise<{ ok: boolean; message: string }> => probeCode(code)

  const setAuthor = (player: Player, mode: AuthorMode): void => switchAuthor(game, player, mode)

  const clearMemoryOf = (player: Player): void => clearMemory(game, player)

  const refreshMemoryOf = (player: Player): void => refreshMemory(game, player)

  const trainGames = (games: number, focus: TrainFocus = 'both'): Promise<void> =>
    train(game, games, focus)

  function play(row: number, col: number): void {
    if (!isHumanTurn.value) return
    if (!findMove(validMoves.value, row, col)) return
    commitMove(game, row, col)
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

    board.value = previous.board
    current.value = previous.current
    turn.value = previous.turn
    lastMove.value = previous.lastMove
    log.value = previous.log
    error.value = null
    status.value = 'paused'
  }

  function reset(): void {
    game.generation++
    disposeRunners(game)

    board.value = createBoard()
    current.value = BLACK
    turn.value = 1
    lastMove.value = null
    log.value = []
    error.value = null
    thinking.value = null
    history.length = 0
    status.value = 'setup'

    for (const player of PLAYERS) Object.assign(traces[player], emptyTrace())
  }

  function setSide(player: Player, patch: Partial<SideConfig>): void {
    Object.assign(sides[player], patch)
  }

  function useTemplate(player: Player, templateId: string): void {
    const template = findTemplate(templateId)
    if (!template) return
    setSide(player, { templateId, code: template.code, agentName: template.name })
  }

  /**
   * ความจำผูกกับ "โปรแกรมไหน" ไม่ใช่ "ฝั่งไหน" — คีย์จึงมีทั้งโหมดเขียน ตัวอย่างบล็อก และเทมเพลตโค้ดอยู่ในนั้น
   * เปลี่ยนโปรแกรมเมื่อไรก็ต้องไปอ่านความจำของโปรแกรมใหม่ทันที ไม่งั้นการ์ดจะโชว์ของเก่าหรือโชว์ว่าง
   * ทั้งที่ของที่ฝึกไว้ยังอยู่ในเครื่อง
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
    train: trainGames,
    stopTraining,
    refreshMemory: refreshMemoryOf,
    clearMemory: clearMemoryOf
  }
}
