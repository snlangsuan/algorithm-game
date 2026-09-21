<script setup lang="ts">
import { MORT } from '~/game/dino/art'

/**
 * ตัวละคร — เลือกเฟรมจากสไปรท์ให้ตรงกับสิ่งที่กำลังเกิดขึ้นในกติกา
 *
 * เฟรมวิ่งกับเฟรมหมอบสลับตามเวลาจริง ไม่ใช่ตามเฟรมของฟิสิกส์
 * เพราะตอนตั้งความเร็วภาพช้า ขาจะขยับช้าตามไปด้วยจนดูเหมือนภาพค้าง
 */
const props = withDefaults(
  defineProps<{
    /** มุมซ้ายล่างของตัวละคร (พิกเซลของเกม) */
    x: number
    /** y ของพื้น */
    groundY: number
    /** เท้าลอยสูงจากพื้นกี่พิกเซล */
    lift?: number
    ducking?: boolean
    airborne?: boolean
    crashed?: boolean
    /** กำลังวิ่งอยู่จริงไหม — หยุดสลับเฟรมเมื่อพัก จบรอบ หรือยังไม่เริ่ม */
    moving?: boolean
  }>(),
  { lift: 0, ducking: false, airborne: false, crashed: false, moving: false }
)

/** สลับเฟรมทุก 80 มิลลิวินาที */
const STEP_MS = 80

const beat = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const stop = () => {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

watch(
  () => props.moving,
  (moving) => {
    stop()
    if (!moving) return
    timer = setInterval(() => {
      beat.value = beat.value + 1
    }, STEP_MS)
  },
  { immediate: true }
)

onBeforeUnmount(stop)

const index = computed(() => {
  if (props.crashed) return MORT.dead
  if (props.airborne) return MORT.jump
  if (props.ducking) return MORT.duck[beat.value % MORT.duck.length]!
  if (!props.moving) return MORT.idle[Math.floor(beat.value / 4) % MORT.idle.length]!
  return MORT.run[beat.value % MORT.run.length]!
})
</script>

<template>
  <DinoSprite
    art="mort"
    :index="index"
    :frame="MORT.frame"
    :frames="MORT.frames"
    :x="x"
    :y="groundY - lift - MORT.frame.height + MORT.footroom"
    :width="MORT.frame.width"
    :height="MORT.frame.height"
  />
</template>
