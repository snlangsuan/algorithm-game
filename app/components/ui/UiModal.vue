<script setup lang="ts">
const open = defineModel<boolean>({ required: true })

withDefaults(
  defineProps<{ title?: string; description?: string; wide?: boolean; full?: boolean }>(),
  { wide: false, full: false }
)

const close = () => (open.value = false)

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="page">
        <div v-if="open" class="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="close" />

          <div
            role="dialog"
            aria-modal="true"
            class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card border border-line bg-surface shadow-lift sm:rounded-card"
            :class="full ? 'sm:max-w-6xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'"
          >
            <header class="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h2 v-if="title" class="text-base font-semibold text-ink">{{ title }}</h2>
                <p v-if="description" class="mt-1 text-sm text-ink-muted">{{ description }}</p>
              </div>

              <button
                type="button"
                aria-label="ปิด"
                class="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-primary-50 hover:text-primary-700"
                @click="close"
              >
                <svg viewBox="0 0 24 24" fill="none" class="size-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </header>

            <div class="flex-1 overflow-y-auto px-6 py-5">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="border-t border-line bg-surface-muted px-6 py-4">
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
