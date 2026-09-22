/**
 * สนามที่ผู้เล่นวาดเอง — เก็บลงเครื่องเป็น JSON แล้วอ่านกลับมาอย่างระวัง
 *
 * ของที่อ่านจาก localStorage เชื่อไม่ได้เสมอ (แก้มือได้ รุ่นเก่ากว่า หรือพังครึ่งทาง)
 * จึงตรวจทุกช่องก่อนใช้ สนามที่เสียถูกข้ามไปเฉย ๆ ไม่ทำให้ทั้งหน้าพัง
 */
import { PAINTS, VIEW, checkCourse, type Course, type Paint, type Point } from './engine'

export const STORAGE_KEY = 'line:courses'

/** วาดได้มากสุดกี่จุดต่อสนาม — กันไฟล์ใหญ่เกินและกันหน้าวาดช้า */
export const MAX_POINTS = 60

/** ชื่อสนามยาวได้ไม่เกินเท่านี้ */
export const MAX_NAME = 40

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' &&
  value !== null &&
  Number.isFinite((value as Point).x) &&
  Number.isFinite((value as Point).y) &&
  (value as Point).x >= 0 &&
  (value as Point).x <= VIEW.width &&
  (value as Point).y >= 0 &&
  (value as Point).y <= VIEW.height

const isPaint = (value: unknown): value is Paint => PAINTS.includes(value as Paint)

/** สร้างสนามจากสิ่งที่วาด — ใส่ป้ายว่าวาดเองให้ครบทุกช่อง */
export function customCourse(input: {
  id: string
  name: string
  points: Point[]
  paint: Paint[]
  smooth: boolean
}): Course {
  const name = input.name.trim().slice(0, MAX_NAME) || 'สนามของฉัน'

  return {
    id: input.id,
    name,
    note: 'สนามที่วาดเอง — กด "แก้สนามนี้" เพื่อขยับจุดหรือเปลี่ยนสีเส้น',
    smooth: input.smooth,
    points: input.points.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) })),
    paint: input.points.map((_, index) => input.paint[index] ?? 'black'),
    custom: true
  }
}

/** รหัสของสนามใหม่ — ขึ้นต้นด้วย custom- เสมอ จะได้ไม่ชนกับสนามที่มากับเกม */
export const newCourseId = (): string => `custom-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

/** อ่านรายการสนามจากสิ่งที่เก็บไว้ — ข้ามตัวที่เสียหรือเล่นไม่ได้ */
export function parseCourses(raw: unknown): Course[] {
  const list = (raw as { courses?: unknown })?.courses
  if (!Array.isArray(list)) return []

  const out: Course[] = []
  const seen = new Set<string>()

  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue

    const { id, name, points, paint, smooth } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id.startsWith('custom-') || seen.has(id)) continue
    if (typeof name !== 'string' || typeof smooth !== 'boolean') continue
    if (!Array.isArray(points) || points.length > MAX_POINTS || !points.every(isPoint)) continue
    if (!Array.isArray(paint)) continue
    // โซนแดงถูกถอดออกจากเกมแล้ว — สนามที่วาดไว้ก่อนหน้านั้นยังเปิดได้ ท่อนแดงกลายเป็นเส้นดำ
    const repainted = paint.map((item) => (item === 'red' ? 'black' : item))
    if (!repainted.every(isPaint)) continue

    const course = customCourse({ id, name, points, paint: repainted, smooth })
    if (checkCourse(course) !== null) continue

    seen.add(id)
    out.push(course)
  }

  return out
}

/** เขียนรายการสนามเป็น JSON — เก็บแค่ของที่วาด ไม่เก็บคำอธิบายที่สร้างใหม่ได้ */
export function serializeCourses(courses: Course[]): string {
  return JSON.stringify({
    version: 1,
    courses: courses.map(({ id, name, points, paint, smooth }) => ({ id, name, points, paint, smooth }))
  })
}
