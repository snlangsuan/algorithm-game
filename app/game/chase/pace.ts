/**
 * จังหวะของเกมไล่จับ
 *
 * อยู่นอกโฟลเดอร์ composables โดยตั้งใจ — Nuxt auto-import ทุก export ในนั้น
 * ชื่อกลาง ๆ อย่าง SPEEDS/SpeedOption จึงชนกันเองระหว่างเกม แล้วขึ้นเตือนตอน dev ทุกครั้ง
 */
export interface SpeedOption {
  value: number
  label: string
  /** หนึ่งจังหวะกินเวลากี่มิลลิวินาที — คนหนีเดินได้หนึ่งช่องต่อหนึ่งจังหวะ */
  tickMs: number
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ช้า', tickMs: 300 },
  { value: 1, label: 'ปกติ', tickMs: 195 },
  { value: 2, label: 'เร็ว', tickMs: 130 }
]
