<script setup lang="ts">
import { BLACK, WHITE, type Player, type Score } from '~/game/go/engine'

/**
 * แผ่นสรุปตอนจบเกม — ทับกระดานไว้จนกว่าจะสั่งปิดเอง
 *
 * โกะไม่ได้ชนะกันด้วยการจับหมากให้เยอะ แต่ชนะด้วยพื้นที่ แผ่นนี้จึงแยกให้เห็นว่า
 * แต้มมาจากหมากบนกระดานเท่าไร มาจากพื้นที่ที่ล้อมได้เท่าไร และขาวได้โคมิบวกเพิ่มอีก
 */
const props = defineProps<{
  score: Score
  /** ชื่อของแต่ละฝ่าย — โชว์ว่ารอบนี้ใครเป็นคนคิด */
  names: Record<Player, string>
}>()

defineEmits<{ again: []; close: [] }>()

const blackPoints = computed(() => props.score.area[BLACK])

const whitePoints = computed(() => props.score.area[WHITE] + props.score.komi)

const lead = computed(() => Math.abs(props.score.lead))

const points = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

const title = computed(() => {
  if (!props.score.winner) return 'เสมอกัน'
  return `ฝ่าย${props.score.winner === BLACK ? 'ดำ' : 'ขาว'}ชนะ`
})

const subtitle = computed(() => {
  if (!props.score.winner) return 'แต้มเท่ากันพอดี'
  return `${props.names[props.score.winner]} · ชนะไป ${points(lead.value)} แต้ม`
})
</script>

<template>
  <div class="absolute inset-0 grid place-items-center rounded-2xl bg-ink/40 p-4 backdrop-blur-[3px]">
    <div class="w-full max-w-xs rounded-card border border-line bg-surface p-6 text-center shadow-lift">
      <p class="text-xs font-medium uppercase tracking-widest text-primary-600">จบเกม</p>
      <h2 class="mt-2 text-xl font-semibold text-ink">{{ title }}</h2>
      <p class="mt-1 text-sm text-ink-muted">{{ subtitle }}</p>

      <div class="mt-5 flex items-center justify-center gap-4">
        <div class="flex items-center gap-2">
          <span class="size-5 rounded-full bg-gradient-to-br from-[#413354] to-[#1c1524]" />
          <span class="text-2xl font-semibold tabular-nums text-ink">{{ points(blackPoints) }}</span>
        </div>
        <span class="text-sm text-ink-subtle">:</span>
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold tabular-nums text-ink">{{ points(whitePoints) }}</span>
          <span class="size-5 rounded-full border border-line-strong bg-white" />
        </div>
      </div>

      <!-- แจกแจงที่มาของแต้ม เพื่อให้เห็นว่าพื้นที่ที่ล้อมได้สำคัญกว่าจำนวนหมาก -->
      <dl class="mt-4 space-y-1 text-[11px] text-ink-muted">
        <div class="flex items-center justify-between gap-2">
          <dt>หมากบนกระดาน</dt>
          <dd class="font-mono tabular-nums text-ink">
            {{ score.stones[BLACK] }} : {{ score.stones[WHITE] }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2">
          <dt>พื้นที่ที่ล้อมได้</dt>
          <dd class="font-mono tabular-nums text-ink">
            {{ score.territory[BLACK] }} : {{ score.territory[WHITE] }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2">
          <dt>โคมิของขาว</dt>
          <dd class="font-mono tabular-nums text-ink">+{{ points(score.komi) }}</dd>
        </div>
      </dl>

      <div class="mt-6 flex items-center gap-2">
        <UiButton block @click="$emit('again')">เล่นอีกรอบ</UiButton>
        <UiButton variant="outline" @click="$emit('close')">ดูกระดาน</UiButton>
      </div>
    </div>
  </div>
</template>
