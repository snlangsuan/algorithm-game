import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generate } from '~/game/blocks/codegen'
import { importProgram } from '~/game/blocks/importer'
import { normalize, type BlockPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import type { BlockNode } from '~/game/blocks/types'
import { CHASE_PACK } from '~/game/chase/blocks/pack'
import { RUNNER_PACK } from '~/game/chase/blocks/runner'
import { DINO_PACK } from '~/game/dino/blocks/pack'
import { HANOI_PACK } from '~/game/hanoi/blocks/pack'
import { LINE_PACK } from '~/game/line/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'
import { AGENT_GLOBALS, ChaseAgent, heroAsMover, viewOf } from '~/game/chase/agent'
import {
  ARENAS,
  TICK_LIMIT,
  catcher,
  createMatch,
  dueHunters,
  moveHunter,
  stepHero,
  type Direction
} from '~/game/chase/engine'
import { countBlocks } from './helpers'

/**
 * แกะกล่องต้องไม่เปลี่ยนพฤติกรรม — ถ้าแกะแล้วเดินต่างไปแม้ก้าวเดียว
 * เด็กจะเรียนว่าบล็อกนี้ "ข้างในเป็นแบบนี้" ทั้งที่ไม่ใช่
 */

const PACKS: BlockPack[] = [MAZE_PACK, OTHELLO_PACK, HANOI_PACK, CHASE_PACK, RUNNER_PACK, DINO_PACK, LINE_PACK]

/** แทนทุกบล็อกที่แกะได้ในรายการ ด้วยบล็อกย่อยของมัน (ลงไปในทุกชั้น) */
function unpackAll(list: BlockNode[], pack: BlockPack): BlockNode[] {
  return list.flatMap((node) => {
    const spec = pack.blocks.find((item) => item.kind === node.kind)
    const bodies = Object.fromEntries(Object.entries(node.bodies).map(([name, body]) => [name, unpackAll(body, pack)]))
    const next = { ...node, bodies }
    return spec?.unpack ? unpackAll(spec.unpack(next), pack) : [next]
  })
}

function unpackProgram(program: BlockProgram, pack: BlockPack): BlockProgram {
  return {
    ...program,
    scripts: Object.fromEntries(Object.entries(program.scripts).map(([hat, list]) => [hat, unpackAll(list, pack)]))
  }
}

const programOf = (pack: BlockPack, kind: string, fields: Record<string, string | number> = {}): BlockProgram => {
  const node = createBlock(kind)
  Object.assign(node.fields, fields)
  return normalize({ name: 'ทดสอบ', scripts: { [pack.hats[0]!.kind]: [node] } }, pack)
}

for (const pack of PACKS) {
  for (const spec of pack.blocks.filter((item) => item.unpack && item.pack === pack.id)) {
    const options = spec.parts.flatMap((part) => (part.type === 'field' ? [part] : []))[0]
    const values = options ? options.options.map((option) => option.value) : [undefined]

    test(`${spec.kind} — แกะแล้วไปกลับบล็อก↔โค้ดได้เหมือนเดิม และไม่เหลือบล็อกของเดิม`, () => {
      for (const value of values) {
        const fields = options && value !== undefined ? { [options.name]: value } : {}
        const unpacked = unpackProgram(programOf(pack, spec.kind, fields), pack)

        const kinds: string[] = []
        const walk = (list: BlockNode[]) =>
          list.forEach((node) => {
            kinds.push(node.kind)
            Object.values(node.bodies).forEach(walk)
            Object.values(node.inputs).forEach((input) => input && walk([input]))
          })
        Object.values(unpacked.scripts).forEach(walk)
        assert.ok(!kinds.includes(spec.kind), 'แกะแล้วยังเหลือบล็อกเดิมอยู่ข้างใน')

        const first = generate(unpacked, pack)
        const imported = importProgram(first.code, pack)
        assert.ok(imported.ok, `อ่านโค้ดกลับเป็นบล็อกไม่ได้: ${imported.message}`)
        assert.equal(generate(normalize(imported.program, pack), pack).code, first.code)
        assert.equal(countBlocks(imported.program), countBlocks(unpacked))
      }
    })
  }
}

// ---------- เดินเหมือนเดิมทุกก้าว ----------

function agentFrom(program: BlockProgram, pack: BlockPack): ChaseAgent {
  const { code } = generate(program, pack)
  const factory = new Function('ChaseAgent', ...Object.keys(AGENT_GLOBALS), `"use strict";\n${code}\n;return Agent;`)
  return new (factory(ChaseAgent, ...Object.values(AGENT_GLOBALS)))() as ChaseAgent
}

/** เล่นหนึ่งรอบ จดทุกทางที่คนหนีเลือก */
function trail(runner: ChaseAgent, arenaId: string, hunters: number, seed: number): Array<Direction | null> {
  const hunter = agentFrom(
    normalize(CHASE_PACK.presets.find((preset) => preset.id === 'pursuit')!.build(), CHASE_PACK),
    CHASE_PACK
  )
  const match = createMatch(ARENAS.find((arena) => arena.id === arenaId)!, { hunters, hunterSpeed: 0.75, seed })
  const moves: Array<Direction | null> = []

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    match.tick = tick
    const heroBefore = { ...match.hero }
    const state = viewOf(match, 1000)
    const raw = runner.step({ ...state, me: heroAsMover(match) })
    const dir = typeof raw === 'string' ? (raw as Direction) : null
    moves.push(dir)
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

  return moves
}

test('ฝ่ายหนี "ชั่งน้ำหนักทุกก้าว" — แกะกล่องแล้วเดินเหมือนเดิมทุกก้าว ทุกสนาม', () => {
  const preset = RUNNER_PACK.presets.find((item) => item.id === 'field')!
  const whole = normalize(preset.build(), RUNNER_PACK)
  const opened = unpackProgram(whole, RUNNER_PACK)

  assert.notEqual(generate(opened, RUNNER_PACK).code, generate(whole, RUNNER_PACK).code, 'ยังไม่ได้แกะอะไรเลย')

  let steps = 0
  for (const arena of ARENAS) {
    for (const hunters of [1, 2, 4]) {
      for (const seed of [1, 7, 42]) {
        const before = trail(agentFrom(whole, RUNNER_PACK), arena.id, hunters, seed)
        const after = trail(agentFrom(opened, RUNNER_PACK), arena.id, hunters, seed)
        assert.deepEqual(after, before, `สนาม ${arena.id} ผู้ไล่ล่า ${hunters} ตัว seed ${seed} เดินไม่เหมือนเดิม`)
        steps += before.length
      }
    }
  }
  assert.ok(steps > 500, `เทียบได้แค่ ${steps} ก้าว น้อยเกินจะเชื่อได้`)
})

test('ทุกเป้าหมายของ "เดินทางที่ปลอดภัยที่สุด" แกะแล้วเลือกทางเดียวกันทุกก้าว', () => {
  const field = RUNNER_PACK.blocks.find((item) => item.kind === 'runner.safe-step')!
  const targets = field.parts.flatMap((part) => (part.type === 'field' ? part.options.map((o) => o.value) : []))

  for (const target of targets) {
    const whole = programOf(RUNNER_PACK, 'runner.safe-step', { target })
    const opened = unpackProgram(whole, RUNNER_PACK)
    for (const arena of ARENAS) {
      assert.deepEqual(
        trail(agentFrom(opened, RUNNER_PACK), arena.id, 2, 3),
        trail(agentFrom(whole, RUNNER_PACK), arena.id, 2, 3),
        `เป้าหมาย ${target} สนาม ${arena.id} เดินไม่เหมือนเดิม`
      )
    }
  }
})
