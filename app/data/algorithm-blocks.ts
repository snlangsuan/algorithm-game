/**
 * บล็อกตัวอย่างสำหรับหน้าความรู้ — อธิบายอัลกอริทึมด้วยภาษาภาพเดียวกับในเกม
 *
 * หัวข้อกลุ่ม blocks ใช้ตัวอย่างจริงจาก pack ได้เลย
 * ส่วนหัวข้อที่ยังต่อด้วยบล็อกไม่ได้ ประกอบขึ้นมาให้ดูโครง
 * โดยส่วนที่ยังไม่มีบล็อกรองรับจะเป็นบล็อก "โค้ดของฉัน" — ซึ่งตรงกับความจริงพอดี
 * ว่าถ้าจะทำตอนนี้ต้องเขียนส่วนนั้นเป็นโค้ดเอง
 */
import { normalize, type BlockPack, type BlockProgram } from '~/game/blocks/pack'
import { createBlock } from '~/game/blocks/program'
import type { BlockNode } from '~/game/blocks/types'
import { MAZE_PACK } from '~/game/maze/blocks/pack'
import { OTHELLO_PACK } from '~/game/othello/blocks/pack'

type Fields = Record<string, string | number>
type Inputs = Record<string, BlockNode | null>
type Bodies = Record<string, BlockNode[]>

function make(kind: string, fields: Fields = {}, inputs: Inputs = {}, bodies: Bodies = {}): BlockNode {
  const node = createBlock(kind)
  Object.assign(node.fields, fields)
  for (const [name, child] of Object.entries(inputs)) node.inputs[name] = child
  for (const [name, list] of Object.entries(bodies)) node.bodies[name] = list
  return node
}

/** ส่วนที่ยังไม่มีบล็อกรองรับ — โชว์เป็นบล็อกโค้ดดิบ */
const code = (text: string) => make('raw-code', { code: text })
const expr = (text: string) => make('raw-value', { code: text })

const setVar = (name: string, value: BlockNode) => make('set-var', { name }, { value })
const whileDo = (cond: BlockNode, body: BlockNode[]) => make('while', {}, { cond }, { do: body })
const ifDo = (cond: BlockNode, body: BlockNode[]) => make('if', {}, { cond }, { then: body })
interface Demo {
  pack: BlockPack
  program: BlockProgram
  /** คำอธิบายสั้น ๆ ใต้บล็อก */
  note: string
}

const mazeDemo = (name: string, blocks: BlockNode[], note: string): Demo => ({
  pack: MAZE_PACK,
  program: normalize({ name, scripts: { 'maze.on-turn': blocks } }, MAZE_PACK),
  note
})

const othelloDemo = (name: string, blocks: BlockNode[], note: string): Demo => ({
  pack: OTHELLO_PACK,
  program: normalize({ name, scripts: { 'othello.on-turn': blocks } }, OTHELLO_PACK),
  note
})

/** โครงของอัลกอริทึมค้นหาที่ต่างกันแค่ "หยิบตัวไหนออกมาก่อน" */
function frontierDemo(name: string, take: string, add: string, note: string) {
  return mazeDemo(
    name,
    [
      code(take === 'บนสุด' ? "// ก = กองซ้อน เริ่มด้วยช่องที่ยืนอยู่" : '// ก = คิว เริ่มด้วยช่องที่ยืนอยู่'),
      setVar('a', expr('[ช่องที่ยืนอยู่]')),
      whileDo(expr(take === 'บนสุด' ? 'กองยังไม่ว่าง' : 'คิวยังไม่ว่าง'), [
        setVar('b', expr(`[เอาช่อง${take}ออกมา]`)),
        ifDo(expr('ข คือทางออก'), [code('// เจอแล้ว ย้อนตามที่จำไว้กลับไปหาจุดเริ่ม'), make('maze.stop')]),
        code('// ไล่ดูเพื่อนบ้านของ ข ทีละช่อง เรียกช่องที่กำลังดูว่า ค'),
        make('for-each', { list: 'b', item: 'c' }, {}, {
          do: [
            ifDo(expr('ช่อง ค ยังไม่เคยเจอ'), [
              code(`// ${add}`),
              code('// จำไว้ว่า ค มาจาก ข')
            ])
          ]
        })
      ])
    ],
    note
  )
}

const DEMOS: Record<string, () => Demo> = {
  dfs: () =>
    frontierDemo(
      'ค้นลึกก่อน',
      'บนสุด',
      'ใส่ ค ลงบนสุดของกอง',
      'ต่างจากค้นกว้างก่อนแค่บรรทัดเดียว — หยิบช่องบนสุดของกองออกมา จึงมุ่งลงลึกทางเดียวก่อน'
    ),
  bfs: () =>
    frontierDemo(
      'ค้นกว้างก่อน',
      'หน้าสุด',
      'ต่อ ค ท้ายคิว',
      'หยิบจากหน้าคิว ใส่ต่อท้ายคิว จึงแผ่ออกทีละชั้น ช่องที่เจอครั้งแรกคือช่องที่ก้าวน้อยที่สุด'
    ),
  dijkstra: () =>
    mazeDemo(
      'ทางที่ถูกที่สุด',
      [
        code('// ก = ราคาถึงแต่ละช่อง เริ่มต้นเป็นอนันต์หมด ยกเว้นช่องที่ยืนอยู่เป็น 0'),
        setVar('a', make('number', { value: 0 })),
        whileDo(expr('ยังมีช่องที่ยังไม่สรุป'), [
          setVar('b', expr('[ช่องที่ราคาถูกที่สุดที่ยังไม่สรุป]')),
          code('// ไล่ดูเพื่อนบ้านของ ข ทีละช่อง เรียกช่องที่กำลังดูว่า ค'),
          make('for-each', { list: 'b', item: 'c' }, {}, {
            do: [
              setVar(
                'a',
                make('math', { op: 'add' }, { left: expr('ราคาของ ข'), right: expr('ราคาก้าวเข้า ค') })
              ),
              ifDo(expr('ก ถูกกว่าราคาที่จดไว้ของ ค'), [
                code('// จดราคาใหม่ทับ แล้วจำว่า ค มาจาก ข')
              ])
            ]
          })
        ])
      ],
      'บล็อกที่ขึ้นต้นว่า "โค้ด" คือส่วนที่ต้องมีคิวลำดับความสำคัญกับตารางราคา ซึ่งยังไม่มีบล็อกรองรับ'
    ),
  'a-star': () =>
    mazeDemo(
      'เอสตาร์',
      [
        code('// เหมือน Dijkstra ทุกอย่าง ต่างแค่วิธีให้คะแนนตอนเลือกช่อง'),
        setVar(
          'a',
          make('math', { op: 'add' }, { left: expr('ราคาที่จ่ายมาแล้ว'), right: make('maze.distance') })
        ),
        code('// เลือกช่องที่ ก น้อยที่สุดออกมาทำก่อน'),
        ifDo(make('maze.at-goal'), [make('maze.stop')])
      ],
      'บล็อก "ระยะถึงทางออก" ที่เกมมีอยู่แล้ว คือตัวเดาระยะที่เหลือที่ A* ต้องใช้ — ส่วนที่ขาดคือคิวลำดับความสำคัญ'
    )
}

/** บล็อกตัวอย่างของหัวข้อนี้ — ตัวอย่างจริงจาก pack หรือบล็อกอธิบายที่ประกอบขึ้น */
export function demoFor(slug: string, preset?: { game: 'maze' | 'othello'; id: string }): Demo | null {
  if (preset) {
    const pack = preset.game === 'maze' ? MAZE_PACK : OTHELLO_PACK
    const found = pack.presets.find((item) => item.id === preset.id)
    if (!found) return null

    return {
      pack,
      program: normalize(found.build(), pack),
      note: 'ชุดนี้คือตัวอย่างจริงในเกม กดเข้าไปเล่นแล้วเลือกจากช่อง "อัลกอริทึมที่ใช้" ได้เลย'
    }
  }

  return DEMOS[slug]?.() ?? null
}
