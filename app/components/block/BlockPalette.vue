<script setup lang="ts">
import { CATEGORY_STYLE, findSpec } from '~/game/blocks/types'
import type { BlockPack } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { useBlockDrag } from '~/composables/useBlockEditor'

const props = defineProps<{ pack: BlockPack; disabled?: boolean }>()
const emit = defineEmits<{ trash: [] }>()

const { start, end, dragging } = useBlockDrag()

const groups = props.pack.palette.map((group) => {
  const items = group.kinds
    .filter((kind) => Boolean(findSpec(kind)))
    .map((kind) => ({ kind, spec: findSpec(kind)!, preview: createBlock(kind) }))

  return {
    ...group,

    sections: [
      { label: 'คำสั่ง — ต่อกันลงมา', items: items.filter((item) => item.spec.shape === 'statement') },
      {
        label: 'เงื่อนไข (ใช่/ไม่ใช่) — เสียบในช่องเงื่อนไข',
        items: items.filter((item) => item.spec.shape === 'value' && item.spec.value === 'check')
      },
      {
        label: 'ข้อความ — เสียบในช่องที่รับข้อความ',
        items: items.filter((item) => item.spec.shape === 'value' && item.spec.value === 'string')
      },
      {
        label: 'ตัวเลข — เสียบในช่องที่รับตัวเลข',
        items: items.filter((item) => item.spec.shape === 'value' && item.spec.value === 'number')
      },
      {
        label: 'ค่าอื่น ๆ — เสียบได้ทุกช่อง',
        items: items.filter(
          (item) => item.spec.shape === 'value' && (item.spec.value ?? 'any') === 'any'
        )
      }
    ].filter((section) => section.items.length > 0)
  }
})

const overTrash = ref(false)

const active = ref(groups[0]?.id ?? '')
const shown = computed(() => groups.find((group) => group.id === active.value) ?? groups[0])

function onDragStart(event: DragEvent, kind: string) {
  const spec = findSpec(kind)
  if (!spec) return
  start(event, { source: 'palette', kind, shape: spec.shape, value: spec.value })
}

function onTrash() {
  overTrash.value = false
  if (dragging.value?.source !== 'script') return
  emit('trash')
  end()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 grid shrink-0 grid-cols-2 gap-1">
      <button
        v-for="group in groups"
        :key="group.id"
        type="button"
        class="rounded-lg px-2 py-1.5 text-[11px] font-medium ring-1 ring-inset transition-colors"
        :class="
          active === group.id
            ? CATEGORY_STYLE[group.category].chip
            : 'bg-surface text-ink-subtle ring-line hover:text-ink-muted'
        "
        @click="active = group.id"
      >
        {{ group.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <section v-for="section in shown?.sections ?? []" :key="section.label">
        <p class="mb-1.5 px-0.5 text-[10px] font-medium text-ink-subtle">{{ section.label }}</p>

        <div class="flex flex-col items-start gap-1.5">
          <div
            v-for="item in section.items"
            :key="item.kind"
            :draggable="!disabled"
            class="max-w-full"
            :class="disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'"
            :title="disabled ? 'กด \'คัดลอกไปแก้\' ก่อน' : item.spec.hint"
            @dragstart="onDragStart($event, item.kind)"
            @dragend="end()"
          >
            <BlockPiece :node="item.preview" />
          </div>
        </div>
      </section>
    </div>

    <div
      class="mt-3 flex shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs transition-colors"
      :class="
        overTrash
          ? 'border-rose-400 bg-rose-50 text-rose-700'
          : 'border-line-strong bg-surface-muted text-ink-subtle'
      "
      v-if="!disabled"
      @dragover.prevent="overTrash = true"
      @dragleave="overTrash = false"
      @drop.prevent="onTrash"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-4" aria-hidden="true">
        <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      ลากมาทิ้งเพื่อลบ
    </div>
  </div>
</template>
