import { findSpec, type BlockId, type BlockNode } from './types'
import type { BlockProgram } from './pack'

let counter = 0

export const nextId = (): BlockId => `b${(++counter).toString(36)}${Date.now().toString(36).slice(-3)}`

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

export const allScripts = (program: BlockProgram): BlockNode[][] => Object.values(program.scripts)

function findInInputs(node: BlockNode, id: BlockId): BlockNode | null {
  for (const child of Object.values(node.inputs)) {
    if (!child) continue
    if (child.id === id) return child

    const found = findInList([child], id)
    if (found) return found
  }

  return null
}

function findInBodies(node: BlockNode, id: BlockId): BlockNode | null {
  for (const body of Object.values(node.bodies)) {
    const found = findInList(body, id)
    if (found) return found
  }

  return null
}

function findInList(list: BlockNode[], id: BlockId): BlockNode | null {
  for (const node of list) {
    if (node.id === id) return node

    const found = findInInputs(node, id) ?? findInBodies(node, id)
    if (found) return found
  }

  return null
}

export function findBlock(program: BlockProgram, id: BlockId): BlockNode | null {
  for (const script of allScripts(program)) {
    const found = findInList(script, id)
    if (found) return found
  }

  return null
}

export function bodyOf(program: BlockProgram, parent: BlockId | null, name: string): BlockNode[] | null {
  if (parent === null) return program.scripts[name] ?? null
  return findBlock(program, parent)?.bodies[name] ?? null
}

function detachFromInputs(node: BlockNode, id: BlockId): BlockNode | null {
  for (const [key, child] of Object.entries(node.inputs)) {
    if (child?.id === id) {
      node.inputs[key] = null
      return child
    }

    if (child) {
      const found = detachFromList([child], id)
      if (found) return found
    }
  }

  return null
}

function detachFromBodies(node: BlockNode, id: BlockId): BlockNode | null {
  for (const body of Object.values(node.bodies)) {
    const found = detachFromList(body, id)
    if (found) return found
  }

  return null
}

function detachFromList(list: BlockNode[], id: BlockId): BlockNode | null {
  const index = list.findIndex((node) => node.id === id)
  if (index >= 0) return list.splice(index, 1)[0] ?? null

  for (const node of list) {
    const found = detachFromInputs(node, id) ?? detachFromBodies(node, id)
    if (found) return found
  }

  return null
}

export function detach(program: BlockProgram, id: BlockId): BlockNode | null {
  for (const script of allScripts(program)) {
    const found = detachFromList(script, id)
    if (found) return found
  }

  return null
}

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
