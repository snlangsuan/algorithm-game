<script setup lang="ts">
/**
 * ปุ่ม "i" ที่กดแล้วค่อยอ่านคำอธิบาย
 *
 * หน้าเกมมีของที่ต้องจ้องเยอะอยู่แล้ว คำอธิบายที่อ่านรอบเดียวก็พอจึงไม่ควรกินที่ถาวร
 * โดยเฉพาะในรางขวาที่ยาวจนตกจอ — พับเก็บไว้ในนี้ ใครอยากรู้ค่อยกด
 */
const props = withDefaults(
  defineProps<{
    /** ข้อความบนปุ่มสำหรับ screen reader — บอกว่าอธิบายเรื่องอะไร */
    label?: string
    /** อยากให้ป้ายกางไปทางไหน — ชิดขวาเป็นค่าตั้งต้น เพราะไอคอนมักอยู่ท้ายแถว */
    align?: 'left' | 'right'
  }>(),
  { label: 'ดูคำอธิบาย', align: 'right' }
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)

/** กางแล้วพ้นขอบจอก็พลิกไปอีกด้าน — ไอคอนตัวเดียวกันอยู่คนละที่ได้ตามขนาดจอ */
const flipped = ref(false)

/** ไอคอนที่อยู่ท้ายราง ป้ายจะล้นขอบล่าง จึงกางขึ้นแทน */
const upward = ref(false)

const side = computed<'left' | 'right'>(() => {
  if (!flipped.value) return props.align
  return props.align === 'right' ? 'left' : 'right'
})

/** กดที่อื่นหรือกด Esc ก็ปิด — ป้ายนี้ไม่ควรค้างบังของอื่นไว้ */
function dismiss(event: Event): void {
  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') open.value = false
    return
  }

  if (!root.value?.contains(event.target as Node)) open.value = false
}

watch(open, async (value) => {
  flipped.value = false
  upward.value = false
  if (!value) return

  await nextTick()

  const box = panel.value?.getBoundingClientRect()
  if (!box) return

  const edge = 8
  if (box.right > window.innerWidth - edge || box.left < edge) flipped.value = true

  // กางขึ้นก็ต่อเมื่อข้างบนมีที่พอจริง ไม่งั้นล้นขอบบนแทน ซึ่งแย่กว่า
  if (box.bottom > window.innerHeight - edge && box.height + edge < box.top) upward.value = true
})

watchEffect((onCleanup) => {
  if (!open.value) return

  document.addEventListener('click', dismiss)
  document.addEventListener('keydown', dismiss)

  onCleanup(() => {
    document.removeEventListener('click', dismiss)
    document.removeEventListener('keydown', dismiss)
  })
})
</script>

<template>
  <span ref="root" class="relative inline-flex align-middle">
    <button
      type="button"
      class="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none ring-1 transition-colors"
      :class="
        open
          ? 'bg-primary-600 text-white ring-primary-600'
          : 'bg-surface-sunken text-ink-muted ring-line-strong hover:bg-primary-50 hover:text-primary-700'
      "
      :aria-label="label"
      :aria-expanded="open"
      @click.stop="open = !open"
    >
      i
    </button>

    <span
      v-if="open"
      ref="panel"
      class="absolute z-30 w-60 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-surface p-2.5 text-left text-[11px] font-normal leading-relaxed text-ink-muted shadow-lift"
      :class="[side === 'right' ? 'right-0' : 'left-0', upward ? 'bottom-6' : 'top-6']"
    >
      <slot />
    </span>
  </span>
</template>
