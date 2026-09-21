<script setup lang="ts">
import barrel from '~/assets/dino/barrel.png'
import bird from '~/assets/dino/bird.png'
import mort from '~/assets/dino/mort.png'
import rock from '~/assets/dino/rock.png'
import stump from '~/assets/dino/stump.png'

/**
 * วาดภาพหนึ่งเฟรมจากไฟล์สไปรท์ ลงในกรอบที่กำหนดด้วยหน่วยพิกเซลของเกม
 *
 * ใช้ <svg> ซ้อนข้างใน แทน clipPath เพราะ svg ซ้อนจะตัดส่วนที่เกินกรอบให้เอง
 * และไม่ต้องตั้ง id ให้ไม่ซ้ำกัน ซึ่งเป็นเรื่องยุ่งเมื่อมีของหลายชิ้นพร้อมกันบนจอ
 */
const props = defineProps<{
  /** ชื่อไฟล์ภาพ */
  art: 'mort' | 'bird' | 'barrel' | 'stump' | 'rock'
  /** เฟรมที่เท่าไรในแถว */
  index: number
  /** ขนาดของหนึ่งเฟรมในไฟล์ */
  frame: { width: number; height: number }
  /** จำนวนเฟรมทั้งหมดในไฟล์ */
  frames: number
  /** มุมซ้ายบนของกรอบที่จะวาง */
  x: number
  y: number
  width: number
  height: number
}>()

const SOURCE: Record<string, string> = { mort, bird, barrel, stump, rock }

const href = computed(() => SOURCE[props.art]!)

const sheet = computed(() => ({
  width: props.frame.width * props.frames,
  height: props.frame.height
}))

const box = computed(() => ({
  x: props.frame.width * props.index,
  y: 0,
  width: props.frame.width,
  height: props.frame.height
}))
</script>

<template>
  <svg
    :x="x"
    :y="y"
    :width="width"
    :height="height"
    :viewBox="`${box.x} ${box.y} ${box.width} ${box.height}`"
    preserveAspectRatio="none"
    overflow="hidden"
  >
    <image
      :href="href"
      x="0"
      y="0"
      :width="sheet.width"
      :height="sheet.height"
      style="image-rendering: pixelated"
    />
  </svg>
</template>
