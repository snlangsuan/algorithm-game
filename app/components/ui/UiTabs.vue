<script setup lang="ts">
export interface TabItem {
  value: string
  label: string
  badge?: string | number
}

const model = defineModel<string>({ required: true })

defineProps<{ tabs: TabItem[] }>()
</script>

<template>
  <div class="flex gap-1 rounded-full bg-surface-sunken p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
      :class="
        model === tab.value
          ? 'bg-surface text-primary-700 shadow-soft'
          : 'text-ink-muted hover:text-primary-700'
      "
      @click="model = tab.value"
    >
      {{ tab.label }}
      <span
        v-if="tab.badge"
        class="rounded-full px-1.5 text-[10px] tabular-nums"
        :class="model === tab.value ? 'bg-primary-100 text-primary-700' : 'bg-line text-ink-subtle'"
      >
        {{ tab.badge }}
      </span>
    </button>
  </div>
</template>
