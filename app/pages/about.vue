<script setup lang="ts">
useSeoMeta({
  title: 'เกี่ยวกับ — Algorithm Game',
  description: 'ที่มาของโปรเจกต์ วิธีที่บล็อกกลายเป็นโค้ดที่รันจริง และสิ่งที่ยังทำไม่ได้'
})
</script>

<template>
  <UiContainer size="md">
    <div class="py-14 sm:py-20">
      <h1 class="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        สอนอัลกอริทึมด้วยการให้ลองสั่งบอทดู
      </h1>

      <p class="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted">
        เวลาสอนเรื่องลูปหรือเงื่อนไข ปัญหาไม่ใช่ว่าเด็กไม่เข้าใจคำอธิบาย
        แต่คือไม่เห็นว่ามันส่งผลอะไร โปรเจกต์นี้เลยเอาแนวคิดพวกนี้ไปผูกกับสิ่งที่ขยับให้ดูได้ —
        หุ่นที่เดินหลงในเขาวงกต บอทที่เล่นหมากแพ้ชนะกันจริง และกองจานที่ย้ายผิดกติกาไม่ได้
      </p>

      <div class="mt-14 space-y-12 border-t border-line pt-12">
        <section class="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10">
          <h2 class="text-sm font-semibold text-ink">บล็อกไม่ใช่ของเล่น</h2>
          <div class="max-w-xl space-y-3 text-sm leading-relaxed text-ink-muted">
            <p>
              บล็อกที่ต่อไว้จะถูกแปลงเป็น JavaScript แล้วรันจริงในเบราว์เซอร์
              ไม่ได้ตีความแยกต่างหาก โปรแกรมที่เด็กต่อจึงเป็นโปรแกรมจริงตั้งแต่วันแรก
            </p>
            <p>
              กติกาที่ยึดไว้คือหนึ่งบล็อกได้โค้ดหนึ่งบรรทัดเสมอ
              ระบบจึงย้อนจากบรรทัดที่กำลังรันกลับมาไฮไลต์บล็อกที่กำลังทำงานได้ตรงตัว
            </p>
          </div>
        </section>

        <section class="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10">
          <h2 class="text-sm font-semibold text-ink">ค้นหาเส้นทางด้วยบล็อก</h2>
          <p class="max-w-xl text-sm leading-relaxed text-ink-muted">
            หัวบล็อก "เมื่อวางแผนเส้นทาง" เปิดให้เห็นแผนที่ทั้งใบ จึงต่อ BFS, Dijkstra และ A* ได้จริง
            ทั้งสามใช้บล็อกชุดเดียวกันหมด ต่างกันแค่ค่าที่ใส่ในช่อง "ด้วยลำดับ" ของบล็อกใส่คิว —
            เด็กจึงเห็นกับตาว่าอัลกอริทึมที่ฟังดูต่างกันลิบ ห่างกันแค่บล็อกเดียว
          </p>
        </section>

        <section class="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10">
          <h2 class="text-sm font-semibold text-ink">การเรียกตัวเองซ้ำที่มองเห็นได้</h2>
          <p class="max-w-xl text-sm leading-relaxed text-ink-muted">
            หอคอยฮานอยใช้บล็อก "กองงาน" แทนการให้ฟังก์ชันเรียกตัวเอง — งานหนึ่งชิ้นถูกแตกเป็นงานย่อย
            สามชิ้นที่หน้าตาเหมือนเดิมแต่เล็กลงหนึ่งใบ แล้ววางกลับลงกอง
            กองที่ภาษาโปรแกรมซ่อนไว้ให้เงียบ ๆ จึงถูกยกออกมาวางให้เห็นทีละชั้น
            และเทียบได้ทันทีว่าได้ 2ⁿ − 1 ตาซึ่งน้อยที่สุดเท่าที่เป็นไปได้จริงไหม
          </p>
        </section>

        <section class="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10">
          <h2 class="text-sm font-semibold text-ink">บอทที่จำเกมก่อนได้</h2>
          <p class="max-w-xl text-sm leading-relaxed text-ink-muted">
            ใน Othello มีบล็อกความจำที่เก็บค่าข้ามเกมได้
            ตัวอย่าง "วิวัฒนาการ" ใช้ความจำนี้สุ่มปรับวิธีเล่นทีละนิดแล้วเก็บเฉพาะครั้งที่ทำคะแนนดีขึ้น
            ซ้อมหลายสิบเกมแล้วชนะบ่อยขึ้นจริง วัดผลได้ ไม่ใช่แค่คำโฆษณา
          </p>
        </section>

        <section class="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10">
          <h2 class="text-sm font-semibold text-ink">สิ่งที่ยังทำไม่ได้</h2>
          <div class="max-w-xl space-y-3 text-sm leading-relaxed text-ink-muted">
            <p>
              บอทที่คิดแทนคู่แข่งล่วงหน้าอย่าง minimax ยังต่อด้วยบล็อกไม่ได้
              เพราะต้องจำลองการลงหมากบนกระดานสมมติก่อน ซึ่ง Othello ยังไม่มีบล็อกรองรับ
              (ส่วนการเรียกตัวเองซ้ำนั้นทำได้แล้วด้วยกองงานในหอคอยฮานอย)
            </p>
            <p>
              โปรแกรมที่ต่อไว้ยังบันทึกเก็บไม่ได้ ปิดหน้าแล้วหาย
              และยังตั้งชื่อตัวแปรเองไม่ได้ มีให้เลือกแค่ ก ข ค
            </p>
          </div>
        </section>
      </div>

      <div class="mt-14 border-t border-line pt-8">
        <UiButton to="/play">ลองเล่นดู</UiButton>
      </div>
    </div>
  </UiContainer>
</template>
