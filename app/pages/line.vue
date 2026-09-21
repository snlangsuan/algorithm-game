<script setup lang="ts">
import { COURSES, type Course } from '~/game/line/engine'

definePageMeta({ layout: false })

useSeoMeta({
  title: 'หุ่นเดินตามเส้น — Algorithm Game',
  description:
    'ต่อบล็อกให้หุ่นสองล้อที่มีเซนเซอร์แสงห้าตัว วิ่งตามเส้นดำให้ครบรอบเร็วที่สุด — ตั้งแต่เลี้ยวสุดแรงแบบ bang-bang ไปจนถึงตัวควบคุม PID ที่หุ่นแข่งจริงใช้'
})

const game = useLineGame()

const blockEditorOpen = ref(false)

/** หน้าวาดสนาม — editing คือสนามที่กำลังแก้ null คือวาดใหม่ */
const courseEditorOpen = ref(false)
const editing = ref<Course | null>(null)

const builtIn = COURSES

function drawCourse() {
  editing.value = null
  courseEditorOpen.value = true
}

function editCourse() {
  editing.value = game.course.value.custom ? game.course.value : null
  courseEditorOpen.value = true
}

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
  <NuxtLayout name="game" title="หุ่นเดินตามเส้น">
    <GameStage wide-stage>
      <template #stage>
        <LineField
          :run="game.run.value"
          :status="game.status.value"
          :watched="game.watched.value"
          :best="game.bestTime.value"
        >
          <LineResultOverlay
            v-if="game.overlay.value && game.result.value"
            :result="game.result.value"
            :agent-name="game.blocks.program.name"
            @again="start"
            @close="game.closeResult"
          />
        </LineField>

        <LineToolbar
          v-model:speed="game.speed.value"
          :status="game.status.value"
          :starting="starting"
          :pilot="game.pilot.value"
          @start="start"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.stop"
        />

        <LinePad v-if="game.pilot.value === 'player'" @press="game.press" />

        <LineSensors :run="game.run.value" :watched="game.watched.value" />

        <LineSetupPanel
          :course="game.course.value"
          :courses="game.courses.value"
          :pilot="game.pilot.value"
          :agent-name="game.blocks.program.name"
          :disabled="game.playing.value"
          @course="game.setCourse"
          @pilot="game.setPilot"
          @draw="drawCourse"
          @edit="editCourse"
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
            <LineStats
              :run="game.run.value"
              :status="game.status.value"
              :result="game.result.value"
              :ms="game.trace.ms"
              :pilot="game.pilot.value"
              :best="game.bestTime.value"
            />

            <LineWork :counts="game.trace.counts" :calls="game.trace.calls" :seconds="game.run.value.time" />
          </template>

          <template #default>
            <BlockAlgorithmPicker
              :pack="game.blocks.pack"
              :program="game.blocks.program"
              :preset-id="game.blocks.presetId.value"
              :locked="game.blocks.locked.value"
              :disabled="game.playing.value"
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
          :running="game.playing.value"
          :disabled="game.playing.value"
          :logs="game.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>
    </GameStage>

    <LineCourseEditor
      v-model:open="courseEditorOpen"
      :initial="editing"
      :templates="builtIn"
      @save="game.saveCourse"
      @remove="game.removeCourse"
    />

    <BlockEditor
      v-model:open="blockEditorOpen"
      title="ต่อบล็อกให้หุ่นเดินตามเส้น"
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
