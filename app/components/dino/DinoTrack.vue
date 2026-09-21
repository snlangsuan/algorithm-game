<script setup lang="ts">
import ground from '~/assets/dino/ground.png'
import plx1 from '~/assets/dino/plx-1.png'
import plx2 from '~/assets/dino/plx-2.png'
import plx3 from '~/assets/dino/plx-3.png'
import plx4 from '~/assets/dino/plx-4.png'
import plx5 from '~/assets/dino/plx-5.png'
import { BODY_X, GROUND, LAYERS, VIEW } from '~/game/dino/art'
import { ahead, metersOf, onGround, speedOf, visible, type Run } from '~/game/dino/engine'
import type { DinoStatus } from '~/composables/useDinoGame'

/**
 * ลู่วิ่ง — ฉากหลังห้าชั้นเลื่อนคนละความเร็ว (พารัลแลกซ์) พื้นเลื่อนเต็มความเร็ว
 *
 * ฉากหลังกับพื้นวาดด้วย CSS เพราะเป็นภาพที่ต่อกันไม่รู้จบ เลื่อนด้วย background-position ถูกกว่ามาก
 * ส่วนตัวละครกับสิ่งกีดขวางวาดใน SVG ที่ใช้พิกัดเดียวกับกติกาเป๊ะ ๆ ภาพจึงไม่มีทางหลุดจากกล่องชน
 */
const props = withDefaults(
  defineProps<{
    run: Run
    status: DinoStatus
    /** ลำดับของสิ่งกีดขวางที่โปรแกรมเปิดดูล่าสุด — ตีกรอบให้เห็นว่ามันคิดถึงตัวไหน */
    watched?: number[]
    /** สถิติของลู่นี้ (เมตร) — 0 คือยังไม่มี */
    best?: number
    /** ปิดป้ายบอกสถานะ — ใช้ตอนเอาลู่ไปวางเป็นภาพประกอบในหน้าความรู้ */
    quiet?: boolean
  }>(),
  { watched: () => [], best: 0, quiet: false }
)

const BACKDROPS: Record<string, string> = {
  'plx-1': plx1,
  'plx-2': plx2,
  'plx-3': plx3,
  'plx-4': plx4,
  'plx-5': plx5
}

const distance = computed(() => props.run.distance)

const speed = computed(() => speedOf(props.run))

const crashed = computed(() => props.run.over === 'crashed')

const done = computed(() => props.run.over === 'finished')

const running = computed(() => props.status === 'playing')

/** ฉากหลังแต่ละชั้น — เลื่อนช้ากว่าพื้นตามระยะห่างของมัน */
const layers = computed(() =>
  LAYERS.map((layer) => ({
    key: layer.file,
    image: BACKDROPS[layer.file]!,
    offset: -(distance.value * layer.pace)
  }))
)

const groundOffset = computed(() => -(distance.value % GROUND.width))

const scene = computed(() => visible(props.run))

/** ชิ้นที่โปรแกรมเปิดดู — ลำดับที่ส่งมานับจากชิ้นที่ใกล้ที่สุด */
const marked = computed(() => {
  const list = ahead(props.run)
  return new Set(
    props.watched.map((rank) => list[rank]?.id).filter((id): id is number => id !== undefined)
  )
})

/** ตำแหน่งบนจอของของที่อยู่ที่ x บนลู่ */
const screenX = (x: number) => BODY_X + (x - distance.value)

/** ปีกนกกระพือตามเวลาจริง ไม่ผูกกับเฟรมของฟิสิกส์ */
const beat = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const stopFlap = () => {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

watch(
  running,
  (on) => {
    stopFlap()
    if (!on) return
    timer = setInterval(() => {
      beat.value = beat.value + 1
    }, 70)
  },
  { immediate: true }
)

onBeforeUnmount(stopFlap)

const hint = computed(() => {
  if (props.quiet) return null
  if (props.status === 'idle') return 'กดเว้นวรรค หรือปุ่มลูกศรขึ้น เพื่อเริ่มวิ่ง'
  if (props.status === 'paused') return 'พักอยู่ — กดเว้นวรรคเพื่อวิ่งต่อ'
  return null
})

const meters = computed(() => metersOf(props.run.distance))

const score = computed(() => String(meters.value).padStart(5, '0'))
</script>

<template>
  <div
    class="relative isolate w-full overflow-hidden rounded-card shadow-lift ring-1 transition-shadow"
    :class="crashed ? 'ring-4 ring-rose-400' : done ? 'ring-4 ring-emerald-400' : 'ring-line'"
    :style="{ aspectRatio: `${VIEW.width} / ${VIEW.height}`, backgroundColor: '#cfeae0' }"
  >
    <!-- ฉากหลังห้าชั้น ยิ่งอยู่ไกลยิ่งเลื่อนช้า -->
    <div
      v-for="layer in layers"
      :key="layer.key"
      class="pointer-events-none absolute inset-0 bg-repeat-x"
      :style="{
        backgroundImage: `url(${layer.image})`,
        backgroundSize: 'auto 100%',
        backgroundPositionX: `${layer.offset}px`,
        imageRendering: 'pixelated'
      }"
    />

    <!--
      พื้นดิน เลื่อนเต็มความเร็วของลู่
      วางให้ "ผิวหญ้า" ของภาพตรงกับเส้นพื้นที่กติกาใช้เป๊ะ และคงสัดส่วนเดิมของภาพไว้
      ส่วนที่ล้นขอบล่างปล่อยให้ถูกตัดไป ดีกว่าบีบภาพให้เตี้ยลงจนหญ้าผิดรูป
    -->
    <div
      class="pointer-events-none absolute inset-x-0 bg-repeat-x"
      :style="{
        top: `${((VIEW.ground - GROUND.surface) / VIEW.height) * 100}%`,
        height: `${(GROUND.height / VIEW.height) * 100}%`,
        backgroundImage: `url(${ground})`,
        backgroundSize: 'auto 100%',
        backgroundPositionX: `${groundOffset}px`,
        imageRendering: 'pixelated'
      }"
    />

    <!-- ตัวละครกับสิ่งกีดขวาง วาดในพิกัดเดียวกับกติกา -->
    <svg
      class="absolute inset-0 h-full w-full"
      :viewBox="`0 0 ${VIEW.width} ${VIEW.height}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`วิ่งมาแล้ว ${meters} เมตร ระดับ ${run.level} ความเร็ว ${Math.round(speed)} พิกเซลต่อวินาที`"
    >
      <g v-for="item in scene" :key="item.id">
        <DinoObstacle
          :obstacle="item"
          :x="screenX(item.x)"
          :ground-y="VIEW.ground"
          :beat="beat"
        />

        <!-- กรอบประ = ชิ้นที่โปรแกรมกำลังจ้องอยู่ -->
        <rect
          v-if="marked.has(item.id)"
          :x="screenX(item.x) - 5"
          :y="VIEW.ground - item.box.bottom - item.box.height - 5"
          :width="item.box.width + 10"
          :height="item.box.height + 10"
          rx="4"
          fill="none"
          stroke="#7c3aed"
          stroke-width="2"
          stroke-dasharray="6 4"
        />
      </g>

      <DinoCharacter
        :x="BODY_X"
        :ground-y="VIEW.ground"
        :lift="run.y"
        :ducking="run.ducking && onGround(run)"
        :airborne="!onGround(run)"
        :crashed="crashed"
        :moving="running"
      />
    </svg>

    <!-- คะแนนมุมขวาบน — ฉากหลังเป็นป่าเข้ม ตัวเลขจึงต้องมีแผ่นรองไม่งั้นอ่านไม่ออก -->
    <div
      class="pointer-events-none absolute right-3 top-2 rounded-full bg-white/85 px-3 py-1 text-right shadow-soft"
    >
      <span class="font-mono text-base font-bold tabular-nums text-ink sm:text-xl">{{ score }}</span>
      <span class="ml-1 font-mono text-[10px] tabular-nums text-ink-muted">ม.</span>
      <span v-if="best > 0" class="ml-1.5 font-mono text-[10px] tabular-nums text-ink-subtle">
        สถิติ {{ best }}
      </span>
    </div>

    <!-- ความเร็วมุมซ้ายบน — ตัวเลขที่ทุกอย่างในเกมนี้ขึ้นอยู่กับมัน -->
    <div
      class="pointer-events-none absolute left-3 top-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted shadow-soft"
    >
      ระดับ <span class="font-mono font-bold text-primary-700">{{ run.level }}</span>
      <span class="mx-1 text-ink-subtle">·</span>
      <span class="font-mono font-bold text-primary-700">{{ Math.round(speed) }}</span>
      <span class="text-[10px]"> px/วิ</span>
    </div>

    <div
      v-if="hint"
      class="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4"
    >
      <span
        class="rounded-full bg-ink/85 px-4 py-2 text-center text-sm font-semibold text-white shadow-lift"
      >
        {{ hint }}
      </span>
    </div>

    <slot />
  </div>
</template>
