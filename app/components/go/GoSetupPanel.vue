<script setup lang="ts">
import { BOARD_SIZES, DEFAULT_KOMI, type BoardSize } from '~/game/go/engine'

/**
 * ตั้งกระดานก่อนเริ่มเกม — ขนาดกระดานกับโคมิ
 *
 * สองค่านี้ต้องอยู่ด้วยกัน เพราะโคมิมาตรฐานผูกกับขนาดกระดาน เปลี่ยนขนาดแล้ว
 * หน้าเกมมักตั้งโคมิใหม่ให้ด้วย ในนี้จึงบอกค่ามาตรฐานไว้ให้เทียบเสมอ
 */
const props = defineProps<{
  size: BoardSize
  komi: number
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:size': [size: BoardSize]; 'update:komi': [komi: number] }>()

const standard = computed(() => DEFAULT_KOMI[props.size])

const onKomi = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) emit('update:komi', value)
}
</script>

<template>
  <div class="grid gap-x-4 gap-y-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-2">
    <div>
      <div class="flex h-5 items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">ขนาดกระดาน</span>
        <UiInfo label="เลือกขนาดไหนดี" align="left">
          9×9 ไว้หัดและดูผลไว ๆ · 19×19 คือกระดานแข่งจริง
          กระดานยิ่งใหญ่ ช่องที่บอทต้องลองคิดยิ่งเยอะ บอทจึงเดินช้าลงมาก
        </UiInfo>
      </div>

      <div class="mt-1.5 flex rounded-xl border border-line-strong bg-surface p-0.5">
        <button
          v-for="option in BOARD_SIZES"
          :key="option"
          type="button"
          class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
          :class="size === option ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          :disabled="disabled"
          @click="emit('update:size', option)"
        >
          {{ option }}×{{ option }}
        </button>
      </div>
    </div>

    <div>
      <div class="flex h-5 items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">โคมิ (แต้มแถมให้ขาว)</span>
        <UiInfo label="โคมิคืออะไร">
          ดำลงก่อนเลยได้เปรียบ จึงแถมแต้มให้ขาวไว้ล่วงหน้า
          กระดานนี้ใช้กันที่ {{ standard }} แต้ม
        </UiInfo>
      </div>

      <div class="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          step="0.5"
          min="0"
          max="20"
          :value="komi"
          :disabled="disabled"
          class="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors hover:border-primary-300 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          @change="onKomi"
        >

        <!-- กดคืนค่ามาตรฐานได้ในคลิกเดียว หลังจากลองเล่นกับตัวเลขแปลก ๆ -->
        <UiButton
          v-if="komi !== standard"
          size="sm"
          variant="outline"
          :disabled="disabled"
          @click="emit('update:komi', standard)"
        >
          {{ standard }}
        </UiButton>
      </div>
    </div>

    <p class="text-[11px] leading-relaxed text-ink-subtle sm:col-span-2">
      กระดานใหญ่ขึ้นหนึ่งขั้น ช่องที่ต้องคิดเพิ่มขึ้นเป็นเท่าตัว — บอทจะคิดนานขึ้นตามไปด้วย
    </p>
  </div>
</template>
