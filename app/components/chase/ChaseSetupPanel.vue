<script setup lang="ts">
import { ARENAS, MAX_HUNTERS, MIN_HUNTERS, SPEED_LABEL, type Arena } from '~/game/chase/engine'

const props = defineProps<{
  arena: Arena
  hunters: number
  hunterSpeed: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  arena: [id: string]
  hunters: [count: number]
  speed: [value: number]
}>()

const arenaOptions = ARENAS.map((item) => ({ value: item.id, label: item.name }))

const arenaId = computed({
  get: () => props.arena.id,
  set: (value: string) => emit('arena', value)
})

const counts = Array.from({ length: MAX_HUNTERS - MIN_HUNTERS + 1 }, (_, index) => MIN_HUNTERS + index)

const speedNote = computed(
  () => SPEED_LABEL.find((item) => item.value === props.hunterSpeed)?.note ?? ''
)
</script>

<template>
  <!--
    สามค่าตั้งยืนเรียงกันเป็นสามคอลัมน์เท่ากัน — หัวข้อหน้าตาเดียวกัน ตัวควบคุมสูงเท่ากัน
    แถบปุ่มจึงใส่กรอบกับความสูงให้ตรงกับช่องเลือกสนาม ไม่งั้นแถวดูเบี้ยว
  -->
  <div class="grid gap-x-4 gap-y-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-3">
    <div>
      <div class="flex h-5 items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">สนาม</span>
        <UiInfo label="สนามนี้เป็นยังไง" align="left">{{ arena.note }}</UiInfo>
      </div>

      <UiSelect v-model="arenaId" class="mt-1.5" :options="arenaOptions" :disabled="disabled" />
    </div>

    <div>
      <div class="flex h-5 items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">จำนวนผู้ไล่ล่า</span>
        <span class="font-mono text-[11px] tabular-nums text-ink">{{ hunters }} ตัว</span>
      </div>

      <div class="mt-1.5 flex rounded-xl border border-line-strong bg-surface p-0.5">
        <button
          v-for="count in counts"
          :key="count"
          type="button"
          class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
          :class="hunters === count ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          :disabled="disabled"
          @click="emit('hunters', count)"
        >
          {{ count }}
        </button>
      </div>
    </div>

    <div>
      <div class="flex h-5 items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">ความเร็วผู้ไล่ล่า</span>
        <UiInfo label="ความเร็วระดับนี้เป็นยังไง">{{ speedNote }}</UiInfo>
      </div>

      <div class="mt-1.5 flex rounded-xl border border-line-strong bg-surface p-0.5">
        <button
          v-for="option in SPEED_LABEL"
          :key="option.value"
          type="button"
          class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
          :class="hunterSpeed === option.value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          :disabled="disabled"
          @click="emit('speed', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
