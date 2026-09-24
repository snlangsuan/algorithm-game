import type { Matcher, Node, ParseContext } from '~/game/blocks/importer'
import { createPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import { quote, type BlockNode, type BlockPart, type BlockSpec, type SelectOption } from '~/game/blocks/types'
import type { BotKind } from '~/game/go/bots'
import { GO_EXPLAIN } from './explain'

/** ช่องที่จะลง — ที่จดไว้เองระหว่างไล่ดูทีละตา หรือปล่อยให้เอนจินเลือกให้ */
const SPOTS: SelectOption[] = [
  { value: 'kept', label: 'ช่องที่จำไว้' },
  { value: 'best', label: 'ช่องที่ดีที่สุด' }
]

/** อัลกอริทึมสำเร็จรูปใน bots.ts — ค่าต้องตรงกับ BotKind เป๊ะ */
const BOTS: Array<{ value: BotKind; label: string }> = [
  { value: 'random', label: 'สุ่มถูกกติกา' },
  { value: 'capture', label: 'ไล่จับกับหนีอาตาริ' },
  { value: 'pattern', label: 'แพทเทิร์น 3×3' },
  { value: 'influence', label: 'อิทธิพล' },
  { value: 'montecarlo', label: 'สุ่มเล่นจนจบ' },
  { value: 'uct', label: 'MCTS (UCT)' },
  { value: 'rave', label: 'RAVE' }
]

/** 9 คิวคืออ่อนสุด 1 คิวคือแข็งสุด — เรียงจากง่ายไปยากเหมือนบันไดขั้นฝึก */
const KYU: SelectOption[] = [
  { value: '9', label: '9 คิว (อ่อนสุด)' },
  { value: '8', label: '8 คิว' },
  { value: '7', label: '7 คิว' },
  { value: '6', label: '6 คิว' },
  { value: '5', label: '5 คิว' },
  { value: '4', label: '4 คิว' },
  { value: '3', label: '3 คิว' },
  { value: '2', label: '2 คิว' },
  { value: '1', label: '1 คิว (แข็งสุด)' }
]

const WHO: SelectOption[] = [
  { value: 'me', label: 'ฉัน' },
  { value: 'them', label: 'อีกฝ่าย' }
]

const COLORS: SelectOption[] = [
  { value: 'empty', label: 'ว่าง' },
  { value: 'mine', label: 'หมากของฉัน' },
  { value: 'theirs', label: 'หมากของอีกฝ่าย' }
]

/**
 * ช่องแถว/หลักของบล็อก "ช่องนี้" — เว้นว่างไว้ = ช่องที่ลูปกำลังไล่ดูอยู่
 * สร้างใหม่ทุกครั้งเพราะแต่ละบล็อกถือ parts ของตัวเอง
 */
const point = (): BlockPart[] => [
  { type: 'input', name: 'row', placeholder: 'แถว', accepts: 'number' },
  { type: 'input', name: 'col', placeholder: 'หลัก', accepts: 'number' }
]

const POINT_HINT =
  'เว้นช่องแถวกับหลักว่างไว้ = ช่องที่ "สำหรับตาที่ลงได้แต่ละตา" กำลังดูอยู่ · ใส่ตัวเลขเองก็ได้ แถว 0 คือแถวบนสุด หลัก 0 คือหลักซ้ายสุด'

/** โค้ดของบล็อกจุดหนึ่งช่อง — ไม่ใส่แถว/หลักก็อ่านช่องที่กำลังไล่ดูอยู่ */
const at = (node: BlockNode, ctx: { value: (node: BlockNode, slot: string, fallback: string) => string }) =>
  `${ctx.value(node, 'row', 'this.atRow()')}, ${ctx.value(node, 'col', 'this.atCol()')}`

const HAT_START: BlockSpec = {
  kind: 'go.on-start',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อเริ่มเกม',
  hint: 'ทำครั้งเดียวก่อนเกมเริ่ม เหมาะกับการเตรียมค่าหรือโหลดสิ่งที่จำไว้ · ตอนนี้ยังไม่เห็นกระดาน บล็อกที่อ่านกระดานจึงใช้ไม่ได้',
  parts: [{ type: 'text', text: 'เมื่อเริ่มเกม' }],
  emit: () => {}
}

const HAT_TURN: BlockSpec = {
  kind: 'go.on-turn',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อถึงตาของฉัน',
  hint: 'ระบบอ่านบล็อกที่ต่อไว้ข้างล่างนี้ทุกครั้งที่ถึงตาเรา',
  parts: [{ type: 'text', text: 'เมื่อถึงตาของฉัน' }],
  emit: () => {}
}

const HAT_END: BlockSpec = {
  kind: 'go.on-end',
  shape: 'hat',
  category: 'event',
  title: 'เมื่อจบเกม',
  hint: 'ทำหลังนับแต้มเสร็จ เหมาะกับการจำสิ่งที่ได้ผลไว้ใช้เกมหน้า',
  parts: [{ type: 'text', text: 'เมื่อจบเกม' }],
  emit: () => {}
}

const BLOCKS: BlockSpec[] = [
  // ---------- สั่งให้ทำ ----------
  {
    kind: 'go.place',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมาก',
    hint: 'ลงหมากแล้วจบตานี้ทันที บล็อกที่ต่อไว้ข้างล่างจะไม่ถูกทำ · "ช่องที่จำไว้" คือช่องที่ "จำช่องนี้ไว้" จดไว้ล่าสุดในตานี้',
    parts: [
      { type: 'text', text: 'ลงหมากที่' },
      { type: 'field', name: 'spot', options: SPOTS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.playSpot(${quote(ctx.field(node, 'spot'))})`)
  },
  {
    kind: 'go.pass',
    shape: 'statement',
    category: 'action',
    title: 'ผ่านตา',
    hint: 'ไม่ลงหมากในตานี้ — สองฝ่ายผ่านติดกันคือจบเกมแล้วนับแต้ม จึงควรผ่านตอนไม่มีตาไหนคุ้มที่จะลงแล้วเท่านั้น',
    parts: [{ type: 'text', text: 'ผ่านตา' }],
    emit: (node, ctx) => ctx.line(node, `return 'pass'`)
  },
  {
    kind: 'go.keep',
    shape: 'statement',
    category: 'action',
    title: 'จำช่องนี้ไว้',
    hint: 'จดช่องที่กำลังไล่ดูอยู่ไว้ ยังไม่ลง — ใช้ข้างใน "สำหรับตาที่ลงได้แต่ละตา" เพื่อเก็บช่องที่ดีที่สุดเท่าที่เจอ แล้วค่อยลงตอนจบลูป',
    parts: [{ type: 'text', text: 'จำช่องนี้ไว้' }],
    emit: (node, ctx) => ctx.line(node, 'this.keep()')
  },
  {
    kind: 'go.ruthless',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากโหมดโหด',
    hint: 'เอนจินเต็มกำลัง — MCTS + RAVE ที่มีความรู้เรื่องโกะนำทาง สุ่มเล่นแบบหยุดเร็ว และไม่ยอมผ่านตาทิ้งเกม · แข็งกว่าระดับ 1 คิว',
    parts: [{ type: 'text', text: 'ลงหมากโหมดโหด' }],
    emit: (node, ctx) => ctx.line(node, `return this.bot('ruthless')`)
  },
  {
    kind: 'go.rl-play',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากด้วยน้ำหนักที่ฝึกเอง',
    hint: 'ค้นแบบโหมดโหด แต่ใช้ "น้ำหนักของลักษณะ" ที่ฝึกมาเองนำทาง แทนความรู้โกะที่เขียนไว้ตายตัว — ต้องคู่กับบล็อก "ปรับน้ำหนักจากผลเกมนี้"',
    parts: [{ type: 'text', text: 'ลงหมากด้วยน้ำหนักที่ฝึกเอง' }],
    emit: (node, ctx) => ctx.line(node, 'return this.rlPlay()')
  },
  {
    kind: 'go.rl-learn',
    shape: 'statement',
    category: 'action',
    title: 'ปรับน้ำหนักจากผลเกมนี้',
    hint: 'ใช้ในหัวบล็อก "เมื่อจบเกม" — ชนะก็ดันน้ำหนักของลักษณะที่ตาเราเลือกขึ้น แพ้ก็ดึงลง (REINFORCE)',
    parts: [{ type: 'text', text: 'ปรับน้ำหนักจากผลเกมนี้' }],
    emit: (node, ctx) => ctx.line(node, 'this.rlLearn(this.won)')
  },
  {
    kind: 'go.learned',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากแบบเรียนรู้จากเกมก่อน ๆ',
    hint: 'ค้นแบบโหมดโหด แต่ใช้ตำราเปิดหมากกับตาตอบที่จำมาจากเกมก่อน ๆ ด้วย — ต้องคู่กับบล็อก "จดผลเกมนี้ไว้เรียนรู้" ในหัว "เมื่อจบเกม"',
    parts: [{ type: 'text', text: 'ลงหมากแบบเรียนรู้จากเกมก่อน ๆ' }],
    emit: (node, ctx) => ctx.line(node, 'return this.learned()')
  },
  {
    kind: 'go.remember',
    shape: 'statement',
    category: 'action',
    title: 'จดผลเกมนี้ไว้เรียนรู้',
    hint: 'ใช้ในหัวบล็อก "เมื่อจบเกม" — ชนะก็จดว่าตาที่เดินมาใช้ได้ แพ้ก็จดว่าเคยลองแล้วไม่เวิร์ก เกมหน้าจะเล่นดีขึ้น',
    parts: [{ type: 'text', text: 'จดผลเกมนี้ไว้เรียนรู้' }],
    emit: (node, ctx) => ctx.line(node, 'this.rememberGame(this.won)')
  },
  {
    kind: 'go.bot',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากแบบอัลกอริทึม',
    hint: 'ให้อัลกอริทึมสำเร็จรูปเลือกตาให้ — ลองสลับดูว่าแต่ละแบบเล่นต่างกันยังไง',
    parts: [
      { type: 'text', text: 'ลงหมากแบบ' },
      { type: 'field', name: 'kind', options: BOTS }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.bot(${quote(ctx.field(node, 'kind'))})`)
  },
  {
    kind: 'go.kyu',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากตามระดับคิว',
    hint: 'บันไดความเก่งของคนเล่นโกะ — 9 คิวคือมือใหม่ 1 คิวคือใกล้ระดับดั้ง แต่ละขั้นเพิ่มความคิดขึ้นทีละอย่าง',
    parts: [
      { type: 'text', text: 'ลงหมากระดับ' },
      { type: 'field', name: 'level', options: KYU }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.kyu(${Number(ctx.field(node, 'level')) || 9})`)
  },
  {
    kind: 'go.search',
    shape: 'statement',
    category: 'action',
    title: 'ลงหมากโดยสุ่มเล่นให้จบ',
    hint: 'สร้างต้นไม้แล้วสุ่มเล่นจนจบเกมซ้ำ ๆ (MCTS/UCT) รอบยิ่งมากยิ่งเก่งแต่ยิ่งช้า — หมดเวลาคิดของตานั้นเมื่อไรก็หยุดก่อนครบรอบ',
    parts: [
      { type: 'text', text: 'ลงหมากที่ดีที่สุด โดยสุ่มเล่นจนจบ' },
      { type: 'input', name: 'rounds', placeholder: 'ตัวเลข', accepts: 'number' },
      { type: 'text', text: 'รอบ' }
    ],
    emit: (node, ctx) => ctx.line(node, `return this.search(${ctx.value(node, 'rounds', '300')})`)
  },

  // ---------- เงื่อนไข / ทำซ้ำ ----------
  {
    kind: 'go.each-move',
    shape: 'statement',
    category: 'control',
    title: 'สำหรับตาที่ลงได้แต่ละตา',
    hint:
      'ไล่ดูช่องที่ลงได้ทีละช่อง (ไม่รวมช่องที่เป็นการถมตาตัวเอง) · ' +
      'บล็อก "ช่องนี้" ทุกตัวที่อยู่ข้างใน จะหมายถึงช่องที่กำลังไล่ดูอยู่',
    parts: [
      { type: 'text', text: 'สำหรับตาที่ลงได้แต่ละตา' },
      { type: 'body', name: 'do' }
    ],
    emit: (node, ctx) => {
      ctx.line(node, 'for (const ตา of this.movesHere()) {')
      ctx.indent(1)
      ctx.raw('this.focus(ตา)')
      ctx.body(node, 'do')
      ctx.indent(-1)
      ctx.raw('}')
    }
  },

  // ---------- สิ่งที่มองเห็น: ช่องหนึ่งช่อง ----------
  {
    kind: 'go.liberties',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ลมหายใจของหมู่ที่ช่องนี้',
    hint: 'ช่องว่างที่ติดกับหมู่นั้น — หมดเมื่อไรหมู่ถูกจับออกจากกระดาน · ช่องว่างได้ 0 · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'ลมหายใจของหมู่ที่ช่อง' }, ...point()],
    emit: (node, ctx) => `this.liberties(${at(node, ctx)})`
  },
  {
    kind: 'go.group-size',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'หมู่นี้มีกี่เม็ด',
    hint: 'จำนวนหมากในหมู่ที่ติดกันเป็นผืนเดียวกับช่องนี้ · ช่องว่างได้ 0 · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'หมู่ที่ช่อง' }, ...point(), { type: 'text', text: 'มีกี่เม็ด' }],
    emit: (node, ctx) => `this.groupSize(${at(node, ctx)})`
  },
  {
    kind: 'go.atari',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'หมู่นี้โดนอาตาริ',
    hint: 'อาตาริ = เหลือลมหายใจเส้นเดียว ตาหน้าถูกจับได้ · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'หมู่ที่ช่อง' }, ...point(), { type: 'text', text: 'โดนอาตาริ' }],
    emit: (node, ctx) => `this.inAtari(${at(node, ctx)})`
  },
  {
    kind: 'go.captures',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ลงตานี้จับได้กี่เม็ด',
    hint: 'ลองลงในใจแล้วนับหมากของอีกฝ่ายที่ถูกยกออก · ลงตานั้นไม่ได้ตามกติกาก็ได้ 0 · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'ลงที่ช่อง' }, ...point(), { type: 'text', text: 'จับได้กี่เม็ด' }],
    emit: (node, ctx) => `this.capturesBy(${at(node, ctx)})`
  },
  {
    kind: 'go.libs-after',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ลงตานี้แล้วเหลือลมหายใจกี่เส้น',
    hint: 'ลมหายใจของหมู่ตัวเองหลังลงหมากเม็ดนี้ — 1 คือลงไปแล้วโดนอาตาริทันที · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'ลงที่ช่อง' }, ...point(), { type: 'text', text: 'แล้วเหลือลมหายใจกี่เส้น' }],
    emit: (node, ctx) => `this.libertiesAfter(${at(node, ctx)})`
  },
  {
    kind: 'go.my-eye',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ช่องนี้เป็นตาของฉัน',
    hint: 'ตา = ช่องว่างที่ล้อมด้วยหมากเราครบทุกด้าน ลงทับเองมีแต่เสีย · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'ช่อง' }, ...point(), { type: 'text', text: 'เป็นตาของฉัน' }],
    emit: (node, ctx) => `this.isMyEye(${at(node, ctx)})`
  },
  {
    kind: 'go.color',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'สีของช่องนี้',
    hint: 'ดูว่าช่องนั้นว่าง เป็นหมากของเรา หรือของอีกฝ่าย · นอกกระดานเป็นเท็จทั้งสามแบบ · ' + POINT_HINT,
    parts: [
      { type: 'text', text: 'ช่อง' },
      ...point(),
      { type: 'text', text: 'เป็น' },
      { type: 'field', name: 'who', options: COLORS }
    ],
    emit: (node, ctx) => {
      const who = ctx.field(node, 'who')
      const method = who === 'mine' ? 'isMine' : who === 'theirs' ? 'isTheirs' : 'isEmpty'
      return `this.${method}(${at(node, ctx)})`
    }
  },
  {
    kind: 'go.from-edge',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ห่างขอบกระดานเท่าไร',
    hint: '0 คือริมสุด 1 คือเส้นที่สอง · คนเล่นโกะชอบเส้นที่สามกับสี่ (ค่า 2 กับ 3) เพราะได้ทั้งพื้นที่และความแข็งแรง · ' + POINT_HINT,
    parts: [{ type: 'text', text: 'ช่อง' }, ...point(), { type: 'text', text: 'ห่างขอบกระดานเท่าไร' }],
    emit: (node, ctx) => `this.fromEdge(${at(node, ctx)})`
  },
  {
    kind: 'go.playout',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'สุ่มเล่นจนจบจากตานี้แล้วฉันชนะไหม',
    hint: 'ลงช่องนี้แล้วสุ่มเล่นทั้งสองฝ่ายจนจบเกมหนึ่งครั้ง แล้วนับแต้มดูว่าเราชนะไหม — ครั้งเดียวเชื่อไม่ได้ ต้องลองซ้ำหลายครั้ง · ' + POINT_HINT,
    parts: [
      { type: 'text', text: 'ลงที่ช่อง' },
      ...point(),
      { type: 'text', text: 'แล้วสุ่มเล่นจนจบ ฉันชนะไหม' }
    ],
    emit: (node, ctx) => `this.playout(${at(node, ctx)})`
  },

  // ---------- สิ่งที่มองเห็น: ทั้งกระดาน ----------
  {
    kind: 'go.lead',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'แต้มที่ฉันนำอยู่',
    hint: 'นับแบบจีน (หมากบนกระดาน + พื้นที่ที่ล้อมได้) รวมโคมิแล้ว — ติดลบคือกำลังตามหลัง',
    parts: [{ type: 'text', text: 'แต้มที่ฉันนำอยู่' }],
    emit: () => 'this.lead()'
  },
  {
    kind: 'go.area',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'พื้นที่',
    hint: 'หมากบนกระดานบวกช่องว่างที่ล้อมได้ของฝ่ายนั้น',
    parts: [
      { type: 'text', text: 'พื้นที่ของ' },
      { type: 'field', name: 'who', options: WHO }
    ],
    emit: (node, ctx) => `this.area(${quote(ctx.field(node, 'who'))})`
  },
  {
    kind: 'go.move-count',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'จำนวนตาที่ลงได้',
    hint: 'นับเฉพาะตาที่ลงได้และไม่ใช่การถมตาตัวเอง — ชุดเดียวกับที่ลูป "สำหรับตาที่ลงได้แต่ละตา" ไล่ดู',
    parts: [{ type: 'text', text: 'จำนวนตาที่ลงได้' }],
    emit: () => 'this.sensibleMoves().length'
  },
  {
    kind: 'go.turn',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ตาที่เท่าไร',
    hint: 'ตาแรกของเกมคือ 1 นับรวมตาที่ผ่านด้วย',
    parts: [{ type: 'text', text: 'ตาที่เท่าไรแล้ว' }],
    emit: () => 'this.here.turn'
  },
  {
    kind: 'go.size',
    shape: 'value',
    value: 'number',
    category: 'sense',
    title: 'ขนาดกระดาน',
    hint: 'ด้านละกี่เส้น — 9, 13 หรือ 19',
    parts: [{ type: 'text', text: 'ขนาดกระดาน' }],
    emit: () => 'this.here.size'
  },
  {
    kind: 'go.won',
    shape: 'value',
    value: 'check',
    category: 'sense',
    title: 'ฉันชนะเกมนี้',
    hint: 'ใช้ในหัวบล็อก "เมื่อจบเกม"',
    parts: [{ type: 'text', text: 'ฉันชนะเกมนี้' }],
    emit: () => 'this.won'
  }
]

const HELPERS = `
  // ---------- ตัวช่วยของบล็อก ----------

  // ช่องที่ลูป "สำหรับตาที่ลงได้แต่ละตา" กำลังไล่ดูอยู่
  focus(move) {
    this.look = move
  }

  // ชุดช่องที่ลูปไล่ดู — ลงได้ตามกติกา และไม่ใช่การถมตาตัวเอง
  movesHere() {
    return this.sensibleMoves()
  }

  // แถว/หลักของช่องที่กำลังไล่ดู — บล็อก "ช่องนี้" ที่เว้นช่องแถว-หลักว่างไว้มาอ่านที่นี่
  atRow() {
    return this.look ? this.look.row : 0
  }

  atCol() {
    return this.look ? this.look.col : 0
  }

  // จดช่องที่กำลังไล่ดูไว้ พร้อมจดว่าจดตอนกระดานของตาไหน กันของค้างข้ามตา
  keep() {
    this.saved = { move: this.look, at: this.here }
  }

  /**
   * ตาสำรองเวลาโปรแกรมยังไม่ได้สั่งลงตาไหน
   * แพทเทิร์น 3×3 รอบตาที่อีกฝ่ายเพิ่งลงก่อน ไม่มีก็สุ่มจากตาที่ไม่ถมตาตัวเอง
   */
  bestSpot() {
    const pattern = this.patternMove()
    if (pattern) return pattern

    const list = this.sensibleMoves()
    if (list.length === 0) return 'pass'
    return list[Math.floor(Math.random() * list.length)]
  }

  // ลงช่องที่จำไว้ (ต้องจำไว้ในตานี้จริง ๆ) ไม่งั้นให้เอนจินเลือกให้
  playSpot(kind) {
    if (kind === 'kept') {
      const saved = this.saved
      if (saved && saved.at === this.here && saved.move) return saved.move
    }

    return this.bestSpot()
  }`

function block(
  kind: string,
  fields: Record<string, string | number> = {},
  inputs: Record<string, BlockNode | null> = {},
  bodies: Record<string, BlockNode[]> = {}
): BlockNode {
  const node = createBlock(kind)
  Object.assign(node.fields, fields)
  Object.assign(node.inputs, inputs)
  Object.assign(node.bodies, bodies)
  return node
}

const number = (value: number) => block('number', { value })
const readVar = (name: string) => block('var-get', { name })
const setVar = (name: string, value: BlockNode) => block('set-var', { name }, { value })
const math = (op: string, left: BlockNode, right: BlockNode) => block('math', { op }, { left, right })
const smallest = (left: BlockNode, right: BlockNode) =>
  block('math-fn', { fn: 'min' }, { left, right })
const compare = (left: BlockNode, op: string, right: BlockNode) =>
  block('compare', { op }, { left, right })

/** ลูปเก็บช่องที่ดีที่สุด: ถ้าคะแนน b ดีกว่าที่เคยเจอ (a) ก็จำช่องนี้ไว้ */
const keepIfBetter = () =>
  block(
    'if',
    {},
    { cond: compare(readVar('b'), 'gt', readVar('a')) },
    { then: [setVar('a', readVar('b')), block('go.keep')] }
  )

const STATEMENT_PARSERS: Matcher[] = [
  (node, ctx) => {
    const back = ctx.returned(node)
    if (!back) return null

    const spot = ctx.call(back, 'playSpot')
    const which = spot ? ctx.str(spot[0]!) : null
    if (which && SPOTS.some((item) => item.value === which)) return ctx.make('go.place', { spot: which })

    if (ctx.call(back, 'learned')) return ctx.make('go.learned')
    if (ctx.call(back, 'rlPlay')) return ctx.make('go.rl-play')

    const bot = ctx.call(back, 'bot')
    const kind = bot ? ctx.str(bot[0]!) : null
    // โหมดโหดมีบล็อกของตัวเอง ต้องเช็คก่อนบล็อกอัลกอริทึมแบบมีดรอปดาวน์
    // ไม่งั้นอ่านโค้ดกลับมาแล้วบล็อกจะเปลี่ยนชนิดไปเฉย ๆ ทั้งที่โค้ดเหมือนเดิม
    if (kind === 'ruthless') return ctx.make('go.ruthless')
    if (kind && BOTS.some((item) => item.value === kind)) return ctx.make('go.bot', { kind })

    const kyu = ctx.call(back, 'kyu')
    const level = kyu ? ctx.num(kyu[0]!) : null
    if (level !== null && KYU.some((item) => item.value === String(level))) {
      return ctx.make('go.kyu', { level: String(level) })
    }

    const rounds = ctx.call(back, 'search')
    if (rounds?.length === 1) return ctx.make('go.search', {}, { rounds: ctx.value(rounds[0]!) })

    return ctx.str(back) === 'pass' ? ctx.make('go.pass') : null
  },

  (node, ctx) =>
    node.type === 'ExpressionStatement' && ctx.call(node.expression, 'keep')
      ? ctx.make('go.keep')
      : null,

  (node, ctx) =>
    node.type === 'ExpressionStatement' && ctx.call(node.expression, 'rememberGame')
      ? ctx.make('go.remember')
      : null,

  (node, ctx) =>
    node.type === 'ExpressionStatement' && ctx.call(node.expression, 'rlLearn')
      ? ctx.make('go.rl-learn')
      : null,

  (node, ctx) => {
    if (node.type !== 'ForOfStatement') return null
    if (!ctx.call(node.right, 'movesHere')) return null

    // บรรทัด this.focus(ตา) เป็นของตัวลูปเอง ไม่ใช่บล็อกที่ผู้เล่นต่อไว้ข้างใน
    const inner: Node[] = (node.body?.body ?? []).filter(
      (item: Node) => !(item.type === 'ExpressionStatement' && ctx.call(item.expression, 'focus'))
    )

    return ctx.make('go.each-move', {}, {}, { do: inner.flatMap((item) => ctx.body(item)) })
  }
]

/**
 * แถว/หลักของบล็อก "ช่องนี้" — this.atRow()/this.atCol() คือช่องที่เว้นว่างไว้
 * ต้องคืนรูว่าง ไม่งั้นอ่านกลับแล้วบล็อกจะงอกเพิ่มทุกรอบ
 */
const pointInputs = (args: Node[], ctx: ParseContext): Record<string, BlockNode | null> => ({
  row: ctx.call(args[0]!, 'atRow') ? null : ctx.value(args[0]!),
  col: ctx.call(args[1]!, 'atCol') ? null : ctx.value(args[1]!)
})

const pointValue =
  (method: string, kind: string, fields: Record<string, string> = {}): Matcher =>
  (node, ctx) => {
    const args = ctx.call(node, method)
    return args?.length === 2 ? ctx.make(kind, fields, pointInputs(args, ctx)) : null
  }

const VALUE_PARSERS: Matcher[] = [
  pointValue('liberties', 'go.liberties'),
  pointValue('groupSize', 'go.group-size'),
  pointValue('inAtari', 'go.atari'),
  pointValue('capturesBy', 'go.captures'),
  pointValue('libertiesAfter', 'go.libs-after'),
  pointValue('isMyEye', 'go.my-eye'),
  pointValue('fromEdge', 'go.from-edge'),
  pointValue('playout', 'go.playout'),
  pointValue('isEmpty', 'go.color', { who: 'empty' }),
  pointValue('isMine', 'go.color', { who: 'mine' }),
  pointValue('isTheirs', 'go.color', { who: 'theirs' }),
  (node, ctx) => (ctx.call(node, 'lead') ? ctx.make('go.lead') : null),
  (node, ctx) => {
    const args = ctx.call(node, 'area')
    const who = args ? ctx.str(args[0]!) : null
    return who && WHO.some((item) => item.value === who) ? ctx.make('go.area', { who }) : null
  },
  (node, ctx) => {
    if (node.type !== 'MemberExpression' || node.property?.name !== 'length') return null
    return ctx.call(node.object, 'sensibleMoves') ? ctx.make('go.move-count') : null
  },
  (node, ctx) => (ctx.thisProp(node, 'here', 'turn') ? ctx.make('go.turn') : null),
  (node, ctx) => (ctx.thisProp(node, 'here', 'size') ? ctx.make('go.size') : null),
  (node, ctx) => (ctx.thisProp(node, 'won') ? ctx.make('go.won') : null)
]

/** ตัดบรรทัดที่ระบบเขียนให้เองออก ก่อนแปลงโค้ดกลับเป็นบล็อก */
function unwrapTurn(statements: Node[], ctx: ParseContext): Node[] {
  const list = statements.filter(
    (node) => !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'here'))
  )

  const last = list[list.length - 1]
  if (last?.type === 'ReturnStatement' && ctx.call(last.argument, 'bestSpot')) list.pop()

  return list
}

/**
 * ชื่อไทยของงานที่นับได้ตอนรัน — ใช้ในแผง "โปรแกรมนี้ทำงานยังไง"
 * worker ห่อทุกเมธอดของ agent ด้วยตัวนับอยู่แล้ว ตรงนี้แค่เลือกว่าตัวไหนควรให้เห็น
 */
export const WORK_LABEL: Record<string, string> = {
  liberties: 'นับลมหายใจ',
  groupSize: 'นับเม็ดในหมู่',
  inAtari: 'เช็กอาตาริ',
  capturesBy: 'ลองดูว่าจับได้กี่เม็ด',
  libertiesAfter: 'ลองดูลมหายใจหลังลง',
  isMyEye: 'เช็กว่าเป็นตาตัวเอง',
  canPlay: 'เช็กว่าลงได้ไหม',
  fromEdge: 'วัดระยะจากขอบ',
  sensibleMoves: 'ไล่ตาที่ลงได้',
  lead: 'นับแต้มที่นำอยู่',
  area: 'นับพื้นที่',
  playout: 'สุ่มเล่นจนจบหนึ่งครั้ง',
  patternMove: 'หาแพทเทิร์น 3×3',
  search: 'ค้นแบบ MCTS',
  bot: 'ให้อัลกอริทึมสำเร็จรูปเลือก',
  kyu: 'ให้ระดับคิวเลือก'
}

/** ชุดระดับคิว — ข้อความหนึ่งบรรทัดว่าขั้นนั้นคิดอะไรเพิ่มจากขั้นก่อน */
const LADDER: Array<{ level: number; detail: string }> = [
  { level: 9, detail: 'สุ่มลงในช่องที่ลงได้และไม่ถมตาตัวเอง — ยังไม่รู้จักการจับกินเลย' },
  { level: 8, detail: 'รู้จักจับหมู่ที่เหลือลมหายใจเดียว และหนีเมื่อหมู่ตัวเองโดนอาตาริ แต่ยังเผลอลงมั่ว 40% ของตา' },
  { level: 7, detail: 'เพิ่มการตอบใกล้ ๆ ตาที่อีกฝ่ายเพิ่งลง กับแพทเทิร์น 3×3 แบบ MoGo · เผลอลงมั่ว 25%' },
  { level: 6, detail: 'เปลี่ยนจากการตอบใกล้ ๆ เป็นการชั่งอิทธิพลทั้งกระดาน ชอบเส้นที่สามกับสี่ · เผลอลงมั่ว 12%' },
  { level: 5, detail: 'เปลี่ยนมาใช้ MCTS/UCT แต่ได้เวลาคิดแค่ 12% ของโควตา (อย่างน้อย 300 รอบ) และยังเผลอลงมั่ว 15%' },
  { level: 4, detail: 'UCT เหมือนกัน แต่ได้เวลาคิด 22% ของโควตา (อย่างน้อย 600 รอบ) และเผลอลงมั่ว 8%' },
  { level: 3, detail: 'UCT ที่ได้เวลาคิด 40% ของโควตา (อย่างน้อย 1,200 รอบ) เผลอลงมั่วแค่ 4% — เริ่มเห็นการวางรูปที่ต่อเนื่อง' },
  { level: 2, detail: 'UCT ที่ได้เวลาคิด 65% ของโควตา (อย่างน้อย 2,400 รอบ) เผลอลงมั่วแค่ 1%' },
  { level: 1, detail: 'UCT + RAVE ใช้เวลาคิดเต็มโควตาทุกตา (อย่างน้อย 4,000 รอบ) ไม่เผลอเลย — แข็งที่สุดในเกมนี้' }
]

export const GO_PACK = createPack({
  id: 'go',
  blocks: BLOCKS,
  explain: GO_EXPLAIN,
  parsers: { statements: STATEMENT_PARSERS, values: VALUE_PARSERS },
  target: {
    base: 'GoAgent',
    fields: [],
    helpers: HELPERS,
    memory: true,
    methods: [
      {
        hat: HAT_START,
        name: 'onGameStart',
        unwrap: (statements, ctx) =>
          statements.filter(
            (node) =>
              !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'side'))
          ),
        write: (writer) => {
          writer.push('onGameStart(player) {')
          writer.indent(1)
          writer.push('this.side = player')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: HAT_TURN,
        name: 'chooseMove',
        unwrap: unwrapTurn,
        write: (writer) => {
          writer.push('chooseMove(state) {')
          writer.indent(1)
          writer.push('this.here = state')
          writer.push('')
          writer.body()
          writer.push('')
          writer.push('// โปรแกรมไม่ได้สั่งลงตาไหนเลย — เลือกตาให้เองจากแพทเทิร์น 3×3 หรือสุ่มตาที่ไม่ถมตาตัวเอง')
          writer.push('return this.bestSpot()')
          writer.indent(-1)
          writer.push('}')
        }
      },
      {
        hat: HAT_END,
        name: 'onGameEnd',
        unwrap: (statements, ctx) =>
          statements.filter(
            (node) =>
              !(node.type === 'ExpressionStatement' && ctx.thisProp(node.expression?.left, 'won'))
          ),
        write: (writer) => {
          writer.push('onGameEnd(final) {')
          writer.indent(1)
          writer.push('this.won = final.winner === this.side')
          writer.body()
          writer.indent(-1)
          writer.push('}')
        }
      }
    ]
  },
  presets: [
    ...LADDER.map(({ level, detail }) => ({
      id: `kyu${level}`,
      name: `ระดับ ${level} คิว`,
      description: detail,
      build: (): BlockProgram => ({
        name: `ระดับ ${level} คิว`,
        scripts: { 'go.on-turn': [block('go.kyu', { level: String(level) })] }
      })
    })),
    {
      id: 'random',
      name: 'สุ่มถูกกติกา',
      description:
        'สุ่มช่องจากตาที่ลงได้ทั้งหมด ข้ามแค่ช่องที่เป็นการถมตาตัวเอง — ไม่มีความรู้เรื่องโกะเลย ใช้เป็นคู่ซ้อมเบา ๆ และเป็นฐานให้วิธีอื่นเทียบ',
      build: (): BlockProgram => ({
        name: 'สุ่มถูกกติกา',
        scripts: { 'go.on-turn': [block('go.bot', { kind: 'random' })] }
      })
    },
    {
      id: 'capture',
      name: 'ไล่จับกับหนีอาตาริ',
      description:
        'ต่อจากบล็อกเอง: ไล่ดูทุกตาที่ลงได้ ให้คะแนน = จับได้กี่เม็ด × 10 + ลมหายใจที่เหลือหลังลง เก็บช่องที่คะแนนสูงสุดไว้แล้วค่อยลง — จับกินก่อนเสมอ และเลี่ยงช่องที่ลงไปแล้วโดนอาตาริทันที',
      build: (): BlockProgram => ({
        name: 'ไล่จับกับหนีอาตาริ',
        scripts: {
          'go.on-turn': [
            // ไม่เหลือตาที่คุ้มจะลงแล้วก็ผ่าน สองฝ่ายผ่านติดกันคือจบเกม
            block(
              'if',
              {},
              { cond: compare(block('go.move-count'), 'lt', number(1)) },
              { then: [block('go.pass')] }
            ),
            setVar('a', number(-1)),
            block(
              'go.each-move',
              {},
              {},
              {
                do: [
                  setVar('b', math('mul', block('go.captures'), number(10))),
                  setVar('b', math('add', readVar('b'), block('go.libs-after'))),
                  keepIfBetter()
                ]
              }
            ),
            block('go.place', { spot: 'kept' })
          ]
        }
      })
    },
    {
      id: 'pattern',
      name: 'แพทเทิร์น 3×3',
      description:
        'จับกินก่อนเสมอ ไม่มีอะไรให้จับค่อยดูรูปหมาก 3×3 รอบตาที่อีกฝ่ายเพิ่งลง ตรงกับรูปที่คนเล่นตอบกันประจำก็ลงตามนั้น สุดท้ายค่อยตอบใกล้ ๆ ตาที่เพิ่งลง — เป็นชุดกฎที่โปรแกรม MoGo ใช้',
      build: (): BlockProgram => ({
        name: 'แพทเทิร์น 3×3',
        scripts: { 'go.on-turn': [block('go.bot', { kind: 'pattern' })] }
      })
    },
    {
      id: 'influence',
      name: 'อิทธิพล',
      description:
        'ต่อจากบล็อกเอง: ให้คะแนนช่องตามที่คนเล่นโกะสอนกัน — อยู่เส้นที่สามหรือสี่ได้คะแนนเต็ม (ระยะจากขอบ ไม่เกิน 3 แล้วคูณ 2) บวกลมหายใจที่เหลือหลังลง บวกหมากที่จับได้ × 5 แล้วลงช่องที่ได้คะแนนสูงสุด',
      build: (): BlockProgram => ({
        name: 'อิทธิพล',
        scripts: {
          'go.on-turn': [
            setVar('a', number(-999)),
            block(
              'go.each-move',
              {},
              {},
              {
                do: [
                  // ริมสุด (0) ได้น้อย เส้นที่สามขึ้นไป (3 ขึ้นไป) ได้เท่ากันหมด
                  setVar('b', smallest(block('go.from-edge'), number(3))),
                  setVar('b', math('mul', readVar('b'), number(2))),
                  setVar('b', math('add', readVar('b'), block('go.libs-after'))),
                  setVar('b', math('add', readVar('b'), math('mul', block('go.captures'), number(5)))),
                  keepIfBetter()
                ]
              }
            ),
            block('go.place', { spot: 'kept' })
          ]
        }
      })
    },
    {
      id: 'montecarlo',
      name: 'สุ่มเล่นจนจบ (Monte Carlo)',
      description:
        'ไม่มีสูตรบอกว่ากระดานดีแค่ไหนเลย — ทุกตาที่ลงได้ถูกสุ่มเล่นจนจบเกมตาละ 30 ครั้ง แล้วเลือกตาที่ชนะบ่อยที่สุด (flat Monte Carlo ไม่สร้างต้นไม้ หมดเวลาก่อนก็ตอบเท่าที่ลองมา)',
      build: (): BlockProgram => ({
        name: 'สุ่มเล่นจนจบ',
        scripts: { 'go.on-turn': [block('go.bot', { kind: 'montecarlo' })] }
      })
    },
    {
      id: 'uct',
      name: 'MCTS (UCT)',
      description:
        'สุ่มเล่นจนจบเหมือนกัน แต่จดผลลงต้นไม้แล้วแบ่งรอบที่เหลือไปกิ่งที่ทั้งชนะบ่อยและยังลองน้อย (สูตร UCT) — ชุดนี้ตั้งไว้ 400 รอบ ลองเพิ่มลดดูว่าเก่งขึ้นแค่ไหน',
      build: (): BlockProgram => ({
        name: 'MCTS (UCT)',
        scripts: { 'go.on-turn': [block('go.search', {}, { rounds: number(400) })] }
      })
    },
    {
      id: 'rl',
      name: 'ฝึกน้ำหนักเอง (RL)',
      description:
        'เรียนแบบ reinforcement learning — ไม่ได้จำกระดานเป็นรูป ๆ แต่เรียน "น้ำหนัก" ของลักษณะแต่ละอย่างของตา (จับได้กี่เม็ด ลงแล้วเหลือลมหายใจเท่าไร อยู่เส้นไหน ใกล้ตาที่เขาเพิ่งลงแค่ไหน และรูปสี่ด้านรอบช่อง 256 แบบ) · จบเกมแล้วชนะก็ดันน้ำหนักของตาที่เลือกขึ้น แพ้ก็ดึงลง (REINFORCE) · เรียนเป็นน้ำหนักจึงใช้กับกระดานที่ไม่เคยเจอและข้ามขนาดกระดานได้',
      build: (): BlockProgram => ({
        name: 'ฝึกน้ำหนักเอง (RL)',
        scripts: {
          'go.on-turn': [block('go.rl-play')],
          'go.on-end': [block('go.rl-learn')]
        }
      })
    },
    {
      id: 'learner',
      name: 'ยิ่งเล่นยิ่งเก่ง',
      description:
        'เริ่มต้นเท่าโหมดโหด แต่จำสิ่งที่ได้จากเกมก่อน ๆ ไว้ด้วย — จดตำราเปิดหมากว่าจากกระดานหน้าตานี้เคยลงตาไหนแล้วชนะ และจดตาตอบที่เคยได้ผลไว้ใช้ตอนสุ่มเล่นใน MCTS · ยิ่งซ้อมหลายเกมยิ่งเปิดหมากแม่นขึ้น (กดล้างความจำได้ถ้าอยากเริ่มใหม่)',
      build: (): BlockProgram => ({
        name: 'ยิ่งเล่นยิ่งเก่ง',
        scripts: {
          'go.on-turn': [block('go.learned')],
          'go.on-end': [block('go.remember')]
        }
      })
    },
    {
      id: 'ruthless',
      name: 'โหมดโหด',
      description:
        'เอนจินเต็มกำลังของเกมนี้ — ค้นแบบ MCTS + RAVE เหมือน 1 คิว แต่เพิ่มสามอย่าง: ให้เครดิตล่วงหน้ากับตาที่คนเล่นโกะรู้ว่าดี (จับได้ ไม่ทิ้งหมู่ให้โดนจับ ตอบใกล้ตาที่เพิ่งลง เลี่ยงเส้นแรก), หยุดสุ่มเล่นทันทีที่ผลขาดกันเกิน 35% ของกระดานจึงได้จำนวนรอบมากขึ้น, และไม่ยอมผ่านตาทิ้งเกมตอนตามหลัง · ชนะระดับ 1 คิวได้ทุกเกมในเทสต์',
      build: (): BlockProgram => ({
        name: 'โหมดโหด',
        scripts: { 'go.on-turn': [block('go.ruthless')] }
      })
    },
    {
      id: 'rave',
      name: 'RAVE',
      description:
        'UCT ที่แชร์สถิติข้ามกิ่ง — ถ้าช่องหนึ่งทำให้ชนะบ่อยไม่ว่าลงตาที่เท่าไร ก็เชื่อไว้ก่อน ทำให้รู้เร็วขึ้นมากตอนรอบยังน้อย เป็นสูตรที่โปรแกรมโกะยุคก่อน AlphaGo ใช้กันทุกตัว',
      build: (): BlockProgram => ({
        name: 'RAVE',
        scripts: { 'go.on-turn': [block('go.bot', { kind: 'rave' })] }
      })
    }
  ]
})

export const DEFAULT_PRESET_ID = 'kyu9'
