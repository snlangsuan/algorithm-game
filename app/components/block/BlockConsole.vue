<script setup lang="ts">
import type { LogLine } from '~/game/shared/console'

/** แผงคอนโซล — ข้อความที่โปรแกรมของผู้เล่นพิมพ์ออกมา ใช้เหมือนกันทุกเกม */
const props = withDefaults(defineProps<{ lines: LogLine[]; running?: boolean }>(), {
  running: false
})

const emit = defineEmits<{ clear: [] }>()

const scroller = ref<HTMLDivElement | null>(null)
const open = ref(true)

/** เลื่อนตามบรรทัดล่าสุดเสมอ */
watch(
  () => props.lines.length,
  async () => {
    if (!open.value) return
    await nextTick()
    const box = scroller.value
    if (box) box.scrollTop = box.scrollHeight
  }
)
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-[#1c1524]">
    <div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        @click="open = !open"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          class="size-3.5 shrink-0 text-white/50 transition-transform"
          :class="open ? '' : '-rotate-90'"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>

        <span class="font-mono text-[11px] text-white/50">คอนโซล</span>

        <span
          v-if="lines.length"
          class="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums text-white/60"
        >
          {{ lines.length }}
        </span>

        <span
          v-if="running"
          class="ml-1 size-1.5 shrink-0 animate-pulse rounded-full bg-primary-400"
          aria-hidden="true"
        />
      </button>

      <button
        v-if="lines.length"
        type="button"
        class="shrink-0 text-[11px] text-white/40 transition-colors hover:text-white/80"
        @click="emit('clear')"
      >
        ล้าง
      </button>
    </div>

    <div v-if="open" ref="scroller" class="max-h-44 overflow-auto px-3 py-2">
      <p v-if="!lines.length" class="font-mono text-[11px] leading-relaxed text-white/30">
        ใช้บล็อก "พิมพ์ … ลงคอนโซล" (หรือ console.log ในโหมดเขียนโค้ด) แล้วข้อความจะมาโผล่ที่นี่
      </p>

      <p
        v-for="(line, index) in lines"
        :key="index"
        class="flex gap-2 font-mono text-[11px] leading-relaxed"
      >
        <span v-if="line.line" class="shrink-0 tabular-nums text-white/25">{{ line.line }}</span>
        <span class="min-w-0 whitespace-pre-wrap break-words text-white/80">{{ line.text }}</span>
      </p>
    </div>
  </div>
</template>
