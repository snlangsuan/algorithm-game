<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    to?: RouteLocationRaw
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    block: false
  }
)

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white shadow-soft hover:bg-primary-700 active:bg-primary-800',
  secondary: 'bg-primary-100 text-primary-800 hover:bg-primary-200 active:bg-primary-300',
  outline: 'border border-line-strong bg-surface text-ink hover:border-primary-400 hover:text-primary-700',
  ghost: 'text-ink-muted hover:bg-primary-50 hover:text-primary-700'
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5'
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-full font-medium transition-colors duration-150',
  'disabled:pointer-events-none disabled:opacity-50',
  variants[props.variant],
  sizes[props.size],
  props.block ? 'w-full' : ''
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
