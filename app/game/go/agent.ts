import {
  BLACK,
  EMPTY,
  WHITE,
  clonePosition,
  createPosition,
  groupAt,
  isEye,
  isLegal,
  legalMoves,
  neighbors,
  opponent,
  play,
  score,
  toCol,
  toIndex,
  toNotation,
  toRow,
  type Board,
  type BoardSize,
  type Player,
  type Position
} from './engine'
import { botMove, candidateFeatures, patternMove, playoutWinner, uctMove, type BotKind } from './bots'
import {
  addChoice,
  emptyGradient,
  learnWeights,
  packWeights,
  readWeights,
  weightsLabel,
  type Features,
  type Gradient,
  type Weights
} from './policy'
import {
  BOOK_DEPTH,
  bookMove,
  brainLabel,
  learnFrom,
  readBrain,
  signature,
  type Brain,
  type PlayedMove
} from './learn'

/** ทุกอย่างที่ฝ่ายที่กำลังคิดมองเห็นในตานั้น */
export interface TurnState {
  size: BoardSize
  board: Board
  player: Player
  opponent: Player
  /** ช่องที่ลงได้ในตานี้ เก็บเป็นตำแหน่งแบน (row * size + col) */
  legalMoves: number[]
  /** ตาที่เท่าไร เริ่มจาก 1 */
  turn: number
  /** ตาที่อีกฝ่ายเพิ่งลง — ผ่านตาเป็น 'pass' ยังไม่มีใครลงเป็น null */
  lastMove: { row: number; col: number } | 'pass' | null
  /** จับหมากของอีกฝ่ายไปแล้วกี่เม็ด */
  captures: Record<Player, number>
  komi: number
  /** ช่องที่ห้ามลงเพราะโค */
  ko: number | null
  /** เวลาคิดต่อหนึ่งตา (ms) */
  timeBudget: number
}

export interface AgentMemory {
  label?: string
  [key: string]: unknown
}

/** ลงช่องไหน หรือผ่านตา */
export type AgentMove = { row: number; col: number } | [number, number] | 'pass' | null

/**
 * คลาสแม่ของโปรแกรมหมากล้อมทุกตัว
 *
 * บล็อกทุกบล็อกเรียกผ่านเมธอดในนี้ เมธอดที่คิดหนัก (ฝูงสุ่มเล่นจนจบ, MCTS, ระดับคิว)
 * ส่งต่อไปที่ bots.ts ซึ่งเขียนด้วยกระดานเร็วแยกต่างหาก
 */
export class GoAgent {
  name = 'Agent'

  memory: AgentMemory | null = null

  /** สถานะของตาปัจจุบัน — โค้ดที่สร้างจากบล็อกตั้งค่านี้ก่อนเสมอ */
  here!: TurnState

  /** สีของเราในเกมนี้ */
  side: Player = BLACK

  chooseMove(_state: TurnState): AgentMove {
    throw new Error('Agent ต้อง override เมธอด chooseMove(state)')
  }

  onGameStart(_player: Player): void {}

  onGameEnd(_final: { board: Board; winner: Player | null; lead: number }): void {}

  saveMemory(_data: AgentMemory): void {}

  // ---------- อ่านกระดาน ----------

  /** ตำแหน่งปัจจุบันในรูปแบบที่กติกาใช้ — ใช้ภายในของตัวช่วยต่าง ๆ */
  position(): Position {
    const state = this.here
    const base = createPosition(state.size, state.komi)
    return {
      ...base,
      board: state.board,
      toPlay: state.player,
      ko: state.ko,
      captures: { ...state.captures },
      turn: state.turn
    }
  }

  /** สีของหมากที่ช่องนั้น — 0 ว่าง 1 ดำ 2 ขาว */
  colorAt(row: number, col: number): number {
    const state = this.here
    if (row < 0 || col < 0 || row >= state.size || col >= state.size) return -1
    return state.board[toIndex(state.size, row, col)] ?? EMPTY
  }

  /** ช่องนี้ว่างไหม */
  isEmpty(row: number, col: number): boolean {
    return this.colorAt(row, col) === EMPTY
  }

  /** เป็นหมากของเราไหม */
  isMine(row: number, col: number): boolean {
    return this.colorAt(row, col) === this.here.player
  }

  /** เป็นหมากของอีกฝ่ายไหม */
  isTheirs(row: number, col: number): boolean {
    return this.colorAt(row, col) === this.here.opponent
  }

  /** ลมหายใจของหมู่ที่ช่องนี้ — ช่องว่างได้ 0 */
  liberties(row: number, col: number): number {
    const state = this.here
    return groupAt(state.board, state.size, toIndex(state.size, row, col))?.liberties.length ?? 0
  }

  /** หมู่ที่ช่องนี้มีหมากกี่เม็ด */
  groupSize(row: number, col: number): number {
    const state = this.here
    return groupAt(state.board, state.size, toIndex(state.size, row, col))?.stones.length ?? 0
  }

  /** หมู่ที่ช่องนี้เหลือลมหายใจเดียวไหม (โดนอาตาริ = ตาหน้าถูกจับได้) */
  inAtari(row: number, col: number): boolean {
    return this.liberties(row, col) === 1
  }

  /** ลงตานี้ได้ตามกติกาไหม */
  canPlay(row: number, col: number): boolean {
    return isLegal(this.position(), { row, col }, this.here.player)
  }

  /** ช่องนี้เป็นตาของเราไหม — ลงทับตาตัวเองมีแต่เสีย */
  isMyEye(row: number, col: number): boolean {
    const state = this.here
    return isEye(state.board, state.size, toIndex(state.size, row, col), state.player)
  }

  /** ลงตานี้แล้วจับหมากของอีกฝ่ายได้กี่เม็ด */
  capturesBy(row: number, col: number): number {
    const position = this.position()
    if (!isLegal(position, { row, col }, this.here.player)) return 0
    return play(position, { row, col }, this.here.player).captured.length
  }

  /** ลงตานี้แล้วหมู่ของเราจะเหลือลมหายใจกี่เส้น — น้อยแปลว่าเสี่ยงถูกจับ */
  libertiesAfter(row: number, col: number): number {
    const position = this.position()
    if (!isLegal(position, { row, col }, this.here.player)) return 0
    const after = play(position, { row, col }, this.here.player).position
    return groupAt(after.board, after.size, toIndex(after.size, row, col))?.liberties.length ?? 0
  }

  /** ช่องที่ติดกันสี่ทิศของช่องนี้ */
  around(row: number, col: number): Array<{ row: number; col: number }> {
    const state = this.here
    return neighbors(state.size, toIndex(state.size, row, col)).map((index) => ({
      row: toRow(state.size, index),
      col: toCol(state.size, index)
    }))
  }

  /** ระยะจากขอบกระดานที่ใกล้ที่สุด — 0 คือริมสุด */
  fromEdge(row: number, col: number): number {
    const last = this.here.size - 1
    return Math.min(row, col, last - row, last - col)
  }

  /** ทุกช่องที่ลงได้ในตานี้ */
  moves(): Array<{ row: number; col: number }> {
    const state = this.here
    return state.legalMoves.map((index) => ({
      row: toRow(state.size, index),
      col: toCol(state.size, index)
    }))
  }

  /** ช่องที่ลงได้และไม่ใช่การถมตาตัวเอง — ตัวเลือกที่ "พอมีเหตุผล" ของทุกอัลกอริทึม */
  sensibleMoves(): Array<{ row: number; col: number }> {
    return this.moves().filter((move) => !this.isMyEye(move.row, move.col))
  }

  /** แต้มนำของเราตอนนี้ (นับแบบจีน รวมโคมิแล้ว) — ติดลบคือตามหลัง */
  lead(): number {
    const counted = score(this.position())
    return this.here.player === BLACK ? counted.lead : -counted.lead
  }

  /** พื้นที่ที่ล้อมได้ของฝ่ายที่เลือก */
  area(who: 'me' | 'them'): number {
    const counted = score(this.position())
    const player = who === 'me' ? this.here.player : this.here.opponent
    return counted.area[player]
  }

  /** ชื่อช่องแบบหนังสือโกะ เช่น D4 */
  notation(row: number, col: number): string {
    return toNotation(this.here.size, row, col)
  }

  // ---------- ตัวช่วยที่คิดหนัก (อยู่ใน bots.ts) ----------

  /**
   * สุ่มเล่นจากกระดานนี้จนจบเกมหนึ่งครั้ง แล้วบอกว่าเราชนะไหม
   * ใช้เป็นหัวใจของวิธีแบบมอนติคาร์โล — เล่นมั่ว ๆ หลายครั้งแล้วดูว่าตาไหนชนะบ่อย
   */
  playout(row: number, col: number): boolean {
    return playoutWinner(this.position(), { row, col }, this.here.player)
  }

  /** ตาที่เข้ากับแพทเทิร์น 3×3 ของ MoGo รอบ ๆ ตาที่อีกฝ่ายเพิ่งลง — ไม่มีก็ null */
  patternMove(): { row: number; col: number } | null {
    const last = this.here.lastMove
    const index = last && last !== 'pass' ? last.row * this.here.size + last.col : null
    const found = patternMove(this.position(), this.here.player, index)
    return found && found !== 'pass' ? found : null
  }

  /** ค้นแบบ MCTS/UCT ตามจำนวนรอบที่สั่ง */
  search(rounds: number): AgentMove {
    return uctMove(this.position(), this.here.player, { rounds, budgetMs: this.here.timeBudget })
  }

  /** ช่องที่อีกฝ่ายเพิ่งลง เป็นตำแหน่งแบน — บอทที่ "ตอบที่เดิม" กับแพทเทิร์นต้องรู้ */
  private lastIndex(): number | null {
    const last = this.here.lastMove
    return last && last !== 'pass' ? last.row * this.here.size + last.col : null
  }

  /** บอทสำเร็จรูปหนึ่งตัว — ใช้ทั้งระดับคิวและอัลกอริทึมที่มีชื่อเรียก */
  bot(kind: BotKind): AgentMove {
    return botMove(kind, this.position(), this.here.player, this.here.timeBudget, this.lastIndex())
  }

  // ---------- ตัวที่เรียนรู้จากเกมก่อน ๆ ----------

  /** สมองที่จำข้ามเกม — อ่านจากความจำครั้งแรกที่ใช้ แล้วถือไว้ทั้งเกม */
  private brain: Brain | null = null

  /** ตาที่เราลงในเกมนี้ พร้อมกระดานตอนนั้น — ตอนจบเกมเอาไปอัปเดตความจำ */
  private played: PlayedMove[] = []

  private mind(): Brain {
    if (!this.brain || this.brain.size !== this.here.size) {
      this.brain = readBrain(this.memory?.brain, this.here.size)
    }
    return this.brain
  }

  /**
   * ลงหมากแบบเรียนรู้จากเกมก่อน ๆ
   *
   * ต้นเกมถ้าตำราเคยเจอกระดานนี้แล้วรู้ว่าตาไหนได้ผล ก็ลงตามนั้นเลย
   * นอกนั้นค้นแบบโหมดโหด แต่เอา "ตาตอบที่เคยชนะ" ไปช่วยตอนสุ่มเล่นด้วย
   */
  learned(): AgentMove {
    const brain = this.mind()
    const position = this.position()
    const answering = this.lastIndex() ?? -1

    const remember = (index: number) => {
      this.played.push({
        key: position.turn <= BOOK_DEPTH ? signature(position) : null,
        move: index,
        answering
      })
    }

    const known = bookMove(brain, position)
    if (known !== null && this.here.legalMoves.includes(known)) {
      remember(known)
      return { row: (known / this.here.size) | 0, col: known % this.here.size }
    }

    const found = uctMove(position, this.here.player, {
      rounds: 200000,
      budgetMs: this.here.timeBudget,
      minRounds: 6000,
      rave: true,
      smart: true,
      priors: true,
      mercy: true,
      patient: true,
      replies: brain.replies
    })

    if (found !== 'pass') remember(found.row * this.here.size + found.col)
    return found
  }

  /**
   * จบเกมแล้วเก็บบทเรียน — เรียกจากหัวบล็อก "เมื่อจบเกม"
   * ชนะก็จดว่าตาที่เดินมาใช้ได้ แพ้ก็จดไว้เหมือนกันว่าเคยลองแล้วไม่เวิร์ก
   */
  rememberGame(won: boolean): void {
    const brain = this.brain
    if (!brain || this.played.length === 0) return

    const next = learnFrom(brain, this.played, won)
    this.brain = next
    this.played = []
    this.saveMemory({ ...this.memory, brain: next, label: brainLabel(next) })
  }

  // ---------- ตัวที่เรียน "น้ำหนัก" เอง (reinforcement learning) ----------

  /** น้ำหนักที่ฝึกมา — อ่านจากความจำครั้งแรกที่ใช้ */
  private weights: Weights | null = null

  /** ทิศที่น้ำหนักควรขยับ สะสมระหว่างเกม แล้วใช้ทีเดียวตอนจบ */
  private gradient: Gradient = emptyGradient()

  private policy(): Weights {
    if (!this.weights) this.weights = readWeights(this.memory?.weights)
    return this.weights
  }

  /**
   * ลงหมากด้วยน้ำหนักที่เรียนเอง
   *
   * ค้นแบบเดียวกับโหมดโหด แต่ "ความรู้เรื่องโกะ" ที่ใช้นำทางการค้นมาจากน้ำหนักที่ฝึกเอง
   * ไม่ใช่ตัวเลขที่คนเขียนไว้ตายตัว · แล้วจดไว้ด้วยว่าตาที่เลือกต่างจากค่าเฉลี่ยของตาที่เลือกได้ยังไง
   */
  rlPlay(): AgentMove {
    const weights = this.policy()
    const position = this.position()
    const last = this.lastIndex()

    const candidates = candidateFeatures(position, this.here.player, last)
    if (candidates.length === 0) return 'pass'

    const found = uctMove(position, this.here.player, {
      rounds: 200000,
      budgetMs: this.here.timeBudget,
      minRounds: 6000,
      rave: true,
      smart: true,
      priors: true,
      mercy: true,
      patient: true,
      weights
    })

    if (found !== 'pass') {
      const index = found.row * this.here.size + found.col
      const chosen = candidates.find((item) => item.move === index)
      if (chosen) {
        addChoice(
          this.gradient,
          chosen.features,
          candidates.map((item): Features => item.features)
        )
      }
    }

    return found
  }

  /**
   * จบเกมแล้วปรับน้ำหนักหนึ่งครั้ง (REINFORCE)
   * ชนะ = ดันลักษณะของตาที่เราเลือกขึ้น · แพ้ = ดึงลง
   */
  rlLearn(won: boolean): void {
    if (this.gradient.steps === 0) return

    const next = learnWeights(this.policy(), this.gradient, won)
    this.weights = next
    this.gradient = emptyGradient()
    this.saveMemory({ ...this.memory, weights: packWeights(next), label: weightsLabel(next) })
  }

  /** ระดับ 9 คิว (อ่อนสุด) ถึง 1 คิว (แข็งสุด) */
  kyu(level: number): AgentMove {
    const rank = Math.max(1, Math.min(9, Math.round(level)))
    return botMove(`kyu${rank}` as BotKind, this.position(), this.here.player, this.here.timeBudget, this.lastIndex())
  }
}

export const AGENT_GLOBALS = { EMPTY, BLACK, WHITE } as const

/**
 * สร้าง state ที่ agent มองเห็นจากตำแหน่งจริงในเกม
 *
 * ทุกค่าต้องเป็นของธรรมดาที่ copy ข้ามเธรดได้ — ฝั่งหน้าจอห่อค่าด้วย ref ของ Vue
 * ซึ่งกลายเป็น Proxy ส่งเข้า worker ไม่ได้ จึงคัดลอกทีละช่องตรงนี้ให้หมด
 */
export function viewOf(position: Position, timeBudget: number, lastMove: TurnState['lastMove'] = null): TurnState {
  return {
    size: position.size,
    board: Uint8Array.from(position.board),
    player: position.toPlay,
    opponent: opponent(position.toPlay),
    legalMoves: [...legalMoves(position)],
    turn: position.turn,
    lastMove: lastMove && lastMove !== 'pass' ? { row: lastMove.row, col: lastMove.col } : lastMove,
    captures: { [BLACK]: position.captures[BLACK], [WHITE]: position.captures[WHITE] },
    komi: position.komi,
    ko: position.ko,
    timeBudget
  }
}

export { clonePosition }
