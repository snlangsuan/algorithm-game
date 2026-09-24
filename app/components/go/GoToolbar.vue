<script setup lang="ts">
/** สถานะของเกม — ชุดเดียวกับที่ composable ของหน้าเกมใช้ (ประกาศซ้ำในนี้ เพื่อไม่ให้คอมโพเนนต์ผูกกับ composable) */
type GoStatus = 'setup' | 'playing' | 'paused' | 'finished' | 'error'

interface GoSpeedOption {
  value: number
  label: string
}

/**
 * แถบควบคุมเกมหมากล้อม
 *
 * ตัวเลือกจังหวะรับมาเป็น prop แทนที่จะ import เอง เพราะคอมโพเนนต์นี้ไม่ควรรู้จัก
 * ไฟล์ของเกมไหนเป็นพิเศษ — หน้าเกมส่งชุดเดียวกับเกมอื่นเข้ามาได้เลย
 */
withDefaults(
  defineProps<{
    status: GoStatus
    /** กำลังโหลดโปรแกรมของบอทอยู่ — กันกดเริ่มซ้ำ */
    starting: boolean
    /** ตอนนี้ถึงตาคนจริง ๆ และผ่านตาได้ */
    canPass: boolean
    /** ย้อนตาที่แล้วได้ไหม */
    canUndo?: boolean
    speeds?: GoSpeedOption[]
  }>(),
  {
    speeds: () => [
      { value: 0, label: 'ทันที' },
      { value: 200, label: 'เร็ว' },
      { value: 500, label: 'ปกติ' },
      { value: 1000, label: 'ช้า' }
    ]
  }
)

const speed = defineModel<number>('speed', { required: true })

/** ระบายสีพื้นที่ที่แต่ละฝ่ายถือครองอยู่บนกระดานไหม */
const area = defineModel<boolean>('area', { required: true })

const emit = defineEmits<{ start: []; pause: []; resume: []; stop: []; pass: []; undo: []; reset: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-2.5 shadow-soft">
    <div class="flex items-center gap-2">
      <UiButton v-if="status === 'playing'" size="sm" variant="secondary" @click="emit('pause')">
        พัก
      </UiButton>

      <UiButton v-else-if="status === 'paused'" size="sm" @click="emit('resume')">เล่นต่อ</UiButton>

      <UiButton v-else size="sm" :disabled="starting" @click="emit('start')">
        {{ starting ? 'กำลังโหลดโปรแกรม…' : status === 'setup' ? 'เริ่มเกม' : 'เริ่มเกมใหม่' }}
      </UiButton>

      <UiButton
        v-if="status === 'playing' || status === 'paused'"
        size="sm"
        variant="outline"
        @click="emit('stop')"
      >
        หยุด
      </UiButton>

      <!-- ผ่านตาเป็นการ "เดิน" อย่างหนึ่งของโกะ ไม่ใช่การยอมแพ้ จึงอยู่ในแถวเดียวกับปุ่มเล่น -->
      <UiButton size="sm" variant="outline" :disabled="!canPass" @click="emit('pass')">
        ผ่านตา
      </UiButton>

      <button
        type="button"
        title="ย้อนหนึ่งตา"
        :disabled="!canUndo"
        class="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700 disabled:pointer-events-none disabled:opacity-40"
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4.5" aria-hidden="true">
          <path d="M9 14L4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 9h10a6 6 0 010 12h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <button
        type="button"
        title="ล้างกระดาน เริ่มใหม่ตั้งแต่ต้น"
        class="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700"
        @click="emit('reset')"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4.5" aria-hidden="true">
          <path d="M20 11a8 8 0 10-2.3 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M20 5v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- ระบายพื้นที่ — เปิดไว้ก่อน เพราะเป็นสิ่งที่ตัดสินแพ้ชนะแต่มองด้วยตาเปล่ายาก -->
      <button
        type="button"
        class="rounded-full px-2.5 py-1.5 text-[11px] font-medium ring-1 ring-inset transition-colors"
        :class="area ? 'bg-primary-100 text-primary-800 ring-primary-200' : 'bg-surface text-ink-subtle ring-line hover:text-ink-muted'"
        :title="area ? 'ซ่อนสีพื้นที่' : 'ระบายสีพื้นที่ที่แต่ละฝ่ายถือครอง'"
        @click="area = !area"
      >
        พื้นที่
      </button>
    </div>

    <UiInfo label="ผ่านตาแล้วเกิดอะไรขึ้น" align="left">
      ตาไหนไม่มีที่คุ้มค่าให้ลงแล้วก็ผ่านตาได้ ถ้าผ่านติดกันทั้งสองฝ่ายถือว่าจบเกม
      แล้วมานับพื้นที่กัน
    </UiInfo>

    <div class="ml-auto flex items-center gap-1.5">
      <span class="hidden text-[11px] text-ink-subtle xl:inline">จังหวะบอท</span>
      <div class="flex rounded-full bg-surface-sunken p-0.5">
        <button
          v-for="option in speeds"
          :key="option.value"
          type="button"
          class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          :class="speed === option.value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-primary-700'"
          @click="speed = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
