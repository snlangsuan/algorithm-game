<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'เขาวงกต — Algorithm Game',
  description:
    'สุ่มเขาวงกตตามขนาดที่ต้องการ แล้วต่อบล็อกลากวางให้หุ่นหาทางออก หรือจะเขียนโค้ด BFS, Dijkstra, A* เองก็ได้'
})

const game = useMazeGame()

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
</script>

<template>
  <NuxtLayout name="game" title="เขาวงกต">
    <GameStage>
      <template #stage>
        <MazeGrid
          :maze="game.maze.value"
          :explored="game.explored.value"
          :explored-shown="game.exploredShown.value"
          :path="game.path.value"
          :walk-shown="game.walkShown.value"
          :optimal="game.best.value.path"
          :show-optimal="game.showOptimal.value"
          :editable="game.editable.value"
          @cell="game.editCell"
        />

        <MazeLegend />

        <MazeToolbar
          v-model:speed="game.speed.value"
          v-model:show-optimal="game.showOptimal.value"
          :status="game.status.value"
          :starting="starting"
          :solvable="game.best.value.solvable"
          @run="run"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.stop"
          @reset="game.reset"
        />

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

        <MazeMapPanel
          :options="game.options"
          :disabled="game.busy.value"
          :solvable="game.best.value.solvable"
          @option="game.setOption"
          @shuffle="game.shuffle"
        />
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
            <MazeStats
              :status="game.status.value"
              :result="game.result.value"
              :best="game.best.value"
              :cells="game.maze.value.width * game.maze.value.height"
              :explored-shown="game.exploredShown.value"
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

            <MazeTrainingPanel
              v-if="game.learns.value || game.training.running"
              :training="game.training"
              :memory="game.memory.value"
              :learns="game.learns.value"
              :optimal="game.optimalCost.value"
              :disabled="game.busy.value"
              @train="game.train"
              @stop="game.stopTraining"
              @clear="game.clearMemory"
            />

            <MazeDrawTools v-model:tool="game.tool.value" :disabled="game.busy.value" />
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
      title="ต่อบล็อกให้หุ่นหาทางออก"
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
