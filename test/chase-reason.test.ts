import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import { AGENT_GLOBALS, ChaseAgent, heroAsMover, viewOf } from '~/game/chase/agent'
import {
  TICK_LIMIT,
  catcher,
  createMatch,
  dueHunters,
  findArena,
  moveHunter,
  stepHero,
  type Direction
} from '~/game/chase/engine'
import { cleanReason, type Reason } from '~/game/shared/reason'

/**
 * ตาราง "ทำไมถึงเลือกทางนี้" ต้องพูดความจริง — ทางที่ติ๊กว่าเลือก ต้องเป็นทางที่เดินจริง
 * และตัวเลขในตารางต้องรวมกันได้ตามสูตรที่เขียนโชว์ไว้ ไม่งั้นเด็กจะเรียนสูตรผิด
 */

function agentOf(presetId: string, pack = CHASE_PACK): { agent: ChaseAgent; heard: () => Reason | null } {
  const preset = pack.presets.find((item) => item.id === presetId)!
  const { code } = generate(normalize(preset.build(), pack), pack)
  const factory = new Function('ChaseAgent', ...Object.keys(AGENT_GLOBALS), `"use strict";\n${code}\n;return Agent;`)
  const agent = new (factory(ChaseAgent, ...Object.values(AGENT_GLOBALS)))() as ChaseAgent

  let last: Reason | null = null
  agent.reason = (why) => {
    last = cleanReason(why)
  }

  return {
    agent,
    heard: () => {
      const said = last
      last = null
      return said
    }
  }
}

/** เล่นหนึ่งรอบ แล้วเก็บเหตุผลของคนหนีทุกก้าวคู่กับทางที่เดินจริง */
function playAndListen(runnerPreset: string, arenaId = 'rooms') {
  const match = createMatch(findArena(arenaId), { hunters: 2, hunterSpeed: 0.75, seed: 7 })
  const hunter = agentOf('pursuit').agent
  const runner = agentOf(runnerPreset, RUNNER_PACK)
  const heard: Array<{ reason: Reason | null; dir: Direction | null }> = []

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    match.tick = tick
    const heroBefore = { ...match.hero }
    const state = viewOf(match, 1000)

    const raw = runner.agent.step({ ...state, me: heroAsMover(match) })
    const dir = typeof raw === 'string' ? (raw as Direction) : null
    heard.push({ reason: runner.heard(), dir })
    stepHero(match, dir)

    if (match.over) break
    if (catcher(match, heroBefore, match.hunters.map((item) => ({ ...item.at }))) !== null) break

    const view = viewOf(match, 1000)
    for (const due of dueHunters(match, 0.75)) {
      const move = hunter.step({ ...view, me: view.hunters[due.index]! })
      moveHunter(match, due, typeof move === 'string' ? (move as Direction) : null)
    }
    if (match.over) break
  }

  return heard
}

test('ชั่งความปลอดภัย: ทางที่ติ๊กเลือกคือทางที่เดินจริง และคะแนนตรงตามสูตรที่โชว์', () => {
  const heard = playAndListen('field')
  const told = heard.filter((item) => item.reason)
  assert.ok(told.length > 10, 'เดินไปหลายก้าวแต่แทบไม่ได้บอกเหตุผลเลย')

  for (const { reason, dir } of told) {
    assert.deepEqual(reason!.columns, ['ก้าวถึงเป้า', 'ห่างผู้ไล่ล่า', 'อันตราย', 'คะแนน'])

    const chosen = reason!.options.filter((option) => option.chosen)
    assert.equal(chosen.length, 1, 'ต้องติ๊กเลือกทางเดียวพอดี')

    const names: Record<string, Direction> = { ขึ้น: 'up', ขวา: 'right', ลง: 'down', ซ้าย: 'left' }
    assert.equal(names[chosen[0]!.label], dir, 'ทางที่ติ๊กในตารางไม่ใช่ทางที่เดินจริง')

    for (const option of reason!.options) {
      const [steps, away, danger, score] = option.values as [number, number, number, number]
      assert.equal(danger, Math.max(0, 3 - away), 'อันตรายไม่ตรงสูตร max(0, 3 − ห่าง)')
      assert.equal(score, -steps - danger * 2, 'คะแนนไม่ตรงสูตร −ก้าว − อันตราย × 2')
      assert.ok(score <= chosen[0]!.values[3]!, 'มีทางที่คะแนนดีกว่าทางที่เลือก')
    }
  }
})

test('ใกล้ก็หนีก่อน: ทั้งตอนถอยและตอนเดินเก็บของ บอกเหตุผลที่ตรงกับทางที่เดิน', () => {
  const heard = playAndListen('evade')
  const titles = new Set(heard.flatMap((item) => (item.reason ? [item.reason.title] : [])))

  assert.ok(titles.has('เดินตามทางที่สั้นที่สุด'), 'ตอนเดินเก็บของไม่ได้บอกเหตุผล')

  for (const { reason, dir } of heard) {
    if (!reason) continue
    const chosen = reason.options.filter((option) => option.chosen)
    assert.equal(chosen.length, 1)
    assert.ok(chosen[0]!.at, 'ตัวเลือกบนสนามต้องบอกช่อง จะได้เขียนคะแนนลงบนช่องได้')

    if (reason.title === 'เดินตามทางที่สั้นที่สุด') {
      const best = Math.min(...reason.options.map((option) => option.values[0]!))
      assert.equal(chosen[0]!.values[0], best, 'ทางที่เลือกไม่ใช่ทางที่เหลือก้าวน้อยที่สุด')
    }
    assert.ok(dir !== null)
  }
})

test('เหตุผลจากโค้ดของผู้เล่นรูปร่างผิด ๆ ไม่ทำให้เกมพัง', () => {
  assert.equal(cleanReason(null), null)
  assert.equal(cleanReason({ title: 'x' }), null)
  assert.equal(cleanReason('ข้อความ'), null)

  const cleaned = cleanReason({
    title: 42,
    columns: ['a', 'b'],
    options: [null, { label: 'ขึ้น', at: { row: 1.5, col: 2 }, values: ['3', NaN, 9, 10], chosen: 'yes' }]
  })

  assert.deepEqual(cleaned, {
    title: '42',
    columns: ['a', 'b'],
    options: [{ label: 'ขึ้น', at: undefined, values: [3, 0], chosen: false }],
    rule: undefined,
    who: undefined
  })
})
