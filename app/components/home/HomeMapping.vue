<script setup lang="ts">
import { generate } from '~/game/blocks/codegen'
import { normalize } from '~/game/blocks/pack'
import { MAZE_PACK } from '~/game/maze/blocks/pack'

/**
 * กติกาข้อเดียวที่ทำให้ทั้งระบบเข้าใจง่าย — หนึ่งบล็อกได้โค้ดหนึ่งบรรทัดเสมอ
 * โค้ดที่โชว์ตรงนี้ไม่ได้พิมพ์ทิ้งไว้ แต่ให้ระบบแปลงจากบล็อกชุดเดียวกันตอนเปิดหน้า
 */
const preset = MAZE_PACK.presets.find((item) => item.id === 'starter') ?? MAZE_PACK.presets[0]!
const program = normalize(preset.build(), MAZE_PACK)
const built = generate(program, MAZE_PACK)

/** ตัดเอาเฉพาะช่วงที่มาจากบล็อก ไม่ต้องโชว์โครงคลาสที่ระบบเติมให้ */
const lines = computed(() => {
  const numbers = Object.values(built.lineOf)
  if (numbers.length === 0) return []

  const from = Math.min(...numbers)
  const to = Math.max(...numbers)
  const source = built.code.split('\n')

  return source.slice(from - 1, to).map((text, index) => ({
    number: from + index,
    text: text.replace(/^ {4}/, ''),
    fromBlock: Boolean(built.blockOf[from + index])
  }))
})
</script>

<template>
  <section class="py-14 sm:py-20">
    <UiContainer>
      <div class="max-w-2xl">
        <h2 class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          หนึ่งบล็อก คือโค้ดหนึ่งบรรทัด
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-ink-muted">
          บล็อกที่ต่อไว้ไม่ได้เป็นของเล่นแยกจากโค้ด แต่ถูกแปลงเป็น JavaScript แล้วรันจริง
          เทียบกันได้ทีละบรรทัดแบบนี้ พอเด็กเลิกต่อบล็อกแล้วไปเขียนโค้ดเอง ก็อ่านออกตั้งแต่วันแรก
        </p>
      </div>

      <div class="mt-9 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <BlockScript :pack="MAZE_PACK" :program="program" />

        <div class="overflow-hidden rounded-xl bg-[#1c1524]">
          <div class="border-b border-white/10 px-4 py-2.5">
            <p class="font-mono text-[11px] text-white/45">agent.js</p>
          </div>

          <div class="overflow-x-auto px-4 py-3">
            <div
              v-for="line in lines"
              :key="line.number"
              class="flex gap-4 font-mono text-[12px] leading-[1.9]"
            >
              <span class="w-5 shrink-0 select-none text-right tabular-nums text-white/25">
                {{ line.number }}
              </span>
              <span class="whitespace-pre" :class="line.fromBlock ? 'text-white/85' : 'text-white/35'">{{
                line.text || ' '
              }}</span>
            </div>
          </div>

          <p class="border-t border-white/10 px-4 py-2.5 text-[11px] leading-relaxed text-white/40">
            บรรทัดสีจาง คือวงเล็บปิดที่ระบบเติมให้ ไม่ได้มาจากบล็อกตัวไหน
          </p>
        </div>
      </div>
    </UiContainer>
  </section>
</template>
