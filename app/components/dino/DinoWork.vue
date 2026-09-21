<script setup lang="ts">
import { WORK_LABEL } from '~/game/dino/blocks/pack'

/**
 * "โปรแกรมนี้ทำงานยังไง" — ยอดทั้งหมดมาจากรอบที่เพิ่งวิ่งจริง
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว ตรงนี้แค่เอามาเรียงให้อ่านออก
 */
const props = defineProps<{
  counts: Record<string, number>
  calls: number
  /** เวลาในเกมที่ผ่านไป ใช้หารเป็นค่าเฉลี่ยต่อวินาที */
  seconds: number
}>()

const work = computed(() =>
  Object.entries(props.counts)
    .filter(([name, count]) => count > 0 && name in WORK_LABEL)
    .map(([name, count]) => ({ label: WORK_LABEL[name]!, count }))
    .sort((a, b) => b.count - a.count)
)

const most = computed(() => work.value[0]?.count ?? 0)

const perSecond = computed(() =>
  props.seconds > 0 ? Math.round(props.calls / props.seconds) : 0
)
</script>

<template>
  <div v-if="work.length > 0" class="mt-2 rounded-xl bg-surface-muted p-3">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
      โปรแกรมนี้ทำงานยังไง
      <UiInfo label="ตัวเลขพวกนี้อ่านยังไง" align="left">
        บอทถูกถาม 30 ครั้งต่อวินาที กฎที่ดูของหลายชิ้นก็เรียกคำสั่งมากกว่า
        แต่ก็เตรียมตัวได้ล่วงหน้ากว่าเหมือนกัน
      </UiInfo>
    </p>

    <p class="mt-1 text-[11px] text-ink-subtle">
      เฉลี่ย <span class="font-mono tabular-nums text-ink">{{ perSecond }}</span> ครั้งต่อวินาที
    </p>

    <ul class="mt-2.5 space-y-1.5">
      <li v-for="item in work" :key="item.label">
        <div class="flex items-baseline justify-between gap-2 text-[11px]">
          <span class="text-ink-muted">{{ item.label }}</span>
          <span class="font-mono tabular-nums text-ink">{{ item.count.toLocaleString() }}</span>
        </div>

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
    </p>
  </div>
</template>
