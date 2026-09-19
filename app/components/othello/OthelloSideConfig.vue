<script setup lang="ts">
import { BLACK, type Player } from '~/game/othello/engine'
import type { MemoryInfo, SideConfig, SideKind } from '~/composables/useOthelloGame'
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'

const props = defineProps<{
  player: Player
  config: SideConfig
  /** ชื่อโปรแกรมที่ฝั่งนี้ใช้อยู่ */
  name: string
  /** บล็อกของฝั่งนี้ ใช้เลือกอัลกอริทึมตรงนี้เลย */
  pack: BlockPack
  program: BlockProgram
  presetId: string
  locked?: boolean
  /** โปรแกรมของฝั่งนี้จำอะไรข้ามเกมได้ไหม — จำเป็นต้องฝึกถึงจะเก่งขึ้น */
  learns?: boolean
  training?: boolean
  memory?: MemoryInfo | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:kind': [kind: SideKind]
  'update:preset': [id: string]
  'clear-memory': []
  train: []
}>()

const memorySize = computed(() =>
  props.memory ? `${(props.memory.bytes / 1024).toFixed(1)} KB` : ''
)

const isBlack = computed(() => props.player === BLACK)

const kinds: Array<{ value: SideKind; label: string }> = [
  { value: 'human', label: 'คน' },
  { value: 'code', label: 'บอท' }
]
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center gap-2.5">
      <span
        class="size-6 shrink-0 rounded-full shadow-soft"
        :class="isBlack ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]' : 'border border-line-strong bg-white'"
      />

      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-ink">{{ isBlack ? 'ดำ' : 'ขาว' }}</p>
        <p class="text-[11px] text-ink-subtle">{{ isBlack ? 'เดินก่อน' : 'เดินทีหลัง' }}</p>
      </div>

      <div class="flex rounded-full bg-surface p-0.5 ring-1 ring-line">
        <button
          v-for="kind in kinds"
          :key="kind.value"
          type="button"
          :disabled="disabled"
          class="rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
          :class="
            config.kind === kind.value
              ? 'bg-primary-600 text-white shadow-soft'
              : 'text-ink-muted hover:text-primary-700'
          "
          @click="emit('update:kind', kind.value)"
        >
          {{ kind.label }}
        </button>
      </div>
    </div>

    <div v-if="config.kind === 'code'" class="mt-2.5 space-y-2">
      <BlockAlgorithmPicker
        bare
        :pack="pack"
        :program="program"
        :preset-id="presetId"
        :locked="locked"
        :disabled="disabled"
        @preset="emit('update:preset', $event)"
      />

      <!-- ฝึกได้เฉพาะฝั่งที่โปรแกรมจำข้ามเกมได้ ฝั่งที่ไม่จำ ฝึกไปก็เหมือนเดิม -->
      <UiButton
        v-if="learns"
        variant="outline"
        size="sm"
        block
        :disabled="disabled || training"
        @click="emit('train')"
      >
        {{ training ? 'กำลังฝึกอยู่' : `ฝึกฝ่าย${isBlack ? 'ดำ' : 'ขาว'}` }}
      </UiButton>

      <div v-if="memory" class="flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 ring-1 ring-line">
        <svg viewBox="0 0 24 24" fill="none" class="size-3.5 shrink-0 text-primary-600" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="2" />
          <path d="M9 9h6v6H9z" fill="currentColor" />
        </svg>

        <p class="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          {{ memory.label || 'มีความจำบันทึกไว้' }}
        </p>

        <span class="shrink-0 text-[10px] tabular-nums text-ink-subtle">{{ memorySize }}</span>

        <button
          type="button"
          :disabled="disabled"
          class="shrink-0 text-[11px] font-medium text-ink-subtle transition-colors hover:text-primary-700 disabled:opacity-50"
          @click="emit('clear-memory')"
        >
          ล้าง
        </button>
      </div>
    </div>

    <p v-else class="mt-2.5 text-[11px] text-ink-subtle">คลิกบนกระดานเพื่อลงหมากในตาของฝั่งนี้</p>
  </div>
</template>
