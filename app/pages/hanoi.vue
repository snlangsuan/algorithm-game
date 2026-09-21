<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'หอคอยฮานอย — Algorithm Game',
  description:
    'ต่อบล็อกให้เครื่องย้ายจานข้ามหมุดให้ครบตามกติกา ลองทั้งแบบแบ่งแล้วพิชิตและกฎสลับตา แล้วเทียบกับจำนวนตาที่น้อยที่สุดเท่าที่เป็นไปได้'
})

const game = useHanoiGame()

const blockEditorOpen = ref(false)
const starting = ref(false)

function edit() {
  blockEditorOpen.value = true
}

async function run() {
  starting.value = true
  try {
    await game.run()
  } finally {
    starting.value = false
  }
}

const slideMs = computed(() => Math.min(260, game.pace.value.stepDelay))
</script>

<template>
  <NuxtLayout name="game" title="หอคอยฮานอย">
    <GameStage>
      <template #stage>
        <HanoiBoard
          :puzzle="game.puzzle.value"
          :towers="game.towers.value"
          :last="game.lastMove.value"
          :duration="slideMs"
        />

        <HanoiToolbar
          v-model:speed="game.speed.value"
          v-model:show-best="game.showBest.value"
          :status="game.status.value"
          :starting="starting"
          @run="run"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.stop"
          @reset="game.reset"
        />

        <HanoiSetupPanel
          :disks="game.options.disks"
          :disabled="game.busy.value"
          @disks="game.setDisks"
        />

        <HanoiSolution v-if="game.showBest.value" :moves="game.solution.value" />

        <p
          v-if="game.error.value"
          class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
        >
          {{ game.error.value }}
        </p>

        <p
          v-else-if="game.notice.value"
          class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800"
        >
          {{ game.notice.value }}
        </p>
      </template>

      <template #program>
        <BlockWorkspace
          tall
          :pack="game.blocks.pack"
          :program="game.blocks.program"
          :author="game.author.value"
          :code="game.source.value"
          :active-id="game.activeBlock.value"
          :counts="game.blockCounts.value"
          :line="game.trace.line"
          :lines="game.trace.lines"
          :traced="game.trace.traced"
          :running="game.busy.value"
          :disabled="game.busy.value"
          :logs="game.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>

      <template #panel>
        <GamePanel>
          <template #summary>
            <HanoiStats
              :status="game.status.value"
              :result="game.result.value"
              :best="game.best.value"
              :explored-shown="game.exploredShown.value"
              :moves-shown="game.movesShown.value"
            />

            <HanoiWork
              :mode="game.agent.mode"
              :counts="game.trace.counts"
              :calls="game.trace.calls"
              :moves="game.movesShown.value"
            />
          </template>

          <template #default>
            <BlockAlgorithmPicker
              :pack="game.blocks.pack"
              :program="game.blocks.program"
              :preset-id="game.blocks.presetId.value"
              :locked="game.blocks.locked.value"
              :disabled="game.busy.value"
              @preset="game.blocks.usePreset"
            />
          </template>
        </GamePanel>
      </template>

      <template #panel-extra>
        <BlockWorkspace
          class="mt-3 xl:hidden"
          :pack="game.blocks.pack"
          :program="game.blocks.program"
          :author="game.author.value"
          :code="game.source.value"
          :active-id="game.activeBlock.value"
          :counts="game.blockCounts.value"
          :line="game.trace.line"
          :lines="game.trace.lines"
          :traced="game.trace.traced"
          :running="game.busy.value"
          :disabled="game.busy.value"
          :logs="game.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>
    </GameStage>

    <BlockEditor
      v-model:open="blockEditorOpen"
      title="ต่อบล็อกให้เครื่องย้ายจานให้ครบ"
      :pack="game.blocks.pack"
      :program="game.blocks.program"
      :api="game.blocks.api"
      :preset-id="game.blocks.presetId.value"
      :locked="game.blocks.locked.value"
      @preset="game.blocks.usePreset"
      @rename="game.blocks.rename"
      @clone="game.blocks.cloneForEditing"
      @create="game.blocks.newProgram"
      @load="game.blocks.loadProgram"
      @remove="game.blocks.removeProgram()"
    />
  </NuxtLayout>
</template>
