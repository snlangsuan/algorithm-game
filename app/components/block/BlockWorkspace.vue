<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import type { AuthorMode, BlockId } from '~/game/blocks/types'
import type { LogLine } from '~/game/shared/console'

/**
 * ที่ทำงานของโปรแกรมหนึ่งชุด — ใช้เหมือนกันทุกเกม
 * สลับดูได้ระหว่างบล็อกที่ต่อไว้ กับโค้ดที่บล็อกแปลงออกมา พร้อมปุ่มแก้ในหัวเดียว
 */
const props = withDefaults(
  defineProps<{
    pack: BlockPack
    program: BlockProgram
    /** ต่อบล็อกหรือพิมพ์โค้ดเอง */
    author: AuthorMode
    /** โค้ดที่กำลังจะรันจริง */
    code: string
    /** บล็อก/บรรทัดที่กำลังทำงาน */
    activeId?: BlockId | null
    counts?: Record<BlockId, number>
    line?: number | null
    lines?: Record<number, number>
    traced?: boolean
    running?: boolean
    disabled?: boolean
    /** ข้อความที่โปรแกรมพิมพ์ออกคอนโซล */
    logs?: LogLine[]
    /** แบบเต็มคอลัมน์: ตัวอักษรใหญ่ขึ้นและสูงตามจอ */
    tall?: boolean
  }>(),
  {
    activeId: null,
    counts: () => ({}),
    line: null,
    lines: () => ({}),
    traced: false,
    running: false,
    disabled: false,
    logs: () => [],
    tall: false
  }
)

const emit = defineEmits<{ edit: []; 'clear-logs': [] }>()

const view = ref<'program' | 'code'>('program')

const tabs = [
  { value: 'program', label: 'บล็อก' },
  { value: 'code', label: 'โค้ดที่ได้' }
]

const blocks = computed(() => props.author === 'blocks')
const showBlocks = computed(() => blocks.value && view.value === 'program')
const editLabel = computed(() => (blocks.value ? 'แก้บล็อก' : 'แก้โค้ด'))
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2">
    <slot name="header" />

    <UiTabs v-if="blocks" v-model="view" :tabs="tabs" />

    <BlockScript
      v-if="showBlocks"
      class="min-h-0"
      :class="tall ? 'max-h-[calc(100vh-24rem)]' : 'max-h-72'"
      :pack="pack"
      :program="program"
      :active-id="activeId"
      :counts="counts"
      :running="running"
    >
      <template #action>
        <UiButton size="sm" :disabled="disabled" @click="emit('edit')">{{ editLabel }}</UiButton>
      </template>
    </BlockScript>

    <BlockCodeView
      v-else
      :tall="tall"
      :short="true"
      :code="code"
      :line="line"
      :lines="lines"
      :running="running"
      :traced="traced"
    >
      <template v-if="!blocks" #action>
        <UiButton size="sm" :disabled="disabled" @click="emit('edit')">{{ editLabel }}</UiButton>
      </template>
    </BlockCodeView>

    <BlockConsole :lines="logs" :running="running" @clear="emit('clear-logs')" />
  </div>
</template>
