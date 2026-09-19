/**
 * ตัวช่วยที่ใช้ร่วมกันในเทสต์ — ทุกอย่างในโฟลเดอร์นี้รันใน Node ล้วน ไม่ใช้เบราว์เซอร์
 * (ส่วนที่ต้องลากจริงหรือดู DOM ทดสอบด้วย CDP แยกต่างหาก ดู README ของเทสต์)
 */
import type { BlockNode } from '~/game/blocks/types'
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'

/** เดินทั่วทุกบล็อกในโปรแกรม รวมบล็อกค่าที่เสียบอยู่ในช่องและคำสั่งข้างใน */
export function walkBlocks(program: BlockProgram, visit: (node: BlockNode) => void): void {
  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      visit(node)
      for (const body of Object.values(node.bodies ?? {})) walk(body)
      for (const input of Object.values(node.inputs ?? {})) if (input) walk([input])
    }
  }
  for (const script of Object.values(program.scripts)) walk(script)
}

export function countBlocks(program: BlockProgram): number {
  let total = 0
  walkBlocks(program, () => total++)
  return total
}

/** บล็อก "โค้ดของฉัน" ที่เกิดตอนอ่านโค้ดกลับ — ถ้ามี แปลว่าบล็อกปกติรับโค้ดนั้นไม่ได้ */
export function countRaw(program: BlockProgram): number {
  let total = 0
  walkBlocks(program, (node) => {
    if (node.kind === 'raw-code' || node.kind === 'raw-value') total++
  })
  return total
}

/** ชื่อเกม + ชื่อตัวอย่าง ใช้ตั้งชื่อเทสต์ให้อ่านออกว่าพังตรงไหน */
export const presetsOf = (pack: BlockPack) =>
  pack.presets.map((preset) => ({ pack, preset, title: `${pack.id}/${preset.id}` }))
