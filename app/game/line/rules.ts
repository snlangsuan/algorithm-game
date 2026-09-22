/**
 * กฎของตัวอย่างในเกม เขียนซ้ำเป็น TypeScript ธรรมดา — ใช้วาดภาพย่อกับภาพในหน้าความรู้
 *
 * โปรแกรมของผู้เล่นรันใน Web Worker ซึ่งเรียกจากตอนสร้างภาพไม่ได้ จึงต้องมีฉบับที่เรียกตรง ๆ ได้
 * เทสต์เทียบทุกกฎในนี้กับโค้ดที่บล็อกแปลงออกมาจริงทุกสนาม ถ้าใครแก้ตัวอย่างแล้วลืมแก้ตรงนี้ เทสต์จะฟ้อง
 */
import {
  DECIDE_EVERY,
  SEE_THRESHOLD,
  advance,
  createRun,
  isLost,
  linePosition,
  order,
  seesMarker,
  type Drive,
  type Run
} from './engine'

/** ความจำที่อยู่ข้ามการตัดสินใจ — ตรงกับตัวแปร b (previous) กับ c (calm · marker) ในบล็อก */
export interface RuleMemory {
  previous: number
  calm: number
  /** ป้ายเขียวที่เพิ่งเห็น — ติดลบคือซ้าย บวกคือขวา ตัวเลขคือจะจำต่ออีกกี่ครั้ง */
  marker: number
}

/** กฎหนึ่งข้อ — ได้สภาพสนามกับกล่องความจำเล็ก ๆ แล้วตอบกำลังมอเตอร์ */
export type Rule = (run: Run, memory: RuleMemory) => Drive

const sees = (run: Run, index: number): boolean => (run.sensors[index] ?? 0) >= SEE_THRESHOLD

const positionOf = (run: Run): number => linePosition(run.sensors, run.lastSide)

export const RULES = {
  /** ตัวอย่าง "เลี้ยวสุดทางเมื่อเห็นเส้น (bang-bang)" */
  'bang-bang': (run) => {
    if (sees(run, 0)) return { left: -50, right: 50 }
    if (sees(run, 4)) return { left: 50, right: -50 }
    return { left: 50, right: 50 }
  },

  /** ตัวอย่าง "เลี้ยวตามระยะที่เบี่ยง (P control)" */
  proportional: (run) => {
    const turn = positionOf(run) * 0.5
    return { left: 60 + turn, right: 60 - turn }
  },

  /** ตัวอย่าง "ดูทั้งระยะและทิศที่กำลังเบี่ยง (PD control)" */
  pd: (run, memory) => {
    const error = positionOf(run)
    const change = error - memory.previous
    memory.previous = error

    const turn = error * 0.7 + change * 5
    return { left: 90 + turn, right: 90 - turn }
  },

  /** ตัวอย่าง "สลับพฤติกรรมตามสถานการณ์ (state machine)" */
  switching: (run, memory) => {
    if (isLost(run.sensors) && memory.calm > 10) return { left: 60, right: 60 }

    const error = positionOf(run)
    memory.calm = Math.abs(error) > 30 ? 0 : memory.calm + 1

    const turn = (error - memory.previous) * 5 + error * 0.7
    memory.previous = error

    return { left: 80 + turn, right: 80 - turn }
  },

  /** ตัวอย่าง "มือซ้ายแตะกำแพงบนเส้น" */
  'left-hand': (run) => {
    if (sees(run, 0)) return { left: -40, right: 60 }
    const turn = positionOf(run) * 0.5
    return { left: 50 + turn, right: 50 - turn }
  },

  /** ตัวอย่าง "จำป้ายเขียวแล้วเลี้ยวที่ทางแยก" */
  markers: (run, memory) => {
    if (seesMarker(run, 'left')) memory.marker = -15
    if (seesMarker(run, 'right')) memory.marker = 15
    if (memory.marker < 0) memory.marker += 1
    if (memory.marker > 0) memory.marker -= 1

    if (memory.marker < 0 && sees(run, 0)) return { left: -40, right: 60 }
    if (memory.marker > 0 && sees(run, 4)) return { left: 60, right: -40 }

    const turn = positionOf(run) * 0.5
    return { left: 50 + turn, right: 50 - turn }
  }
} satisfies Record<string, Rule>

export type RuleId = keyof typeof RULES

/**
 * PD ที่เลือกกำลัง Kp Kd เองได้ — ใช้วาดภาพของค่าที่ฝูงนกหาเจอ
 * ตัวอย่างฝูงนกสุ่มเอง จึงอยู่ใน RULES ไม่ได้ แต่ค่าที่มันหาเจอเอามาวิ่งซ้ำได้เป๊ะ
 */
export function pdWith(power: number, kp: number, kd: number): Rule {
  return (run, memory) => {
    const error = positionOf(run)
    const change = error - memory.previous
    memory.previous = error

    const turn = error * kp + change * kd
    return { left: power + turn, right: power - turn }
  }
}

/** วิ่งด้วยกฎที่ส่งมาตรง ๆ จนจบรอบ — แบบเดียวกับ playRule */
export function playWith(courseId: string, rule: Rule): Run {
  const run = createRun({ courseId })
  const memory: RuleMemory = { previous: 0, calm: 0, marker: 0 }

  while (!run.over) {
    order(run, rule(run, memory))
    for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
  }

  return run
}

/**
 * วิ่งด้วยกฎนั้นจนจบรอบ หรือจนกว่า stop จะบอกให้หยุด (ถามก่อนตัดสินใจทุกครั้ง)
 * stop ใช้หยุดภาพไว้ตรงจังหวะที่เล่าเรื่องได้ เช่นตอนกำลังเข้าจุดตัด
 */
export function playRule(courseId: string, rule: RuleId, stop?: (run: Run) => boolean): Run {
  const run = createRun({ courseId })
  const memory: RuleMemory = { previous: 0, calm: 0, marker: 0 }

  while (!run.over && !stop?.(run)) {
    order(run, RULES[rule](run, memory))
    for (let step = 0; step < DECIDE_EVERY && !run.over; step++) advance(run)
  }

  return run
}
