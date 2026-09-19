<script setup lang="ts">
import { normalize } from '~/game/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'

/**
 * ส่วนหัวหน้าแรก — โชว์บล็อกจริงจากเกม ไม่ใช่ภาพประกอบ
 * ใช้ตัวอย่าง "เลาะกำแพงขวา" เพราะสั้นพอจะอ่านจบในสายตาเดียว แต่เป็นโปรแกรมที่เดินจบจริง
 */
const preset = MAZE_PACK.presets.find((item) => item.id === 'wall') ?? MAZE_PACK.presets[0]!
const program = normalize(preset.build(), MAZE_PACK)
</script>

<template>
  <section class="border-b border-line bg-surface">
    <UiContainer>
      <div class="grid items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14 lg:py-20">
        <div>
          <h1 class="text-[2.1rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl">
            เขียนโปรแกรมให้บอท<br />
            ด้วยการ<span class="text-primary-600">ต่อบล็อก</span>
          </h1>

          <p class="mt-5 max-w-lg text-base leading-relaxed text-ink-muted">
            ลากบล็อกมาต่อกันเป็นวิธีคิดของบอท แล้วกดรันดูว่ามันเดินตามที่สั่งไหม
            ระหว่างรัน บล็อกที่กำลังทำงานจะสว่างขึ้นทีละตัว จึงเห็นว่าโปรแกรมคิดถึงไหนแล้ว
          </p>

          <div class="mt-8 flex flex-wrap items-center gap-3">
            <UiButton to="/play" size="lg">เลือกเกม</UiButton>
            <UiButton to="/about" variant="outline" size="lg">ที่มาของโปรเจกต์</UiButton>
          </div>

          <dl class="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            <div>
              <dt class="text-xs text-ink-subtle">เกมที่เล่นได้</dt>
              <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">2</dd>
            </div>
            <div>
              <dt class="text-xs text-ink-subtle">บล็อกในเขาวงกต</dt>
              <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {{ MAZE_PACK.palette.reduce((sum, group) => sum + group.kinds.length, 0) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-ink-subtle">ต้องติดตั้ง</dt>
              <dd class="mt-0.5 text-lg font-semibold text-ink">ไม่ต้อง</dd>
            </div>
          </dl>
        </div>

        <!-- บล็อกชุดนี้คือของจริงที่หยิบมาจากเกม ไม่ได้วาดขึ้นใหม่ -->
        <div class="relative">
          <div
            class="pointer-events-none absolute -inset-3 rounded-[1.6rem] bg-primary-100/50"
            aria-hidden="true"
          />
          <BlockScript
            class="relative max-h-[27rem] shadow-lift"
            :pack="MAZE_PACK"
            :program="program"
          />
        </div>
      </div>
    </UiContainer>
  </section>
</template>
