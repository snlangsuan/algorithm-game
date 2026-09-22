import { findSpec } from '~/game/blocks/types'
import { targetOf } from '~/game/blocks/pack'
import { methodSource } from '~/game/blocks/source'

/**
 * การ์ด "บล็อกนี้คิดยังไง" — เปิดได้จากบล็อกทุกที่ (กล่องเครื่องมือ สคริปต์ ตัวแก้บล็อก)
 * จึงเก็บว่ากำลังเปิดบล็อกไหนไว้ที่เดียว แล้ววางการ์ดใบเดียวไว้ที่ app.vue
 */
export function useBlockExplain() {
  const kind = useState<string | null>('block-explain', () => null)

  return {
    kind,
    open: (next: string) => (kind.value = next),
    close: () => (kind.value = null)
  }
}

/**
 * โค้ดของทุกเกม — โหลดเป็นข้อความเฉพาะตอนมีคนกด "ดูโค้ดจริง" และเฉพาะไฟล์ของเกมที่ดูอยู่
 * ไม่ให้โค้ดทั้งเกมติดไปกับหน้าเว็บตั้งแต่แรก
 */
const FILES = import.meta.glob<string>(['../game/*/*.ts', '../game/shared/*.ts'], {
  query: '?raw',
  import: 'default'
})

/** ไฟล์ที่หลายเกมใช้ร่วมกัน — ฝูงนกอยู่ในโฟลเดอร์เกมเส้นแต่ไดโนกับโอเทลโลก็ใช้ */
const isShared = (path: string) => path.includes('/shared/') || path.endsWith('/line/swarm.ts')

/** ลำดับการหา: คลาสแม่ → กติกาของเกม → ไฟล์อื่นในเกมเดียวกัน */
const rank = (path: string) => (path.endsWith('/agent.ts') ? 0 : path.endsWith('/engine.ts') ? 1 : 2)

/** โค้ดจริงของเมธอดที่บล็อกนี้เรียก — หาในตัวช่วยของชุดบล็อกก่อน แล้วค่อยไล่ไฟล์ของเกมนั้น */
export async function blockSource(kind: string): Promise<Array<{ name: string; code: string }>> {
  const spec = findSpec(kind)
  const names = spec?.explain?.code ?? []
  if (names.length === 0) return []

  const target = targetOf(spec?.pack)
  const sources = [target?.helpers ?? '']

  // หาแค่ในเกมของชุดนี้กับไฟล์กลาง — เกมอื่นมีเมธอดชื่อซ้ำกันได้ (swarmFly มีทั้งสามเกม)
  let folder: string | null = null
  for (const [path, load] of Object.entries(FILES)) {
    if (!path.endsWith('/agent.ts') || !target?.base) continue
    if ((await load()).includes(`class ${target.base}`)) folder = path.replace(/agent\.ts$/, '')
  }

  const own = Object.keys(FILES)
    .filter((path) => folder && path.startsWith(folder) && !path.includes('.worker.'))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const shared = Object.keys(FILES).filter((path) => isShared(path) && !own.includes(path))

  for (const path of [...own, ...shared]) sources.push(await FILES[path]!())

  return names.map((name) => ({
    name,
    code: sources.map((source) => methodSource(source, name)).find(Boolean) ?? `// ไม่เจอโค้ดของ ${name}`
  }))
}
