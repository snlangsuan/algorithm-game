<script setup lang="ts">
import { BLACK, WHITE, type Player } from '~/game/othello/engine'
import type { MemoryInfo } from '~/composables/useOthelloGame'

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
  ready: boolean

  side?: Player | null

  learners: Record<Player, boolean>
  names: Record<Player, string>
  memories: Record<Player, MemoryInfo | null>
}>()

const emit = defineEmits<{ start: [games: number, focus: Focus]; stop: []; clear: [player: Player] }>()

const options = [10, 25, 50]
const games = ref(25)
const focus = ref<Focus>('both')

const learners = computed(() =>
  ([BLACK, WHITE] as Player[]).filter((player) => props.learners[player])
)

watch(
  () => [props.side, props.learners[BLACK], props.learners[WHITE], open.value],
  () => {
    if (!open.value) return

    focus.value = props.side ?? learners.value[0] ?? 'both'
  },
  { immediate: true }
)

const choices = computed(() => [
  { value: BLACK as Focus, label: `ฝึกฝ่ายดำ`, hint: props.names[BLACK], learns: props.learners[BLACK] },
  { value: WHITE as Focus, label: `ฝึกฝ่ายขาว`, hint: props.names[WHITE], learns: props.learners[WHITE] },
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

const action = computed(() => (focus.value === 'both' ? 'เริ่มประลอง' : 'เริ่มฝึก'))

const size = (memory: MemoryInfo | null) => (memory ? `${(memory.bytes / 1024).toFixed(1)} KB` : '')

/**
 * ซ้อมแล้วได้อะไรกลับไปบ้าง — ดูจากสัดส่วนที่ฝั่งที่ฝึกชนะ
 *
 * ชนะเกือบทุกเกมหรือแพ้เกือบทุกเกม แปลว่าคู่ซ้อมไม่เหมาะ ไม่ใช่โปรแกรมไม่ดี
 * เพราะตัววัดของ GA คือคะแนนปลายเกม ถ้าผลออกมาเหมือนกันหมดทุกเกม มันก็ไม่รู้ว่าอะไรดีกว่าอะไร
 */
const sparring = computed(() => {
  const done = props.training.done
  const side = props.training.focus

  if (props.training.running || done < 10 || side === 'both') return null

  const wins = side === BLACK ? props.training.blackWins : props.training.whiteWins
  const rate = Math.round((wins / done) * 100)

  if (rate <= 10) {
    return `ซ้อม ${done} เกมแล้วชนะแค่ ${rate}% — คู่ซ้อมแข็งเกินไป แพ้หมดทุกเกมเหมือนกันจนบอทไม่รู้ว่าชุดน้ำหนักไหนดีกว่ากัน ลองสลับคู่ซ้อมเป็นตัวที่อ่อนกว่าก่อน ฝึกจนเก่งแล้วค่อยกลับมาวัดกับตัวนี้`
  }

  if (rate >= 90) {
    return `ซ้อม ${done} เกมแล้วชนะ ${rate}% — คู่ซ้อมอ่อนไปแล้ว ชนะหมดทุกเกมก็ไม่มีอะไรให้เรียนต่อ ลองสลับเป็นคู่ที่แข็งขึ้นอีกขั้น`
  }

  return null
})
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
              focus === choice.value
                ? 'border-primary-400 bg-primary-50'
                : 'border-line bg-surface hover:border-primary-200'
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

        <p
          v-if="focus !== 'both' && !learners.includes(focus as Player)"
          class="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-[11px] leading-relaxed text-ink-muted"
        >
          โปรแกรมของฝั่งนี้ไม่ได้เรียก "จำไว้ข้ามเกม" ฝึกไปก็ไม่เก่งขึ้น —
          ลองตัวอย่าง "วิวัฒนาการ (GA)" ที่จำน้ำหนักที่ดีที่สุดไว้ข้ามเกม
        </p>
      </div>

      <div>
        <p class="mb-1.5 text-xs font-medium text-ink-muted">จำนวนเกม</p>
        <div class="flex gap-2">
          <button
            v-for="option in options"
            :key="option"
            type="button"
            :disabled="training.running"
            class="flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            :class="
              games === option
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-line bg-surface text-ink-muted hover:border-primary-200'
            "
            @click="games = option"
          >
            {{ option }}
          </button>
        </div>
      </div>

      <div v-if="training.total > 0" class="space-y-2">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-ink-muted">{{ training.running ? 'กำลังทำงาน' : 'เสร็จแล้ว' }}</span>
          <span class="font-mono tabular-nums text-ink">{{ training.done }} / {{ training.total }}</span>
        </div>

        <div class="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            class="h-full rounded-full bg-primary-600 transition-[width] duration-300"
            :style="{ width: `${percent}%` }"
          />
        </div>

        <div class="grid grid-cols-3 gap-2 pt-1 text-center">
          <div class="rounded-xl bg-surface-muted py-2">
            <p class="text-[11px] text-ink-subtle">ดำชนะ</p>
            <p class="text-lg font-semibold tabular-nums text-ink">{{ training.blackWins }}</p>
          </div>
          <div class="rounded-xl bg-surface-muted py-2">
            <p class="text-[11px] text-ink-subtle">เสมอ</p>
            <p class="text-lg font-semibold tabular-nums text-ink">{{ training.draws }}</p>
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
              player === BLACK
                ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]'
                : 'border border-line-strong bg-white'
            "
          />

          <p class="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
            {{ memories[player]?.label || 'มีความจำบันทึกไว้' }}
          </p>

          <span class="shrink-0 text-[10px] tabular-nums text-ink-subtle">{{ size(memories[player]) }}</span>

          <button
            type="button"
            :disabled="training.running"
            class="shrink-0 text-[11px] font-medium text-ink-subtle transition-colors hover:text-primary-700 disabled:opacity-50"
            @click="emit('clear', player)"
          >
            ล้าง
          </button>
        </div>
      </div>

      <p
        v-if="training.error"
        class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
      >
        {{ training.error }}
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UiInfo label="การฝึกทำงานยังไง" align="left">
          ระหว่างฝึกจะคิดตาละ 40 ms · ฝึกซ้ำได้เรื่อย ๆ ความจำสะสมต่อจากของเดิม
        </UiInfo>

        <UiButton v-if="training.running" size="sm" variant="secondary" @click="emit('stop')">
          หยุด
        </UiButton>
        <UiButton v-else size="sm" :disabled="!ready" @click="emit('start', games, focus)">
          {{ action }}
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
