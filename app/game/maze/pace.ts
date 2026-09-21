/**
 * จังหวะการเล่นย้อนภาพของเขาวงกต
 *
 * อยู่นอกโฟลเดอร์ composables โดยตั้งใจ — Nuxt auto-import ทุก export ในนั้น
 * ชื่อกลาง ๆ อย่าง SPEEDS/SpeedOption จึงชนกันเองระหว่างเกม แล้วขึ้นเตือนตอน dev ทุกครั้ง
 */
export interface SpeedOption {
  value: number
  label: string

  /** เล่นย้อนการค้นทั้งชุดให้จบในกี่มิลลิวินาที */
  replayMs: number

  /** หน่วงระหว่างก้าวตอนหุ่นเดินจริง (ms) */
  stepDelay: number
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ทันที', replayMs: 0, stepDelay: 0 },
  { value: 1, label: 'เร็ว', replayMs: 1600, stepDelay: 8 },
  { value: 2, label: 'ปกติ', replayMs: 5000, stepDelay: 32 },
  { value: 3, label: 'ช้า', replayMs: 14000, stepDelay: 90 }
]
