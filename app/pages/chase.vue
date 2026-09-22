<script setup lang="ts">
import type { Pilot, SideView } from '~/components/chase/ChaseSideConfig.vue'
import type { Side } from '~/composables/useChaseGame'

definePageMeta({ layout: false })

useSeoMeta({
  title: 'ไล่จับ — Algorithm Game',
  description:
    'เขียน AI ให้ทั้งฝ่ายไล่และฝ่ายหนี แล้วปล่อยให้สองอัลกอริทึมสู้กัน หรือลงไปบังคับคนหนีเองก็ได้'
})

const game = useChaseGame()

const blockEditorOpen = ref(false)
const starting = ref(false)

/** ชื่อโปรแกรมของทั้งสองฝ่าย — ใช้ทั้งบนแท็บและบนแผ่นสรุปตอนจบ */
const names = computed(() => ({
  hunter: game.brains.hunter.blocks.program.name,
  runner: game.brains.runner.blocks.program.name
}))

/** สองฝ่ายของเกม — ฝ่ายไล่เป็นบอทเสมอ ฝ่ายหนีเลือกได้ว่าจะเล่นเองหรือให้บอทเล่น */
const sides = computed<SideView[]>(() => [
  {
    value: 'runner',
    label: 'ฝ่ายหนี',
    pilot: game.control.value === 'agent' ? 'bot' : 'human',
    choosable: true,
    pack: game.brains.runner.blocks.pack,
    program: game.brains.runner.blocks.program,
    presetId: game.brains.runner.blocks.presetId.value,
    locked: game.brains.runner.blocks.locked.value
  },
  {
    value: 'hunter',
    label: 'ฝ่ายไล่',
    pilot: 'bot',
    choosable: false,
    pack: game.brains.hunter.blocks.pack,
    program: game.brains.hunter.blocks.program,
    presetId: game.brains.hunter.blocks.presetId.value,
    locked: game.brains.hunter.blocks.locked.value
  }
])

const setPilot = (which: Side, pilot: Pilot) => {
  if (which !== 'runner') return
  game.setControl(pilot === 'bot' ? 'agent' : 'player')
}

const setPreset = (which: Side, id: string) => game.brains[which].blocks.usePreset(id)

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

const editorTitle = computed(() =>
  game.side.value === 'hunter' ? 'ต่อบล็อกให้ผู้ไล่ล่าคิดเอง' : 'ต่อบล็อกให้คนหนีคิดเอง'
)
</script>

<template>
  <NuxtLayout name="game" title="ไล่จับ">
    <GameStage wide-stage>
      <template #stage>
        <ChaseArena
          :match="game.match.value"
          :hunter-looked="game.brains.hunter.looked.value"
          :runner-looked="game.brains.runner.looked.value"
          :duration="game.pace.value.tickMs"
          :status="game.status.value"
          :reasons="game.shown.value.reasons.value"
        >
          <ChaseResultOverlay
            v-if="game.overlay.value && game.result.value"
            :result="game.result.value"
            :hunter-name="names.hunter"
            :runner-name="names.runner"
            @again="start"
            @close="game.closeResult"
          />
        </ChaseArena>

        <ChaseToolbar
          v-model:speed="game.speed.value"
          :status="game.status.value"
          :starting="starting"
          :control="game.control.value"
          @start="start"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.stop"
        />

        <ChasePad v-if="game.control.value === 'player'" @turn="game.turn" />

        <!-- ของที่ตั้งก่อนเริ่มอยู่ใต้สนามทั้งหมด รางขวาจะได้เหลือแต่ตัวเลขสด ๆ ไม่ยาวจนตกจอตอนเล่น -->
        <ChaseSetupPanel
          :arena="game.arena.value"
          :hunters="game.options.hunters"
          :hunter-speed="game.options.hunterSpeed"
          :disabled="game.playing.value"
          @arena="game.setArena"
          @hunters="game.setHunters"
          @speed="game.setHunterSpeed"
        />

        <ChaseSideConfig
          :sides="sides"
          :side="game.side.value"
          :disabled="game.playing.value"
          @update:side="game.side.value = $event"
          @pilot="setPilot"
          @preset="setPreset"
        />

        <p
          v-if="game.error.value"
          class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
        >
          {{ game.error.value }}
        </p>

        <p
          v-else-if="game.notice.value"
          class="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-800"
        >
          {{ game.notice.value }}
        </p>
      </template>

      <template #program>
        <div class="flex min-h-0 flex-1 flex-col gap-2">
          <ChaseSideTabs
            :side="game.side.value"
            :control="game.control.value"
            :names="names"
            @update:side="game.side.value = $event"
          />

          <BlockWorkspace
            tall
            :pack="game.shown.value.blocks.pack"
            :program="game.shown.value.blocks.program"
            :author="game.author.value"
            :code="game.shown.value.source.value"
            :active-id="game.activeBlock.value"
            :counts="game.blockCounts.value"
            :line="game.shown.value.trace.line"
            :lines="game.shown.value.trace.lines"
            :traced="game.shown.value.trace.traced"
            :running="game.playing.value"
            :disabled="game.playing.value"
            :logs="game.shown.value.logs.value"
            @edit="edit"
            @clear-logs="game.clearLogs"
          />
        </div>
      </template>

      <template #panel>
        <GamePanel>
          <template #summary>
            <ChaseStats
              :match="game.match.value"
              :status="game.status.value"
              :result="game.result.value"
              :tick-limit="game.tickLimit"
              :ms="game.brains.hunter.trace.ms + game.brains.runner.trace.ms"
            />

            <ChaseWork
              :side="game.side.value"
              :counts="game.shown.value.trace.counts"
              :calls="game.shown.value.trace.calls"
              :ticks="game.match.value.tick"
            />

            <BlockReason :reasons="game.shown.value.reasons.value" />
          </template>

        </GamePanel>
      </template>

      <template #panel-extra>
        <ChaseSideTabs
          class="mt-3 xl:hidden"
          :side="game.side.value"
          :control="game.control.value"
          :names="names"
          @update:side="game.side.value = $event"
        />

        <BlockWorkspace
          class="mt-2 xl:hidden"
          :pack="game.shown.value.blocks.pack"
          :program="game.shown.value.blocks.program"
          :author="game.author.value"
          :code="game.shown.value.source.value"
          :active-id="game.activeBlock.value"
          :counts="game.blockCounts.value"
          :line="game.shown.value.trace.line"
          :lines="game.shown.value.trace.lines"
          :traced="game.shown.value.trace.traced"
          :running="game.playing.value"
          :disabled="game.playing.value"
          :logs="game.shown.value.logs.value"
          @edit="edit"
          @clear-logs="game.clearLogs"
        />
      </template>
    </GameStage>

    <BlockEditor
      v-model:open="blockEditorOpen"
      :title="editorTitle"
      :pack="game.shown.value.blocks.pack"
      :program="game.shown.value.blocks.program"
      :api="game.shown.value.blocks.api"
      :preset-id="game.shown.value.blocks.presetId.value"
      :locked="game.shown.value.blocks.locked.value"
      @preset="game.shown.value.blocks.usePreset"
      @rename="game.shown.value.blocks.rename"
      @clone="game.shown.value.blocks.cloneForEditing"
      @create="game.shown.value.blocks.newProgram"
      @load="game.shown.value.blocks.loadProgram"
      @remove="game.shown.value.blocks.removeProgram()"
    />
  </NuxtLayout>
</template>
