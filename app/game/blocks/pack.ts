import { coreBlocksOf } from './core'
import type { Node, PackParsers, ParseContext } from './importer'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  register,
  type BlockCategory,
  type BlockNode,
  type BlockSpec,
  type PaletteGroup
} from './types'

export interface BlockProgram {
  name: string
  scripts: Record<string, BlockNode[]>
  /** โปรแกรมนี้อยู่ในคลัง "ของฉัน" ช่องไหน — ตัวอย่างสำเร็จรูปไม่มี */
  libraryId?: string
}

export interface BlockPreset {
  id: string
  name: string
  description: string
  build: () => BlockProgram
}

export interface TargetWriter {

  push: (text: string) => void
  indent: (delta: number) => void

  body: () => void
}

export interface TargetMethod {

  hat: BlockSpec

  name: string

  write: (writer: TargetWriter) => void

  unwrap: (statements: Node[], ctx: ParseContext) => Node[]

  skipWhenEmpty?: boolean
}

export interface CodeTarget {

  base: string

  fields: string[]

  helpers: string

  memory?: boolean

  methods: TargetMethod[]
}

export interface BlockPack {
  id: string

  hats: BlockSpec[]

  blocks: BlockSpec[]

  palette: PaletteGroup[]
  target: CodeTarget
  presets: BlockPreset[]

  parsers?: PackParsers
}

export type PackInput = Omit<BlockPack, 'hats' | 'palette'>

export function createPack(input: PackInput): BlockPack {
  const hats = input.target.methods.map((method) => method.hat)
  const blocks = [...input.blocks, ...coreBlocksOf(input.target.memory === true)]

  register([...hats, ...input.blocks])

  const palette: PaletteGroup[] = CATEGORY_ORDER.map((category: BlockCategory) => ({
    id: category,
    category,
    label: CATEGORY_LABEL[category],
    kinds: blocks
      .filter((block) => block.category === category && !block.hidden)
      .map((block) => block.kind)
  })).filter((group) => group.kinds.length > 0)

  return { ...input, hats, palette }
}

export function normalize(program: BlockProgram, pack: BlockPack): BlockProgram {
  return {
    name: program.name,
    scripts: Object.fromEntries(
      pack.hats.map((hat) => [hat.kind, program.scripts[hat.kind] ?? []])
    )
  }
}

export function emptyProgram(pack: BlockPack, name = 'โปรแกรมของฉัน'): BlockProgram {
  return {
    name,
    scripts: Object.fromEntries(pack.hats.map((hat) => [hat.kind, []]))
  }
}
