<script setup lang="ts">
import type { DinoMemoryInfo, DinoTraining } from '~/composables/useDinoGame'
import type { DinoMemory } from '~/game/dino/agent'
import { downloadText, exportMemory, fileName, pickTextFile, readMemoryFile } from '~/game/blocks/transfer'

/**
 * การ์ดฝึกบอท — ให้โปรแกรมที่จำข้ามรอบได้ วิ่งรัว ๆ หลายรอบโดยไม่วาดภาพ
 *
 * กราฟแท่งคือระยะของแต่ละรอบเรียงตามลำดับ ถ้าโปรแกรมเรียนรู้ได้จริง แท่งจะสูงขึ้นไปทางขวา
 * ไม่ได้ขึ้นเรียบ ๆ เพราะทุกรอบสุ่มลู่ใหม่ และบางรอบก็ลองยีนที่แย่กว่าเดิม
 */
const props = defineProps<{
  training: DinoTraining
  memory: DinoMemoryInfo | null
  /** โปรแกรมนี้จำอะไรข้ามรอบไหม */
  learns: boolean
  courseName: string
  /** ชื่อโปรแกรมที่เลือกอยู่ — ใส่ไว้ในไฟล์ความจำ และตั้งเป็นชื่อไฟล์ */
  programName: string
  /** อ่านความจำทั้งก้อนตอนกดส่งออก */
  read: () => DinoMemory | null
  disabled?: boolean
}>()

const emit = defineEmits<{ train: [runs: number]; stop: []; clear: []; load: [memory: DinoMemory] }>()

const notice = ref<{ tone: 'ok' | 'warn'; text: string } | null>(null)

function exportFile() {
  const data = props.read()
  if (!data) return

  downloadText(exportMemory(data, 'dino', props.programName), fileName(props.programName, 'memory'))
  notice.value = { tone: 'ok', text: 'ส่งออกความจำเป็นไฟล์แล้ว' }
}

async function importFile() {
  const picked = await pickTextFile()
  if (!picked) return
  if (!picked.ok) {
    notice.value = { tone: 'warn', text: picked.message }
    return
  }

  const read = readMemoryFile(picked.value, 'dino', props.programName)
  if (!read.ok) {
    notice.value = { tone: 'warn', text: read.message }
    return
  }

  if (props.memory && !window.confirm('ความจำที่ฝึกไว้ตอนนี้จะถูกแทนที่ด้วยของในไฟล์ — ต่อเลยไหม?')) return

  emit('load', read.value as DinoMemory)
  notice.value = { tone: read.note ? 'warn' : 'ok', text: `นำเข้าความจำแล้ว${read.note ? ` · ${read.note}` : ''}` }
}

const options = [10, 25, 50, 100]

/** ฝึกได้ครั้งละไม่เกินเท่านี้รอบ — เกินนี้กดซ้ำได้ ความจำสะสมต่อจากของเดิม */
const MAX_RUNS = 1000

const runs = ref(25)

/** พิมพ์เองได้ — ตัดให้อยู่ในช่วง 1 ถึง MAX_RUNS และเป็นจำนวนเต็ม */
const typed = computed({
  get: () => runs.value,
  set: (value: number) => {
    const whole = Math.round(Number(value))
    runs.value = Number.isFinite(whole) ? Math.min(MAX_RUNS, Math.max(1, whole)) : 1
  }
})

/** กราฟแสดงได้ไม่เกินนี้แท่ง — ฝึกหลายร้อยรอบจะรวมรอบที่ติดกันเป็นแท่งเดียว (ค่าเฉลี่ย) */
const MAX_BARS = 60

const meters = computed(() => props.training.meters)

const bars = computed(() => {
  const list = meters.value
  const size = Math.max(1, Math.ceil(list.length / MAX_BARS))
  const out: Array<{ value: number; label: string }> = []

  for (let start = 0; start < list.length; start += size) {
    const chunk = list.slice(start, start + size)
    const value = Math.round(chunk.reduce((sum, item) => sum + item, 0) / chunk.length)
    const label =
      chunk.length === 1
        ? `รอบที่ ${start + 1}: ${value.toLocaleString()} ม.`
        : `รอบที่ ${start + 1}–${start + chunk.length}: เฉลี่ย ${value.toLocaleString()} ม.`
    out.push({ value, label })
  }

  return out
})

const tallest = computed(() => Math.max(1, ...bars.value.map((bar) => bar.value)))

/** เฉลี่ยห้ารอบแรกเทียบห้ารอบหลัง — ตัวเลขเดียวที่บอกว่าฝึกแล้วดีขึ้นไหม */
const average = (list: number[]) =>
  list.length === 0 ? 0 : Math.round(list.reduce((sum, value) => sum + value, 0) / list.length)

const first = computed(() => average(meters.value.slice(0, 5)))
const last = computed(() => average(meters.value.slice(-5)))

const percent = computed(() =>
  props.training.total === 0 ? 0 : Math.round((meters.value.length / props.training.total) * 100)
)

const size = computed(() => (props.memory ? `${(props.memory.bytes / 1024).toFixed(1)} KB` : ''))
</script>

<template>
  <div class="mt-3 rounded-xl bg-surface-muted p-3">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
      ฝึกบอท
      <UiInfo label="การฝึกทำงานยังไง" align="left">
        วิ่งรัว ๆ บน{{ courseName }}โดยไม่วาดภาพ แต่ละรอบสุ่มลู่ใหม่ ·
        สิ่งเดียวที่ส่งต่อข้ามรอบได้คือของที่โปรแกรมสั่ง "จำไว้ข้ามเกม" เอง ·
        ฝึกซ้ำได้เรื่อย ๆ ความจำสะสมต่อจากของเดิม
      </UiInfo>
    </p>

    <p v-if="!learns" class="mt-2 text-[11px] leading-relaxed text-ink-muted">
      โปรแกรมนี้ไม่ได้ใช้บล็อก "จำไว้ข้ามเกม" ฝึกไปก็ไม่เก่งขึ้น —
      ลองตัวอย่าง "วิวัฒนาการหาจังหวะ (GA)" ที่จำยีนที่ดีที่สุดไว้ข้ามรอบ
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

        <label class="flex flex-1 items-center gap-1 rounded-lg border border-line bg-surface px-2 focus-within:border-primary-400">
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

      <p class="mt-1 text-[10px] text-ink-subtle">
        ฝึก {{ runs.toLocaleString() }} รอบ · พิมพ์เองได้ 1–{{ MAX_RUNS.toLocaleString() }} รอบ
      </p>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="text-[11px] tabular-nums text-ink-subtle">
          <template v-if="training.total > 0">
            {{ training.running ? 'กำลังฝึก' : 'ฝึกแล้ว' }} {{ meters.length }} / {{ training.total }}
          </template>
        </span>

        <UiButton v-if="training.running" size="sm" variant="secondary" @click="emit('stop')">หยุด</UiButton>
        <UiButton v-else size="sm" :disabled="disabled" @click="emit('train', runs)">เริ่มฝึก</UiButton>
      </div>

      <div v-if="training.running" class="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div class="h-full rounded-full bg-primary-600 transition-[width] duration-300" :style="{ width: `${percent}%` }" />
      </div>

      <div v-if="meters.length > 0" class="mt-3">
        <div
          class="flex h-16 items-end gap-px"
          role="img"
          :aria-label="`ระยะของการฝึก ${meters.length} รอบ ตั้งแต่ ${first.toLocaleString()} ถึง ${last.toLocaleString()} เมตรโดยเฉลี่ย`"
        >
          <div
            v-for="(bar, index) in bars"
            :key="index"
            class="min-w-0 flex-1 rounded-t-sm bg-primary-400"
            :style="{ height: `${Math.max(3, (bar.value / tallest) * 100)}%` }"
            :title="bar.label"
          />
        </div>

        <p v-if="bars.length < meters.length" class="mt-1 text-[10px] text-ink-subtle">
          หนึ่งแท่ง = ค่าเฉลี่ย {{ Math.ceil(meters.length / MAX_BARS) }} รอบที่ติดกัน
        </p>

        <div class="mt-2 grid grid-cols-2 gap-2 text-center">
          <div class="rounded-lg bg-surface py-1.5">
            <p class="text-[10px] text-ink-subtle">เฉลี่ย 5 รอบแรก</p>
            <p class="font-mono text-sm font-semibold tabular-nums text-ink">{{ first.toLocaleString() }} ม.</p>
          </div>
          <div class="rounded-lg bg-surface py-1.5">
            <p class="text-[10px] text-ink-subtle">เฉลี่ย 5 รอบหลัง</p>
            <p class="font-mono text-sm font-semibold tabular-nums text-ink">{{ last.toLocaleString() }} ม.</p>
          </div>
        </div>
      </div>

      <div class="mt-2.5 flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
        <p class="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          <template v-if="memory">{{ memory.label || 'มีความจำบันทึกไว้' }} · {{ size }}</template>
          <template v-else>ยังไม่มีความจำ</template>
        </p>

        <button
          v-for="action in [
            { label: 'นำเข้า', show: true, run: importFile },
            { label: 'ส่งออก', show: !!memory, run: exportFile },
            { label: 'ล้าง', show: !!memory, run: () => emit('clear') }
          ].filter((item) => item.show)"
          :key="action.label"
          type="button"
          :disabled="training.running || disabled"
          class="shrink-0 text-[11px] font-medium text-ink-subtle transition-colors hover:text-primary-700 disabled:opacity-50"
          @click="action.run"
        >
          {{ action.label }}
        </button>
      </div>

      <p
        v-if="notice"
        role="status"
        class="mt-1.5 text-[11px] leading-relaxed"
        :class="notice.tone === 'ok' ? 'text-ink-subtle' : 'text-amber-700'"
      >
        {{ notice.text }}
      </p>

      <p
        v-if="training.error"
        class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800"
      >
        {{ training.error }}
      </p>
    </template>
  </div>
</template>
