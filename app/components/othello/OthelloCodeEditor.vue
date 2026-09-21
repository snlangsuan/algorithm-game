<script setup lang="ts">
import { BLACK, type Player } from '~/game/othello/engine'
import { AGENT_TEMPLATES } from '~/game/othello/templates'

const open = defineModel<boolean>('open', { required: true })
const code = defineModel<string>('code', { required: true })

const props = defineProps<{
  player: Player
  templateId: string
  test: (code: string) => Promise<{ ok: boolean; message: string }>
}>()

const emit = defineEmits<{ 'use-template': [templateId: string] }>()

const templateOptions = AGENT_TEMPLATES.map((template) => ({
  value: template.id,
  label: template.name
}))

const selected = ref(props.templateId)
const running = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

watch(open, (value) => {
  if (!value) return
  selected.value = props.templateId
  result.value = null
})

watch(selected, (value) => {
  if (value === props.templateId) return
  emit('use-template', value)
  result.value = null
})

const lineCount = computed(() => code.value.split('\n').length)

async function runTest() {
  running.value = true
  result.value = null

  try {
    result.value = await props.test(code.value)
  } finally {
    running.value = false
  }
}

function onTab(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement
  const start = target.selectionStart
  const end = target.selectionEnd

  code.value = `${code.value.slice(0, start)}  ${code.value.slice(end)}`

  nextTick(() => {
    target.selectionStart = start + 2
    target.selectionEnd = start + 2
  })
}
</script>

<template>
  <UiModal
    v-model="open"
    wide
    :title="`โค้ดของฝ่าย${player === BLACK ? 'ดำ' : 'ขาว'}`"
    description="เขียน class Agent extends OthelloAgent แล้ว override เมธอด chooseMove(state)"
  >
    <div class="space-y-4">
      <UiSelect v-model="selected" :options="templateOptions" label="โหลดโค้ดตั้งต้นทับ" />

      <div class="overflow-hidden rounded-xl border border-line-strong bg-[#1c1524]">
        <div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <p class="font-mono text-xs text-white/50">agent.js</p>
          <p class="font-mono text-xs text-white/40">{{ lineCount }} บรรทัด</p>
        </div>

        <textarea
          v-model="code"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="block h-[45vh] w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed text-white/90 outline-none"
          @keydown.tab.prevent="onTab"
        />
      </div>

      <div
        v-if="result"
        class="rounded-xl border px-4 py-3 text-sm"
        :class="
          result.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        "
      >
        {{ result.message }}
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-ink-muted">โค้ดรันใน Web Worker แยกจากหน้าเว็บ และมีเวลาคิดตาละ 3 วินาที</p>

        <div class="flex gap-2">
          <UiButton variant="outline" size="sm" :disabled="running" @click="runTest">
            {{ running ? 'กำลังทดสอบ…' : 'ทดสอบโค้ด' }}
          </UiButton>
          <UiButton size="sm" @click="open = false">เสร็จแล้ว</UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>
