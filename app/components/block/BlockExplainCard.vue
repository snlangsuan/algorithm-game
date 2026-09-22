<script setup lang="ts">
import { CATEGORY_STYLE, findSpec } from '~/game/blocks/types'
import { TOPICS } from '~/data/algorithms'
import { blockSource, useBlockExplain } from '~/composables/useBlockExplain'

/**
 * การ์ด "บล็อกนี้คิดยังไง" — เปิดกล่องดำของบล็อกที่ซ่อนอัลกอริทึมไว้ข้างใน
 *
 * เรียงจากง่ายไปลึก: ใจความ → ทำอะไรทีละขั้น → สูตร → ตัวเลขที่ตั้งไว้ → จุดอ่อน → โค้ดจริง
 * อ่านแค่สองหัวข้อแรกก็ควรเข้าใจแล้ว ที่เหลือไว้สำหรับคนอยากเขียนเอง
 */
const { kind, close } = useBlockExplain()

const open = computed({
  get: () => kind.value !== null,
  set: (value: boolean) => {
    if (!value) close()
  }
})

const spec = computed(() => (kind.value ? findSpec(kind.value) : undefined))
const explain = computed(() => spec.value?.explain)
const style = computed(() => CATEGORY_STYLE[spec.value?.category ?? 'action'])
const topic = computed(() => TOPICS.find((item) => item.slug === explain.value?.learn))

const code = ref<Array<{ name: string; code: string }> | null>(null)
const showCode = ref(false)
const loading = ref(false)

watch(kind, () => {
  code.value = null
  showCode.value = false
})

async function toggleCode() {
  showCode.value = !showCode.value
  if (!showCode.value || code.value || !kind.value) return

  loading.value = true
  try {
    code.value = await blockSource(kind.value)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" above wide :title="spec?.title ?? ''">
    <div v-if="spec && explain" class="space-y-5 text-sm leading-relaxed text-ink">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="style.chip">
          บล็อกนี้คิดยังไง
        </span>
        <span v-if="spec.hint" class="text-xs text-ink-muted">{{ spec.hint }}</span>
      </div>

      <p class="text-[15px]">{{ explain.idea }}</p>

      <section>
        <h3 class="mb-2 text-xs font-semibold text-ink-muted">ทุกครั้งที่บล็อกนี้ทำงาน มันทำแบบนี้</h3>
        <ol class="space-y-1.5">
          <li v-for="(step, index) in explain.steps" :key="index" class="flex gap-2.5">
            <span
              class="grid size-5 shrink-0 place-items-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-800"
            >
              {{ index + 1 }}
            </span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </section>

      <section v-if="explain.rule">
        <h3 class="mb-2 text-xs font-semibold text-ink-muted">กติกาการเลือก</h3>
        <p class="whitespace-pre-line rounded-xl bg-surface-muted px-4 py-3 font-mono text-[13px] ring-1 ring-line">
          {{ explain.rule }}
        </p>
      </section>

      <section v-if="explain.knobs?.length">
        <h3 class="mb-2 text-xs font-semibold text-ink-muted">ตัวเลขที่ตั้งไว้ในบล็อก</h3>
        <dl class="divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
          <div v-for="knob in explain.knobs" :key="knob.name" class="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_1fr]">
            <dt class="font-medium">
              {{ knob.name }}
              <span class="ml-1 rounded bg-primary-50 px-1.5 font-mono text-xs text-primary-800">{{ knob.value }}</span>
            </dt>
            <dd class="text-ink-muted">{{ knob.why }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="explain.unpacks">
        <h3 class="mb-2 text-xs font-semibold text-ink-muted">แกะกล่องดูข้างใน</h3>
        <p class="rounded-xl bg-primary-50 px-4 py-3 text-primary-900 ring-1 ring-primary-200">{{ explain.unpacks }}</p>
      </section>

      <section v-if="explain.weakness">
        <h3 class="mb-2 text-xs font-semibold text-ink-muted">พลาดตรงไหนได้บ้าง</h3>
        <p class="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 ring-1 ring-amber-200">{{ explain.weakness }}</p>
      </section>

      <section v-if="showCode">
        <p v-if="loading" class="text-xs text-ink-subtle">กำลังเปิดโค้ด…</p>
        <div v-for="item in code ?? []" :key="item.name" class="mb-3">
          <p class="mb-1 font-mono text-xs text-ink-muted">this.{{ item.name }}()</p>
          <pre
            class="max-h-80 overflow-auto rounded-xl bg-ink px-4 py-3 font-mono text-[12px] leading-relaxed text-white"
          >{{ item.code }}</pre>
        </div>
      </section>
    </div>

    <template v-if="explain" #footer>
      <div class="flex flex-wrap items-center gap-2">
        <UiButton v-if="explain.code?.length" size="sm" variant="outline" @click="toggleCode">
          {{ showCode ? 'ซ่อนโค้ด' : 'ดูโค้ดจริงที่บล็อกนี้รัน' }}
        </UiButton>
        <UiButton v-if="topic" size="sm" variant="ghost" :to="`/learn/${topic.slug}`" @click="close">
          อ่านเรื่อง {{ topic.name }} ต่อ →
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>
