import type { ChaseState } from './agent'
import type { Point } from './engine'
import type { LogLine } from '../shared/console'
import type { MoverMove, TraceSummary, TraceTick, WorkerRequest, WorkerResponse } from './protocol'

export interface RunnerOptions {
  /** คิดนานเกินนี้ถือว่าโปรแกรมค้าง — เกมเดินตามเวลาจริง รอนานไม่ได้ */
  timeoutMs?: number
  onTrace?: (tick: TraceTick) => void
  onSummary?: (summary: TraceSummary) => void
  onLog?: (lines: LogLine[]) => void
}

export interface ThinkOutcome {
  moves: MoverMove[]
  looked: Point[]
}

export interface AgentReady {
  name: string
  traced: boolean
}

interface Pending {
  resolve: (value: ThinkOutcome) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * ตัวคุม Web Worker ที่รันโค้ดของผู้เล่น
 *
 * โค้ดของ AI รันคนละเธรดกับหน้าจอเสมอ เขียนวนไม่รู้จบก็แค่หมดเวลาคิด
 * แล้วเกมฟ้องว่าโปรแกรมค้าง — หน้าเว็บไม่ตายไปด้วย
 */
export class ChaseRunner {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private seq = 0
  private agentName = 'Agent'
  private agentTraced = false
  private readonly timeoutMs: number
  private readonly onTrace?: (tick: TraceTick) => void
  private readonly onSummary?: (summary: TraceSummary) => void
  private readonly onLog?: (lines: LogLine[]) => void

  constructor(private readonly code: string, options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 2000
    this.onTrace = options.onTrace
    this.onSummary = options.onSummary
    this.onLog = options.onLog
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
       * บอกให้ตรงตัว จะได้ไม่ไปนั่งไล่แก้บล็อกที่ไม่ได้ผิดอะไรเลย
       */
      const onError = (event: ErrorEvent) =>
        settle(new Error(event.message || 'โหลดตัวรันโค้ดไม่สำเร็จ — ลองรีเฟรชหน้าหนึ่งครั้งแล้วกดใหม่'))

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      this.send({ type: 'init', code: this.code })
    })
  }

  /** ฝ่ายไล่ — ถามทางเดินของผู้ไล่ล่าที่ถึงตาเดินในจังหวะนี้ */
  think(state: ChaseState, hunters: number[]): Promise<ThinkOutcome> {
    return this.ask((id) => ({ type: 'think', id, state, hunters }))
  }

  /** ฝ่ายหนี — ถามทางเดินของคนหนีหนึ่งก้าว (state.me ต้องเป็นคนหนีแล้ว) */
  flee(state: ChaseState): Promise<ThinkOutcome> {
    return this.ask((id) => ({ type: 'flee', id, state }))
  }

  private ask(make: (id: number) => WorkerRequest): Promise<ThinkOutcome> {
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

  notifyStart(state: ChaseState): void {
    this.send({ type: 'start', state })
  }

  notifyFinish(caught: boolean, ticks: number): void {
    this.send({ type: 'finish', caught, ticks })
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

    const id = data.id
    if (id === null) return

    const pending = this.pending.get(id)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(id)

    if (data.type === 'moves') pending.resolve({ moves: data.moves, looked: data.looked })
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
