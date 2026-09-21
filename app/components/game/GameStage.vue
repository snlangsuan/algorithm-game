<script setup lang="ts">
defineProps<{
  title?: string
  /**
   * ให้สนามเป็นพระเอก — คอลัมน์สนามกว้างกว่าคอลัมน์โปรแกรม แทนที่จะแบ่งครึ่งเท่ากัน
   * ใช้กับเกมที่ต้องจ้องสนามตลอดเวลา ไม่ใช่เกมที่จ้องแต่บล็อก
   */
  wideStage?: boolean
}>()
</script>

<template>
  <div class="flex-1 px-4 py-3 sm:px-6 sm:py-5">
    <div class="mx-auto flex w-full max-w-[104rem] flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-5">
      <aside v-if="$slots.aside" class="hidden lg:block lg:w-44 lg:shrink-0 xl:w-52">
        <slot name="aside" />
      </aside>

      <section
        class="flex w-full min-w-0 flex-col gap-3 lg:flex-1"
        :class="wideStage ? 'xl:max-w-[56rem] xl:flex-[5] 2xl:flex-[3]' : 'xl:max-w-[46rem]'"
      >
        <slot name="stage" />
      </section>

      <section
        v-if="$slots.program"
        class="hidden min-w-0 flex-1 xl:flex xl:flex-col"
        :class="wideStage ? 'xl:flex-[4] 2xl:flex-[2]' : ''"
      >
        <slot name="program" />
      </section>

      <!-- สนามเป็นพระเอกเมื่อไร รางขวาก็ยอมแคบลงหน่อย เอาที่ไปคืนให้สนามกับบล็อก -->
      <aside class="w-full lg:w-72 lg:shrink-0" :class="wideStage ? 'xl:w-72' : 'xl:w-80'">
        <div class="rounded-card border border-line bg-surface p-3 shadow-soft">
          <slot name="panel" />
        </div>

        <slot name="panel-extra" />
      </aside>
    </div>
  </div>
</template>
