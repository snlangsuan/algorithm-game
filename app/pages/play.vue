<script setup lang="ts">
import { CATEGORY_LABEL, CATEGORY_ORDER } from '~/game/blocks/types'

useSeoMeta({
  title: 'เลือกเกม — Algorithm Game',
  description: 'เขาวงกตกับ Othello — เลือกเกมแล้วต่อบล็อกให้บอทเล่นเอง'
})

/** หมวดบล็อกเป็นชุดเดียวกันทุกเกม เลยบอกไว้ตรงนี้ครั้งเดียว */
const categories = CATEGORY_ORDER.map((category) => CATEGORY_LABEL[category])
</script>

<template>
  <UiContainer>
    <div class="py-14 sm:py-20">
      <h1 class="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        เลือกเกม แล้วเริ่มต่อบล็อกได้เลย
      </h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
        ไม่ต้องสมัคร ไม่ต้องติดตั้ง ทุกอย่างทำงานอยู่ในเบราว์เซอร์นี้
        โปรแกรมที่ต่อไว้จะอยู่จนกว่าจะปิดหน้า
      </p>

      <GameChooser class="mt-10" />

      <div class="mt-14 grid gap-8 border-t border-line pt-10 sm:grid-cols-2 lg:gap-14">
        <div>
          <h2 class="text-base font-semibold text-ink">บล็อกแบ่งเป็นสี่หมวด</h2>
          <p class="mt-2 text-sm leading-relaxed text-ink-muted">
            เหมือนกันทั้งสองเกม ต่างกันแค่คำศัพท์ข้างใน จำที่เดียวใช้ได้ทั้งคู่
          </p>

          <ol class="mt-4 space-y-1.5">
            <li
              v-for="(label, index) in categories"
              :key="label"
              class="flex gap-3 text-sm text-ink-muted"
            >
              <span class="font-mono text-xs tabular-nums text-ink-subtle">{{ index + 1 }}</span>
              {{ label }}
            </li>
          </ol>
        </div>

        <div>
          <h2 class="text-base font-semibold text-ink">ตัวอย่างสำเร็จรูปแก้ไม่ได้</h2>
          <p class="mt-2 text-sm leading-relaxed text-ink-muted">
            ตัวอย่างที่ให้มาเป็นของอ้างอิง กดดูได้ตลอดว่าเขาทำกันยังไง
            อยากแก้ก็กด "คัดลอกไปแก้" จะได้สำเนาที่เป็นของตัวเอง ตัวอย่างเดิมยังอยู่ครบ
          </p>
        </div>
      </div>
    </div>
  </UiContainer>
</template>
