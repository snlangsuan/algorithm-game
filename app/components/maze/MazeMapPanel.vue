<script setup lang="ts">
import { MAX_SIZE, MIN_SIZE, type MazeKind, type MazeOptions } from '~/game/maze/engine'

const props = defineProps<{ options: MazeOptions; disabled?: boolean; solvable: boolean }>()

const emit = defineEmits<{
  option: [field: keyof MazeOptions, value: number | MazeKind]
  shuffle: []
}>()

const kinds: Array<{ value: MazeKind; label: string; hint: string }> = [
  { value: 'perfect', label: 'เขาวงกตแท้', hint: 'ทางเดินกว้างช่องเดียว มีทางไปถึงทางออกทางเดียว' },
  { value: 'braid', label: 'เขาวงกตมีวงวน', hint: 'ทุบทางตันทิ้ง เกิดทางลัดหลายเส้นให้เลือก' },
  { value: 'obstacles', label: 'อุปสรรคสุ่ม', hint: 'ทุ่งโล่งที่โปรยกำแพงกระจาย ปรับความหนาแน่นได้' },
  { value: 'cavern', label: 'ถ้ำ', hint: 'โพรงกว้างที่เกลี่ยจนดูเป็นธรรมชาติ' }
]

const hint = computed(() => kinds.find((kind) => kind.value === props.options.kind)?.hint ?? '')

const usesDensity = computed(
  () => props.options.kind === 'obstacles' || props.options.kind === 'cavern'
)

const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="@container space-y-3">
    <div class="rounded-xl bg-surface-muted p-3">
      <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
        รูปแบบแผนที่
        <UiInfo label="แผนที่แบบนี้เป็นยังไง" align="left">{{ hint }}</UiInfo>
      </p>

      <div class="grid grid-cols-2 gap-1.5 @sm:grid-cols-4">
        <button
          v-for="kind in kinds"
          :key="kind.value"
          type="button"
          :disabled="disabled"
          class="rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
          :class="
            options.kind === kind.value
              ? 'border-primary-400 bg-primary-50 text-primary-700'
              : 'border-line bg-surface text-ink-muted hover:border-primary-200'
          "
          @click="emit('option', 'kind', kind.value)"
        >
          {{ kind.label }}
        </button>
      </div>
    </div>

    <div class="rounded-xl bg-surface-muted p-3">
      <div class="grid gap-3 @sm:grid-cols-2 @sm:gap-x-4">
        <label class="block">
          <span class="mb-1 flex items-baseline justify-between text-[11px] text-ink-muted">
            <span>กว้าง</span>
            <span class="font-mono tabular-nums text-ink">{{ options.width }} ช่อง</span>
          </span>
          <input
            type="range"
            :min="MIN_SIZE"
            :max="MAX_SIZE"
            step="2"
            :value="options.width"
            :disabled="disabled"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary-600 disabled:opacity-50"
            @change="emit('option', 'width', Number(($event.target as HTMLInputElement).value))"
          />
        </label>

        <label class="block">
          <span class="mb-1 flex items-baseline justify-between text-[11px] text-ink-muted">
            <span>สูง</span>
            <span class="font-mono tabular-nums text-ink">{{ options.height }} ช่อง</span>
          </span>
          <input
            type="range"
            :min="MIN_SIZE"
            :max="MAX_SIZE"
            step="2"
            :value="options.height"
            :disabled="disabled"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary-600 disabled:opacity-50"
            @change="emit('option', 'height', Number(($event.target as HTMLInputElement).value))"
          />
        </label>

        <label v-if="usesDensity" class="block">
          <span class="mb-1 flex items-baseline justify-between text-[11px] text-ink-muted">
            <span>ความหนาแน่นของกำแพง</span>
            <span class="font-mono tabular-nums text-ink">{{ percent(options.density) }}</span>
          </span>
          <input
            type="range"
            min="5"
            max="45"
            step="1"
            :value="Math.round(options.density * 100)"
            :disabled="disabled"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary-600 disabled:opacity-50"
            @change="emit('option', 'density', Number(($event.target as HTMLInputElement).value) / 100)"
          />
        </label>

        <label class="block">
          <span class="mb-1 flex items-baseline justify-between text-[11px] text-ink-muted">
            <span>โคลน (ก้าวละ 5)</span>
            <span class="font-mono tabular-nums text-ink">{{ percent(options.mud) }}</span>
          </span>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            :value="Math.round(options.mud * 100)"
            :disabled="disabled"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary-600 disabled:opacity-50"
            @change="emit('option', 'mud', Number(($event.target as HTMLInputElement).value) / 100)"
          />
        </label>

        <div class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1.5 text-[11px] text-ink-muted">
              เลข seed
              <UiInfo label="เลข seed มีไว้ทำไม" align="left">
                seed เดิมได้แผนที่เดิมเสมอ ใช้เทียบอัลกอริทึมบนสนามเดียวกันได้
              </UiInfo>
            </p>
            <p class="truncate font-mono text-xs tabular-nums text-ink">{{ options.seed }}</p>
          </div>

          <UiButton size="sm" variant="outline" :disabled="disabled" @click="emit('shuffle')">
            สุ่มใหม่
          </UiButton>
        </div>
      </div>
    </div>

    <p
      v-if="!solvable"
      class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800"
    >
      ตอนนี้ไม่มีเส้นทางจากจุดเริ่มไปถึงทางออกเลย — ลบกำแพงบางส่วนหรือสุ่มแผนที่ใหม่ก่อน
    </p>
  </div>
</template>
