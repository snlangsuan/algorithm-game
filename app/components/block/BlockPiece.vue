<script setup lang="ts">
import { CATEGORY_STYLE, findSpec, type BlockNode } from '~/game/blocks/types'
import { BLOCK_EDITOR, BLOCK_RUNTIME, useBlockDrag } from '~/composables/useBlockEditor'
import { useBlockExplain } from '~/composables/useBlockExplain'

const props = defineProps<{
  node: BlockNode
  editable?: boolean
  /** บล็อกค่าที่ครอบบล็อกนี้อยู่ — ใช้สลับเฉดเมื่อซ้อนกันสีเดียวกัน */
  host?: { category: string; shaded: boolean }
}>()

const editor = inject(BLOCK_EDITOR, null)
const runtime = inject(BLOCK_RUNTIME, null)
const { start, end, accepts, acceptsValue } = useBlockDrag()
const explainer = useBlockExplain()

const spec = computed(() => findSpec(props.node.kind))
const style = computed(() => CATEGORY_STYLE[spec.value?.category ?? 'action'])
const isValue = computed(() => spec.value?.shape === 'value')
const isHat = computed(() => spec.value?.shape === 'hat')
const isStatement = computed(() => spec.value?.shape === 'statement')

/**
 * บล็อกค่าที่ซ้อนอยู่ในบล็อกสีเดียวกัน (เช่น + ครอบ × ครอบตัวเลข) จะกลืนเป็นเนื้อเดียว
 * เหลือแค่เส้นขอบบาง ๆ ให้แยกชั้น จึงสลับเฉดเข้ม/อ่อนทีละชั้นแบบ Scratch
 */
const shaded = computed(() => {
  const host = props.host
  return isValue.value && host !== undefined && host.category === spec.value?.category && !host.shaded
})
const childHost = computed(() => ({ category: spec.value?.category ?? '', shaded: shaded.value }))

const JOINT = 'absolute left-3.5 h-[6px] w-6 rounded-b-[5px]'

const ACTIVE_RING =
  'z-20 outline outline-[3px] outline-offset-[3px] outline-white shadow-[0_0_0_6px_rgba(28,21,36,0.75)]'

const active = computed(() => runtime?.value.activeId === props.node.id)
const count = computed(() => runtime?.value.counts[props.node.id] ?? 0)

const overSlot = ref<string | null>(null)

const canEdit = computed(() => Boolean(props.editable && editor))

const fitsSlot = (slot?: string) => canEdit.value && acceptsValue(slot as never)

function onDragStart(event: DragEvent) {
  if (!canEdit.value || !spec.value) return
  event.stopPropagation()
  start(event, {
    source: 'script',
    kind: props.node.kind,
    shape: spec.value.shape,
    value: spec.value.value,
    id: props.node.id
  })
}

function onSlotDrop(part: { name: string; accepts?: string }) {
  overSlot.value = null
  if (!fitsSlot(part.accepts)) return

  editor?.dropInput({ parent: props.node.id, name: part.name })
  end()
}

function onSlotOver(part: { name: string; accepts?: string }) {
  if (!fitsSlot(part.accepts)) return
  overSlot.value = part.name
}

const label = (options: { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === String(value))?.label ?? String(value ?? '')
</script>

<template>
  <div
    v-if="spec"
    class="group/block relative"
    :data-active="active ? 'true' : undefined"
    :class="isValue ? 'inline-flex' : 'w-fit max-w-full'"
    :draggable="canEdit"
    @dragstart="onDragStart"
    @dragend="end()"
  >
    <div
      class="relative ring-1 ring-inset transition-shadow"
      :class="[
        style.block,
        // รัศมีคงที่แทน rounded-full — บรรทัดเดียวยังเป็นแคปซูลเหมือนเดิม
        // แต่พอนิพจน์ยาวจนขึ้นบรรทัดใหม่ จะเป็นสี่เหลี่ยมมุมมน ไม่พองเป็นวงรีใหญ่
        isValue ? 'rounded-[0.875rem] !ring-black/15' : 'w-full min-w-40 shadow-soft',
        shaded ? 'shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.14)]' : '',
        isHat ? 'rounded-t-[1.1rem] rounded-b-md' : '',
        !isValue && !isHat ? 'rounded-md' : '',
        active ? ACTIVE_RING : '',
        canEdit ? 'cursor-grab active:cursor-grabbing' : ''
      ]"
    >
      <span
        v-if="isStatement"
        class="pointer-events-none top-0 bg-black/25 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]"
        :class="JOINT"
        aria-hidden="true"
      />

      <span
        v-if="isStatement"
        class="pointer-events-none -bottom-[6px] z-10"
        :class="[JOINT, style.peg]"
        aria-hidden="true"
      />
      <div
        class="flex flex-wrap items-center gap-x-1.5 gap-y-1"
        :class="isValue ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'"
      >
        <template v-for="(part, index) in spec.parts" :key="index">
          <span v-if="part.type === 'text'">{{ part.text }}</span>

          <template v-else-if="part.type === 'field'">
            <select
              v-if="canEdit"
              :value="node.fields[part.name]"
              class="rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] text-white outline-none"
              @pointerdown.stop
              @change="editor?.setField(node, part.name, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="option in part.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span v-else class="rounded-md bg-black/25 px-1.5 py-0.5">
              {{ label(part.options, node.fields[part.name]) }}
            </span>
          </template>

          <template v-else-if="part.type === 'number'">
            <input
              v-if="canEdit"
              type="number"
              :value="node.fields[part.name]"
              class="w-14 rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] text-white outline-none"
              @pointerdown.stop
              @dragstart.stop.prevent
              @input="editor?.setField(node, part.name, Number(($event.target as HTMLInputElement).value))"
            />
            <span v-else class="rounded-md bg-black/25 px-1.5 py-0.5 tabular-nums">
              {{ node.fields[part.name] }}
            </span>
          </template>

          <template v-else-if="part.type === 'string'">
            <input
              v-if="canEdit"
              type="text"
              :value="String(node.fields[part.name] ?? '')"
              :placeholder="part.placeholder"
              spellcheck="false"
              class="min-w-24 max-w-56 flex-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] text-white outline-none placeholder:text-white/40"
              @pointerdown.stop
              @dragstart.stop.prevent
              @input="editor?.setField(node, part.name, ($event.target as HTMLInputElement).value)"
            />
            <span v-else class="rounded-md bg-black/25 px-1.5 py-0.5">
              {{ node.fields[part.name] || part.placeholder }}
            </span>
          </template>

          <template v-else-if="part.type === 'code'">
            <textarea
              v-if="canEdit"
              :value="String(node.fields[part.name] ?? '')"
              rows="1"
              spellcheck="false"
              class="min-w-48 flex-1 resize-y rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] leading-relaxed text-white outline-none"
              :style="{ height: `${Math.min(8, String(node.fields[part.name] ?? '').split('\n').length) * 1.35 + 0.8}rem` }"
              @pointerdown.stop
              @dragstart.stop.prevent
              @input="editor?.setField(node, part.name, ($event.target as HTMLTextAreaElement).value)"
            />
            <span v-else class="whitespace-pre rounded-md bg-black/30 px-2 py-0.5 font-mono text-[11px]">{{
              node.fields[part.name]
            }}</span>
          </template>

          <span
            v-else-if="part.type === 'input'"
            class="inline-flex min-h-6 items-center rounded-full transition-all"
            :class="[
              overSlot === part.name ? 'ring-2 ring-white' : '',
              fitsSlot(part.accepts)
                ? node.inputs[part.name]
                  ? 'ring-2 ring-dashed ring-white/40'
                  : 'ring-2 ring-dashed ring-white/70'
                : ''
            ]"
            @dragover.prevent="onSlotOver(part)"
            @dragleave="overSlot = null"
            @drop.prevent.stop="onSlotDrop(part)"
          >
            <BlockPiece
              v-if="node.inputs[part.name]"
              :node="node.inputs[part.name]!"
              :editable="editable"
              :host="childHost"
            />
            <span
              v-else
              class="rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] text-white/55 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
            >
              {{ part.placeholder }}
            </span>
          </span>
        </template>

        <button
          v-if="spec.explain"
          type="button"
          title="บล็อกนี้คิดยังไง"
          aria-label="ดูว่าบล็อกนี้คิดยังไง"
          class="grid size-4 shrink-0 place-items-center rounded-full bg-white/25 text-[10px] font-bold leading-none text-white transition-colors hover:bg-white hover:text-ink"
          @pointerdown.stop
          @click.stop="explainer.open(node.kind)"
        >
          ?
        </button>

        <button
          v-if="canEdit && spec.unpack"
          type="button"
          title="แกะกล่อง — แทนบล็อกนี้ด้วยบล็อกย่อยที่ทำงานเหมือนกันทุกก้าว"
          class="shrink-0 rounded-full bg-white/25 px-1.5 text-[10px] font-semibold leading-4 text-white transition-colors hover:bg-white hover:text-ink"
          @pointerdown.stop
          @click.stop="editor?.unpack(node.id)"
        >
          แกะ
        </button>

        <span
          v-if="count > 0"
          class="ml-1 shrink-0 rounded-full bg-black/25 px-1.5 text-[10px] tabular-nums text-white/80"
          :title="`บล็อกนี้ทำงาน ${count.toLocaleString()} ครั้ง`"
        >
          ×{{ count.toLocaleString() }}
        </span>

        <button
          v-if="canEdit"
          type="button"
          title="ลบบล็อกนี้"
          class="shrink-0 rounded-full px-1 text-white/50 opacity-0 transition-opacity hover:text-white group-hover/block:opacity-100"
          :class="count > 0 ? '' : 'ml-auto'"
          @pointerdown.stop
          @click.stop="editor?.remove(node.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-3.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <template v-for="part in spec.parts" :key="`${part.type}-${'name' in part ? part.name : ''}`">
        <div v-if="part.type === 'body'" class="pb-2 pl-4 pr-1.5">
          <p v-if="part.label" class="px-1 pb-1 text-[11px] text-white/70">{{ part.label }}</p>

          <div class="relative rounded-md bg-black/10 p-1 pt-0 ring-1 ring-inset ring-black/5">
            <span
              class="pointer-events-none absolute left-[1.125rem] top-0 z-10 h-[6px] w-6 rounded-b-[5px]"
              :class="style.peg"
              aria-hidden="true"
            />

            <BlockList
              :list="node.bodies[part.name] ?? []"
              :parent="node.id"
              :name="part.name"
              :editable="editable"
              :empty="editable ? 'ลากบล็อกมาวางตรงนี้' : 'ว่าง'"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
