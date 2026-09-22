<script setup lang="ts">
useSeoMeta({
  title: 'Algorithm Game — ต่อบล็อกให้บอทเล่นเกมเอง',
  description:
    'ลากบล็อกมาต่อกันเป็นวิธีคิดของบอท แล้วกดรันดูว่ามันทำตามที่สั่งไหม มีเขาวงกต Othello และหอคอยฮานอยให้ลอง'
})
</script>

<template>
  <div>
    <HomeIntro />

    <section class="py-14 sm:py-20">
      <UiContainer>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <h2 class="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">เลือกเกมที่จะลอง</h2>
          <p class="text-sm text-ink-subtle">ทุกเกมใช้บล็อกชุดเดียวกัน ต่างกันที่คำศัพท์ของเกม</p>
        </div>

        <GameChooser class="mt-8" />
      </UiContainer>
    </section>

    <div class="border-t border-line bg-surface">
      <HomeMapping />
    </div>

    <section class="border-t border-line py-14 sm:py-16">
      <UiContainer>
        <div class="flex flex-wrap items-center justify-between gap-6">
          <div class="max-w-xl">
            <h2 class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              อยากรู้ว่าวิธีพวกนี้มีชื่อเรียกว่าอะไร
            </h2>
            <p class="mt-2 text-sm leading-relaxed text-ink-muted">
              เลาะกำแพง โลภ ฮิวริสติก วิวัฒนาการ BFS, Dijkstra, A*, DFS, minimax ไปจนถึงตัวควบคุม PID และอัลกอริทึมฝูงสัตว์ ทั้งฝูงนก (PSO) ฝูงมด (ACO) และฝูงปลา (Boids) —
              แต่ละหัวข้อมีบล็อกอธิบายให้ดูว่าทำงานยังไง พร้อมที่มาจากงานต้นฉบับ
            </p>
          </div>

          <UiButton to="/learn" variant="outline">เปิดหน้าความรู้</UiButton>
        </div>
      </UiContainer>
    </section>
  </div>
</template>
