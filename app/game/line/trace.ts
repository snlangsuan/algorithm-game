import type { Paint, Point } from './engine'

/**
 * วาดสนามแบบ "เต่า" — เริ่มที่จุดหนึ่ง หันไปทางหนึ่ง แล้วสั่งเดินตรง เลี้ยวโค้ง หรือหักมุมไปเรื่อย ๆ
 *
 * สนามตามกติกาการแข่งจริงบอกขนาดเป็นระยะกับรัศมี (ช่องว่างไม่เกิน 20 ซม. โค้งรัศมีไม่ต่ำกว่า 10 ซม.)
 * ไม่ได้บอกเป็นพิกัดของจุด วาดแบบนี้จึงเช็กกับกติกาได้ตรง ๆ ว่าแต่ละท่อนยาวเท่าไร โค้งแค่ไหน
 *
 * ได้สนามแบบเส้นตรงต่อกัน (smooth: false) — ทางโค้งซอยเป็นท่อนสั้น ๆ ทีละ ARC_STEP องศา
 * มุมทิศเป็นองศาบนจอ: 0 คือไปทางขวา 90 คือลงล่าง (แกน y ของจอชี้ลง)
 */

/** ซอยทางโค้งทุกกี่องศา — 8 องศาต่อท่อน โค้งรัศมี 60 พิกเซลได้ท่อนละราว 8 พิกเซล */
const ARC_STEP = 8

export interface Traced {
  points: Point[]
  paint: Paint[]
  /** ตำแหน่งที่ตั้งชื่อไว้ระหว่างวาด — ใช้บอกว่าทางแยกแตกจากจุดที่เท่าไร */
  marks: Record<string, number>
}

export function trace(start: Point, heading: number) {
  const points: Point[] = [{ ...start }]
  const paint: Paint[] = []
  const marks: Record<string, number> = {}
  let angle = heading

  const here = (): Point => points[points.length - 1]!
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const round = (value: number) => Math.round(value * 1000) / 1000

  const put = (at: Point, kind: Paint) => {
    paint.push(kind)
    points.push({ x: round(at.x), y: round(at.y) })
  }

  const api = {
    /** เดินตรงไปตามทิศที่หันอยู่ */
    forward(length: number, kind: Paint = 'black') {
      const from = here()
      put({ x: from.x + Math.cos(rad(angle)) * length, y: from.y + Math.sin(rad(angle)) * length }, kind)
      return api
    },

    /** เส้นขาดยาวเท่านี้ */
    gap(length: number) {
      return api.forward(length, 'gap')
    },

    /** หักมุมตรงจุดที่อยู่ — บวกคือเลี้ยวซ้าย ลบคือเลี้ยวขวา */
    turn(degrees: number) {
      angle -= degrees
      return api
    },

    /** เลี้ยวโค้งรัศมีนี้ไปกี่องศา — บวกคือโค้งซ้าย ลบคือโค้งขวา */
    arc(radius: number, degrees: number) {
      const side = Math.sign(degrees)
      // ด้านซ้ายของทิศ (cos, sin) บนจอที่ y ชี้ลง คือ (sin, -cos)
      const leftOf = (a: number) => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) })
      const from = here()
      const left = leftOf(angle)
      const center = { x: from.x + side * left.x * radius, y: from.y + side * left.y * radius }
      const pieces = Math.max(1, Math.round(Math.abs(degrees) / ARC_STEP))
      const start = angle

      for (let piece = 1; piece <= pieces; piece++) {
        const a = start - (degrees * piece) / pieces
        const l = leftOf(a)
        put({ x: center.x - side * l.x * radius, y: center.y - side * l.y * radius }, 'black')
      }

      angle = start - degrees
      return api
    },

    /** ตั้งชื่อจุดที่อยู่ตอนนี้ไว้ใช้ทีหลัง */
    mark(name: string) {
      marks[name] = points.length - 1
      return api
    },

    /** ตรงนี้อยู่ที่ไหน — ใช้คำนวณปลายทางแยก */
    at(): Point {
      return { ...here() }
    },

    /**
     * ปิดวง — ต้องกลับมาถึงจุดเริ่มพอดี จุดสุดท้ายที่ซ้ำกับจุดเริ่มถูกตัดทิ้ง
     * สีของท่อนสุดท้ายกลายเป็นสีของท่อนที่ปิดวงกลับไปจุดแรก
     */
    close(): Traced {
      const last = here()
      const first = points[0]!
      if (Math.hypot(last.x - first.x, last.y - first.y) > 0.5) {
        throw new Error(`วาดสนามไม่ปิดวง — จบที่ (${last.x}, ${last.y}) แต่เริ่มที่ (${first.x}, ${first.y})`)
      }
      points.pop()
      return { points, paint, marks }
    }
  }

  return api
}
