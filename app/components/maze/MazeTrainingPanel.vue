<script setup lang="ts">
import type { MazeMemoryInfo, MazeTraining, MazeTrainingRound } from '~/composables/useMazeGame'

/**
 * การ์ดฝึกบอท — ให้โปรแกรมที่จำข้ามรอบได้ เดินรัว ๆ หลายรอบโดยไม่วาดภาพ
 *
 * คะแนนคือราคาของทางที่มดเดินจริงทั้งหมด (รวมวงวน) ยิ่งน้อยยิ่งดี
 * แท่งสีเขียวคือรอบที่ถึงทางออก แท่งสีแดงคือรอบที่เดินครบก้าวแล้วยังไม่ถึง
 * เส้นประคือราคาของทางที่ถูกที่สุดจริง ที่ Dijkstra หาได้เพราะเห็นแผนที่ทั้งใบ
 */
const props = defineProps<{
  training: MazeTraining
  memory: MazeMemoryInfo | null
  /** ราคาของทางที่ถูกที่สุดจริง — ไว้เทียบว่าฝูงเข้าใกล้แค่ไหน */
  optimal: number | null
  /** โปรแกรมนี้จำอะไรข้ามรอบไหม */
  learns: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ train: [runs: number]; stop: []; clear: [] }>()

const options = [10, 25, 50, 100]

/** ฝึกได้ครั้งละไม่เกินเท่านี้รอบ — เกินนี้กดซ้ำได้ ความจำสะสมต่อจากของเดิม */
const MAX_RUNS = 1000

const runs = ref(100)

/** พิมพ์เองได้ — ตัดให้อยู่ในช่วง 1 ถึง MAX_RUNS และเป็นจำนวนเต็ม */
const typed = computed({
  get: () => runs.value,
  set: (value: number) => {
    const whole = Math.round(Number(value))
    runs.value = Number.isFinite(whole) ? Math.min(MAX_RUNS, Math.max(1, whole)) : 1
  }
})

/** กราฟแสดงได้ไม่เกินนี้แท่ง — ฝึกหลายร้อยรอบจะรวมรอบที่ติดกันเป็นแท่งเดียว */
const MAX_BARS = 60

const rounds = computed(() => props.training.rounds)

const finishedTimes = computed(() => rounds.value.filter((round) => round.ok).map((round) => round.cost))

const bars = computed(() => {
  const list = rounds.value
  const size = Math.max(1, Math.ceil(list.length / MAX_BARS))
  const out: Array<{ value: number; ok: boolean; label: string }> = []

  for (let start = 0; start < list.length; start += size) {
    const chunk: MazeTrainingRound[] = list.slice(start, start + size)
    const done = chunk.filter((round) => round.ok)
    // แท่งที่รวมหลายรอบ: มีรอบที่ครบก็โชว์เวลาที่ดีที่สุดในกลุ่ม ไม่มีเลยก็เป็นแท่งแดง
    const value = done.length > 0 ? Math.min(...done.map((round) => round.cost)) : 0
    const where = chunk.length === 1 ? `รอบที่ ${start + 1}` : `รอบที่ ${start + 1}–${start + chunk.length}`
    const label =
      done.length > 0
        ? `${where}: ราคา ${value}`
        : `${where}: ไม่ถึงทางออก`
    out.push({ value, ok: done.length > 0, label })
  }

  return out
})

const slowest = computed(() => Math.max(1, props.optimal ?? 0, ...bars.value.map((bar) => bar.value)))

/** เส้นประของราคาที่ถูกที่สุดจริง เป็นเปอร์เซ็นต์ของความสูงกราฟ */
const optimalLine = computed(() => (props.optimal ? (props.optimal / slowest.value) * 100 : null))

const bestTime = computed(() => (finishedTimes.value.length > 0 ? Math.min(...finishedTimes.value) : null))

/** ราคาที่เดินจริงเฉลี่ย ของสิบตัวแรกกับสิบตัวหลัง — ถ้าฝูงเรียนรู้ได้ ตัวหลังต้องเดินวนน้อยลง */
const averageWalk = (list: MazeTrainingRound[]) => {
  const done = list.filter((round) => round.ok)
  return done.length > 0 ? Math.round(done.reduce((sum, round) => sum + round.cost, 0) / done.length) : null
}

const firstWalk = computed(() => averageWalk(rounds.value.slice(0, 10)))
const lastWalk = computed(() => averageWalk(rounds.value.slice(-10)))

/** ทางที่ถูกที่สุดที่ฝูงรู้จัก — ทางหลังตัดวงวนของมดที่ดีที่สุด */
const known = computed(() => {
  const list = rounds.value.map((round) => round.shortcut).filter((value): value is number => value !== null)
  return list.length > 0 ? Math.min(...list) : null
})

const percent = computed(() =>
  props.training.total === 0 ? 0 : Math.round((rounds.value.length / props.training.total) * 100)
)

const size = computed(() => (props.memory ? `${(props.memory.bytes / 1024).toFixed(1)} KB` : ''))
</script>

<template>
  <div class="mt-3 rounded-xl bg-surface-muted p-3">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
      ฝึกบอท
      <UiInfo label="การฝึกทำงานยังไง" align="left">
        ปล่อยมดทีละตัวบนเขาวงกตที่เปิดอยู่โดยไม่วาดภาพ ·
        สิ่งเดียวที่ส่งต่อข้ามรอบได้คือของที่โปรแกรมจำไว้เอง เช่นกลิ่นของฝูงมด ·
        เปลี่ยนแผนที่แล้วกลิ่นเก่าใช้ไม่ได้ ฝูงจะเริ่มใหม่เอง
      </UiInfo>
    </p>

    <p v-if="!learns" class="mt-2 text-[11px] leading-relaxed text-ink-muted">
      โปรแกรมนี้ไม่ได้จำอะไรข้ามรอบ ฝึกไปก็ไม่เก่งขึ้น — ลองตัวอย่าง "ฝูงมดหาทาง (ACO)"
      ที่มดทิ้งกลิ่นไว้ให้ตัวถัดไปตาม
    </p>

    <template v-else>
      <div class="mt-2.5 flex gap-1.5">
        <button
          v-for="option in options"
          :key="option"
          type="button"
          :disabled="training.running || disabled"
          class="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          :class="
            runs === option
              ? 'border-primary-400 bg-primary-50 text-primary-700'
              : 'border-line bg-surface text-ink-muted hover:border-primary-200'
          "
          @click="runs = option"
        >
          {{ option }}
        </button>

        <label class="flex w-16 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 focus-within:border-primary-400">
          <span class="sr-only">จำนวนรอบที่จะฝึก</span>
          <input
            v-model.lazy.number="typed"
            type="number"
            inputmode="numeric"
            min="1"
            :max="MAX_RUNS"
            :disabled="training.running || disabled"
            class="w-full min-w-0 bg-transparent py-1.5 text-center text-xs font-medium tabular-nums text-ink outline-none disabled:opacity-50"
          />
        </label>
      </div>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="text-[11px] tabular-nums text-ink-subtle">
          <template v-if="training.total > 0">
            {{ training.running ? 'กำลังฝึก' : 'ฝึกแล้ว' }} {{ rounds.length }} / {{ training.total }}
          </template>
        </span>

        <UiButton v-if="training.running" size="sm" variant="secondary" @click="emit('stop')">หยุด</UiButton>
        <UiButton v-else size="sm" :disabled="disabled" @click="emit('train', runs)">เริ่มฝึก</UiButton>
      </div>

      <div v-if="training.running" class="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div class="h-full rounded-full bg-primary-600 transition-[width] duration-300" :style="{ width: `${percent}%` }" />
      </div>

      <div v-if="rounds.length > 0" class="mt-3">
        <div
          class="relative flex h-16 items-end gap-px"
          role="img"
          :aria-label="`ราคาของทางจากการฝึก ${rounds.length} รอบ ถูกที่สุด ${bestTime === null ? 'ยังไม่มีมดถึงทางออก' : bestTime}`"
        >
          <div
            v-if="optimalLine !== null"
            class="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-subtle"
            :style="{ bottom: `${optimalLine}%` }"
          />
          <div
            v-for="(bar, index) in bars"
            :key="index"
            class="min-w-0 flex-1 rounded-t-sm"
            :class="bar.ok ? 'bg-emerald-400' : 'bg-rose-300'"
            :style="{ height: bar.ok ? `${Math.max(3, (bar.value / slowest) * 100)}%` : '100%' }"
            :title="bar.label"
          />
        </div>

        <p class="mt-1 text-[10px] text-ink-subtle">
          แท่งเขียว = ราคาที่มดเดินจริงรวมวงวน (ยิ่งเตี้ยยิ่งถูก) · แท่งแดง = ไม่ถึงทางออก ·
          เส้นประ = ทางที่ถูกที่สุดจริง{{ optimal ? ` (${optimal})` : '' }} — มดเดินวนระหว่างทางเสมอ แท่งจึงสูงกว่าเส้นประ
          <template v-if="bars.length < rounds.length"> · หนึ่งแท่ง = ราคาถูกสุดของ {{ Math.ceil(rounds.length / MAX_BARS) }} รอบที่ติดกัน</template>
        </p>

        <div class="mt-2 grid grid-cols-2 gap-2 text-center">
          <div class="rounded-lg bg-surface py-1.5">
            <p class="text-[10px] text-ink-subtle">เดินจริงเฉลี่ย 10 ตัวแรก → 10 ตัวหลัง</p>
            <p class="font-mono text-sm font-semibold tabular-nums text-ink">
              {{ firstWalk ?? '–' }} → {{ lastWalk ?? '–' }}
            </p>
          </div>
          <div class="rounded-lg bg-surface py-1.5">
            <p class="text-[10px] text-ink-subtle">ทางที่ฝูงรู้จัก / ถูกที่สุดจริง</p>
            <p class="font-mono text-sm font-semibold tabular-nums text-emerald-700">
              {{ known ?? '–' }} <span class="text-ink-subtle">/ {{ optimal ?? '–' }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="mt-2.5 flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
        <p class="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          <template v-if="memory">{{ memory.label || 'มีความจำบันทึกไว้' }} · {{ size }}</template>
          <template v-else>ยังไม่มีความจำ</template>
        </p>

        <button
          v-if="memory"
          type="button"
          :disabled="training.running || disabled"
          class="shrink-0 text-[11px] font-medium text-ink-subtle transition-colors hover:text-primary-700 disabled:opacity-50"
          @click="emit('clear')"
        >
          ล้าง
        </button>
      </div>

      <p
        v-if="training.error"
        class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800"
      >
        {{ training.error }}
      </p>
    </template>
  </div>
</template>
