<script setup lang="ts">
import type { BlockPack, BlockProgram } from '~/game/blocks/pack'
import type { Side } from '~/composables/useChaseGame'
import { hunterColor } from '~/game/chase/palette'

/** ใครเล่นฝ่ายนี้ — ฝ่ายไล่เป็นบอทเสมอ ส่วนฝ่ายหนีเลือกได้ */
export type Pilot = 'human' | 'bot'

export interface SideView {
  value: Side
  label: string
  pilot: Pilot
  /** เลือกได้ไหมว่าจะเล่นเองหรือให้บอทเล่น */
  choosable: boolean
  pack: BlockPack
  program: BlockProgram
  presetId: string
  locked: boolean
}

/**
 * สองฝ่ายของเกม วางเรียงให้เห็นพร้อมกัน
 * แถวไหนถูกเลือกอยู่ แผงบล็อกตรงกลางก็เป็นสมองของฝ่ายนั้น
 */
defineProps<{
  sides: SideView[]
  /** ฝ่ายที่กำลังแก้บล็อกอยู่ */
  side: Side
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:side': [side: Side]
  pilot: [side: Side, pilot: Pilot]
  preset: [side: Side, id: string]
}>()

const PILOTS: Array<{ value: Pilot; label: string }> = [
  { value: 'human', label: 'เล่นเอง' },
  { value: 'bot', label: 'บอท' }
]

const GHOST =
  'M -0.34 0.32 L -0.34 -0.04 A 0.34 0.34 0 0 1 0.34 -0.04 L 0.34 0.32 L 0.17 0.18 L 0 0.32 L -0.17 0.18 Z'
</script>

<template>
  <div class="grid gap-2.5 sm:grid-cols-2">
    <div
      v-for="item in sides"
      :key="item.value"
      class="rounded-xl p-3 transition-colors"
      :class="
        side === item.value
          ? 'bg-primary-50 ring-2 ring-primary-400'
          : 'bg-surface-muted ring-1 ring-line hover:ring-primary-200'
      "
    >
      <div class="flex items-center gap-2.5">
        <!-- ผีคือฝ่ายไล่ วงกลมดำคือฝ่ายหนี ให้ตรงกับตัวละครในสนาม -->
        <svg viewBox="-0.5 -0.5 1 1" class="size-6 shrink-0" aria-hidden="true">
          <path v-if="item.value === 'hunter'" :d="GHOST" :fill="hunterColor(0)" />
          <circle v-else r="0.36" fill="#1c1524" />
        </svg>

        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          :aria-pressed="side === item.value"
          @click="emit('update:side', item.value)"
        >
          <!-- ป้ายตกบรรทัดใหม่ได้ แต่ชื่อฝ่ายห้ามฉีกกลางคำ รางขวาแคบกว่าเกมอื่น -->
          <span class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span class="whitespace-nowrap text-sm font-semibold text-ink">{{ item.label }}</span>
            <span
              v-if="side === item.value"
              class="rounded-full bg-primary-600 px-1.5 py-0.5 text-[9px] font-medium text-white"
            >
              กำลังแก้อยู่
            </span>
          </span>
        </button>

        <UiInfo v-if="item.pilot === 'human'" label="ทำไมบล็อกชุดนี้ยังไม่ได้ลงสนาม">
          รอบนี้คุณบังคับเอง บล็อกชุดนี้จึงพักไว้ — เลือกอัลกอริทึมหรือแก้บล็อกของฝ่ายนี้เมื่อไร
          เกมจะสลับเป็น "บอท" ให้ทันที แล้วดูว่ามันเล่นแทนเราได้ดีแค่ไหน
        </UiInfo>

        <div v-if="item.choosable" class="flex shrink-0 rounded-full bg-surface p-0.5 ring-1 ring-line">
          <button
            v-for="pilot in PILOTS"
            :key="pilot.value"
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
            :class="
              item.pilot === pilot.value
                ? 'bg-primary-600 text-white shadow-soft'
                : 'text-ink-muted hover:text-primary-700'
            "
            :disabled="disabled"
            @click="emit('pilot', item.value, pilot.value)"
          >
            {{ pilot.label }}
          </button>
        </div>

        <span
          v-else
          class="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted ring-1 ring-line"
        >
          บอท
        </span>
      </div>

      <!-- แตะบล็อกของฝ่ายหนีเมื่อไร หน้าเกมจะสลับให้บอทเล่นเอง บล็อกที่เพิ่งเลือกจะได้ลงสนามจริง -->
      <BlockAlgorithmPicker
        bare
        class="mt-2.5"
        :pack="item.pack"
        :program="item.program"
        :preset-id="item.presetId"
        :locked="item.locked"
        :disabled="disabled"
        @preset="emit('preset', item.value, $event)"
      />


    </div>
  </div>
</template>
