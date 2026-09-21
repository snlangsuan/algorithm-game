<script setup lang="ts">
import type { BlockId, BlockNode } from '~/game/blocks/types'
import { BLOCK_EDITOR, useBlockDrag } from '~/composables/useBlockEditor'

const props = defineProps<{
  list: BlockNode[]

  parent: BlockId | null
  name: string
  editable?: boolean

  empty?: string
}>()

const editor = inject(BLOCK_EDITOR, null)
const { accepts, end, hovering, nextListId } = useBlockDrag()

const id = nextListId()

const at = ref(0)

const canDrop = computed(() => Boolean(props.editable && editor) && accepts('statement'))
const active = computed(() => canDrop.value && hovering.value === id)

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
  <div
    class="flex flex-col items-start"
    @dragover.prevent.stop="onTailOver"
    @drop.prevent.stop="onDrop"
  >
    <template v-for="(node, index) in list" :key="node.id">
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
