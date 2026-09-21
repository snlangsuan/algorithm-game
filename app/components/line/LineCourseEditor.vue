<script setup lang="ts">
import {
  LINE_WIDTH,
  PAINT_LABEL,
  VIEW,
  buildTrack,
  checkCourse,
  segmentsOf,
  type Course,
  type Paint,
  type Point
} from '~/game/line/engine'
import { MAX_NAME, MAX_POINTS, customCourse, newCourseId } from '~/game/line/custom'

/**
 * หน้าวาดสนามเอง — คลิกวางจุด ลากจุดย้าย คลิกท่อนเส้นเพื่อระบายสี
 *
 * ท่อนที่ i คือเส้นจากจุดที่ i ไปจุดถัดไป สีจึงผูกกับจุดเริ่มของท่อน
 * ทุกครั้งที่แก้ จะตรวจด้วยกติกาเดียวกับที่เอนจินใช้ (checkCourse) บันทึกได้ก็ต่อเมื่อสนามวิ่งได้จริง
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** สนามที่กำลังแก้ — null คือวาดใหม่ */
  initial: Course | null
  /** สนามที่คัดลอกมาเป็นจุดตั้งต้นได้ */
  templates: Course[]
}>()

const emit = defineEmits<{ save: [course: Course]; remove: [id: string] }>()

type Tool = 'point' | Paint | 'erase'

const TOOLS: Array<{ value: Tool; label: string; hint: string }> = [
  { value: 'point', label: 'วาง/ลากจุด', hint: 'คลิกที่ว่างเพื่อต่อจุดใหม่ท้ายเส้น · คลิกบนเส้นเพื่อแทรกจุด · ลากจุดเพื่อย้าย' },
  { value: 'black', label: PAINT_LABEL.black, hint: 'คลิกท่อนเส้นเพื่อเปลี่ยนเป็นเส้นดำปกติ' },
  { value: 'red', label: PAINT_LABEL.red, hint: 'คลิกท่อนเส้นเพื่อทำเป็นโซนแดง — ในโซนแดงห้ามวิ่งเร็วเกิน 120 px/วิ' },
  { value: 'gap', label: PAINT_LABEL.gap, hint: 'คลิกท่อนเส้นเพื่อลบเส้นช่วงนั้นออก เซนเซอร์จะมองไม่เห็นอะไรเลย' },
  { value: 'erase', label: 'ลบจุด', hint: 'คลิกที่จุดเพื่อลบทิ้ง (ใช้เครื่องมืออื่นอยู่ก็คลิกขวาที่จุดเพื่อลบได้)' }
]

const STROKE: Record<Paint, string> = { black: '#1c1524', red: '#e11d48', gap: '#b9b0a0' }

const SNAP = 10

const points = ref<Point[]>([])
const paint = ref<Paint[]>([])
const smooth = ref(true)
const name = ref('')
const tool = ref<Tool>('point')
const template = ref('')

const svg = ref<SVGSVGElement | null>(null)
let dragging: number | null = null

function load(from: Course | null, keepName = false): void {
  points.value = from ? from.points.map((at) => ({ ...at })) : []
  paint.value = from ? from.points.map((_, index) => from.paint?.[index] ?? 'black') : []
  smooth.value = from?.smooth ?? true
  if (!keepName) name.value = from?.custom ? from.name : ''
}

// เปิดหน้าวาดใหม่ทุกครั้ง ก็เริ่มจากสนามที่ส่งมา (หรือว่างเปล่า) — ไม่ค้างของที่วาดทิ้งไว้รอบก่อน
watch(open, (now) => {
  if (!now) return
  load(props.initial)
  tool.value = 'point'
  template.value = ''
})

const templateOptions = computed(() => [
  { value: '', label: 'เริ่มจากสนามที่มีอยู่…' },
  ...props.templates.map((item) => ({ value: item.id, label: item.name }))
])

watch(template, (id) => {
  const found = props.templates.find((item) => item.id === id)
  if (found) load(found, true)
})

const draft = computed<Course>(() =>
  customCourse({
    id: props.initial?.id ?? 'custom-draft',
    name: name.value,
    points: points.value,
    paint: paint.value,
    smooth: smooth.value
  })
)

const problem = computed(() => (points.value.length === 0 ? null : checkCourse(draft.value)))

const segments = computed(() =>
  points.value.length < 2
    ? []
    : segmentsOf(draft.value).map((line, index) => ({
        index,
        paint: paint.value[index] ?? 'black',
        d: `M ${line.map((at) => `${at.x.toFixed(1)} ${at.y.toFixed(1)}`).join(' L ')}`
      }))
)

const length = computed(() => {
  if (points.value.length < 3) return 0
  try {
    return Math.round(buildTrack(draft.value).length)
  } catch {
    return 0
  }
})

const full = computed(() => points.value.length >= MAX_POINTS)

/** ตำแหน่งบนสนาม (พิกัดเดียวกับเอนจิน) ของจุดที่ชี้อยู่ — ปัดเข้าตารางทีละ 10 พิกเซล */
function toField(event: PointerEvent): Point | null {
  const matrix = svg.value?.getScreenCTM()
  if (!matrix) return null

  const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  const clamp = (value: number, max: number) => Math.max(SNAP, Math.min(max - SNAP, Math.round(value / SNAP) * SNAP))
  return { x: clamp(at.x, VIEW.width), y: clamp(at.y, VIEW.height) }
}

function onFloor(event: PointerEvent): void {
  if (tool.value !== 'point' || full.value) return
  const at = toField(event)
  if (!at) return

  points.value = [...points.value, at]
  paint.value = [...paint.value, 'black']
}

function onSegment(event: PointerEvent, index: number): void {
  if (tool.value === 'point') {
    if (full.value) return
    const at = toField(event)
    if (!at) return

    // แทรกจุดกลางท่อน — ท่อนใหม่ที่เกิดขึ้นได้สีเดียวกับท่อนเดิม
    points.value = [...points.value.slice(0, index + 1), at, ...points.value.slice(index + 1)]
    paint.value = [...paint.value.slice(0, index + 1), paint.value[index] ?? 'black', ...paint.value.slice(index + 1)]
    return
  }

  if (tool.value === 'erase') return
  paint.value = paint.value.map((value, at) => (at === index ? (tool.value as Paint) : value))
}

/** ลบจุดนั้นทิ้ง — ใช้ได้ทั้งเครื่องมือลบจุด และคลิกขวาที่จุดตอนใช้เครื่องมืออื่น */
function removePoint(index: number): void {
  points.value = points.value.filter((_, at) => at !== index)
  paint.value = paint.value.filter((_, at) => at !== index)
}

function onHandle(event: PointerEvent, index: number): void {
  if (tool.value === 'erase') {
    removePoint(index)
    return
  }

  dragging = index
  svg.value?.setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent): void {
  if (dragging === null) return
  const at = toField(event)
  if (!at) return
  points.value = points.value.map((point, index) => (index === dragging ? at : point))
}

function onUp(): void {
  dragging = null
}

function undo(): void {
  points.value = points.value.slice(0, -1)
  paint.value = paint.value.slice(0, -1)
}

function clear(): void {
  points.value = []
  paint.value = []
}

function save(): void {
  if (problem.value || points.value.length === 0) return

  emit(
    'save',
    customCourse({
      id: props.initial?.id ?? newCourseId(),
      name: name.value,
      points: points.value,
      paint: paint.value,
      smooth: smooth.value
    })
  )
  open.value = false
}

function remove(): void {
  if (!props.initial) return
  emit('remove', props.initial.id)
  open.value = false
}

const toolHint = computed(() => TOOLS.find((item) => item.value === tool.value)?.hint ?? '')
</script>

<template>
  <UiModal
    v-model="open"
    full
    :title="initial ? `แก้สนาม: ${initial.name}` : 'วาดสนามเอง'"
    description="หุ่นออกตัวที่จุดสีเขียว วิ่งตามลำดับจุด แล้ววนกลับมาจุดแรก"
  >
    <div class="flex flex-col gap-3 p-4 sm:p-5">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap rounded-full bg-surface-sunken p-0.5" role="group" aria-label="เครื่องมือวาด">
          <button
            v-for="item in TOOLS"
            :key="item.value"
            type="button"
            class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
            :class="tool === item.value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
            @click="tool = item.value"
          >
            <span
              v-if="item.value === 'black' || item.value === 'red' || item.value === 'gap'"
              class="inline-block h-1.5 w-4 rounded-full"
              :style="{
                background: item.value === 'gap' ? 'transparent' : STROKE[item.value],
                border: item.value === 'gap' ? '1.5px dashed #b9b0a0' : 'none'
              }"
            />
            {{ item.label }}
          </button>
        </div>

        <div class="flex rounded-full bg-surface-sunken p-0.5">
          <button
            v-for="option in [
              { value: true, label: 'โค้งมน' },
              { value: false, label: 'มุมคม' }
            ]"
            :key="option.label"
            type="button"
            class="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
            :class="smooth === option.value ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'"
            @click="smooth = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <UiSelect v-model="template" class="w-48" :options="templateOptions" />
      </div>

      <p class="text-[11px] text-ink-subtle">{{ toolHint }}</p>

      <div
        class="relative w-full overflow-hidden rounded-card bg-[#f7f5f0] ring-1 ring-line"
        :style="{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }"
      >
        <svg
          ref="svg"
          class="absolute inset-0 h-full w-full touch-none select-none"
          :viewBox="`0 0 ${VIEW.width} ${VIEW.height}`"
          :class="tool === 'point' ? 'cursor-crosshair' : 'cursor-pointer'"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <defs>
            <pattern id="line-editor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e7e2d8" stroke-width="1" />
            </pattern>
          </defs>

          <rect :width="VIEW.width" :height="VIEW.height" fill="url(#line-editor-grid)" @pointerdown="onFloor" />

          <g v-for="segment in segments" :key="segment.index">
            <path
              :d="segment.d"
              fill="none"
              :stroke="STROKE[segment.paint]"
              :stroke-width="segment.paint === 'gap' ? 3 : LINE_WIDTH"
              :stroke-dasharray="segment.paint === 'gap' ? '2 7' : undefined"
              stroke-linecap="round"
              stroke-linejoin="round"
              pointer-events="none"
            />
            <!-- เส้นใสหนา ๆ ทับไว้ให้คลิกโดนง่าย -->
            <path
              :d="segment.d"
              fill="none"
              stroke="transparent"
              stroke-width="22"
              class="hover:stroke-primary-300/40"
              @pointerdown.stop="onSegment($event, segment.index)"
            />
          </g>

          <g
            v-for="(point, index) in points"
            :key="index"
            class="cursor-grab"
            @pointerdown.stop="onHandle($event, index)"
            @contextmenu.prevent="removePoint(index)"
          >
            <circle
              :cx="point.x"
              :cy="point.y"
              r="11"
              :fill="index === 0 ? '#10b981' : '#ffffff'"
              :stroke="tool === 'erase' ? '#e11d48' : '#7c3aed'"
              stroke-width="2.5"
            />
            <text
              :x="point.x"
              :y="point.y + 4"
              text-anchor="middle"
              class="pointer-events-none select-none font-mono text-[11px] font-bold"
              :fill="index === 0 ? '#ffffff' : '#4c1d95'"
            >
              {{ index + 1 }}
            </text>
          </g>
        </svg>

        <div
          v-if="points.length === 0"
          class="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center"
        >
          <p class="max-w-sm rounded-2xl bg-white/90 px-4 py-3 text-sm text-ink-muted shadow-soft">
            คลิกบนพื้นเพื่อวางจุดทีละจุด เส้นจะลากผ่านจุดตามลำดับแล้ววนกลับมาจุดแรกเอง ·
            หรือเลือก "เริ่มจากสนามที่มีอยู่" แล้วดัดต่อ
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-48 flex-1">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">ชื่อสนาม</span>
          <input
            v-model="name"
            type="text"
            :maxlength="MAX_NAME"
            placeholder="สนามของฉัน"
            class="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
        </label>

        <p class="text-[11px] text-ink-subtle">
          {{ points.length }}/{{ MAX_POINTS }} จุด<template v-if="length > 0"> · ยาว {{ length.toLocaleString() }} พิกเซล</template>
        </p>
      </div>

      <p
        v-if="problem"
        class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
      >
        {{ problem }}
      </p>
      <p
        v-else-if="points.length > 0"
        class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
      >
        สนามนี้วิ่งได้ — บันทึกแล้วจะอยู่ในรายการ "สนามของฉัน" ในเครื่องนี้
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <UiButton size="sm" :disabled="points.length === 0 || problem !== null" @click="save">บันทึกสนาม</UiButton>
        <UiButton size="sm" variant="outline" :disabled="points.length === 0" @click="undo">ย้อนจุดล่าสุด</UiButton>
        <UiButton size="sm" variant="outline" :disabled="points.length === 0" @click="clear">ล้างทั้งหมด</UiButton>
        <UiButton v-if="initial" size="sm" variant="secondary" class="ml-auto" @click="remove">ลบสนามนี้</UiButton>
      </div>
    </div>
  </UiModal>
</template>
