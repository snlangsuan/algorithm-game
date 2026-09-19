<script setup lang="ts">
/**
 * โครงหน้าเล่นเกม — ทุกเกมวางเหมือนกันหมด
 *
 *   [ ข้างซ้าย ]  [ สนามเล่น ]  [ โปรแกรม ]  [ แผงควบคุม ]
 *
 * จอกว้างเห็นครบสี่ส่วน, จอกลางคอลัมน์โปรแกรมยุบเข้าไปอยู่ในแผงควบคุม,
 * จอเล็กเรียงต่อกันลงมาเป็นแถวเดียว
 */
defineProps<{ title?: string }>()
</script>

<template>
  <div class="flex-1 px-4 py-3 sm:px-6 sm:py-5">
    <div class="mx-auto flex w-full max-w-[104rem] flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-5">
      <!-- ข้างซ้าย: ข้อมูลประกอบของเกม (มีหรือไม่มีก็ได้) -->
      <aside v-if="$slots.aside" class="hidden lg:block lg:w-44 lg:shrink-0 xl:w-52">
        <slot name="aside" />
      </aside>

      <!-- สนามเล่น -->
      <section class="flex w-full min-w-0 flex-col gap-3 lg:flex-1 xl:max-w-[46rem]">
        <slot name="stage" />
      </section>

      <!-- โปรแกรมของผู้เล่น (จอกว้างได้คอลัมน์ของตัวเอง) -->
      <section v-if="$slots.program" class="hidden min-w-0 flex-1 xl:flex xl:flex-col">
        <slot name="program" />
      </section>

      <!-- แผงควบคุมด้านขวา -->
      <aside class="w-full lg:w-72 lg:shrink-0 xl:w-80">
        <div class="rounded-card border border-line bg-surface p-3 shadow-soft">
          <slot name="panel" />
        </div>

        <slot name="panel-extra" />
      </aside>
    </div>
  </div>
</template>
