<script setup lang="ts">
import { BLACK, WHITE, type Player } from '~/game/othello/engine'
import type { SideKind } from '~/composables/useOthelloGame'

definePageMeta({ layout: false })

useSeoMeta({
  title: 'Othello — Algorithm Game',
  description: 'เล่น Othello 8x8 แบบคน vs คน หรือต่อบล็อก/เขียนโค้ดให้บอทสองตัวแข่งกันเอง'
})

const game = useOthelloGame()
const editing = ref<Player | null>(null)
const editingBlocks = ref<Player | null>(null)
const starting = ref(false)

const editorOpen = computed({
  get: () => editing.value !== null,
  set: (value: boolean) => {
    if (!value) editing.value = null
  }
})

const editingSide = computed(() => (editing.value ? game.sides[editing.value] : null))

const blocksOpen = computed({
  get: () => editingBlocks.value !== null,
  set: (value: boolean) => {
    if (!value) editingBlocks.value = null
  }
})

/** ฝั่งที่กำลังแก้บล็อกอยู่ */
const blockSide = computed(() => (editingBlocks.value ? game.blocks[editingBlocks.value] : null))

const editingCode = computed({
  get: () => editingSide.value?.code ?? '',
  set: (value: string) => {
    if (editing.value) game.setSide(editing.value, { code: value })
  }
})

const locked = computed(() => game.status.value !== 'setup' || game.training.running)
const trainingOpen = ref(false)

/** เปิดหน้าต่างฝึกโดยเจาะจงสีหมาก — ฝึกทีละฝั่ง คู่ซ้อมจะได้นิ่ง */
function openTraining(player: Player) {
  focus(player)
  trainFocus.value = player
  trainingOpen.value = true
}

const trainFocus = ref<Player | null>(null)
const canTrain = computed(
  () => game.sides[BLACK].kind === 'code' && game.sides[WHITE].kind === 'code'
)

/** ฝั่งที่เล่นด้วยโปรแกรม — ใช้เลือกว่าจะโชว์โปรแกรมของใครบ้าง */
const codeSides = computed(() =>
  ([BLACK, WHITE] as Player[]).filter((player) => game.sides[player].kind === 'code')
)

/** ฝั่งที่กำลังดูโปรแกรมอยู่ในคอลัมน์กลาง */
const viewing = ref<Player>(BLACK)

watch(
  codeSides,
  (sides) => {
    if (sides.length && !sides.includes(viewing.value)) viewing.value = sides[0]!
  },
  { immediate: true }
)

const shown = computed(() => (codeSides.value.includes(viewing.value) ? viewing.value : null))

/** แก้โปรแกรมฝั่งไหน ก็เลื่อนคอลัมน์กลางไปโชว์ฝั่งนั้นให้ */
function focus(player: Player) {
  viewing.value = player
}

const sideLabel = (player: Player) => (player === BLACK ? 'ดำ' : 'ขาว')

/** ฝั่งไหนมีโปรแกรมที่จำอะไรข้ามเกมได้ — ใช้ตัดสินว่าปุ่มควรเขียนว่า "ฝึก" หรือ "ประลอง" */
const learners = computed(
  () => ({ [BLACK]: game.learns(BLACK), [WHITE]: game.learns(WHITE) }) as Record<Player, boolean>
)


/** ชื่อโปรแกรมที่แต่ละฝั่งใช้อยู่จริง (บล็อกหรือโค้ด) */
const names = computed(
  () => ({ [BLACK]: game.nameOf(BLACK), [WHITE]: game.nameOf(WHITE) }) as Record<Player, string>
)

/** ปุ่มแก้ที่หัวโปรแกรม — เปิดตัวแก้ให้ตรงกับโหมดของฝั่งนั้น */
function edit(player: Player) {
  if (game.sides[player].author === 'blocks') editingBlocks.value = player
  else editing.value = player
}

function applyPreset(black: SideKind, white: SideKind) {
  game.setSide(BLACK, { kind: black })
  game.setSide(WHITE, { kind: white })
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
  <NuxtLayout name="game" title="Othello 8×8">
    <GameStage>
      <!-- ข้างซ้าย: ประวัติการเดิน -->
      <template #aside>
        <div class="flex flex-col rounded-card border border-line bg-surface p-3 shadow-soft">
          <div class="mb-2 flex shrink-0 items-baseline justify-between px-1">
            <h2 class="text-xs font-semibold text-ink">ประวัติการเดิน</h2>
            <span class="text-[11px] tabular-nums text-ink-subtle">{{ game.log.value.length }}</span>
          </div>

          <OthelloMoveLog class="h-[var(--log-20-rows)] max-h-[calc(100vh-11rem)]" :entries="game.log.value" />
        </div>
      </template>

      <!-- สนามเล่น -->
      <template #stage>
        <OthelloScoreboard
          :sides="game.sides"
          :names="names"
          :scores="game.scores.value"
          :current="game.current.value"
          :status="game.status.value"
          :thinking="game.thinking.value"
          :winner="game.winner.value"
          :turn="game.turn.value"
        />

        <div class="relative">
          <OthelloBoard
            :board="game.board.value"
            :valid-moves="game.validMoves.value"
            :last-move="game.lastMove.value"
            :interactive="game.isHumanTurn.value"
            @play="game.play"
          />

          <OthelloResultOverlay
            v-if="game.status.value === 'finished'"
            :winner="game.winner.value"
            :scores="game.scores.value"
            :sides="game.sides"
            :names="names"
            @restart="start"
          />
        </div>

        <OthelloToolbar
          v-model:speed="game.speed.value"
          :status="game.status.value"
          :can-undo="game.canUndo.value"
          :starting="starting"
          :show-speed="codeSides.length > 0"
          @start="start"
          @pause="game.pause"
          @resume="game.resume"
          @undo="game.undo"
          @reset="game.reset"
        />

        <p
          v-if="game.error.value"
          class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
        >
          {{ game.error.value }}
        </p>
      </template>

      <!-- โปรแกรมของฝั่งที่เลือกดู -->
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
          @edit="edit(shown)"
          @clear-logs="game.clearLogs(shown)"
        >
          <!-- มีสองฝั่ง เลือกได้ว่าจะดูโปรแกรมของใคร -->
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
                  class="size-3 rounded-full"
                  :class="
                    player === BLACK
                      ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]'
                      : 'border border-line-strong bg-white'
                  "
                />
                ฝ่าย{{ sideLabel(player) }}
              </button>
            </div>
          </template>
        </BlockWorkspace>

        <p
          v-else
          class="rounded-card border border-line bg-surface px-4 py-8 text-center text-xs leading-relaxed text-ink-subtle shadow-soft"
        >
          ยังไม่มีฝั่งไหนเล่นด้วยโปรแกรม<br />เปลี่ยนได้ที่แท็บ "ผู้เล่น"
        </p>
      </template>

      <!-- แผงควบคุม -->
      <template #panel>
        <GamePanel>
          <template #summary>
            <OthelloStats
              :status="game.status.value"
              :scores="game.scores.value"
              :winner="game.winner.value"
              :turn="game.turn.value"
              :moves="game.validMoves.value.length"
              :names="names"
            />
          </template>

          <template #default>
            <OthelloMatchPresets
              :black="game.sides[BLACK].kind"
              :white="game.sides[WHITE].kind"
              :disabled="locked"
              @select="applyPreset"
            />

            <OthelloSideConfig
              v-for="side in [BLACK, WHITE]"
              :key="side"
              :player="side"
              :config="game.sides[side]"
              :name="names[side]"
              :pack="game.blocks[side].pack"
              :program="game.blocks[side].program"
              :preset-id="game.blocks[side].presetId.value"
              :locked="game.blocks[side].locked.value"
              :learns="learners[side]"
              :training="game.training.running"
              :memory="game.memories[side]"
              :disabled="locked"
              @update:kind="focus(side), game.setSide(side, { kind: $event })"
              @update:preset="focus(side), game.blocks[side].usePreset($event)"
              @clear-memory="game.clearMemory(side)"
              @train="openTraining(side)"
            />

            <p v-if="game.training.running" class="px-1 text-[11px] text-ink-subtle">
              กำลังฝึก {{ game.training.done }}/{{ game.training.total }}
            </p>

            <p v-if="locked" class="px-1 text-[11px] text-ink-subtle">
              {{ game.training.running ? 'กำลังฝึกอยู่' : 'กด "ล้างกระดาน" ก่อน ถึงจะเปลี่ยนผู้เล่นหรือแก้โปรแกรมได้' }}
            </p>
          </template>

        </GamePanel>
      </template>

      <template #panel-extra>
        <!-- จอเล็ก: โปรแกรมอยู่ใต้แผงควบคุมแทนคอลัมน์กลางที่ถูกซ่อน -->
        <BlockWorkspace
          v-for="player in codeSides"
          :key="player"
          class="mt-3 xl:hidden"
          :pack="game.blocks[player].pack"
          :program="game.blocks[player].program"
          :author="game.sides[player].author"
          :code="game.sourceOf(player)"
          :active-id="game.activeBlocks[player]"
          :counts="game.blockCounts(player)"
          :line="game.traces[player].line"
          :lines="game.traces[player].lines"
          :traced="true"
          :running="game.traces[player].running"
          :disabled="locked"
          :logs="game.logs[player]"
          @edit="edit(player)"
          @clear-logs="game.clearLogs(player)"
        >
          <template #header>
            <div class="flex items-center gap-2 px-1">
              <span
                class="size-4 shrink-0 rounded-full"
                :class="
                  player === BLACK
                    ? 'bg-gradient-to-br from-[#413354] to-[#1c1524]'
                    : 'border border-line-strong bg-white'
                "
              />
              <p class="text-xs font-semibold text-ink">ฝ่าย{{ sideLabel(player) }}</p>
            </div>
          </template>
        </BlockWorkspace>

        <!-- จอเล็ก: ประวัติอยู่ท้ายสุดแทนคอลัมน์ซ้าย -->
        <div class="mt-4 rounded-card border border-line bg-surface p-3 shadow-soft lg:hidden">
          <div class="mb-2 flex items-baseline justify-between px-1">
            <h2 class="text-xs font-semibold text-ink">ประวัติการเดิน</h2>
            <span class="text-[11px] tabular-nums text-ink-subtle">{{ game.log.value.length }}</span>
          </div>

          <OthelloMoveLog class="h-56" :entries="game.log.value" />
        </div>
      </template>
    </GameStage>

    <OthelloTrainingPanel
      v-model:open="trainingOpen"
      :training="game.training"
      :side="trainFocus"
      :ready="canTrain"
      :learners="learners"
      :names="names"
      :memories="game.memories"
      @start="game.train"
      @stop="game.stopTraining"
      @clear="game.clearMemory"
    />

    <BlockEditor
      v-if="editingBlocks && blockSide"
      v-model:open="blocksOpen"
      :title="`บล็อกของฝ่าย${sideLabel(editingBlocks)}`"
      :pack="blockSide.pack"
      :program="blockSide.program"
      :api="blockSide.api"
      :preset-id="blockSide.presetId.value"
      :locked="blockSide.locked.value"
      @preset="blockSide.usePreset"
      @rename="blockSide.rename"
      @clone="blockSide.cloneForEditing"
    />

  </NuxtLayout>
</template>
