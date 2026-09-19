<script setup lang="ts">
import { MUD, WALL, type Maze, type Point } from '~/game/maze/engine'

const props = withDefaults(
  defineProps<{
    maze: Maze
    /** ช่องที่โค้ดสำรวจ เรียงตามลำดับ */
    explored: Point[]
    /** ระบายไปแล้วกี่ช่อง */
    exploredShown: number
    /** เส้นทางเต็ม index 0 คือจุดเริ่ม */
    path: Point[]
    /** เดินไปถึง index ไหนแล้ว */
    walkShown: number
    /** เฉลยของแผนที่ */
    optimal?: Point[]
    showOptimal?: boolean
    /** วาดเฉลยทับเส้นทางที่เดิน — ในหน้าความรู้สองเส้นมักซ้อนกันจนเขียวหายไปใต้ม่วง */
    optimalOnTop?: boolean
    editable?: boolean
    /** ความสูงสูงสุดของภาพ (px) — 0 = คิดจากความสูงของหน้าจอให้เอง */
    maxHeight?: number
  }>(),
  { optimal: () => [], showOptimal: false, optimalOnTop: false, editable: false, maxHeight: 0 }
)

const emit = defineEmits<{ cell: [row: number, col: number] }>()

const COLORS = {
  floor: '#ffffff',
  mud: '#f6e3b4',
  wall: '#332450',
  line: '#ece8f7',
  exploredEarly: [246, 244, 255] as const,
  exploredLate: [139, 92, 246] as const,
  path: '#7c3aed',
  optimal: '#10b981',
  start: '#10b981',
  goal: '#f59e0b',
  agent: '#1c1524'
}

const host = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

/** ชั้นสีของการสำรวจ วาดเพิ่มทีละช่องแทนการวาดใหม่ทั้งหมดทุกเฟรม */
let layer: HTMLCanvasElement | null = null
let layerSource: Point[] | null = null
let layerDrawn = 0

const size = ref({ cell: 0, width: 0, height: 0, dpr: 1 })

function measure() {
  const element = host.value
  if (!element) return

  const available = element.clientWidth
  if (available <= 0) return

  // จำกัดทั้งความกว้างและความสูง แผนที่ทรงสูงจะได้ไม่ล้นจอ
  const limit = props.maxHeight > 0 ? props.maxHeight : Math.max(240, window.innerHeight - 270)
  const fit = Math.min(available / props.maze.width, limit / props.maze.height)
  const cell = Math.max(2, Math.floor(fit * 2) / 2)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  size.value = {
    cell,
    width: cell * props.maze.width,
    height: cell * props.maze.height,
    dpr
  }

  layer = null
}

const mix = (ratio: number): string => {
  const from = COLORS.exploredEarly
  const to = COLORS.exploredLate
  const r = Math.round(from[0] + (to[0] - from[0]) * ratio)
  const g = Math.round(from[1] + (to[1] - from[1]) * ratio)
  const b = Math.round(from[2] + (to[2] - from[2]) * ratio)
  return `rgb(${r} ${g} ${b})`
}

/** วาดช่องที่สำรวจเพิ่มลงชั้นสี — ล้างชั้นใหม่เมื่อมีการรันรอบใหม่ */
function paintExplored() {
  const { cell, width, height, dpr } = size.value
  if (cell <= 0) return null

  if (!layer || layerSource !== props.explored || layerDrawn > props.exploredShown) {
    layer = layer ?? document.createElement('canvas')
    layer.width = Math.round(width * dpr)
    layer.height = Math.round(height * dpr)
    layerSource = props.explored
    layerDrawn = 0

    const reset = layer.getContext('2d')
    reset?.clearRect(0, 0, layer.width, layer.height)
  }

  const context = layer.getContext('2d')
  if (!context) return layer

  context.setTransform(dpr, 0, 0, dpr, 0, 0)

  const total = Math.max(props.explored.length - 1, 1)

  for (let index = layerDrawn; index < props.exploredShown; index++) {
    const point = props.explored[index]
    if (!point) continue
    if (props.maze.grid[point.row]?.[point.col] === WALL) continue

    context.fillStyle = mix(index / total)
    context.fillRect(point.col * cell, point.row * cell, cell, cell)
  }

  layerDrawn = props.exploredShown
  return layer
}

/** ลากเส้นทางเป็นเส้นต่อเนื่อง อ่านง่ายกว่าระบายทีละช่อง */
function stroke(
  context: CanvasRenderingContext2D,
  cells: Point[],
  cell: number,
  color: string,
  width: number,
  dashed = false
) {
  if (cells.length < 2) return

  context.save()
  context.strokeStyle = color
  context.lineWidth = Math.max(1.5, cell * width)
  context.lineJoin = 'round'
  context.lineCap = 'round'
  if (dashed) context.setLineDash([cell * 0.45, cell * 0.45])

  context.beginPath()
  cells.forEach((point, index) => {
    const x = point.col * cell + cell / 2
    const y = point.row * cell + cell / 2
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
  context.restore()
}

function marker(context: CanvasRenderingContext2D, point: Point, cell: number, color: string, ring: boolean) {
  const x = point.col * cell + cell / 2
  const y = point.row * cell + cell / 2
  const radius = cell * (ring ? 0.34 : 0.3)

  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)

  if (ring) {
    context.lineWidth = Math.max(1.5, cell * 0.16)
    context.strokeStyle = color
    context.stroke()
  } else {
    context.fillStyle = color
    context.fill()
  }
}

function draw() {
  const element = canvas.value
  const { cell, width, height, dpr } = size.value
  if (!element || cell <= 0) return

  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)

  // ตั้งขนาดเฉพาะตอนที่เปลี่ยนจริง เพราะการเขียน .width ล้างภาพในแคนวาสทิ้ง
  if (element.width !== pixelWidth || element.height !== pixelHeight) {
    element.width = pixelWidth
    element.height = pixelHeight
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  const context = element.getContext('2d')
  if (!context) return

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)

  // พื้นและกำแพง
  context.fillStyle = COLORS.floor
  context.fillRect(0, 0, width, height)

  const grid = props.maze.grid
  const mud: Point[] = []

  for (let row = 0; row < props.maze.height; row++) {
    for (let col = 0; col < props.maze.width; col++) {
      const value = grid[row]?.[col]

      if (value === WALL) {
        context.fillStyle = COLORS.wall
      } else if (value === MUD) {
        context.fillStyle = COLORS.mud
        mud.push({ row, col })
      } else {
        continue
      }

      context.fillRect(col * cell, row * cell, cell, cell)
    }
  }

  // ชั้นสีของการสำรวจ (ไม่ทับกำแพง)
  const shade = paintExplored()
  if (shade && props.exploredShown > 0) {
    context.globalAlpha = 0.85
    context.drawImage(shade, 0, 0, width, height)
    context.globalAlpha = 1

    // ย้อมโคลนกลับเข้าไป ไม่งั้นสีของการสำรวจจะกลบจนดูไม่ออกว่าช่องไหนแพง
    context.globalAlpha = 0.55
    context.fillStyle = COLORS.mud
    for (const point of mud) context.fillRect(point.col * cell, point.row * cell, cell, cell)
    context.globalAlpha = 1
  }

  // เส้นตารางบาง ๆ เฉพาะตอนช่องใหญ่พอ
  if (cell >= 11) {
    context.strokeStyle = COLORS.line
    context.lineWidth = 1

    context.beginPath()
    for (let col = 1; col < props.maze.width; col++) {
      context.moveTo(col * cell, 0)
      context.lineTo(col * cell, height)
    }
    for (let row = 1; row < props.maze.height; row++) {
      context.moveTo(0, row * cell)
      context.lineTo(width, row * cell)
    }
    context.stroke()
  }

  const solution = props.showOptimal && props.optimal.length > 1
  if (solution && !props.optimalOnTop) {
    stroke(context, props.optimal, cell, COLORS.optimal, 0.16, true)
  }

  const walked = props.path.slice(0, props.walkShown + 1)
  stroke(context, walked, cell, COLORS.path, 0.34)

  if (solution && props.optimalOnTop) {
    stroke(context, props.optimal, cell, COLORS.optimal, 0.16, true)
  }

  marker(context, props.maze.start, cell, COLORS.start, false)
  marker(context, props.maze.goal, cell, COLORS.goal, true)

  // ตำแหน่งปัจจุบันของ agent
  const head = walked[walked.length - 1]
  if (head && walked.length > 1) {
    const x = head.col * cell + cell / 2
    const y = head.row * cell + cell / 2

    context.beginPath()
    context.arc(x, y, cell * 0.3, 0, Math.PI * 2)
    context.fillStyle = COLORS.agent
    context.fill()
    context.lineWidth = Math.max(1, cell * 0.1)
    context.strokeStyle = '#ffffff'
    context.stroke()
  }
}

// ---------- การแก้แผนที่ด้วยเมาส์ ----------

let painting = false
let lastCell = ''

function cellAt(event: PointerEvent): Point | null {
  const element = canvas.value
  const { cell } = size.value
  if (!element || cell <= 0) return null

  const box = element.getBoundingClientRect()
  const col = Math.floor((event.clientX - box.left) / cell)
  const row = Math.floor((event.clientY - box.top) / cell)

  if (row < 0 || row >= props.maze.height || col < 0 || col >= props.maze.width) return null
  return { row, col }
}

function onDown(event: PointerEvent) {
  if (!props.editable) return

  const point = cellAt(event)
  if (!point) return

  painting = true
  lastCell = `${point.row},${point.col}`
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  emit('cell', point.row, point.col)
}

function onMove(event: PointerEvent) {
  if (!painting || !props.editable) return

  const point = cellAt(event)
  if (!point) return

  const id = `${point.row},${point.col}`
  if (id === lastCell) return

  lastCell = id
  emit('cell', point.row, point.col)
}

const onUp = () => {
  painting = false
  lastCell = ''
}

let observer: ResizeObserver | null = null

const refresh = () => {
  measure()
  draw()
}

onMounted(() => {
  refresh()

  observer = new ResizeObserver(refresh)
  if (host.value) observer.observe(host.value)

  window.addEventListener('resize', refresh)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.removeEventListener('resize', refresh)
})

// สร้างแผนที่ใหม่ = ขนาดช่องอาจเปลี่ยน ต้องวัดใหม่ก่อนวาด
watch(() => props.maze, refresh)

watch(
  () => [
    props.exploredShown,
    props.walkShown,
    props.explored,
    props.path,
    props.showOptimal,
    props.optimalOnTop
  ],
  () => draw()
)
</script>

<template>
  <div ref="host" class="w-full">
    <canvas
      ref="canvas"
      class="mx-auto block touch-none rounded-xl bg-white shadow-lift ring-1 ring-line"
      :class="editable ? 'cursor-crosshair' : 'cursor-default'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointerleave="onUp"
      @pointercancel="onUp"
    />
  </div>
</template>
