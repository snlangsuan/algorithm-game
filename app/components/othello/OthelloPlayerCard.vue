<script setup lang="ts">
import { WHITE, type Player } from '~/game/othello/engine'
import type { SideConfig } from '~/composables/useOthelloGame'

const props = defineProps<{
  player: Player
  config: SideConfig
  /** ชื่อโปรแกรมที่ฝั่งนี้ใช้อยู่ */
  name: string
  active: boolean
  thinking: boolean
  align?: 'left' | 'right'
}>()

const isWhite = computed(() => props.player === WHITE)
const subtitle = computed(() => (props.config.kind === 'human' ? 'ผู้เล่น' : props.name))
const right = computed(() => props.align === 'right')
</script>

<template>
  <div
    class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-300"
    :class="[right ? 'flex-row-reverse text-right' : '', active ? 'bg-primary-50' : '']"
  >
    <span class="relative grid shrink-0 place-items-center">
      <span
        class="size-8 rounded-full shadow-soft"
        :class="isWhite ? 'border border-line-strong bg-white' : 'bg-gradient-to-br from-[#413354] to-[#1c1524]'"
      />
      <span v-if="thinking" class="absolute inset-0 animate-ping rounded-full ring-2 ring-primary-400" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-ink">{{ subtitle }}</p>
      <p class="truncate text-[11px] text-ink-subtle">
        {{ isWhite ? 'ขาว' : 'ดำ' }} · {{ config.kind === 'code' ? 'บอท' : 'คน' }}
      </p>
    </div>
  </div>
</template>
