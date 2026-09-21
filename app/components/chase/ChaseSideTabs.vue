<script setup lang="ts">
import { SIDES, type HeroControl, type Side } from '~/composables/useChaseGame'

/**
 * สลับว่ากำลังแก้สมองของฝ่ายไหน — ทั้งสองฝ่ายมีชุดบล็อกของตัวเอง
 * ฝ่ายหนีจะถูกใช้จริงก็ต่อเมื่อไม่ได้เล่นเอง ตรงนี้จึงบอกไว้ด้วยว่าตอนนี้ใครคุมอยู่
 */
const props = defineProps<{
  side: Side
  control: HeroControl
  /** ชื่อโปรแกรมของแต่ละฝ่าย */
  names: Record<Side, string>
}>()

defineEmits<{ 'update:side': [side: Side] }>()

/** ฝ่ายไล่เป็นบอทเสมอ ส่วนฝ่ายหนีขึ้นกับว่าผู้เล่นเลือกอะไรไว้ */
const pilotOf = (which: Side) =>
  which === 'hunter' || props.control === 'agent' ? 'บอท' : 'เล่นเอง'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-2 shadow-soft">
    <span class="px-1 text-[11px] text-ink-subtle">กำลังแก้สมองของ</span>

    <div class="flex rounded-full bg-surface-sunken p-0.5">
      <button
        v-for="item in SIDES"
        :key="item.value"
        type="button"
        class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
        :class="side === item.value ? 'bg-primary-600 text-white shadow-soft' : 'text-ink-muted hover:text-primary-700'"
        @click="$emit('update:side', item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <p class="min-w-0 flex-1 truncate text-[11px] text-ink-subtle">
      <span class="text-ink">{{ names[side] }}</span>
      <span class="mx-1">·</span>
      <span :class="pilotOf(side) === 'บอท' ? 'text-emerald-700' : ''">{{ pilotOf(side) }}</span>
    </p>
  </div>
</template>
