<script setup lang="ts">
import { BLACK } from '~/game/go/engine'
import type { GoLogEntry } from '~/composables/useGoGame'

/**
 * ประวัติการเดินของหมากล้อม — โครงเดียวกับของโอเทลโล
 * เลื่อนตามตาล่าสุดให้เอง จะได้ไม่ต้องไล่ลากเองระหว่างบอทเล่นกัน
 */
const props = defineProps<{ entries: GoLogEntry[] }>()

const list = ref<HTMLElement | null>(null)

watch(
  () => props.entries.length,
  async () => {
    await nextTick()
    if (list.value) list.value.scrollTop = list.value.scrollHeight
  }
)
</script>

<template>
  <div class="flex flex-col">
    <p v-if="entries.length === 0" class="rounded-xl bg-surface-muted px-3 py-6 text-center text-xs text-ink-subtle">
      ยังไม่มีการเดิน
    </p>

    <ol v-else ref="list" class="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
      <li
        v-for="(entry, index) in entries"
        :key="index"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
        :class="index === entries.length - 1 ? 'bg-primary-50' : 'hover:bg-surface-muted'"
      >
        <span class="w-7 shrink-0 text-right font-mono tabular-nums text-ink-subtle">{{ entry.turn }}</span>

        <span
          class="size-3 shrink-0 rounded-full"
          :class="
            entry.player === BLACK
              ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]'
              : 'border border-line-strong bg-white'
          "
        />

        <span class="w-8 font-mono font-medium text-ink">{{ entry.notation }}</span>

        <span class="truncate text-[11px] text-ink-subtle">
          {{ entry.pass ? 'ผ่านตา' : entry.captured > 0 ? `จับได้ ${entry.captured} เม็ด` : 'ลงหมาก' }}
        </span>
      </li>
    </ol>
  </div>
</template>
