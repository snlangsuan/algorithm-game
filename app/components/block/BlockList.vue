<script setup lang="ts">
import type { BlockId, BlockNode } from '~/game/blocks/types'
import { BLOCK_EDITOR, useBlockDrag } from '~/composables/useBlockEditor'

const props = defineProps<{
  list: BlockNode[]
  /** บล็อกแม่ที่ลิสต์นี้อยู่ข้างใน (null = ใต้หัวบล็อกชื่อ name) */
  parent: BlockId | null
  name: string
  editable?: boolean
  /** ข้อความตอนยังไม่มีบล็อกเลย */
  empty?: string
}>()

const editor = inject(BLOCK_EDITOR, null)
const { accepts, end, hovering, nextListId } = useBlockDrag()

/** รหัสประจำลิสต์นี้ — เส้นบอกตำแหน่งจะขึ้นเฉพาะลิสต์ที่เมาส์อยู่ */
const id = nextListId()

/** จะแทรกบล็อกที่ตำแหน่งไหน (0 = บนสุด, list.length = ท้ายสุด) */
const at = ref(0)

const canDrop = computed(() => Boolean(props.editable && editor) && accepts('statement'))
const active = computed(() => canDrop.value && hovering.value === id)

/** หย่อนบนครึ่งบนของบล็อก = แทรกก่อน, ครึ่งล่าง = แทรกหลัง */
function onItemOver(event: DragEvent, index: number) {
  if (!canDrop.value) return

  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  at.value = event.clientY < box.top + box.height / 2 ? index : index + 1
  mark(event)
}

function onTailOver(event: DragEvent) {
  if (!canDrop.value) return
  at.value = props.list.length
  mark(event)
}

function mark(event: DragEvent) {
  hovering.value = id
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onDrop() {
  if (!canDrop.value || hovering.value !== id) return

  editor?.dropStatement({ parent: props.parent, name: props.name, index: at.value })
  end()
}
</script>

<template>
  <!-- ทั้งลิสต์รับการหย่อนได้ ไม่ใช่แค่ช่องว่างบาง ๆ ระหว่างบล็อก -->
  <div
    class="flex flex-col items-start"
    @dragover.prevent.stop="onTailOver"
    @drop.prevent.stop="onDrop"
  >
    <template v-for="(node, index) in list" :key="node.id">
      <!-- เส้นบอกว่าบล็อกจะไปแทรกตรงนี้ -->
      <div
        v-if="active && at === index"
        class="-my-[5px] h-2.5 w-40 rounded-full bg-white ring-2 ring-primary-600"
      />

      <div @dragover.prevent.stop="onItemOver($event, index)" @drop.prevent.stop="onDrop">
        <BlockPiece :node="node" :editable="editable" />
      </div>
    </template>

    <div
      v-if="active && at === list.length"
      class="-my-[5px] h-2.5 w-40 rounded-full bg-white ring-2 ring-primary-600"
    />

    <!--
      ลิสต์ว่าง: ใช้กล่องขนาดคงที่เป็นพื้นที่รับ จะได้ไม่ขยับตอนเริ่มลาก (เล็งแล้วไม่หลุด)
      ลิสต์ที่มีบล็อกแล้ว: เว้นท้ายไว้นิดหน่อยสำหรับหย่อนต่อท้าย
    -->
    <div
      v-if="list.length === 0"
      class="flex h-9 w-56 items-center rounded-md px-2 text-[11px] opacity-60 transition-colors"
      :class="active ? 'bg-white/25 opacity-100 ring-2 ring-dashed ring-white/70' : ''"
    >
      {{ empty }}
    </div>

    <div v-else :class="canDrop ? 'h-4' : 'h-1'" />
  </div>
</template>
