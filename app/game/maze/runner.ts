import type { MazeMemory, MazeState } from './agent'
import type { Point } from './engine'
import type { LogLine } from '../shared/console'
import type {
  AgentMode,
  ExploredCell,
  TraceSummary,
  TraceTick,
  WorkerRequest,
  WorkerResponse
} from './protocol'

export interface RunnerOptions {

  timeoutMs?: number

  onTrace?: (tick: TraceTick) => void

  onSummary?: (summary: TraceSummary) => void

  onLog?: (lines: LogLine[]) => void

  /** ความจำจากรอบก่อน ๆ — ส่งให้โปรแกรมอ่านผ่าน this.memory */
  memory?: MazeMemory | null

  /** โปรแกรมสั่งบันทึกความจำ — คนเรียกเป็นคนเขียนลงเครื่อง */
  onMemory?: (data: MazeMemory) => void
}

export interface PlanResult {
  path: Point[]
  explored: ExploredCell[]
  timeline: number[]
}

export interface StepOutcome {
  move: Point | null
  explored: ExploredCell[]
  timeline: number[]
}

export interface AgentReady {
  name: string
  mode: AgentMode
  traced: boolean
}

interface Pending {
  /** solve / step ได้ผลกลับมา ส่วน finish ได้แค่ undefined ว่าทำเสร็จแล้ว */
  resolve: (value: PlanResult | StepOutcome | undefined) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class MazeRunner {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private seq = 0
  private agentName = 'Agent'
  private agentMode: AgentMode = 'plan'
  private agentTraced = false
  private readonly timeoutMs: number
  private readonly onTrace?: (tick: TraceTick) => void
  private readonly onSummary?: (summary: TraceSummary) => void
  private readonly onLog?: (lines: LogLine[]) => void
  private readonly onMemory?: (data: MazeMemory) => void
  private readonly memory: MazeMemory | null

  constructor(private readonly code: string, options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000
    this.onTrace = options.onTrace
    this.onSummary = options.onSummary
    this.onLog = options.onLog
    this.onMemory = options.onMemory
    this.memory = options.memory ?? null
  }

  get name(): string {
    return this.agentName
  }

  get mode(): AgentMode {
    return this.agentMode
  }

  get traced(): boolean {
    return this.agentTraced
  }

  get alive(): boolean {
    return this.worker !== null
  }

  start(): Promise<AgentReady> {
    this.dispose()

    const worker = new Worker(new URL('./agent.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.dispose()
        reject(new Error('โหลดโค้ดไม่สำเร็จภายในเวลาที่กำหนด'))
      }, this.timeoutMs)

      const settle = (error?: Error, ready?: AgentReady) => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)

        if (error || !ready) {
          this.dispose()
          reject(error ?? new Error('โหลดโค้ดไม่สำเร็จ'))
          return
        }

        worker.addEventListener('message', this.onMessage)
        worker.addEventListener('error', this.onError)
        resolve(ready)
      }

      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data

        if (data.type === 'ready') {
          this.agentName = data.name
          this.agentMode = data.mode
          this.agentTraced = data.traced
          settle(undefined, { name: data.name, mode: data.mode, traced: data.traced })
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
      this.send({ type: 'init', code: this.code, memory: this.memory })
    })
  }

  solve(state: MazeState): Promise<PlanResult> {
    return this.ask((id) => ({ type: 'solve', id, state })) as Promise<PlanResult>
  }

  step(state: MazeState): Promise<StepOutcome> {
    return this.ask((id) => ({ type: 'step', id, state })) as Promise<StepOutcome>
  }

  notifyStart(state: MazeState): void {
    this.send({ type: 'start', state })
  }

  /**
   * บอกว่ารอบจบแล้ว — รอจน onFinish ทำเสร็จก่อนค่อยปิด worker
   * ไม่งั้นความจำที่โปรแกรมบันทึกตอนจบรอบ (เช่นกลิ่นของฝูงมด) จะหายไปพร้อม worker ก่อนส่งออกมาทัน
   */
  async finish(ok: boolean, steps: number, cost: number): Promise<void> {
    await this.ask((id) => ({ type: 'finish', id, ok, steps, cost }))
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

  private ask(make: (id: number) => WorkerRequest): Promise<PlanResult | StepOutcome | undefined> {
    if (!this.worker) return Promise.reject(new Error('agent ยังไม่พร้อมทำงาน'))

    const id = ++this.seq

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        this.dispose()
        reject(new Error(`คิดนานเกิน ${this.timeoutMs} ms — หยุดการทำงานของ agent แล้ว`))
      }, this.timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.send(make(id))
    })
  }

  private send(request: WorkerRequest): void {
    this.worker?.postMessage(request)
  }

  private onMessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data

    if (data.type === 'ready') return

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

    if (data.type === 'memory') {
      this.onMemory?.(data.data)
      return
    }

    const id = data.id
    if (id === null) return

    const pending = this.pending.get(id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(id)

    if (data.type === 'path') {
      pending.resolve({ path: data.path, explored: data.explored, timeline: data.timeline })
    } else if (data.type === 'move') {
      pending.resolve({ move: data.move, explored: data.explored, timeline: data.timeline })
    } else if (data.type === 'done') {
      pending.resolve(undefined)
    }
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
