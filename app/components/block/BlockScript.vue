<script setup lang="ts">
import type { BlockId } from '~/game/blocks/types'
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import { countProgram, createBlock } from '~/game/blocks/program'
import { BLOCK_RUNTIME, type BlockRuntime } from '~/composables/useBlockEditor'

const props = withDefaults(
  defineProps<{
    program: BlockProgram
    pack: BlockPack
    /** บล็อกที่กำลังทำงาน */
    activeId?: BlockId | null
    /** จำนวนครั้งที่แต่ละบล็อกทำงาน */
    counts?: Record<BlockId, number>
    editable?: boolean
    running?: boolean
  }>(),
  { activeId: null, counts: () => ({}), editable: false, running: false }
)

const runtime = computed<BlockRuntime>(() => ({
  activeId: props.activeId,
  counts: props.counts
}))

provide(BLOCK_RUNTIME, runtime)

const total = computed(() => countProgram(props.program))

/**
 * ทุกหัวบล็อกของเกมนี้ ("เมื่อ...") พร้อมลำดับคำสั่งของตัวเอง
 * หัวบล็อกลากหรือลบไม่ได้ มีอยู่ตายตัวตามที่เกมประกาศไว้
 */
const scripts = computed(() =>
  props.pack.hats.map((hat) => ({
    kind: hat.kind,
    node: createBlock(hat.kind),
    list: props.program.scripts[hat.kind] ?? []
  }))
)

const scroller = ref<HTMLDivElement | null>(null)

/** เลื่อนบล็อกที่กำลังทำงานให้อยู่ในกรอบ */
watch(
  () => props.activeId,
  async (id) => {
    if (!id) return
    await nextTick()

    const box = scroller.value
    const node = box?.querySelector<HTMLElement>('[data-active="true"]')
    if (!box || !node) return

    const top = node.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    box.scrollTop = Math.max(0, top - box.clientHeight / 2)
  }
)
</script>

<template>
  <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-muted">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <div class="min-w-0">
        <p class="truncate text-xs font-semibold text-ink">{{ program.name }}</p>
        <p class="text-[11px] text-ink-subtle">{{ total }} บล็อก</p>
      </div>

      <span
        v-if="running"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700"
      >
        <span class="size-1.5 animate-pulse rounded-full bg-primary-500" />
        กำลังทำงาน
      </span>
      <slot name="action" />
    </div>

    <div ref="scroller" class="min-h-0 flex-1 overflow-auto p-2">
      <!-- หนึ่งหัวบล็อก = หนึ่งช่วงงาน บล็อกข้างในย่อหน้าเข้ามาให้เห็นว่าอยู่ใต้หัวไหน -->
      <section v-for="(script, index) in scripts" :key="script.kind" :class="index > 0 ? 'mt-5' : ''">
        <BlockPiece :node="script.node" />

        <!--
          สันสีเดียวกับหัว ลากจากขอบซ้ายของหัวลงมา เหมือนตัวหัวยืดคลุมทั้งช่วง
          บล็อกลูกเริ่มถัดจากสันไป 6px ร่องของมันจึงอยู่ที่ 6 + 14 = 20px
          (ตำแหน่ง absolute วัดจากขอบในของกรอบ เส้นสันซ้ายจึงไม่ถูกนับรวม)
        -->
        <div class="relative -mt-px rounded-bl-lg border-l-[10px] border-yellow-500 pb-2 pl-1.5">
          <span
            class="pointer-events-none absolute left-5 top-0 z-10 h-[6px] w-6 rounded-b-[5px] bg-yellow-500"
            aria-hidden="true"
          />

          <BlockList
            :list="script.list"
            :parent="null"
            :name="script.kind"
            :editable="editable"
            :empty="editable ? 'ลากบล็อกมาวางตรงนี้' : 'ยังไม่มีบล็อก'"
          />
        </div>
      </section>
    </div>
  </div>
</template>
