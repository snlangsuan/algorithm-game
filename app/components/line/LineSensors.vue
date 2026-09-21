<script setup lang="ts">
import { SEE_THRESHOLD, SENSOR_LABEL, isLost, linePosition, type Run } from '~/game/line/engine'

/**
 * สิ่งที่หุ่นรู้ตอนนี้ เรียงให้อ่านเป็นตัวเลขเดียวกับที่โปรแกรมเห็น
 * ห้าแท่งคือเซนเซอร์ · เข็มคือ "ตำแหน่งเส้น" ที่ถัวเฉลี่ยจากห้าแท่งนั้น · สองแถบล่างคือกำลังมอเตอร์ที่สั่งไว้
 * ดูคู่กับสนามแล้วจะเห็นว่าตัวเลขพวกนี้เปลี่ยนยังไงตอนหุ่นส่าย
 */
const props = defineProps<{ run: Run; watched: number[] }>()

const bars = computed(() =>
  SENSOR_LABEL.map((label, index) => {
    const value = props.run.sensors[index] ?? 0
    return { label, index, value, seen: value >= SEE_THRESHOLD, watched: props.watched.includes(index) }
  })
)

const position = computed(() => linePosition(props.run.sensors, props.run.lastSide))

const lost = computed(() => isLost(props.run.sensors))

/** เข็มบนแถบ -100..100 เป็นเปอร์เซ็นต์จากซ้าย */
const needle = computed(() => 50 + position.value / 2)

const motors = computed(() => [
  { key: 'left', label: 'มอเตอร์ซ้าย', value: props.run.drive.left },
  { key: 'right', label: 'มอเตอร์ขวา', value: props.run.drive.right }
])
</script>

<template>
  <div class="grid gap-3 rounded-card border border-line bg-surface p-3 shadow-soft sm:grid-cols-[1fr_1.1fr_1fr]">
    <div>
      <p class="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
        เซนเซอร์ห้าตัว
        <UiInfo label="เซนเซอร์อ่านค่ายังไง" align="left">
          0 คือพื้นขาว 100 คือเส้นดำเต็ม ๆ ตั้งแต่ 50 ขึ้นไปถือว่าเห็นเส้น (แท่งสีแดง) ·
          วงสีม่วงบนตัวหุ่นคือเซนเซอร์ที่โปรแกรมเพิ่งเปิดดู
        </UiInfo>
      </p>

      <div class="mt-2 flex h-16 gap-1.5">
        <div v-for="bar in bars" :key="bar.index" class="flex flex-1 flex-col items-center gap-1">
          <span class="font-mono text-[10px] tabular-nums text-ink-muted">{{ bar.value }}</span>
          <div
            class="relative w-full flex-1 overflow-hidden rounded bg-surface-sunken"
            :class="bar.watched ? 'ring-2 ring-primary-300' : ''"
          >
            <div
              class="absolute inset-x-0 bottom-0 rounded transition-[height] duration-75"
              :class="bar.seen ? 'bg-rose-500' : 'bg-slate-300'"
              :style="{ height: `${bar.value}%` }"
            />
          </div>
        </div>
      </div>

      <div class="mt-1 flex gap-1.5">
        <span v-for="bar in bars" :key="bar.index" class="flex-1 truncate text-center text-[9px] text-ink-subtle">
          {{ bar.label }}
        </span>
      </div>
    </div>

    <div>
      <p class="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-ink">
        <span class="flex items-center gap-1.5">
          ตำแหน่งเส้น
          <UiInfo label="ตำแหน่งเส้นคืออะไร" align="left">
            ถัวเฉลี่ยจากเซนเซอร์ทั้งห้าตัว — -100 เส้นอยู่ใต้ตัวซ้ายสุด · 0 ตรงกลางพอดี · 100 ใต้ตัวขวาสุด ·
            หลุดเส้นแล้วจะค้างไว้ที่สุดขอบฝั่งที่เห็นเส้นครั้งสุดท้าย
          </UiInfo>
        </span>
        <span class="font-mono text-sm tabular-nums" :class="lost ? 'text-rose-600' : 'text-primary-700'">
          {{ position > 0 ? `+${position}` : position }}
        </span>
      </p>

      <div class="relative mt-3 h-3 rounded-full bg-gradient-to-r from-primary-100 via-surface-sunken to-primary-100">
        <div class="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
        <div
          class="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full shadow-soft transition-[left] duration-75"
          :class="lost ? 'bg-rose-500' : 'bg-primary-600'"
          :style="{ left: `${needle}%` }"
        />
      </div>

      <div class="mt-1.5 flex justify-between text-[9px] text-ink-subtle">
        <span>-100 ซ้าย</span>
        <span>0</span>
        <span>ขวา 100</span>
      </div>

      <p v-if="lost" class="mt-1.5 text-[10px] font-medium text-rose-600">หลุดเส้น — ไม่มีเซนเซอร์ตัวไหนเห็นเส้นเลย</p>
    </div>

    <div class="space-y-2">
      <p class="text-[11px] font-semibold text-ink">กำลังที่สั่งไว้</p>
      <div v-for="motor in motors" :key="motor.key">
        <div class="flex items-baseline justify-between text-[10px]">
          <span class="text-ink-muted">{{ motor.label }}</span>
          <span class="font-mono tabular-nums text-ink">{{ Math.round(motor.value) }}%</span>
        </div>
        <!-- แถบสองทาง: เติมไปทางขวาคือเดินหน้า ไปทางซ้ายคือถอยหลัง -->
        <div class="relative mt-0.5 h-1.5 rounded-full bg-surface-sunken">
          <div class="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
          <div
            class="absolute inset-y-0 rounded-full"
            :class="motor.value >= 0 ? 'bg-emerald-500' : 'bg-amber-500'"
            :style="
              motor.value >= 0
                ? { left: '50%', width: `${motor.value / 2}%` }
                : { right: '50%', width: `${-motor.value / 2}%` }
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>
