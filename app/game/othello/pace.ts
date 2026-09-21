/**
 * จังหวะการลงหมากของ Othello — ค่าคือเวลาหน่วงต่อหนึ่งตา (ms)
 *
 * อยู่นอกโฟลเดอร์ composables โดยตั้งใจ — Nuxt auto-import ทุก export ในนั้น
 * ชื่อกลาง ๆ อย่าง SPEEDS/SpeedOption จึงชนกันเองระหว่างเกม แล้วขึ้นเตือนตอน dev ทุกครั้ง
 */
export interface SpeedOption {
  value: number
  label: string
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ทันที' },
  { value: 200, label: 'เร็ว' },
  { value: 500, label: 'ปกติ' },
  { value: 1000, label: 'ช้า' }
]
