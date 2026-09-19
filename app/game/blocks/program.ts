import { findSpec, type BlockId, type BlockNode } from './types'
import type { BlockProgram } from './pack'

let counter = 0

export const nextId = (): BlockId => `b${(++counter).toString(36)}${Date.now().toString(36).slice(-3)}`

/** สร้างบล็อกใหม่จากชนิด พร้อมค่าเริ่มต้นของทุกช่อง */
export function createBlock(kind: string): BlockNode {
  const spec = findSpec(kind)
  if (!spec) throw new Error(`ไม่รู้จักบล็อก "${kind}"`)

  const node: BlockNode = { id: nextId(), kind, fields: {}, inputs: {}, bodies: {} }

  for (const part of spec.parts) {
    if (part.type === 'field') node.fields[part.name] = part.options[0]?.value ?? ''
    else if (part.type === 'code' || part.type === 'string') node.fields[part.name] = ''
    else if (part.type === 'number') node.fields[part.name] = part.name === 'times' ? 4 : 1
    else if (part.type === 'input') node.inputs[part.name] = null
    else if (part.type === 'body') node.bodies[part.name] = []
  }

  return node
}

/** สำเนาแบบลึกพร้อมแจก id ใหม่ทั้งต้น */
export function cloneBlock(node: BlockNode): BlockNode {
  return {
    id: nextId(),
    kind: node.kind,
    fields: { ...node.fields },
    inputs: Object.fromEntries(
      Object.entries(node.inputs).map(([key, value]) => [key, value ? cloneBlock(value) : null])
    ),
    bodies: Object.fromEntries(
      Object.entries(node.bodies).map(([key, list]) => [key, list.map(cloneBlock)])
    )
  }
}

export const cloneProgram = (program: BlockProgram): BlockProgram => ({
  name: program.name,
  scripts: Object.fromEntries(
    Object.entries(program.scripts).map(([hat, list]) => [hat, list.map(cloneBlock)])
  )
})

/** ลำดับคำสั่งของทุกหัวบล็อกในโปรแกรม */
export const allScripts = (program: BlockProgram): BlockNode[][] => Object.values(program.scripts)

export function findBlock(program: BlockProgram, id: BlockId): BlockNode | null {
  const walk = (list: BlockNode[]): BlockNode | null => {
    for (const node of list) {
      if (node.id === id) return node

      for (const child of Object.values(node.inputs)) {
        if (!child) continue
        if (child.id === id) return child
        const found = walk([child])
        if (found) return found
      }

      for (const body of Object.values(node.bodies)) {
        const found = walk(body)
        if (found) return found
      }
    }

    return null
  }

  for (const script of allScripts(program)) {
    const found = walk(script)
    if (found) return found
  }

  return null
}

/** ลิสต์คำสั่งที่ตำแหน่งนั้น — parent = null คือใต้หัวบล็อกชื่อ name */
export function bodyOf(program: BlockProgram, parent: BlockId | null, name: string): BlockNode[] | null {
  if (parent === null) return program.scripts[name] ?? null
  return findBlock(program, parent)?.bodies[name] ?? null
}

/** ถอดบล็อกออกจากต้นไม้ คืนตัวที่ถอดได้ */
export function detach(program: BlockProgram, id: BlockId): BlockNode | null {
  const fromList = (list: BlockNode[]): BlockNode | null => {
    const index = list.findIndex((node) => node.id === id)
    if (index >= 0) return list.splice(index, 1)[0] ?? null

    for (const node of list) {
      for (const [key, child] of Object.entries(node.inputs)) {
        if (child?.id === id) {
          node.inputs[key] = null
          return child
        }
        if (child) {
          const found = fromList([child])
          if (found) return found
        }
      }

      for (const body of Object.values(node.bodies)) {
        const found = fromList(body)
        if (found) return found
      }
    }

    return null
  }

  for (const script of allScripts(program)) {
    const found = fromList(script)
    if (found) return found
  }

  return null
}

/** บล็อกนี้มี id นั้นอยู่ข้างในไหม — กันลากบล็อกไปหย่อนใส่ตัวเอง */
export function contains(node: BlockNode, id: BlockId): boolean {
  if (node.id === id) return true

  for (const child of Object.values(node.inputs)) {
    if (child && contains(child, id)) return true
  }

  for (const body of Object.values(node.bodies)) {
    if (body.some((child) => contains(child, id))) return true
  }

  return false
}

export function insertStatement(
  program: BlockProgram,
  target: { parent: BlockId | null; name: string; index: number },
  node: BlockNode
): boolean {
  const list = bodyOf(program, target.parent, target.name)
  if (!list) return false

  list.splice(Math.max(0, Math.min(target.index, list.length)), 0, node)
  return true
}

export function setInput(
  program: BlockProgram,
  target: { parent: BlockId; name: string },
  node: BlockNode | null
): boolean {
  const parent = findBlock(program, target.parent)
  if (!parent || !(target.name in parent.inputs)) return false

  parent.inputs[target.name] = node
  return true
}

/** ตำแหน่งของคำสั่งในต้นไม้ — ใช้ตอนย้ายที่ */
export function locate(
  program: BlockProgram,
  id: BlockId
): { parent: BlockId | null; name: string; index: number } | null {
  const scan = (
    list: BlockNode[],
    parent: BlockId | null,
    name: string
  ): { parent: BlockId | null; name: string; index: number } | null => {
    const index = list.findIndex((node) => node.id === id)
    if (index >= 0) return { parent, name, index }

    for (const node of list) {
      for (const [key, body] of Object.entries(node.bodies)) {
        const found = scan(body, node.id, key)
        if (found) return found
      }
    }

    return null
  }

  for (const [hat, script] of Object.entries(program.scripts)) {
    const found = scan(script, null, hat)
    if (found) return found
  }

  return null
}

/** โปรแกรมนี้มีบล็อกชนิดใดชนิดหนึ่งในรายการอยู่ไหม */
export function usesBlock(program: BlockProgram, kinds: string[]): boolean {
  const wanted = new Set(kinds)

  const scan = (list: BlockNode[]): boolean =>
    list.some(
      (node) =>
        wanted.has(node.kind) ||
        Object.values(node.inputs).some((child) => child && scan([child])) ||
        Object.values(node.bodies).some((body) => scan(body))
    )

  return allScripts(program).some(scan)
}

/** นับบล็อกทั้งโปรแกรม (ทุกหัวบล็อกรวมกัน) */
export const countProgram = (program: BlockProgram): number =>
  allScripts(program).reduce((total, script) => total + countBlocks(script), 0)

export function countBlocks(list: BlockNode[]): number {
  let total = 0

  for (const node of list) {
    total++
    for (const child of Object.values(node.inputs)) if (child) total += countBlocks([child])
    for (const body of Object.values(node.bodies)) total += countBlocks(body)
  }

  return total
}
