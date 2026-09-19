<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

const model = defineModel<string>({ required: true })

defineProps<{ options: SelectOption[]; label?: string; disabled?: boolean }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-medium text-ink-muted">{{ label }}</span>

    <select
      v-model="model"
      :disabled="disabled"
      class="w-full appearance-none rounded-xl border border-line-strong bg-surface bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat py-2.5 pl-3.5 pr-9 text-sm text-ink transition-colors hover:border-primary-300 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235c5370%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
