import type { MazeState } from './agent'
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
  /** เวลาสูงสุดต่อการเรียกหนึ่งครั้ง (ms) — เกินแล้วจะฆ่า worker ทิ้ง */
  timeoutMs?: number
  /** เรียกเป็นระยะระหว่างที่ agent คิด บอกว่ากำลังรันเมธอดไหน */
  onTrace?: (tick: TraceTick) => void
  /** เรียกครั้งเดียวหลังคิดจบ พร้อมสรุปจำนวนครั้งที่เรียกแต่ละเมธอด */
  onSummary?: (summary: TraceSummary) => void
  /** เรียกเมื่อโปรแกรมพิมพ์ข้อความออกคอนโซล */
  onLog?: (lines: LogLine[]) => void
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

/** ผลการโหลดโค้ด — traced = แทรกตัวนับบรรทัดสำเร็จ หน้าจอจึงไฮไลต์บรรทัดได้ */
export interface AgentReady {
  name: string
  mode: AgentMode
  traced: boolean
}

interface Pending {
  resolve: (value: PlanResult | StepOutcome) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * ตัวรันโค้ดของผู้เล่นใน Web Worker
 * แยกสโคปออกจากหน้าเว็บ และตัดจบได้ถ้าโค้ดวนไม่รู้จบ
 */
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

  constructor(private readonly code: string, options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000
    this.onTrace = options.onTrace
    this.onSummary = options.onSummary
    this.onLog = options.onLog
  }

  get name(): string {
    return this.agentName
  }

  /** 'plan' = คิดทั้งเส้นทางทีเดียว, 'step' = เดินทีละก้าว */
  get mode(): AgentMode {
    return this.agentMode
  }

  /** ไฮไลต์บรรทัดได้ไหม */
  get traced(): boolean {
    return this.agentTraced
  }

  get alive(): boolean {
    return this.worker !== null
  }

  /** สร้าง worker แล้วโหลดโค้ด — คืนชื่อ agent กับโหมดที่ใช้ ถ้าโหลดผ่าน */
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

      const onError = (event: ErrorEvent) => settle(new Error(event.message || 'โค้ดมีข้อผิดพลาด'))

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      this.send({ type: 'init', code: this.code })
    })
  }

  /** ขอเส้นทางทั้งเส้น (โหมด plan) */
  solve(state: MazeState): Promise<PlanResult> {
    return this.ask((id) => ({ type: 'solve', id, state })) as Promise<PlanResult>
  }

  /** ขอก้าวถัดไป (โหมด step) */
  step(state: MazeState): Promise<StepOutcome> {
    return this.ask((id) => ({ type: 'step', id, state })) as Promise<StepOutcome>
  }

  notifyStart(state: MazeState): void {
    this.send({ type: 'start', state })
  }

  notifyFinish(ok: boolean, steps: number, cost: number): void {
    this.send({ type: 'finish', ok, steps, cost })
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

  private ask(make: (id: number) => WorkerRequest): Promise<PlanResult | StepOutcome> {
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
