<script setup lang="ts">
import { demoFor } from '~/data/algorithm-blocks'
import { figureFor } from '~/data/algorithm-figures'
import { BIG_O_NOTE, GROUP_LABEL, TOPICS, findTopic } from '~/data/algorithms'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const topic = computed(() => findTopic(slug.value))

if (!topic.value) {
  throw createError({ statusCode: 404, statusMessage: 'ไม่มีหัวข้อนี้', fatal: true })
}

useSeoMeta({
  title: () => `${topic.value!.name} (${topic.value!.english}) — Algorithm Game`,
  description: () => topic.value!.tagline
})

const demo = computed(() => demoFor(slug.value, topic.value!.preset))

/** ภาพจากเอนจินจริง — สร้างครั้งเดียวแล้วแคชไว้ใน algorithm-figures.ts */
const figure = computed(() => figureFor(slug.value))

/** หัวข้อถัดไปในลิสต์ ไว้ให้อ่านต่อโดยไม่ต้องย้อนกลับ */
const next = computed(() => {
  const at = TOPICS.findIndex((item) => item.slug === slug.value)
  return TOPICS[(at + 1) % TOPICS.length]
})
</script>

<template>
  <UiContainer v-if="topic">
    <div class="py-12 sm:py-16">
      <NuxtLink
        to="/learn"
        class="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-primary-700"
      >
        <svg viewBox="0 0 24 24" fill="none" class="size-4" aria-hidden="true">
          <path d="M19 12H6M11 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        ความรู้ทั้งหมด
      </NuxtLink>

      <header class="mt-7 border-b border-line pb-10">
        <p class="font-mono text-xs text-ink-subtle">{{ GROUP_LABEL[topic.group] }}</p>
        <h1 class="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {{ topic.name }}
        </h1>
        <p class="mt-1.5 font-mono text-sm text-primary-700">{{ topic.english }}</p>

        <div class="mt-6 max-w-2xl space-y-3">
          <p v-for="(line, index) in topic.what" :key="index" class="text-base leading-relaxed text-ink-muted">
            {{ line }}
          </p>
        </div>
      </header>

      <div class="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div class="space-y-12">
          <!-- ภาพมาก่อนคำอธิบาย เพราะจุดประสงค์คือให้เห็นก่อนว่าหน้าตามันเป็นยังไง -->
          <section v-if="figure">
            <h2 class="text-lg font-semibold tracking-tight text-ink">หน้าตาในเกมจริง</h2>
            <LearnFigure class="mt-4" :figure="figure" />
          </section>

          <section>
            <h2 class="text-lg font-semibold tracking-tight text-ink">ทำงานยังไง</h2>
            <ol class="mt-4 space-y-3">
              <li v-for="(step, index) in topic.steps" :key="index" class="flex gap-4">
                <span class="mt-0.5 font-mono text-xs tabular-nums text-ink-subtle">
                  {{ String(index + 1).padStart(2, '0') }}
                </span>
                <p class="flex-1 text-sm leading-relaxed text-ink-muted">{{ step }}</p>
              </li>
            </ol>
          </section>

          <!-- อธิบายด้วยบล็อก ภาษาภาพเดียวกับที่ใช้เล่นจริง -->
          <section v-if="demo">
            <h2 class="text-lg font-semibold tracking-tight text-ink">เขียนเป็นบล็อกแล้วหน้าตาแบบนี้</h2>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{{ demo.note }}</p>

            <BlockScript
              class="mt-5"
              :pack="demo.pack"
              :program="demo.program"
            />

            <p v-if="topic.group !== 'blocks'" class="mt-3 text-[11px] leading-relaxed text-ink-subtle">
              บล็อกที่ขึ้นต้นว่า "โค้ด" คือส่วนที่ยังไม่มีบล็อกรองรับ ต้องเขียนเป็นโค้ดเอา —
              ลากออกมาจากกล่องเครื่องมือไม่ได้
            </p>
          </section>

          <section>
            <h2 class="text-lg font-semibold tracking-tight text-ink">มาจากไหน</h2>
            <div class="mt-4 max-w-2xl space-y-3.5">
              <p v-for="(line, index) in topic.theory.origin" :key="index" class="text-sm leading-relaxed text-ink-muted">
                {{ line }}
              </p>
            </div>

            <p class="mt-6 text-[11px] text-ink-subtle">งานต้นฉบับ</p>
            <ul class="mt-2 space-y-3 border-l-2 border-line pl-4">
              <li v-for="paper in topic.theory.papers" :key="paper.cite">
                <p class="text-sm leading-relaxed text-ink">{{ paper.cite }}</p>
                <p v-if="paper.note" class="mt-0.5 text-[11px] text-ink-subtle">{{ paper.note }}</p>
              </li>
            </ul>
          </section>

          <!-- เหตุผลเบื้องหลัง แยกจากที่มา เพราะเป็นคนละคำถาม: ใครคิด กับ ทำไมมันเวิร์ก -->
          <section>
            <h2 class="text-lg font-semibold tracking-tight text-ink">ทำไมมันถึงได้ผล</h2>
            <div class="mt-4 max-w-2xl space-y-3.5">
              <p v-for="(line, index) in topic.theory.why" :key="index" class="text-sm leading-relaxed text-ink-muted">
                {{ line }}
              </p>
            </div>

            <div v-if="topic.theory.guarantee" class="mt-6 max-w-2xl rounded-xl border border-line p-4">
              <p class="text-[11px] text-ink-subtle">รับประกันอะไร</p>
              <p class="mt-1 text-sm leading-relaxed text-ink-muted">{{ topic.theory.guarantee }}</p>
            </div>
          </section>

          <section>
            <h2 class="text-lg font-semibold tracking-tight text-ink">แพงแค่ไหน</h2>

            <div class="mt-4 grid gap-4 rounded-xl bg-surface-muted p-4 sm:grid-cols-2">
              <div>
                <p class="text-[11px] text-ink-subtle">ความซับซ้อนเชิงเวลา</p>
                <p class="mt-1 font-mono text-[13px] leading-relaxed text-ink">{{ topic.theory.bigO.time }}</p>
              </div>
              <div>
                <p class="text-[11px] text-ink-subtle">ความซับซ้อนเชิงพื้นที่</p>
                <p class="mt-1 font-mono text-[13px] leading-relaxed text-ink">{{ topic.theory.bigO.space }}</p>
              </div>
            </div>

            <p class="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">{{ topic.theory.bigO.plain }}</p>
            <p class="mt-4 max-w-2xl text-[11px] leading-relaxed text-ink-subtle">{{ BIG_O_NOTE }}</p>
          </section>

          <section v-if="topic.blocker">
            <h2 class="text-lg font-semibold tracking-tight text-ink">ทำไมยังต่อด้วยบล็อกไม่ได้</h2>
            <p class="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{{ topic.blocker }}</p>
          </section>
        </div>

        <aside class="space-y-8 lg:border-l lg:border-line lg:pl-10">
          <div>
            <h2 class="text-sm font-semibold text-ink">อยู่ตรงไหนในเกมนี้</h2>
            <p class="mt-2 text-sm leading-relaxed text-ink-muted">{{ topic.inGame }}</p>

            <p v-if="topic.source" class="mt-3 font-mono text-[11px] leading-relaxed text-ink-subtle">
              {{ topic.source }}
            </p>

            <UiButton
              v-if="topic.preset"
              class="mt-4"
              size="sm"
              variant="outline"
              :to="topic.preset.game === 'maze' ? '/maze' : '/othello'"
            >
              ไปลองเล่น
            </UiButton>
          </div>

          <div class="border-t border-line pt-6">
            <h2 class="text-sm font-semibold text-ink">ต้นทุน</h2>
            <dl class="mt-3 space-y-2.5">
              <div>
                <dt class="text-[11px] text-ink-subtle">เวลา</dt>
                <dd class="text-sm text-ink-muted">{{ topic.cost.time }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-ink-subtle">ความจำที่ใช้</dt>
                <dd class="text-sm text-ink-muted">{{ topic.cost.space }}</dd>
              </div>
            </dl>
          </div>

          <div class="border-t border-line pt-6">
            <h2 class="text-sm font-semibold text-ink">ดีตรงไหน เสียตรงไหน</h2>
            <p class="mt-3 text-sm leading-relaxed text-emerald-700">{{ topic.good }}</p>
            <p class="mt-2.5 text-sm leading-relaxed text-ink-muted">{{ topic.bad }}</p>
          </div>
        </aside>
      </div>

      <NuxtLink
        v-if="next"
        :to="`/learn/${next.slug}`"
        class="group mt-14 flex items-baseline justify-between gap-4 border-t border-line pt-8"
      >
        <span>
          <span class="text-xs text-ink-subtle">อ่านต่อ</span>
          <span class="mt-0.5 block text-lg font-semibold text-ink transition-colors group-hover:text-primary-700">
            {{ next.name }}
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" class="size-5 shrink-0 text-primary-700 transition-transform group-hover:translate-x-1" aria-hidden="true">
          <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </NuxtLink>
    </div>
  </UiContainer>
</template>
