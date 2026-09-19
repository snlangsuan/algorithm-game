<script setup lang="ts">
import type { BlockPack } from '~/game/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'

/**
 * รายการเกม — ใช้ทั้งหน้าแรกและหน้าเลือกเกม
 * ตัวเลขทุกตัวอ่านจาก pack จริง ไม่ได้พิมพ์ทิ้งไว้ เปลี่ยนบล็อกในเกมแล้วตรงนี้ตามเอง
 */
defineProps<{ compact?: boolean }>()

interface Entry {
  to: string
  name: string
  what: string
  detail: string
  thumb: 'maze' | 'othello'
  pack: BlockPack
}

const entries: Entry[] = [
  {
    to: '/maze',
    name: 'เขาวงกต',
    what: 'ต่อบล็อกให้หุ่นหาทางออกเอง',
    detail:
      'สุ่มแผนที่ได้ตั้งแต่เล็กจนใหญ่ วางกำแพงกับโคลนเองก็ได้ แล้วดูว่าวิธีที่คิดไว้พาหุ่นถึงทางออกกี่ก้าว เทียบกับทางที่สั้นที่สุด',
    thumb: 'maze',
    pack: MAZE_PACK
  },
  {
    to: '/othello',
    name: 'Othello 8×8',
    what: 'เขียนวิธีคิดให้บอทลงหมากแข่งกัน',
    detail:
      'เล่นเองกับเพื่อน หรือปล่อยบอทสองตัวแข่งกัน บอทที่ใช้บล็อกความจำจะจำผลเกมก่อนไว้ ซ้อมหลายเกมแล้วเก่งขึ้นจริง',
    thumb: 'othello',
    pack: OTHELLO_PACK
  }
]

const blocksIn = (pack: BlockPack) =>
  pack.palette.reduce((sum, group) => sum + group.kinds.length, 0)

/** ชื่อบล็อกหัวของเกม — บอกตรง ๆ ว่าต่อบล็อกได้ตรงจังหวะไหนบ้าง ชัดกว่าบอกแค่จำนวน */
const hatNames = (pack: BlockPack) => pack.hats.map((hat) => hat.title).join(' · ')
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

        <!-- ภาพย่อวาดสดจากเอนจินของเกมนั้น ไม่ใช่ไฟล์รูป — กติกาเปลี่ยนเมื่อไรภาพเปลี่ยนตาม -->
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
            {{ blocksIn(entry.pack) }} บล็อก · {{ entry.pack.presets.length }} อัลกอริทึมสำเร็จรูป
          </p>
          <p class="mt-1 font-mono text-[11px] text-ink-subtle">
            ต่อบล็อกได้ที่: {{ hatNames(entry.pack) }}
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
