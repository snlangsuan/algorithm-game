/**
 * สีประจำตัวของเกมไล่จับ — ใช้ร่วมกันทั้งสนาม แผ่นสรุปตอนจบ และภาพย่อในหน้าเลือกเกม
 * แยกออกจาก engine.ts เพราะเอนจินไม่ควรรู้จักหน้าจอ
 */

/** ผู้ไล่ล่าแต่ละตัวมีสีของตัวเอง จะได้อ้างถึงได้ว่า "ตัวแดงจับได้" */
export const HUNTER_COLORS = ['#ef4444', '#0ea5e9', '#f97316', '#22c55e']

export const hunterColor = (index: number): string =>
  HUNTER_COLORS[index % HUNTER_COLORS.length] ?? HUNTER_COLORS[0]!

export const HERO_COLOR = '#1c1524'

export const WALL_COLOR = '#332450'

export const GEM_COLOR = '#f59e0b'

export const EXIT_OPEN_COLOR = '#10b981'

export const EXIT_SHUT_COLOR = '#e5e1f3'

/** ช่องที่ AI แต่ละฝ่ายเปิดดูตอนคิด — คนละสีกันจะได้รู้ว่าใครกำลังคิดถึงตรงไหน */
export const LOOK_HUNTER = '#ede9fe'

export const LOOK_RUNNER = '#d1fae5'
