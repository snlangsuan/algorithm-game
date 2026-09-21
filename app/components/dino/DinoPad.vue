<script setup lang="ts">
/** ปุ่มบังคับสำหรับจอสัมผัส — คีย์บอร์ดยังใช้ได้เหมือนเดิม */
const emit = defineEmits<{ jump: []; duck: [on: boolean] }>()
</script>

<template>
  <div class="flex items-center justify-center gap-3 lg:hidden" role="group" aria-label="ปุ่มบังคับไดโน">
    <button
      type="button"
      class="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-sm font-medium text-ink-muted shadow-soft transition-colors active:bg-primary-100 active:text-primary-700"
      @pointerdown.prevent="emit('jump')"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      กระโดด
    </button>

    <button
      type="button"
      class="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-sm font-medium text-ink-muted shadow-soft transition-colors active:bg-primary-100 active:text-primary-700"
      @pointerdown.prevent="emit('duck', true)"
      @pointerup.prevent="emit('duck', false)"
      @pointercancel.prevent="emit('duck', false)"
      @pointerleave="emit('duck', false)"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      หมอบ (กดค้าง)
    </button>
  </div>
</template>
