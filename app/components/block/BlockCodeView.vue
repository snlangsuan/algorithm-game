<script setup lang="ts">
const props = defineProps<{
  code: string
  /** บรรทัดที่กำลังรัน (null = ยังไม่เริ่ม) */
  line: number | null
  /** จำนวนครั้งที่รันแต่ละบรรทัด */
  lines: Record<number, number>
  running: boolean
  /** แทรกตัวนับบรรทัดสำเร็จไหม */
  traced: boolean
  /** แบบเต็มคอลัมน์: ตัวอักษรใหญ่ขึ้นและสูงตามจอ */
  tall?: boolean
  /** ลดความสูงลงเพื่อเว้นที่ให้แผงคอนโซล */
  short?: boolean
}>()

const scroller = ref<HTMLDivElement | null>(null)

interface Row {
  number: number
  text: string
  count: number
  /** ความยาวของแถบความร้อน (0..1) — ใช้สเกล log เพราะบรรทัดในลูปชนะขาดเสมอ */
  heat: number
}

const rows = computed<Row[]>(() => {
  const source = props.code.split('\n')
  const counts = props.lines
  const peak = Math.log1p(Math.max(0, ...Object.values(counts)))

  return source.map((text, index) => {
    const count = counts[index + 1] ?? 0
    return {
      number: index + 1,
      text,
      count,
      heat: count > 0 && peak > 0 ? Math.log1p(count) / peak : 0
    }
  })
})

const hot = computed(() => Object.keys(props.lines).length > 0)

/** เลื่อนบรรทัดที่กำลังรันให้อยู่กลางกรอบ โดยไม่ไปยุ่งกับ scroll ของทั้งหน้า */
watch(
  () => props.line,
  async (line) => {
    if (line === null) return
    await nextTick()

    const box = scroller.value
    const row = box?.querySelector<HTMLElement>(`[data-line="${line}"]`)
    if (!box || !row) return

    const target = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2
    box.scrollTop = Math.max(0, target)
  }
)
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-[#1c1524]">
    <div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
      <p class="font-mono text-white/50" :class="tall ? 'text-xs' : 'text-[11px]'">agent.js</p>

      <span
        v-if="line !== null"
        class="rounded-full px-2 py-0.5 font-mono tabular-nums"
        :class="[
          running ? 'bg-primary-500/30 text-primary-200' : 'bg-white/10 text-white/50',
          tall ? 'text-xs' : 'text-[10px]'
        ]"
      >
        บรรทัด {{ line }}
      </span>
      <span v-else class="font-mono text-white/30" :class="tall ? 'text-xs' : 'text-[10px]'">
        ยังไม่เริ่ม
      </span>

      <slot name="action" />
    </div>

    <div
      ref="scroller"
      class="overflow-auto"
      :class="tall ? (short ? 'max-h-[calc(100vh-21rem)]' : 'max-h-[calc(100vh-13rem)]') : 'max-h-72'"
    >
      <div class="min-w-max py-1">
        <div
          v-for="row in rows"
          :key="row.number"
          :data-line="row.number"
          class="relative flex items-stretch gap-2 pr-3 font-mono"
          :class="[
            tall ? 'text-[13px] leading-[1.7]' : 'text-[11px] leading-[1.45]',
            row.number === line ? 'bg-primary-500/25' : ''
          ]"
        >
          <!-- แถบความร้อน: ยิ่งบรรทัดถูกรันบ่อย แถบยิ่งยาว -->
          <span
            v-if="row.heat > 0"
            class="pointer-events-none absolute inset-y-0 left-0 bg-primary-400/12"
            :style="{ width: `${Math.max(row.heat * 100, 4)}%` }"
          />

          <!-- เลขบรรทัดกับจำนวนครั้งอยู่ในคอลัมน์ที่ปักไว้ซ้าย เลื่อนดูโค้ดยาว ๆ แล้วยังเห็นครบ -->
          <span
            class="sticky left-0 z-10 flex shrink-0 select-none items-baseline gap-2 pr-3 tabular-nums"
            :class="[
              tall ? 'w-24' : 'w-[4.5rem]',
              row.number === line ? 'bg-primary-500/25' : 'bg-[#1c1524]'
            ]"
          >
            <span
              class="w-7 text-right"
              :class="
                row.number === line
                  ? 'text-primary-200'
                  : row.count > 0
                    ? 'text-white/40'
                    : 'text-white/20'
              "
            >
              {{ row.number }}
            </span>

            <span
              class="flex-1 text-right"
              :class="[
                tall ? 'text-[11px]' : 'text-[10px]',
                row.number === line ? 'text-primary-200' : 'text-white/30'
              ]"
              :title="row.count ? `รันบรรทัดนี้ ${row.count.toLocaleString()} ครั้ง` : ''"
            >
              {{ row.count ? `×${row.count.toLocaleString()}` : '' }}
            </span>
          </span>

          <span
            class="relative whitespace-pre pr-4"
            :class="row.number === line ? 'text-white' : row.count > 0 ? 'text-white/75' : 'text-white/40'"
          >{{ row.text || ' ' }}</span>
        </div>
      </div>
    </div>

    <p
      v-if="!traced && hot"
      class="border-t border-white/10 px-3 py-2 leading-relaxed text-white/40"
      :class="tall ? 'text-[11px]' : 'text-[10px]'"
    >
      โค้ดนี้แทรกตัวนับบรรทัดไม่ได้ จึงบอกได้แค่เมธอดที่กำลังรัน
    </p>
    <p
      v-else-if="!hot"
      class="border-t border-white/10 px-3 py-2 leading-relaxed text-white/40"
      :class="tall ? 'text-[11px]' : 'text-[10px]'"
    >
      ตัวเลขทางขวาคือจำนวนครั้งที่บรรทัดนั้นถูกรัน · กด "เริ่มหาทาง" แล้วจะเห็นบรรทัดที่กำลังทำงานวิ่งไปพร้อมกับภาพบนแผนที่
    </p>
  </div>
</template>
