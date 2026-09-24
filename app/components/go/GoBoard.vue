<script setup lang="ts">
import { BLACK, EMPTY, WHITE, type Player, type Position } from '~/game/go/engine'

/**
 * กระดานหมากล้อม — วาดด้วย SVG เป็น "เส้น" ไม่ใช่ "ช่อง"
 *
 * โกะลงหมากบนจุดตัดของเส้น ไม่ใช่ในช่องสี่เหลี่ยมแบบหมากรุก ตารางจึงเป็นเส้นตรงล้วน
 * แล้วเอาหมากไปวางทับจุดตัด พิกัดในกระดานคือ 1 หน่วย = ระยะห่างระหว่างเส้นหนึ่งคู่
 * ทำให้ viewBox ขยายตามขนาดกระดานได้เอง (9/13/19) โดยไม่ต้องคำนวณพิกเซลเลย
 *
 * ตัวกระดานกว้างเท่าคอลัมน์เสมอ ไม่มีแถบเลื่อนแนวนอน — 19×19 บนมือถือจึงยังกดถูกจุด
 */
const props = withDefaults(
  defineProps<{
    position: Position
    /** ตาล่าสุดที่เพิ่งลง — ใช้ปักหมุดให้เห็นว่าอีกฝ่ายเพิ่งเล่นตรงไหน */
    lastMove: { row: number; col: number } | 'pass' | null
    disabled?: boolean
    showCoords?: boolean
    /**
     * ช่องที่ลงได้ในตานี้ (ตำแหน่งแบน row * size + col)
     * ไม่ส่งมาก็ถือว่าช่องว่างทุกช่องกดได้ — หน้าเกมเป็นคนตัดสินกติกา ไม่ใช่กระดาน
     */
    legal?: number[] | Set<number>
    /** เจ้าของพื้นที่ตอนจบเกม — วาดเป็นเหลี่ยมจาง ๆ บนช่องว่าง */
    territory?: Record<number, Player>
  }>(),
  { disabled: false, showCoords: true, legal: undefined, territory: undefined }
)

const emit = defineEmits<{ play: [move: { row: number; col: number }] }>()

/** ตัวอักษรคอลัมน์แบบหนังสือโกะ — ข้าม I เพราะอ่านสลับกับ 1 ได้ง่าย */
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'

/**
 * สีของผืนพื้นที่ — ใช้คู่สีน้ำเงิน/ส้มแทนสีหมากจริง
 *
 * ระบายด้วยสีดำกับขาวตรง ๆ ไม่ได้ เพราะพื้นกระดานก็อ่อนอยู่แล้ว ผืนของฝ่ายขาวจะจมหายไป
 * ส่วนผืนสีเทาของฝ่ายดำก็แยกจากช่องที่ยังไม่มีเจ้าของไม่ออก · คู่น้ำเงิน-ส้มต่างกันชัด
 * ทั้งสองสี และต่างจากพื้นกระดานเปล่า คนตาบอดสีแดง-เขียวก็ยังแยกออก
 */
const AREA_BLACK = '#3b82f6'
const AREA_WHITE = '#f59e0b'

const size = computed(() => props.position.size)

/** ขอบรอบกระดาน — เผื่อที่ให้ตัวอักษรพิกัด ถ้าไม่โชว์ก็เหลือแค่กันหมากริมไม่ให้โดนตัด */
const margin = computed(() => (props.showCoords ? 0.95 : 0.6))

const viewBox = computed(() => {
  const span = size.value - 1 + margin.value * 2
  return `${-margin.value} ${-margin.value} ${span} ${span}`
})

const lines = computed(() => Array.from({ length: size.value }, (_, index) => index))

/**
 * จุดดาว (โฮชิ) — หมุดอ้างอิงที่ช่วยกะระยะบนกระดานเปล่า
 * ระยะขอบต่างกันตามขนาด: 9 ใช้เส้นที่ 3, 13 กับ 19 ใช้เส้นที่ 4 (นับจาก 1)
 */
const stars = computed<Array<{ row: number; col: number }>>(() => {
  const s = size.value
  const edge = s === 9 ? 2 : 3
  const mid = (s - 1) / 2
  const marks = s === 19 ? [edge, mid, s - 1 - edge] : [edge, s - 1 - edge]

  const out = marks.flatMap((row) => marks.map((col) => ({ row, col })))
  // กระดานเล็กมีดาวกลางดวงเดียว ส่วน 19 ได้ครบเก้าดวงจากตารางด้านบนอยู่แล้ว
  if (s !== 19) out.push({ row: mid, col: mid })

  return out
})

const stones = computed(() => {
  const board = props.position.board
  const s = size.value
  const out: Array<{ index: number; row: number; col: number; color: Player }> = []

  for (let index = 0; index < board.length; index++) {
    const cell = board[index]
    if (cell !== BLACK && cell !== WHITE) continue
    out.push({ index, row: Math.floor(index / s), col: index % s, color: cell as Player })
  }

  return out
})

/** ช่องที่กดได้จริงในตานี้ — เป็นทั้งเป้าคลิกและตัวกำหนดว่าจะโชว์เงาหมากตรงไหน */
const playable = computed(() => {
  if (props.disabled) return []

  const allowed = props.legal
    ? props.legal instanceof Set
      ? props.legal
      : new Set(props.legal)
    : null

  const board = props.position.board
  const s = size.value
  const out: Array<{ index: number; row: number; col: number }> = []

  for (let index = 0; index < board.length; index++) {
    if (board[index] !== EMPTY) continue
    if (allowed && !allowed.has(index)) continue
    out.push({ index, row: Math.floor(index / s), col: index % s })
  }

  return out
})

/** ทุกช่องที่มีเจ้าของ รวมช่องที่มีหมากอยู่ด้วย — ระบายเป็นผืนใหญ่ให้เห็นว่าใครกินพื้นที่ไหน */
const areas = computed(() => {
  if (!props.territory) return []

  const s = size.value
  return Object.entries(props.territory).map(([key, color]) => {
    const index = Number(key)
    return { index, row: Math.floor(index / s), col: index % s, color }
  })
})

const lastPoint = computed(() =>
  props.lastMove && props.lastMove !== 'pass' ? props.lastMove : null
)

const hovered = ref<{ row: number; col: number } | null>(null)

// เปลี่ยนตาแล้วเงาหมากเก่าต้องหาย ไม่งั้นค้างอยู่ตรงที่เพิ่งลงไปจนกว่าจะขยับเมาส์
watch(() => props.position, () => { hovered.value = null })

const notation = (row: number, col: number) => `${COLUMN_LETTERS[col] ?? '?'}${size.value - row}`
</script>

<template>
  <div class="mx-auto w-full max-w-[min(78vh,560px)] select-none">
    <svg
      :viewBox="viewBox"
      class="block w-full rounded-xl bg-surface-sunken shadow-soft ring-1 ring-line"
      role="img"
      :aria-label="`กระดานหมากล้อม ${size} × ${size}`"
      @pointerleave="hovered = null"
    >
      <defs>
        <radialGradient id="goStoneBlack" cx="34%" cy="28%" r="78%">
          <stop offset="0%" stop-color="#413354" />
          <stop offset="100%" stop-color="#1c1524" />
        </radialGradient>

        <radialGradient id="goStoneWhite" cx="34%" cy="28%" r="80%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#ece9f5" />
        </radialGradient>

        <!-- ผืนสีพื้นที่ต้องไม่ล้นกรอบกระดาน ช่องริมจึงถูกตัดครึ่งด้วย clip นี้ -->
        <clipPath id="goBoardClip">
          <rect x="0" y="0" :width="size - 1" :height="size - 1" />
        </clipPath>

        <filter id="goStoneShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0.05" stdDeviation="0.05" flood-color="#1c1524" flood-opacity="0.35" />
        </filter>
      </defs>

      <!--
        พื้นที่ที่แต่ละฝ่ายถือครอง — ระบายเป็นผืนติดกันทั้งอาณาเขต รวมช่องที่มีหมากอยู่ด้วย
        ไม่ใช้จุดเล็ก ๆ ต่อช่อง เพราะบนกระดาน 19×19 ช่องเล็กจนมองไม่ออกว่าผืนไหนเป็นของใคร
        วาดไว้ใต้เส้นกระดานกับหมาก เส้นและหมากจึงยังคมชัดอยู่ข้างบน
      -->
      <g v-if="areas.length > 0" clip-path="url(#goBoardClip)">
        <rect
          v-for="cell in areas"
          :key="`a${cell.index}`"
          :x="cell.col - 0.5"
          :y="cell.row - 0.5"
          width="1"
          height="1"
          :fill="cell.color === BLACK ? AREA_BLACK : AREA_WHITE"
          :opacity="cell.color === BLACK ? 0.26 : 0.3"
        />
      </g>

      <!-- ตารางเส้น + กรอบนอกที่หนากว่าเล็กน้อย ให้ขอบกระดานอ่านออกชัด -->
      <g stroke="#8c85a0" stroke-linecap="square">
        <line v-for="row in lines" :key="`h${row}`" x1="0" :y1="row" :x2="size - 1" :y2="row" stroke-width="0.035" />
        <line v-for="col in lines" :key="`v${col}`" :x1="col" y1="0" :x2="col" :y2="size - 1" stroke-width="0.035" />
        <rect x="0" y="0" :width="size - 1" :height="size - 1" fill="none" stroke-width="0.07" />
      </g>

      <circle v-for="star in stars" :key="`s${star.row}-${star.col}`" :cx="star.col" :cy="star.row" r="0.095" fill="#8c85a0" />

      <!-- หมากจริงบนกระดาน -->
      <g filter="url(#goStoneShadow)">
        <circle
          v-for="stone in stones"
          :key="stone.index"
          :cx="stone.col"
          :cy="stone.row"
          r="0.46"
          :fill="stone.color === BLACK ? 'url(#goStoneBlack)' : 'url(#goStoneWhite)'"
          :stroke="stone.color === BLACK ? 'none' : '#d9d2ee'"
          stroke-width="0.03"
        />
      </g>

      <!-- หมุดตาล่าสุด — สีตัดกับหมากที่อยู่ข้างใต้ -->
      <circle
        v-if="lastPoint"
        :cx="lastPoint.col"
        :cy="lastPoint.row"
        r="0.15"
        :fill="position.board[lastPoint.row * size + lastPoint.col] === BLACK ? '#ffffff' : '#7c3aed'"
      />

      <!-- เงาหมากที่กำลังจะลง โผล่เฉพาะช่องที่ลงได้จริง -->
      <circle
        v-if="hovered"
        :cx="hovered.col"
        :cy="hovered.row"
        r="0.44"
        :fill="position.toPlay === BLACK ? 'url(#goStoneBlack)' : 'url(#goStoneWhite)'"
        stroke="#7c3aed"
        stroke-width="0.05"
        opacity="0.55"
        class="pointer-events-none"
      />

      <!-- เป้าคลิก: มีเฉพาะช่องที่ลงได้ กดที่อื่นจึงเงียบสนิทโดยไม่ต้องเช็กซ้ำ -->
      <rect
        v-for="spot in playable"
        :key="`p${spot.index}`"
        :x="spot.col - 0.5"
        :y="spot.row - 0.5"
        width="1"
        height="1"
        fill="transparent"
        class="cursor-pointer"
        :aria-label="`ลงที่ ${notation(spot.row, spot.col)}`"
        @pointerenter="hovered = { row: spot.row, col: spot.col }"
        @click="emit('play', { row: spot.row, col: spot.col })"
      />

      <!-- พิกัดแบบหนังสือโกะ: ตัวอักษรใต้กระดาน ตัวเลขนับจากล่างขึ้นบนทางซ้าย -->
      <g v-if="showCoords" fill="#8c85a0" font-size="0.32" font-family="inherit">
        <text v-for="col in lines" :key="`c${col}`" :x="col" :y="size - 1 + 0.72" text-anchor="middle">
          {{ COLUMN_LETTERS[col] }}
        </text>
        <text v-for="row in lines" :key="`n${row}`" x="-0.42" :y="row" text-anchor="end" dominant-baseline="middle">
          {{ size - row }}
        </text>
      </g>
    </svg>

    <!-- คำอธิบายสีของผืนพื้นที่ — ไม่งั้นไม่มีทางรู้ว่าสีเหลืองคือของฝ่ายขาว -->
    <p v-if="areas.length > 0" class="mt-2 flex items-center justify-center gap-3 text-[11px] text-ink-subtle">
      <span class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm" :style="{ backgroundColor: AREA_BLACK, opacity: 0.5 }" />
        พื้นที่ของดำ
      </span>
      <span class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm" :style="{ backgroundColor: AREA_WHITE, opacity: 0.55 }" />
        พื้นที่ของขาว
      </span>
    </p>
  </div>
</template>
