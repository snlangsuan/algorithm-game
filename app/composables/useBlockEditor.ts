import type { InjectionKey, Ref } from 'vue'
import {
  fits,
  type BlockId,
  type BlockNode,
  type BlockShape,
  type ValueType
} from '~/game/blocks/types'

export interface DragPayload {

  source: 'palette' | 'script'
  kind: string
  shape: BlockShape

  value?: ValueType
  id?: BlockId
}

export interface StatementTarget {
  parent: BlockId | null
  name: string
  index: number
}

export interface InputTarget {
  parent: BlockId
  name: string
}

export interface BlockEditorApi {
  dropStatement: (target: StatementTarget) => void
  dropInput: (target: InputTarget) => void
  remove: (id: BlockId) => void
  duplicate: (id: BlockId) => void
  setField: (node: BlockNode, name: string, value: string | number) => void
  /** แทนบล็อกด้วยบล็อกย่อยที่ทำงานเหมือนกัน — ใช้ได้กับบล็อกที่มี unpack */
  unpack: (id: BlockId) => void
}

export interface BlockRuntime {
  activeId: BlockId | null
  counts: Record<BlockId, number>
}

export const BLOCK_EDITOR = Symbol('maze-block-editor') as InjectionKey<BlockEditorApi>
export const BLOCK_RUNTIME = Symbol('maze-block-runtime') as InjectionKey<Ref<BlockRuntime>>

const dragging = ref<DragPayload | null>(null)

const hovering = ref<string | null>(null)

let seed = 0

export function useBlockDrag() {
  const start = (event: DragEvent, payload: DragPayload) => {
    dragging.value = payload
    event.dataTransfer?.setData('text/plain', payload.kind)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  const end = () => {
    dragging.value = null
    hovering.value = null
  }

  const accepts = (shape: BlockShape): boolean => dragging.value?.shape === shape

  const acceptsValue = (slot: ValueType = 'any'): boolean =>
    dragging.value?.shape === 'value' && fits(dragging.value.value ?? 'any', slot)

  const nextListId = () => `list-${++seed}`

  return { dragging: readonly(dragging), hovering, start, end, accepts, acceptsValue, nextListId }
}
