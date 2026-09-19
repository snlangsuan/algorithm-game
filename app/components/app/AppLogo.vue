<script setup lang="ts">
withDefaults(defineProps<{ to?: string }>(), { to: '/' })
</script>

<template>
  <NuxtLink :to="to" class="group inline-flex items-center gap-2.5">
    <span
      class="grid size-9 place-items-center rounded-xl bg-primary-600 text-white shadow-soft transition-transform duration-200 group-hover:scale-105"
    >
      <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
        <path
          d="M4 7h5l3 10h8"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="4" cy="7" r="2" fill="currentColor" />
        <circle cx="20" cy="17" r="2" fill="currentColor" />
      </svg>
    </span>
    <span class="text-base font-semibold tracking-tight text-ink">
      Algorithm<span class="text-primary-600">Game</span>
    </span>
  </NuxtLink>
</template>
