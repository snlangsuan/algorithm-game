import type { AgentMemory, TurnState } from './agent'
import type { Board, Player } from './engine'
import type { LogLine } from '../shared/console'
import type { TraceSummary, TraceTick, WorkerRequest, WorkerResponse } from './protocol'

export interface RunnerOptions {

  timeoutMs?: number

  onTrace?: (tick: TraceTick) => void

  onSummary?: (summary: TraceSummary) => void

  memory?: AgentMemory | null

  /** ตรึงความจำไว้ — ใช้กับฝั่งที่ลงเล่นเป็นคู่ซ้อมเฉย ๆ ไม่ได้กำลังฝึก */
  frozen?: boolean

  onMemory?: (data: AgentMemory) => void

  onLog?: (lines: LogLine[]) => void
}

interface Pending {
  resolve: (move: { row: number; col: number }) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class AgentRunner {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private seq = 0
  private agentName = 'Agent'
  private agentTraced = false
  private readonly timeoutMs: number
  private readonly onTrace?: (tick: TraceTick) => void
  private readonly onSummary?: (summary: TraceSummary) => void
  private readonly onMemory?: (data: AgentMemory) => void
  private readonly onLog?: (lines: LogLine[]) => void
  private readonly memory: AgentMemory | null
  private readonly frozen: boolean

  constructor(private readonly code: string, options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 3000
    this.onTrace = options.onTrace
    this.onSummary = options.onSummary
    this.onMemory = options.onMemory
    this.onLog = options.onLog
    this.memory = options.memory ?? null
    this.frozen = options.frozen ?? false
  }

  get name(): string {
    return this.agentName
  }

  get alive(): boolean {
    return this.worker !== null
  }

  get traced(): boolean {
    return this.agentTraced
  }

  start(): Promise<string> {
    this.dispose()

    const worker = new Worker(new URL('./agent.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.dispose()
        reject(new Error('โหลดโค้ดไม่สำเร็จภายในเวลาที่กำหนด'))
      }, this.timeoutMs)

      const settle = (error?: Error, name?: string) => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)

        if (error) {
          this.dispose()
          reject(error)
          return
        }

        worker.addEventListener('message', this.onMessage)
        worker.addEventListener('error', this.onError)
        resolve(name ?? 'Agent')
      }

      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data
        if (data.type === 'memory') {
          this.onMemory?.(data.data)
        } else if (data.type === 'ready') {
          this.agentName = data.name
          this.agentTraced = data.traced
          settle(undefined, data.name)
        } else if (data.type === 'error') {
          settle(new Error(data.message))
        }
      }

      /*
       * ErrorEvent ที่ไม่มีข้อความติดมา มักไม่ใช่ความผิดของโปรแกรมที่ผู้เล่นต่อไว้
       * แต่คือตัวรันโหลดไม่ขึ้นเอง เช่น dev server เพิ่งคอมไพล์ใหม่แล้วไฟล์ worker หลุดไปชั่วครู่
       * บอกให้ตรงตัว จะได้ไม่ไปนั่งไล่แก้บล็อกที่ไม่ได้ผิดอะไรเลย
       */
      const onError = (event: ErrorEvent) =>
        settle(new Error(event.message || 'โหลดตัวรันโค้ดไม่สำเร็จ — ลองรีเฟรชหน้าหนึ่งครั้งแล้วกดใหม่'))

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      this.send({ type: 'init', code: this.code, memory: this.memory, frozen: this.frozen })
    })
  }

  chooseMove(state: TurnState): Promise<{ row: number; col: number }> {
    if (!this.worker) return Promise.reject(new Error('agent ยังไม่พร้อมทำงาน'))

    const id = ++this.seq

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        this.dispose()
        reject(new Error(`คิดนานเกิน ${this.timeoutMs} ms — หยุดการทำงานของ agent แล้ว`))
      }, this.timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.send({ type: 'move', id, state })
    })
  }

  notifyStart(player: Player): void {
    this.send({ type: 'start', player })
  }

  notifyEnd(board: Board, winner: Player | null): void {
    this.send({ type: 'end', board, winner })
  }

  dispose(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('agent ถูกปิดระหว่างรอผลลัพธ์'))
    }
    this.pending.clear()

    this.worker?.terminate()
    this.worker = null
  }

  private send(request: WorkerRequest): void {
    this.worker?.postMessage(request)
  }

  private onMessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data

    if (data.type === 'ready') return

    if (data.type === 'memory') {
      this.onMemory?.(data.data)
      return
    }

    if (data.type === 'log') {
      this.onLog?.(data.lines)
      return
    }

    if (data.type === 'trace') {
      this.onTrace?.(data)
      return
    }

    if (data.type === 'trace-summary') {
      this.onSummary?.(data)
      return
    }

    const id = data.id
    if (id === null) return

    const pending = this.pending.get(id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(id)

    if (data.type === 'move') pending.resolve(data.move)
    else pending.reject(new Error(data.message))
  }

  private onError = (event: ErrorEvent) => {
    const error = new Error(event.message || 'agent ทำงานผิดพลาด')
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    this.dispose()
  }
}
