<script setup lang="ts">
import { MAX_DISKS, MIN_DISKS, optimalMoves } from '~/game/hanoi/engine'

const props = defineProps<{ disks: number; disabled?: boolean }>()

const emit = defineEmits<{ disks: [value: number] }>()

const best = computed(() => optimalMoves(props.disks))

const next = computed(() => optimalMoves(Math.min(MAX_DISKS, props.disks + 1)))
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-baseline justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        โจทย์
        <UiInfo label="ทำไมเพิ่มจานแล้วงานหนักขึ้นมาก" align="left">
          จานทุกใบที่เพิ่มเข้าไป ทำให้จำนวนตาที่น้อยที่สุดเพิ่มขึ้นเท่าตัว —
          {{ disks }} ใบต้องย้าย 2<sup>{{ disks }}</sup> − 1 ตา เพิ่มอีกใบเดียวก็เป็น
          {{ next.toLocaleString() }} ตาแล้ว
        </UiInfo>
      </p>
      <p class="font-mono text-[11px] tabular-nums text-ink-subtle">{{ disks }} ใบ</p>
    </div>

    <input
      class="mt-2 w-full accent-primary-600"
      type="range"
      :min="MIN_DISKS"
      :max="MAX_DISKS"
      step="1"
      :value="disks"
      :disabled="disabled"
      @input="emit('disks', Number(($event.target as HTMLInputElement).value))"
    />

    <div class="mt-1 flex justify-between font-mono text-[10px] text-ink-subtle">
      <span>{{ MIN_DISKS }}</span>
      <span>{{ MAX_DISKS }}</span>
    </div>

    <p class="mt-2 text-[11px] text-ink-subtle">
      ต้องย้ายอย่างน้อย
      <span class="font-mono tabular-nums text-ink">{{ best.toLocaleString() }}</span> ตา
    </p>
  </div>
</template>
