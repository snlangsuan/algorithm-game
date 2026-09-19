import type { InjectionKey, Ref } from 'vue'
import {
  fits,
  type BlockId,
  type BlockNode,
  type BlockShape,
  type ValueType
} from '~/game/blocks/types'

/** สิ่งที่กำลังถูกลากอยู่ตอนนี้ */
export interface DragPayload {
  /** มาจากกล่องเครื่องมือ (สร้างใหม่) หรือจากในโปรแกรม (ย้ายที่) */
  source: 'palette' | 'script'
  kind: string
  shape: BlockShape
  /** ชนิดของค่า (เฉพาะบล็อกแคปซูล) */
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

/** คำสั่งที่บล็อกเรียกกลับไปหาตัวแก้ไข */
export interface BlockEditorApi {
  dropStatement: (target: StatementTarget) => void
  dropInput: (target: InputTarget) => void
  remove: (id: BlockId) => void
  duplicate: (id: BlockId) => void
  setField: (node: BlockNode, name: string, value: string | number) => void
}

/** สถานะระหว่างรัน ใช้ไฮไลต์บล็อกที่กำลังทำงานกับจำนวนครั้งที่ทำงาน */
export interface BlockRuntime {
  activeId: BlockId | null
  counts: Record<BlockId, number>
}

export const BLOCK_EDITOR = Symbol('maze-block-editor') as InjectionKey<BlockEditorApi>
export const BLOCK_RUNTIME = Symbol('maze-block-runtime') as InjectionKey<Ref<BlockRuntime>>

/** สถานะการลากใช้ร่วมกันทั้งหน้า — dataTransfer อ่านค่าตอน dragover ไม่ได้ */
const dragging = ref<DragPayload | null>(null)

/** ลิสต์ที่เมาส์ลอยอยู่ตอนนี้ เพื่อให้เส้นบอกตำแหน่งขึ้นที่เดียว */
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

  /** ช่องนี้รับสิ่งที่กำลังลากอยู่ได้ไหม */
  const accepts = (shape: BlockShape): boolean => dragging.value?.shape === shape

  /** รูที่รับค่าชนิดนี้ รับสิ่งที่กำลังลากอยู่ได้ไหม */
  const acceptsValue = (slot: ValueType = 'any'): boolean =>
    dragging.value?.shape === 'value' && fits(dragging.value.value ?? 'any', slot)

  /** รหัสประจำลิสต์ ใช้บอกว่าตอนนี้เมาส์อยู่เหนือลิสต์ไหน */
  const nextListId = () => `list-${++seed}`

  return { dragging: readonly(dragging), hovering, start, end, accepts, acceptsValue, nextListId }
}
