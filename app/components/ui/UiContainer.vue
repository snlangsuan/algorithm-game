<script setup lang="ts">
type Size = 'sm' | 'md' | 'lg'

withDefaults(defineProps<{ size?: Size }>(), { size: 'lg' })

const sizes: Record<Size, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl'
}
</script>

<template>
  <div class="mx-auto w-full px-4 sm:px-6 lg:px-8" :class="sizes[size]">
    <slot />
  </div>
</template>
