import type { DinoMemory, DinoState } from './agent'
import type { LogLine } from '../shared/console'
import type { TraceSummary, TraceTick, WorkerRequest, WorkerResponse } from './protocol'
import type { Action } from './engine'

export interface RunnerOptions {
  /** คิดนานเกินนี้ถือว่าโปรแกรมค้าง — ลู่วิ่งตามเวลาจริง รอนานไม่ได้ */
  timeoutMs?: number
  onTrace?: (tick: TraceTick) => void
  onSummary?: (summary: TraceSummary) => void
  onLog?: (lines: LogLine[]) => void
  /** ความจำจากรอบก่อน ๆ — ส่งให้โปรแกรมอ่านผ่าน this.memory */
  memory?: DinoMemory | null
  /** โปรแกรมสั่งบันทึกความจำ — คนเรียกเป็นคนเขียนลงเครื่อง */
  onMemory?: (data: DinoMemory) => void
}

export interface ThinkOutcome {
  action: Action
  /** ลำดับของสิ่งกีดขวางที่โปรแกรมเปิดดูในจังหวะนี้ */
  watched: number[]
}

export interface AgentReady {
  name: string
  traced: boolean
}

interface Pending {
  /** think ได้ท่ากลับมา ส่วน start / finish ได้แค่ undefined ว่าทำเสร็จแล้ว */
  resolve: (value: ThinkOutcome | undefined) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * ตัวคุม Web Worker ที่รันโค้ดของผู้เล่น
 *
 * โค้ดของ AI รันคนละเธรดกับหน้าจอเสมอ เขียนวนไม่รู้จบก็แค่หมดเวลาคิด
 * แล้วเกมฟ้องว่าโปรแกรมค้าง — หน้าเว็บไม่ตายไปด้วย
 */
export class DinoRunner {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private seq = 0
  private agentName = 'Agent'
  private agentTraced = false
  private readonly timeoutMs: number
  private readonly onTrace?: (tick: TraceTick) => void
  private readonly onSummary?: (summary: TraceSummary) => void
  private readonly onLog?: (lines: LogLine[]) => void
  private readonly onMemory?: (data: DinoMemory) => void
  private readonly memory: DinoMemory | null

  constructor(private readonly code: string, options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 1000
    this.onTrace = options.onTrace
    this.onSummary = options.onSummary
    this.onLog = options.onLog
    this.onMemory = options.onMemory
    this.memory = options.memory ?? null
  }

  get name(): string {
    return this.agentName
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
      }, Math.max(this.timeoutMs, 3000))

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
          this.agentTraced = data.traced
          settle(undefined, { name: data.name, traced: data.traced })
        } else if (data.type === 'error') {
          settle(new Error(data.message))
        }
      }

      /*
       * ErrorEvent ที่ไม่มีข้อความติดมา มักไม่ใช่ความผิดของโปรแกรมที่ผู้เล่นต่อไว้
       * แต่คือตัวรันโหลดไม่ขึ้นเอง เช่น dev server เพิ่งคอมไพล์ใหม่แล้วไฟล์ worker หลุดไปชั่วครู่
       */
      const onError = (event: ErrorEvent) =>
        settle(new Error(event.message || 'โหลดตัวรันโค้ดไม่สำเร็จ — ลองรีเฟรชหน้าหนึ่งครั้งแล้วกดใหม่'))

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      this.send({ type: 'init', code: this.code, memory: this.memory })
    })
  }

  /** ถามท่าของจังหวะนี้ */
  think(state: DinoState): Promise<ThinkOutcome> {
    return this.request((id) => ({ type: 'think', id, state })) as Promise<ThinkOutcome>
  }

  /** บอกว่ากำลังจะออกวิ่ง — รอจน onStart ทำเสร็จ ความจำที่โหลดตอนนั้นจะได้พร้อมก่อนตัดสินใจครั้งแรก */
  async begin(state: DinoState): Promise<void> {
    await this.request((id) => ({ type: 'start', id, state }))
  }

  /**
   * บอกว่าชนแล้ว — รอจน onFinish ทำเสร็จก่อนค่อยปิด worker
   * ไม่งั้นความจำที่โปรแกรมบันทึกตอนจบรอบจะหายไปพร้อม worker ก่อนส่งออกมาทัน
   */
  async finish(state: DinoState): Promise<void> {
    await this.request((id) => ({ type: 'finish', id, state }))
  }

  private request(make: (id: number) => WorkerRequest): Promise<ThinkOutcome | undefined> {
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

    if (data.type === 'move') pending.resolve({ action: data.action, watched: data.watched })
    else if (data.type === 'done') pending.resolve(undefined)
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
