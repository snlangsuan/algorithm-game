<script setup lang="ts">
import type { TabItem } from '~/components/ui/UiTabs.vue'

defineProps<{ tabs?: TabItem[] }>()

const tab = defineModel<string>('tab', { required: false, default: '' })
</script>

<template>
  <div>
    <slot name="summary" />

    <div v-if="tabs?.length" class="mt-3">
      <UiTabs v-model="tab" :tabs="tabs" />
    </div>

    <div class="mt-3 space-y-2.5">
      <slot v-if="tabs?.length" :name="tab" />
      <slot v-else />
    </div>
  </div>
</template>
