<script setup lang="ts">
import type { AgentMode } from '~/game/hanoi/protocol'
import { WORK_LABEL } from '~/game/hanoi/blocks/pack'

/**
 * "โปรแกรมนี้ทำงานยังไง" — เล่าพฤติกรรมของตัวอย่างที่เลือกอยู่ ไม่ใช่เอาไปแข่งกับตัวอื่น
 *
 * ตัวเลขทั้งหมดมาจากรอบที่เพิ่งรันจริง ไม่ได้คำนวณแยกหรือพิมพ์ทิ้งไว้:
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว หน้าจอแค่เอายอดมาเรียงให้อ่านออก
 *
 * นี่คือที่ที่ความต่างระหว่างสองวิธีโผล่ออกมา — จำนวนตาของทั้งคู่เท่ากันเสมอ
 * สิ่งที่ไม่เท่ากันคือกว่าจะได้ตานั้นมา ต้องทำงานกี่ครั้ง และทำตอนไหน
 */
const props = defineProps<{
  mode: AgentMode
  counts: Record<string, number>
  /** จำนวนครั้งที่เรียกคำสั่งทั้งหมดในรอบนี้ */
  calls: number
  /** จำนวนตาที่ย้ายไปแล้ว ใช้หารเป็นค่าเฉลี่ยต่อตา */
  moves: number
}>()

/** งานที่มีชื่อไทยและเกิดขึ้นจริงในรอบนี้ เรียงจากที่ทำบ่อยที่สุด */
const work = computed(() =>
  Object.entries(props.counts)
    .filter(([name, count]) => count > 0 && name in WORK_LABEL)
    .map(([name, count]) => ({ label: WORK_LABEL[name]!, count }))
    .sort((a, b) => b.count - a.count)
)

const most = computed(() => work.value[0]?.count ?? 0)

const planning = computed(() => props.mode === 'plan')

/** ย้ายทีละตาจะเห็นชัดว่าคิดเท่าเดิมทุกตาไหม — ตัวเลขนี้คือหัวใจของกฎสลับตา */
const perMove = computed(() =>
  props.moves > 0 ? Math.round((props.calls / props.moves) * 10) / 10 : 0
)
</script>

<template>
  <div v-if="work.length > 0" class="mt-2 rounded-xl bg-surface-muted p-3">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
      โปรแกรมนี้ทำงานยังไง
      <UiInfo label="ตัวเลขพวกนี้อ่านยังไง" align="left">
        <template v-if="planning">
          คิดลำดับทั้งชุดให้จบก่อน แล้วค่อยย้ายตามแผน — งานทั้งหมดเกิดขึ้นก่อนจานใบแรกจะขยับ
        </template>
        <template v-else>
          ตัดสินใจใหม่ทุกตา ไม่ได้วางแผนล่วงหน้า — คิดเท่ากันทุกตาไม่ว่าจานจะมีกี่ใบ
        </template>
      </UiInfo>
    </p>

    <p v-if="!planning" class="mt-1 text-[11px] text-ink-subtle">
      เฉลี่ย <span class="font-mono tabular-nums text-ink">{{ perMove }}</span> ครั้งต่อหนึ่งตา
    </p>

    <ul class="mt-2.5 space-y-1.5">
      <li v-for="item in work" :key="item.label">
        <div class="flex items-baseline justify-between gap-2 text-[11px]">
          <span class="text-ink-muted">{{ item.label }}</span>
          <span class="font-mono tabular-nums text-ink">{{ item.count.toLocaleString() }}</span>
        </div>

        <!-- แถบเทียบกันเองภายในรอบนี้ ให้เห็นว่างานส่วนใหญ่หมดไปกับอะไร -->
        <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-line">
          <div
            class="h-full rounded-full bg-primary-400"
            :style="{ width: `${most === 0 ? 0 : Math.max(2, (item.count / most) * 100)}%` }"
          />
        </div>
      </li>
    </ul>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-subtle">
      รวมเรียกคำสั่ง <span class="font-mono tabular-nums text-ink">{{ calls.toLocaleString() }}</span> ครั้ง
      · จำนวนตาบอกว่าคำตอบสั้นแค่ไหน ส่วนตรงนี้บอกว่ากว่าจะได้คำตอบนั้นมา ต้องออกแรงเท่าไร
    </p>
  </div>
</template>
