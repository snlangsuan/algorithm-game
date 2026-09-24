<script setup lang="ts">
import { BLACK, WHITE, score, type Player, type Position } from '~/game/go/engine'

type GoStatus = 'setup' | 'playing' | 'paused' | 'finished' | 'error'

/**
 * แผงคะแนนสดของหมากล้อม
 *
 * โกะไม่มีคะแนนจริงจนกว่าจะจบ ตัวเลขระหว่างเล่นจึงเป็น "ถ้าหยุดตรงนี้" เท่านั้น
 * นับแบบจีน = หมากของตัวเองบนกระดาน + ช่องว่างที่ล้อมได้ แล้วขาวบวกโคมิทีหลัง
 */
const props = defineProps<{
  position: Position
  status: GoStatus
  /** ชื่อโปรแกรม (หรือ 'คุณ') ของแต่ละฝ่าย */
  names: Record<Player, string>
}>()

const tally = computed(() => score(props.position))

const blackPoints = computed(() => tally.value.area[BLACK])

/** ขาวได้โคมิเพิ่มเสมอ ตัวเลขที่โชว์จึงต้องรวมมาแล้ว ไม่งั้นอ่านผลผิดฝั่ง */
const whitePoints = computed(() => tally.value.area[WHITE] + tally.value.komi)

const share = computed(() => {
  const total = blackPoints.value + whitePoints.value
  return total === 0 ? 50 : Math.round((blackPoints.value / total) * 100)
})

const lead = computed(() => Math.abs(tally.value.lead))

const label = computed(() => {
  if (props.status === 'finished') return { text: 'จบเกมแล้ว', tone: 'bg-emerald-50 text-emerald-700' }
  if (props.status === 'playing') return { text: 'กำลังเล่น', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'paused') return { text: 'พักอยู่', tone: 'bg-primary-100 text-primary-700' }
  if (props.status === 'error') return { text: 'โปรแกรมมีปัญหา', tone: 'bg-amber-50 text-amber-800' }
  return { text: 'ยังไม่เริ่ม', tone: 'bg-surface-sunken text-ink-muted' }
})

const turnLabel = computed(() => {
  if (props.status === 'finished') {
    if (!tally.value.winner) return 'เสมอกันพอดี'
    return `ฝ่าย${tally.value.winner === BLACK ? 'ดำ' : 'ขาว'}นำอยู่ ${lead.value} แต้ม`
  }

  return `ถึงตาฝ่าย${props.position.toPlay === BLACK ? 'ดำ' : 'ขาว'}`
})

/** แต้มมีครึ่งแต้มได้เพราะโคมิ — ตัดศูนย์ท้ายทิ้งเพื่อไม่ให้อ่านเป็น 12.0 */
const points = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))
</script>

<template>
  <div class="rounded-xl bg-surface-muted p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
        คะแนนตอนนี้
        <UiInfo label="แต้มในหมากล้อมนับยังไง" align="left">
          แต้มของแต่ละฝ่าย = หมากสีตัวเองที่ยังอยู่บนกระดาน + ช่องว่างที่ล้อมไว้ได้คนเดียว
          ระหว่างเล่นตัวเลขจะแกว่ง เพราะพื้นที่ยังเปลี่ยนมือได้ตลอด
        </UiInfo>
      </p>
      <span class="rounded-full px-2 py-0.5 text-[10px] font-medium" :class="label.tone">{{ label.text }}</span>
    </div>

    <div class="mt-2 space-y-1.5">
      <div class="flex items-baseline justify-between text-[11px]">
        <span class="text-ink-muted">{{ turnLabel }}</span>
        <span class="font-mono tabular-nums text-ink">ตาที่ {{ position.turn }}</span>
      </div>

      <div class="flex h-1.5 overflow-hidden rounded-full bg-line">
        <div class="h-full bg-[#1c1524] transition-[width] duration-300" :style="{ width: `${share}%` }" />
        <div class="h-full flex-1 bg-white ring-1 ring-inset ring-line-strong" />
      </div>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="truncate text-[10px] text-ink-subtle">ดำ · {{ names[BLACK] }}</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ points(blackPoints) }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="truncate text-[10px] text-ink-subtle">ขาว · {{ names[WHITE] }}</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ points(whitePoints) }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          เชลยที่ดำจับได้
          <UiInfo label="เชลยคืออะไร">
            หมากของอีกฝ่ายที่ถูกล้อมจนไม่เหลือ "ลมหายใจ" เลย ต้องยกออกจากกระดาน
            เรียกว่าเชลย — ช่องที่ว่างลงกลายเป็นพื้นที่ของเราแทน
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ position.captures[BLACK] }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="text-[10px] text-ink-subtle">เชลยที่ขาวจับได้</p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ position.captures[WHITE] }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          โคมิของขาว
          <UiInfo label="โคมิคืออะไร">
            ดำได้เปรียบเพราะลงก่อน เลยแถมแต้มให้ขาวไว้ตั้งแต่ต้นเกมเรียกว่าโคมิ
            ใส่เศษครึ่งแต้มไว้เพื่อไม่ให้ผลออกมาเสมอ
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">+{{ points(tally.komi) }}</p>
      </div>

      <div class="rounded-lg bg-surface px-2.5 py-2">
        <p class="flex items-center justify-between gap-1 text-[10px] text-ink-subtle">
          ช่องกลาง ๆ
          <UiInfo label="ช่องกลาง ๆ คืออะไร">
            ช่องว่างที่ติดทั้งสีดำและสีขาว ยังไม่เป็นของใคร — เหลือน้อยแปลว่าเกมใกล้จบ
          </UiInfo>
        </p>
        <p class="font-mono text-lg font-semibold tabular-nums text-ink">{{ tally.neutral }}</p>
      </div>
    </div>
  </div>
</template>
