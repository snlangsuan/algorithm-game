<script setup lang="ts">
const { mainNav } = useNavigation()
const route = useRoute()
const open = ref(false)

watch(() => route.fullPath, () => (open.value = false))
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur">
    <UiContainer>
      <div class="flex h-16 items-center justify-between gap-4">
        <AppLogo />

        <nav class="hidden items-center gap-1 md:flex">
          <AppNavLink v-for="item in mainNav" :key="item.to" :to="item.to">
            {{ item.label }}
          </AppNavLink>
        </nav>

        <div class="hidden md:block">
          <UiButton to="/play" size="sm">เริ่มเล่น</UiButton>
        </div>

        <button
          type="button"
          class="grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700 md:hidden"
          :aria-expanded="open"
          aria-label="สลับเมนู"
          @click="open = !open"
        >
          <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
            <path
              :d="open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <nav v-if="open" class="flex flex-col gap-1 border-t border-line py-3 md:hidden">
        <AppNavLink v-for="item in mainNav" :key="item.to" :to="item.to">
          {{ item.label }}
        </AppNavLink>
        <UiButton to="/play" size="sm" class="mt-2">เริ่มเล่น</UiButton>
      </nav>
    </UiContainer>
  </header>
</template>
