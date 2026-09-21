<script setup lang="ts">
import { GAMES } from '~/data/games'
import type { BlockPack } from '~/game/blocks/pack'

/**
 * รายการเกม — ใช้ทั้งหน้าแรกและหน้าเลือกเกม
 * ตัวเลขทุกตัวอ่านจาก pack จริง ไม่ได้พิมพ์ทิ้งไว้ เปลี่ยนบล็อกในเกมแล้วตรงนี้ตามเอง
 */
defineProps<{ compact?: boolean }>()

const entries = GAMES

const blocksIn = (packs: BlockPack[]) =>
  packs.reduce(
    (sum, pack) => sum + pack.palette.reduce((count, group) => count + group.kinds.length, 0),
    0
  )

const presetsIn = (packs: BlockPack[]) =>
  packs.reduce((sum, pack) => sum + pack.presets.length, 0)

/** ชื่อบล็อกหัวของเกม — บอกตรง ๆ ว่าต่อบล็อกได้ตรงจังหวะไหนบ้าง ชัดกว่าบอกแค่จำนวน */
const hatNames = (packs: BlockPack[]) =>
  packs.flatMap((pack) => pack.hats.map((hat) => hat.title)).join(' · ')
</script>

<template>
  <ul class="divide-y divide-line border-y border-line">
    <li v-for="(entry, index) in entries" :key="entry.to">
      <NuxtLink
        :to="entry.to"
        class="group grid items-start gap-x-6 gap-y-4 py-7 transition-colors sm:grid-cols-[2rem_11rem_minmax(0,1fr)_auto] sm:py-8"
      >
        <span class="font-mono text-sm tabular-nums text-ink-subtle sm:mt-1.5">
          {{ String(index + 1).padStart(2, '0') }}
        </span>

        <GameThumb
          :kind="entry.thumb"
          class="aspect-[4/3] w-full max-w-[16rem] transition-shadow group-hover:shadow-lift sm:max-w-none"
        />

        <div class="min-w-0">
          <h3 class="text-xl font-semibold tracking-tight text-ink transition-colors group-hover:text-primary-700 sm:text-2xl">
            {{ entry.name }}
          </h3>
          <p class="mt-1 text-sm text-ink-muted">{{ entry.what }}</p>

          <p v-if="!compact" class="mt-3 max-w-xl text-sm leading-relaxed text-ink-subtle">
            {{ entry.detail }}
          </p>

          <p class="mt-3 font-mono text-[11px] tabular-nums text-ink-subtle">
            {{ blocksIn(entry.packs) }} บล็อก · {{ presetsIn(entry.packs) }} อัลกอริทึมสำเร็จรูป
          </p>
          <p class="mt-1 font-mono text-[11px] text-ink-subtle">
            ต่อบล็อกได้ที่: {{ hatNames(entry.packs) }}
          </p>
        </div>

        <span
          class="hidden shrink-0 items-center gap-2 self-center text-sm font-medium text-primary-700 sm:inline-flex"
        >
          เล่น
          <svg viewBox="0 0 24 24" fill="none" class="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </NuxtLink>
    </li>
  </ul>
</template>
