<script setup lang="ts">
import { BLACK, WHITE, type Player } from '~/game/go/engine'
import type { GoMemoryInfo } from '~/composables/useGoGame'

/**
 * หน้าต่าง "ฝึกบอท" — ให้บอทสองฝั่งเล่นกันเองรัว ๆ โดยไม่วาดกระดาน
 *
 * มีไว้เพื่อโปรแกรมที่จำของข้ามเกม (เช่นตัวอย่าง "ยิ่งเล่นยิ่งเก่ง") เพราะกว่าตำราเปิดหมาก
 * จะหนาพอใช้งานต้องผ่านหลายสิบเกม นั่งกดเล่นเองทีละเกมคงไม่ไหว
 */
type Focus = Player | 'both'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  training: {
    running: boolean
    done: number
    total: number
    blackWins: number
    whiteWins: number
    draws: number
    focus: Focus
    error: string | null
  }
  /** ทั้งสองฝั่งเป็นบอทหรือยัง — ฝึกได้เฉพาะตอนเป็นบอททั้งคู่ */
  ready: boolean
  /** ฝั่งที่กดปุ่มฝึกมา — ใช้ตั้งค่าเริ่มต้นให้ตรงกับที่ผู้ใช้ตั้งใจ */
  side?: Player | null
  /** ฝั่งไหนจำของข้ามเกมได้บ้าง — ฝั่งที่ไม่จำ ฝึกไปก็ไม่เก่งขึ้น */
  learners: Record<Player, boolean>
  names: Record<Player, string>
  memories: Record<Player, GoMemoryInfo | null>
}>()

const emit = defineEmits<{ start: [games: number, focus: Focus]; stop: []; clear: [player: Player] }>()

const options = [10, 25, 50]
const games = ref(25)
const focus = ref<Focus>('both')

const learnerSides = computed(() => ([BLACK, WHITE] as Player[]).filter((player) => props.learners[player]))

watch(
  () => [props.side, props.learners[BLACK], props.learners[WHITE], open.value],
  () => {
    if (!open.value) return
    focus.value = props.side ?? learnerSides.value[0] ?? 'both'
  },
  { immediate: true }
)

const choices = computed(() => [
  { value: BLACK as Focus, label: 'ฝึกฝ่ายดำ', hint: props.names[BLACK], learns: props.learners[BLACK] },
  { value: WHITE as Focus, label: 'ฝึกฝ่ายขาว', hint: props.names[WHITE], learns: props.learners[WHITE] },
  {
    value: 'both' as Focus,
    label: 'ฝึกพร้อมกันทั้งคู่',
    hint: 'ทั้งสองฝั่งจำผลไว้ — เก่งขึ้นพร้อมกัน แต่คู่ซ้อมขยับตลอด วัดผลยากกว่า',
    learns: true
  }
])

const percent = computed(() =>
  props.training.total === 0 ? 0 : Math.round((props.training.done / props.training.total) * 100)
)

/** เตือนเมื่อฝั่งที่เลือกฝึกไม่ได้จำอะไรเลย — ฝึกไปก็เท่าเดิม */
const sparring = computed(() => {
  if (focus.value === 'both') return null
  return props.learners[focus.value]
    ? null
    : 'ฝั่งนี้ใช้โปรแกรมที่ไม่ได้จำอะไรข้ามเกม ฝึกแล้วก็เล่นเหมือนเดิม — ลองเปลี่ยนเป็นตัวอย่าง "ยิ่งเล่นยิ่งเก่ง"'
})

const size = (memory: GoMemoryInfo | null | undefined) =>
  memory ? `${(memory.bytes / 1024).toFixed(1)} KB` : ''
</script>

<template>
  <UiModal
    v-model="open"
    title="ฝึกบอท"
    description="ให้บอทสองฝั่งเล่นกันเองรัว ๆ — ฝึกทีละฝั่งได้ ฝั่งที่ไม่ได้ฝึกจะเล่นด้วยแต่ไม่จำอะไรกลับไป"
  >
    <div class="space-y-4">
      <p v-if="!ready" class="rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
        ต้องตั้งให้ทั้งสองฝั่งเป็น "บอท" ก่อนถึงจะฝึกได้
      </p>

      <div v-else>
        <p class="mb-1.5 text-xs font-medium text-ink-muted">จะฝึกฝั่งไหน</p>

        <div class="space-y-1.5">
          <button
            v-for="choice in choices"
            :key="String(choice.value)"
            type="button"
            :disabled="training.running"
            class="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50"
            :class="
              focus === choice.value ? 'border-primary-400 bg-primary-50' : 'border-line bg-surface hover:border-primary-200'
            "
            @click="focus = choice.value"
          >
            <span
              v-if="choice.value !== 'both'"
              class="size-4 shrink-0 rounded-full"
              :class="
                choice.value === BLACK
                  ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]'
                  : 'border border-line-strong bg-white'
              "
            />
            <span v-else class="size-4 shrink-0 rounded-full bg-line-strong" />

            <span class="min-w-0 flex-1">
              <span class="block text-xs font-medium text-ink">{{ choice.label }}</span>
              <span class="block truncate text-[11px] text-ink-subtle">{{ choice.hint }}</span>
            </span>

            <span
              v-if="choice.value !== 'both' && !choice.learns"
              class="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-ink-subtle"
            >
              ไม่ได้จำอะไร
            </span>
          </button>
        </div>
      </div>

      <div v-if="ready">
        <p class="mb-1.5 text-xs font-medium text-ink-muted">ฝึกกี่เกม</p>

        <div class="flex gap-1.5">
          <button
            v-for="option in options"
            :key="option"
            type="button"
            :disabled="training.running"
            class="flex-1 rounded-xl px-2 py-2 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50"
            :class="
              games === option
                ? 'bg-primary-600 text-white ring-primary-700'
                : 'bg-surface text-ink-muted ring-line hover:text-primary-700'
            "
            @click="games = option"
          >
            {{ option }} เกม
          </button>
        </div>
      </div>

      <div v-if="training.total > 0" class="space-y-2">
        <div class="h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div class="h-full rounded-full bg-primary-500 transition-all" :style="{ width: `${percent}%` }" />
        </div>

        <p class="text-[11px] text-ink-subtle">ฝึกไปแล้ว {{ training.done }} จาก {{ training.total }} เกม</p>

        <div class="grid grid-cols-2 gap-2 text-center">
          <div class="rounded-xl bg-surface-muted py-2">
            <p class="text-[11px] text-ink-subtle">ดำชนะ</p>
            <p class="text-lg font-semibold tabular-nums text-ink">{{ training.blackWins }}</p>
          </div>
          <div class="rounded-xl bg-surface-muted py-2">
            <p class="text-[11px] text-ink-subtle">ขาวชนะ</p>
            <p class="text-lg font-semibold tabular-nums text-ink">{{ training.whiteWins }}</p>
          </div>
        </div>
      </div>

      <p
        v-if="sparring"
        class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800"
      >
        {{ sparring }}
      </p>

      <div v-if="memories[BLACK] || memories[WHITE]" class="space-y-1.5">
        <p class="text-xs font-medium text-ink-muted">ความจำที่สะสมไว้</p>

        <div
          v-for="player in [BLACK, WHITE]"
          :key="player"
          v-show="memories[player]"
          class="flex items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5"
        >
          <span
            class="size-3.5 shrink-0 rounded-full"
            :class="
              player === BLACK ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]' : 'border border-line-strong bg-white'
            "
          />

          <p class="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
            {{ memories[player]?.label || 'มีความจำบันทึกไว้' }}
          </p>

          <span class="shrink-0 text-[10px] tabular-nums text-ink-subtle">{{ size(memories[player]) }}</span>

          <button
            type="button"
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-ink-subtle transition-colors hover:bg-rose-50 hover:text-rose-700"
            @click="emit('clear', player)"
          >
            ล้าง
          </button>
        </div>
      </div>

      <p
        v-if="training.error"
        class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800"
      >
        {{ training.error }}
      </p>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <UiButton v-if="!training.running" :disabled="!ready" block @click="emit('start', games, focus)">
          เริ่มฝึก
        </UiButton>

        <UiButton v-else variant="outline" block @click="emit('stop')">หยุดฝึก</UiButton>
      </div>
    </template>
  </UiModal>
</template>
