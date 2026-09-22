<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'วิ่งหลบไม่รู้จบ — Algorithm Game',
  description:
    'เล่นเองหรือเขียนบอทให้วิ่งหลบสิ่งกีดขวางไปเรื่อย ๆ จนกว่าจะชน — ทุกระดับลู่เร็วขึ้นและของถี่ขึ้น กฎที่เผื่อระยะเป็นเลขตายตัวจึงสายเกินไปเอง'
})

const game = useDinoGame()

const blockEditorOpen = ref(false)
const starting = ref(false)

function edit() {
  blockEditorOpen.value = true
}

async function start() {
  starting.value = true
  try {
    await game.start()
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <NuxtLayout name="game" title="วิ่งหลบไม่รู้จบ">
    <GameStage wide-stage>
      <template #stage>
        <DinoTrack
          :run="game.run.value"
          :status="game.status.value"
          :watched="game.watched.value"
          :best="game.bestMeters.value"
        >
          <DinoResultOverlay
            v-if="game.overlay.value && game.result.value"
            :result="game.result.value"
            :agent-name="game.blocks.program.name"
            @again="start"
            @close="game.closeResult"
          />
        </DinoTrack>

        <DinoToolbar
          v-model:speed="game.speed.value"
          :status="game.status.value"
          :starting="starting"
          :pilot="game.pilot.value"
          @start="start"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.stop"
        />

        <DinoPad v-if="game.pilot.value === 'player'" @jump="game.jump" @duck="game.duck" />

        <DinoSetupPanel
          :course="game.course.value"
          :pilot="game.pilot.value"
          :agent-name="game.blocks.program.name"
          :disabled="game.playing.value"
          @course="game.setCourse"
          @pilot="game.setPilot"
        />

        <p
          v-if="game.error.value"
          class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
        >
          {{ game.error.value }}
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
          :running="game.playing.value"
          :disabled="game.playing.value"
          :logs="game.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>

      <template #panel>
        <GamePanel>
          <template #summary>
            <DinoStats
              :run="game.run.value"
              :status="game.status.value"
              :result="game.result.value"
              :ms="game.trace.ms"
              :pilot="game.pilot.value"
              :best="game.bestMeters.value"
            />

            <DinoWork
              :counts="game.trace.counts"
              :calls="game.trace.calls"
              :seconds="game.run.value.time"
            />
          </template>

          <template #default>
            <BlockAlgorithmPicker
              :pack="game.blocks.pack"
              :program="game.blocks.program"
              :preset-id="game.blocks.presetId.value"
              :locked="game.blocks.locked.value"
              :disabled="game.playing.value || game.training.running"
              @preset="game.blocks.usePreset"
            />

            <DinoTrainingPanel
              v-if="game.learns.value || game.training.running"
              :training="game.training"
              :memory="game.memory.value"
              :learns="game.learns.value"
              :course-name="game.course.value.name"
              :program-name="game.blocks.program.name"
              :read="game.memoryData"
              :disabled="game.playing.value"
              @train="game.train"
              @stop="game.stopTraining"
              @clear="game.clearMemory"
              @load="game.importMemory"
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
          :running="game.playing.value"
          :disabled="game.playing.value"
          :logs="game.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>
    </GameStage>

    <BlockEditor
      v-model:open="blockEditorOpen"
      title="ต่อบล็อกให้ตัวละครหลบเอง"
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
