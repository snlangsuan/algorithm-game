<script setup lang="ts">
const items = [
  { label: 'จุดเริ่ม', class: 'bg-emerald-500' },
  { label: 'ทางออก', class: 'bg-transparent ring-2 ring-inset ring-amber-500' },
  { label: 'กำแพง', class: 'bg-[#332450]' },
  { label: 'โคลน ×5', class: 'bg-[#f6e3b4] ring-1 ring-inset ring-amber-200' },
  { label: 'ช่องที่สำรวจ', class: 'bg-gradient-to-br from-primary-100 to-primary-400' },
  { label: 'เส้นทางที่เดิน', class: 'bg-primary-600' },
  { label: 'เฉลย', class: 'bg-emerald-500/30 ring-1 ring-dashed ring-emerald-500' }
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
    <span v-for="item in items" :key="item.label" class="inline-flex items-center gap-1.5 text-[11px] text-ink-subtle">
      <span class="size-2.5 rounded-[3px]" :class="item.class" />
      {{ item.label }}
    </span>
  </div>
</template>
