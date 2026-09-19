<script setup lang="ts">
const { mainNav } = useNavigation()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-line bg-surface">
    <UiContainer>
      <div class="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AppLogo />
          <p class="mt-3 max-w-sm text-sm text-ink-muted">
            เรียนรู้อัลกอริทึมผ่านการเล่น ทีละก้าว ทีละแนวคิด
          </p>
        </div>

        <nav class="flex flex-wrap gap-x-5 gap-y-2">
          <NuxtLink
            v-for="item in mainNav"
            :key="item.to"
            :to="item.to"
            class="text-sm text-ink-muted transition-colors hover:text-primary-700"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>

      <div class="border-t border-line py-5 text-xs text-ink-subtle">
        © {{ year }} Algorithm Game
      </div>
    </UiContainer>
  </footer>
</template>
