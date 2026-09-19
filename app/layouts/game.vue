<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-sunken">
    <AppGameBar :title="title" />

    <main class="flex flex-1 flex-col">
      <slot />
    </main>
  </div>
</template>
