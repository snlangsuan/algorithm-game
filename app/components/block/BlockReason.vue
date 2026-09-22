<script setup lang="ts">
import type { Reason } from '~/game/shared/reason'

/**
 * "ทำไมถึงเลือกทางนี้" — ตารางตัวเลือกที่โปรแกรมชั่งก่อนตัดสินใจครั้งล่าสุด
 *
 * ตัวเลขทุกช่องมาจากโค้ดที่รันจริงในจังหวะนั้น ไม่ใช่ตัวอย่าง
 * แถวที่ถูกเลือกขึ้นสีเด่น ให้เทียบได้ทันทีว่าชนะตัวอื่นเพราะตัวเลขไหน
 */
const props = defineProps<{
  reasons: Reason[]
}>()

/** ฝ่ายไล่มีหลายตัว คิดคนละที — เลือกดูทีละตัว */
const picked = ref(0)

watch(
  () => props.reasons.length,
  (count) => {
    if (picked.value >= count) picked.value = 0
  }
)

const shown = computed(() => props.reasons[picked.value] ?? props.reasons[0])

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))
</script>

<template>
  <div v-if="shown" class="mt-2 rounded-xl bg-surface-muted p-3">
    <p class="flex items-center gap-1.5 text-xs font-semibold text-ink">
      ทำไมถึงเลือกทางนี้
      <UiInfo label="ตารางนี้อ่านยังไง" align="left">
        ทุกครั้งที่ถึงตาเดิน บล็อกจะให้คะแนนทุกทางที่เดินได้ แล้วเลือกทางที่ดีที่สุด
        ตัวเลขในตารางคือของจริงจากจังหวะล่าสุด — ตัวเลขคอลัมน์ขวาสุดเขียนไว้บนช่องในสนามด้วย
      </UiInfo>
    </p>

    <div v-if="reasons.length > 1" class="mt-2 flex flex-wrap gap-1">
      <button
        v-for="(reason, index) in reasons"
        :key="index"
        type="button"
        class="rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset transition-colors"
        :class="
          picked === index
            ? 'bg-primary-100 text-primary-800 ring-primary-200'
            : 'bg-surface text-ink-subtle ring-line hover:text-ink-muted'
        "
        @click="picked = index"
      >
        {{ reason.who || `ตัวที่ ${index + 1}` }}
      </button>
    </div>

    <p class="mt-2 text-[11px] text-ink-muted">{{ shown.title }}</p>
    <p v-if="shown.rule" class="mt-1 whitespace-pre-line rounded-lg bg-surface px-2 py-1.5 font-mono text-[11px] text-ink ring-1 ring-line">
      {{ shown.rule }}
    </p>

    <table class="mt-2 w-full text-[11px] tabular-nums">
      <thead>
        <tr class="text-ink-subtle">
          <th class="py-1 pr-2 text-left font-medium">ทาง</th>
          <th v-for="column in shown.columns" :key="column" class="py-1 pl-2 text-right font-medium">
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(option, index) in shown.options"
          :key="index"
          class="border-t border-line"
          :class="option.chosen ? 'bg-emerald-50 font-semibold text-emerald-900' : 'text-ink'"
        >
          <td class="whitespace-nowrap py-1 pr-2">
            {{ option.label }}
            <span v-if="option.chosen" class="ml-0.5 text-emerald-600" title="ทางที่เลือก">✓</span>
          </td>
          <td v-for="(value, column) in option.values" :key="column" class="py-1 pl-2 text-right">
            {{ format(value) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
