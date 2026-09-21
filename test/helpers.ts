import type { BlockNode } from '~/game/blocks/types'
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'

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

export function countRaw(program: BlockProgram): number {
  let total = 0
  walkBlocks(program, (node) => {
    if (node.kind === 'raw-code' || node.kind === 'raw-value') total++
  })
  return total
}

export const presetsOf = (pack: BlockPack) =>
  pack.presets.map((preset) => ({ pack, preset, title: `${pack.id}/${preset.id}` }))
