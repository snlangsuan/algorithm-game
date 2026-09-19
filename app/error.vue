<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <NuxtLayout>
    <UiContainer size="sm">
      <div class="py-24 text-center">
        <p class="text-6xl font-semibold text-primary-600">{{ error.statusCode }}</p>
        <h1 class="mt-4 text-2xl font-semibold text-ink">ไม่พบหน้าที่ต้องการ</h1>
        <p class="mt-3 text-sm text-ink-muted">{{ error.message }}</p>

        <div class="mt-8">
          <UiButton @click="clearError({ redirect: '/' })">กลับหน้าแรก</UiButton>
        </div>
      </div>
    </UiContainer>
  </NuxtLayout>
</template>
