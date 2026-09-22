<script setup lang="ts">
import { GROUP_LABEL, GROUP_NOTE, GROUP_ORDER, topicsIn } from '~/data/algorithms'

useSeoMeta({
  title: 'ความรู้ — Algorithm Game',
  description:
    'อัลกอริทึมที่อยู่เบื้องหลังเกมนี้ — เลาะกำแพง, โลภ, GA, DFS, BFS, Dijkstra, A*, minimax, PID, ฝูงนก (PSO), ฝูงมด (ACO), ฝูงปลา (Boids) พร้อมบล็อกอธิบายการทำงาน'
})

const groups = GROUP_ORDER.map((group) => ({
  id: group,
  label: GROUP_LABEL[group],
  note: GROUP_NOTE[group],
  topics: topicsIn(group)
})).filter((group) => group.topics.length > 0)
</script>

<template>
  <UiContainer>
    <div class="py-14 sm:py-20">
      <h1 class="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        อัลกอริทึมที่อยู่เบื้องหลังเกมนี้
      </h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
        ทุกหัวข้อผูกกับของจริงในโปรเจกต์ ไม่ใช่ตำราลอย ๆ —
        อันไหนต่อด้วยบล็อกได้ก็มีตัวอย่างให้กดดู อันไหนยังทำไม่ได้ก็บอกตรง ๆ ว่าติดตรงไหน
      </p>

      <div class="mt-14 space-y-14">
        <section v-for="group in groups" :key="group.id">
          <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 class="text-xl font-semibold tracking-tight text-ink">{{ group.label }}</h2>
            <span class="font-mono text-xs tabular-nums text-ink-subtle">{{ group.topics.length }} หัวข้อ</span>
          </div>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{{ group.note }}</p>

          <ul class="mt-6 divide-y divide-line border-y border-line">
            <li v-for="topic in group.topics" :key="topic.slug">
              <NuxtLink
                :to="`/learn/${topic.slug}`"
                class="group grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-baseline"
              >
                <div class="min-w-0">
                  <h3 class="text-base font-semibold text-ink transition-colors group-hover:text-primary-700">
                    {{ topic.name }}
                  </h3>
                  <p class="font-mono text-[11px] text-ink-subtle">{{ topic.english }}</p>
                </div>

                <p class="text-sm leading-relaxed text-ink-muted">{{ topic.tagline }}</p>

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  class="hidden size-4 shrink-0 text-primary-700 transition-transform group-hover:translate-x-1 sm:block"
                  aria-hidden="true"
                >
                  <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </UiContainer>
</template>
