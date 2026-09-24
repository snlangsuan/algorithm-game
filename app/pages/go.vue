<script setup lang="ts">
import { BLACK, WHITE, type Player } from '~/game/go/engine'

/**
 * หน้าเกมหมากล้อม — โครงเดียวกับหน้าโอเทลโล: สองฝ่ายมีสมองของตัวเอง
 * เล่นเองก็ได้ ให้บอทเล่นก็ได้ และเลือกได้ว่าบอทฝ่ายไหนใช้อัลกอริทึมอะไร
 */
definePageMeta({ layout: false })

useSeoMeta({
  title: 'หมากล้อม — Algorithm Game',
  description:
    'เล่นหมากล้อม (โกะ) บนกระดาน 9×9 13×13 หรือ 19×19 เลือกคู่ต่อสู้ได้ตั้งแต่ระดับ 9 คิวถึง 1 คิว หรือต่อบล็อกเขียนวิธีคิดของบอทเอง'
})

const game = useGoGame()
const starting = ref(false)

/** ระบายสีพื้นที่ที่แต่ละฝ่ายถือครอง — เปิดไว้ก่อน เพราะเป็นสิ่งที่ตัดสินแพ้ชนะแต่มองด้วยตาเปล่ายาก */
const showArea = ref(true)
const editingBlocks = ref<Player | null>(null)

const names = computed<Record<Player, string>>(() => ({
  [BLACK]: game.nameOf(BLACK),
  [WHITE]: game.nameOf(WHITE)
}))

const locked = computed(() => game.status.value !== 'setup' || game.training.running)

/** ฝั่งไหนใช้โปรแกรมที่จำของข้ามเกมได้ — แผงซ้อมจะได้บอกได้ว่าซ้อมแล้วใครเก่งขึ้น */
const learners = computed<Record<Player, boolean>>(() => ({
  [BLACK]: game.learns(BLACK),
  [WHITE]: game.learns(WHITE)
}))

/** ฝึกได้เฉพาะตอนเป็นบอททั้งสองฝั่ง */
const bothBots = computed(() => codeSides.value.length === 2)

const trainingOpen = ref(false)
const trainSide = ref<Player | null>(null)

function openTraining(player: Player) {
  trainSide.value = player
  trainingOpen.value = true
}

/** ฝ่ายที่เป็นบอท — มีแต่ฝ่ายพวกนี้ที่มีโปรแกรมให้ดูและแก้ */
const codeSides = computed(() => ([BLACK, WHITE] as Player[]).filter((side) => game.sides[side].kind === 'code'))

const viewing = ref<Player>(WHITE)
watch(
  codeSides,
  (sides) => {
    if (sides.length > 0 && !sides.includes(viewing.value)) viewing.value = sides[0]!
  },
  { immediate: true }
)
const shown = computed(() => (codeSides.value.includes(viewing.value) ? viewing.value : null))

const blocksOpen = computed({
  get: () => editingBlocks.value !== null,
  set: (value: boolean) => {
    if (!value) editingBlocks.value = null
  }
})
const blockSide = computed(() => (editingBlocks.value ? game.blocks[editingBlocks.value] : null))

const sideLabel = (player: Player) => (player === BLACK ? 'ดำ' : 'ขาว')

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
  <NuxtLayout name="game" title="หมากล้อม">
    <GameStage>
      <template #aside>
        <div class="flex flex-col rounded-card border border-line bg-surface p-3 shadow-soft">
          <div class="mb-2 flex shrink-0 items-baseline justify-between px-1">
            <h2 class="text-xs font-semibold text-ink">ประวัติการเดิน</h2>
            <span class="text-[11px] tabular-nums text-ink-subtle">{{ game.log.value.length }}</span>
          </div>

          <GoMoveLog class="h-[var(--log-20-rows)] max-h-[calc(100vh-11rem)]" :entries="game.log.value" />
        </div>
      </template>

      <template #stage>
        <div class="relative">
          <GoBoard
            :position="game.position.value"
            :last-move="game.lastMove.value"
            :legal="game.legalSet.value"
            :territory="showArea ? game.area.value : undefined"
            :disabled="!game.isHumanTurn.value"
            @play="game.playAt($event.row, $event.col)"
          />

          <GoResultOverlay
            v-if="game.overlay.value && game.result.value"
            :score="game.result.value"
            :names="names"
            @again="start"
            @close="game.closeResult"
          />
        </div>

        <GoToolbar
          v-model:speed="game.speed.value"
          v-model:area="showArea"
          :status="game.status.value"
          :starting="starting"
          :can-pass="game.canPass.value"
          :can-undo="game.canUndo.value"
          @start="start"
          @pause="game.pause"
          @resume="game.resume"
          @stop="game.reset"
          @pass="game.pass"
          @undo="game.undo"
          @reset="game.reset"
        />

        <GoSetupPanel
          :size="game.size.value"
          :komi="game.komi.value"
          :disabled="locked"
          @update:size="game.setSize"
          @update:komi="game.setKomi"
        />

        <GoSideConfig
          v-for="side in [BLACK, WHITE]"
          :key="side"
          :player="side"
          :kind="game.sides[side].kind"
          :name="names[side]"
          :pack="game.blocks[side].pack"
          :program="game.blocks[side].program"
          :preset-id="game.blocks[side].presetId.value"
          :locked="game.blocks[side].locked.value"
          :disabled="locked"
          :trainable="learners[side]"
          :training="game.training.running"
          :memory="game.memories[side]"
          @update:kind="game.setSide(side, { kind: $event }), (viewing = side)"
          @update:preset="game.blocks[side].usePreset($event), (viewing = side)"
          @train="openTraining(side)"
          @clear-memory="game.clearMemory(side)"
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
        <BlockWorkspace
          v-if="shown"
          tall
          :pack="game.blocks[shown].pack"
          :program="game.blocks[shown].program"
          :author="game.sides[shown].author"
          :code="game.sourceOf(shown)"
          :active-id="game.activeBlocks[shown]"
          :counts="game.blockCounts(shown)"
          :line="game.traces[shown].line"
          :lines="game.traces[shown].lines"
          :traced="true"
          :running="game.traces[shown].running"
          :disabled="locked"
          :logs="game.logs[shown]"
          @edit="editingBlocks = shown"
          @clear-logs="game.clearLogs(shown)"
        >
          <template v-if="codeSides.length > 1" #header>
            <div class="flex rounded-full bg-surface-sunken p-1">
              <button
                v-for="player in codeSides"
                :key="player"
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                :class="
                  viewing === player
                    ? 'bg-surface text-primary-700 shadow-soft'
                    : 'text-ink-muted hover:text-primary-700'
                "
                @click="viewing = player"
              >
                <span
                  class="size-3 rounded-full ring-1 ring-inset ring-black/20"
                  :class="player === BLACK ? 'bg-ink' : 'bg-white'"
                />
                ฝ่าย{{ sideLabel(player) }}
              </button>
            </div>
          </template>
        </BlockWorkspace>

        <p v-else class="rounded-card border border-line bg-surface px-4 py-6 text-center text-xs text-ink-muted">
          ตอนนี้เล่นเองทั้งสองฝ่าย — เปลี่ยนฝ่ายไหนเป็น "บอท" ถึงจะมีโปรแกรมให้ดูและแก้
        </p>
      </template>

      <template #panel>
        <GamePanel>
          <template #summary>
            <GoStats :position="game.position.value" :status="game.status.value" :names="names" />
          </template>
        </GamePanel>
      </template>
    </GameStage>

    <GoTrainingPanel
      v-model:open="trainingOpen"
      :training="game.training"
      :ready="bothBots"
      :side="trainSide"
      :learners="learners"
      :names="names"
      :memories="game.memories"
      @start="game.train"
      @stop="game.stopTraining"
      @clear="game.clearMemory"
    />

    <BlockEditor
      v-if="blocksOpen && blockSide"
      v-model:open="blocksOpen"
      :title="`ต่อบล็อกให้ฝ่าย${editingBlocks === BLACK ? 'ดำ' : 'ขาว'}คิดเอง`"
      :pack="blockSide.pack"
      :program="blockSide.program"
      :api="blockSide.api"
      :preset-id="blockSide.presetId.value"
      :locked="blockSide.locked.value"
      @preset="blockSide.usePreset"
      @rename="blockSide.rename"
      @clone="blockSide.cloneForEditing"
      @create="blockSide.newProgram"
      @load="blockSide.loadProgram"
      @remove="blockSide.removeProgram"
    />
  </NuxtLayout>
</template>
