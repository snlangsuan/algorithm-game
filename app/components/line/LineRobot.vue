<script setup lang="ts">
import { SEE_THRESHOLD, SENSOR_AHEAD, SENSOR_COUNT, SENSOR_GAP, WHEEL_BASE } from '~/game/line/engine'

/**
 * ตัวหุ่นมองจากด้านบน — วาดในพิกัดเดียวกับกติกา ตำแหน่งเซนเซอร์บนภาพจึงตรงกับจุดที่เอนจินอ่านค่าจริง
 *
 * แกน x ของภาพชี้ไปทางหัวหุ่น แกน y ชี้ไปทางขวาของตัวหุ่น (จอมีแกน y ชี้ลง)
 * เซนเซอร์ตัวที่ 0 (ซ้ายสุด) จึงอยู่ฝั่ง y ติดลบ
 */
const props = withDefaults(
  defineProps<{
    x: number
    y: number
    /** ทิศที่หัวหันไป (เรเดียน) */
    heading: number
    /** ค่าที่เซนเซอร์ห้าตัวอ่านได้ 0–100 */
    sensors: number[]
    /** เซนเซอร์ที่โปรแกรมเปิดดูล่าสุด — วงสีม่วงให้เห็น */
    watched?: number[]
    /** จบรอบแบบไม่ครบ — ตัวหุ่นเป็นสีเทา */
    stopped?: boolean
  }>(),
  { watched: () => [], stopped: false }
)

const half = WHEEL_BASE / 2

const transform = computed(() => `translate(${props.x} ${props.y}) rotate(${(props.heading * 180) / Math.PI})`)

const sensorDots = computed(() =>
  Array.from({ length: SENSOR_COUNT }, (_, index) => {
    const value = props.sensors[index] ?? 0
    return {
      index,
      y: (index - (SENSOR_COUNT - 1) / 2) * SENSOR_GAP,
      value,
      seen: value >= SEE_THRESHOLD,
      watched: props.watched.includes(index)
    }
  })
)

const reach = ((SENSOR_COUNT - 1) / 2) * SENSOR_GAP + 4
</script>

<template>
  <g :transform="transform">
    <!-- แขนที่ยื่นไปถือแถวเซนเซอร์ -->
    <rect x="8" y="-3" :width="SENSOR_AHEAD - 8" height="6" rx="2" fill="#475569" />
    <rect :x="SENSOR_AHEAD - 4" :y="-reach" width="8" :height="reach * 2" rx="3" fill="#1e293b" />

    <!-- ล้อสองข้าง -->
    <rect x="-9" :y="-half - 4" width="18" height="8" rx="2.5" fill="#0f172a" />
    <rect x="-9" :y="half - 4" width="18" height="8" rx="2.5" fill="#0f172a" />

    <!-- ตัวถัง — ลูกล้อหมุนอิสระอยู่ท้ายตัว -->
    <rect
      x="-19"
      :y="-half + 3"
      width="30"
      :height="WHEEL_BASE - 6"
      rx="7"
      :fill="stopped ? '#94a3b8' : '#7c3aed'"
      stroke="#ffffff"
      stroke-width="1.5"
    />
    <circle cx="-14" cy="0" r="3" fill="#ffffff" fill-opacity="0.7" />
    <path d="M 2 -5 L 8 0 L 2 5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

    <!-- เซนเซอร์ — เห็นเส้นก็ติดไฟแดง ยิ่งเห็นชัดยิ่งสว่าง -->
    <g v-for="dot in sensorDots" :key="dot.index">
      <circle
        v-if="dot.watched"
        :cx="SENSOR_AHEAD"
        :cy="dot.y"
        r="6"
        fill="none"
        stroke="#a78bfa"
        stroke-width="2"
      />
      <circle
        :cx="SENSOR_AHEAD"
        :cy="dot.y"
        r="3"
        :fill="dot.seen ? '#f43f5e' : '#e2e8f0'"
        :fill-opacity="dot.seen ? 0.5 + dot.value / 200 : 1"
      />
    </g>
  </g>
</template>
