<script setup lang="ts">
import { ART } from '~/game/dino/art'
import type { Obstacle } from '~/game/dino/engine'

/**
 * สิ่งกีดขวางหนึ่งชิ้น — วางให้ขอบล่างของภาพตรงกับขอบล่างของกล่องชนเสมอ
 * นกวาดซ้อนกันตามจำนวนที่มาจริงในฝูงนั้น (หนึ่งหรือสองตัว) เรียงขึ้นจากขอบล่างของกล่องชน
 */
const props = withDefaults(
  defineProps<{
    obstacle: Obstacle
    /** ตำแหน่งบนจอของขอบซ้ายของกล่องชน */
    x: number
    /** y ของพื้น */
    groundY: number
    /** ปีกนกกระพือตามเวลาจริง */
    beat?: number
  }>(),
  { beat: 0 }
)

const spec = computed(() => ART[props.obstacle.art])

/** ภาพกว้างกว่ากล่องชนเล็กน้อย จัดให้กึ่งกลางตรงกัน */
const left = computed(() => props.x - (spec.value.frame.width - spec.value.box.width) / 2)

const stack = computed(() => props.obstacle.count)

/** ตัวที่ซ้อนกันเรียงขึ้นไปจากขอบล่างของกล่องชน */
const rows = computed(() =>
  Array.from({ length: stack.value }, (_, index) => ({
    key: index,
    frame: (props.beat + index * 3) % spec.value.frames,
    y:
      props.groundY -
      props.obstacle.box.bottom -
      spec.value.frame.height * (index + 1) +
      (stack.value > 1 ? index * 4 : 0)
  }))
)
</script>

<template>
  <DinoSprite
    v-for="row in rows"
    :key="row.key"
    :art="obstacle.art"
    :index="row.frame"
    :frame="spec.frame"
    :frames="spec.frames"
    :x="left"
    :y="row.y"
    :width="spec.frame.width"
    :height="spec.frame.height"
  />
</template>
