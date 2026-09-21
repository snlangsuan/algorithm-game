import { test } from 'node:test'
import assert from 'node:assert/strict'

import { useOthelloGame } from '~/composables/useOthelloGame'
import { BLACK, WHITE } from '~/game/othello/engine'
import type { WorkerRequest, WorkerResponse } from '~/game/othello/protocol'

/**
 * การคุม "รอบฝึก" ของโอเทลโล
 *
 * เคยพลาดตรงนี้มาแล้ว — กดหยุดแล้วกดฝึกใหม่ทันที รอบที่สองตายเงียบ ๆ ตั้งแต่ยังไม่ทันเดิน
 * เพราะรอบเก่ายังเก็บกวาดไม่เสร็จ แล้วไปปิดสวิตช์ทับรอบใหม่ที่เพิ่งติด
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Listener = (event: { data: WorkerResponse }) => void

/** จดคำสั่ง init ทุกครั้ง เทสต์จะได้ตรวจได้ว่าฝั่งไหนถูกตรึงความจำไว้บ้าง */
const inits: Array<{ frozen?: boolean }> = []

/**
 * worker ปลอมที่พูดโปรโตคอลเดียวกับของจริง แต่เลือกตาแรกที่ลงได้เสมอ
 * เกมจึงจบเร็วและเหมือนเดิมทุกครั้ง — เทสต์ชุดนี้สนใจการคุมรอบฝึก ไม่ได้สนใจว่าบอทเก่งแค่ไหน
 */
class FakeWorker {
  private listeners: Listener[] = []
  private dead = false

  addEventListener(type: string, fn: Listener): void {
    if (type === 'message') this.listeners.push(fn)
  }

  removeEventListener(type: string, fn: Listener): void {
    if (type === 'message') this.listeners = this.listeners.filter((item) => item !== fn)
  }

  terminate(): void {
    this.dead = true
    this.listeners = []
  }

  postMessage(request: WorkerRequest): void {
    if (request.type === 'init') {
      inits.push({ frozen: request.frozen })
      this.reply({ type: 'ready', name: 'ตัวปลอม', traced: false })
    }
    if (request.type === 'move') {
      this.reply({ type: 'move', id: request.id, move: request.state.validMoves[0]! })
    }
  }

  private reply(response: WorkerResponse): void {
    setTimeout(() => {
      if (this.dead) return
      for (const fn of [...this.listeners]) fn({ data: response })
    }, 0)
  }
}

const globals = globalThis as unknown as { Worker: unknown }
globals.Worker = FakeWorker

function twoBots() {
  const game = useOthelloGame()

  for (const player of [BLACK, WHITE]) game.setSide(player, { kind: 'code' })
  game.blocks[BLACK].usePreset('evolve')
  game.blocks[WHITE].usePreset('evolve')

  return game
}

test('ฝึกจบแล้วกดฝึกอีกครั้ง ก็ต้องเดินครบเหมือนรอบแรก', async () => {
  const game = twoBots()

  await game.train(3, BLACK)
  assert.equal(game.training.done, 3, 'รอบแรกเดินไม่ครบ')

  await game.train(3, BLACK)
  assert.equal(game.training.done, 3, 'รอบที่สองเดินไม่ครบ')
  assert.equal(game.training.error, null)
})

test('กดหยุดแล้วกดฝึกใหม่ทันที รอบใหม่ต้องเดินจนจบ ไม่ถูกรอบเก่าปิดสวิตช์ทับ', async () => {
  const game = twoBots()

  const first = game.train(25, BLACK)
  await wait(60)

  game.stopTraining()
  const second = game.train(3, BLACK)

  await Promise.all([first, second])

  assert.equal(game.training.done, 3, 'รอบที่สองไม่ได้เดินจนจบ — รอบเก่าไปปิดสวิตช์ทับ')
  assert.equal(game.training.total, 3)
  assert.equal(game.training.running, false, 'ฝึกจบแล้วแต่สวิตช์ยังค้างเปิด')
  assert.equal(game.training.error, null)
})

test('กดฝึกซ้อนตอนที่ยังฝึกอยู่ ไม่นับเป็นรอบใหม่', async () => {
  const game = twoBots()

  const first = game.train(3, BLACK)
  await wait(20)

  const session = game.training.session
  await game.train(99, WHITE)

  assert.equal(game.training.session, session, 'กดซ้อนแล้วดันเปิดรอบใหม่')
  assert.equal(game.training.total, 3, 'จำนวนเกมของรอบที่กำลังฝึกอยู่ถูกเขียนทับ')

  await first
  assert.equal(game.training.done, 3)
})

/**
 * ฝึกทีละฝั่ง ฝั่งที่ไม่ได้ฝึกต้องเป็นคู่ซ้อมที่นิ่ง
 *
 * เคยพลาดตรงนี้มาแล้ว — ฝั่งที่ไม่ได้ฝึกแค่ "ไม่บันทึกลงเครื่อง" แต่ยังจำในหัวตัวเองระหว่างรอบ
 * มันจึงปรับตัวสู้ฝั่งที่กำลังฝึกไปเรื่อย ๆ กลายเป็นเป้าเคลื่อนที่ ยิ่งฝึกยิ่งดูเหมือนแพ้เยอะขึ้น
 */
test('ฝึกฝ่ายดำ — ฝ่ายขาวต้องถูกตรึงความจำไว้ ไม่ให้ปรับตัวตาม', async () => {
  inits.length = 0

  const game = twoBots()
  await game.train(2, BLACK)

  const black = inits.filter((init) => init.frozen !== true).length
  const white = inits.filter((init) => init.frozen === true).length

  assert.equal(inits.length, 2, 'ต้องมีสองฝั่งลงสนาม')
  assert.equal(black, 1, 'ฝั่งที่กำลังฝึกต้องจำได้ตามปกติ')
  assert.equal(white, 1, 'ฝั่งที่ไม่ได้ฝึกต้องถูกตรึงความจำ')
})

test('ประลองทั้งคู่ — ต้องไม่ตรึงใครเลย เพราะทั้งสองฝั่งกำลังเรียนรู้', async () => {
  inits.length = 0

  const game = twoBots()
  await game.train(2, 'both')

  assert.equal(inits.length, 2)
  assert.equal(inits.filter((init) => init.frozen === true).length, 0, 'ไม่ควรมีใครถูกตรึง')
})
