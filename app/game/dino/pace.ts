/**
 * ความเร็วภาพของเกมวิ่งหลบ
 *
 * อยู่นอกโฟลเดอร์ composables โดยตั้งใจ — Nuxt auto-import ทุก export ในนั้น
 * ชื่อกลาง ๆ อย่าง SPEEDS/SpeedOption จึงชนกันเองระหว่างเกม แล้วขึ้นเตือนตอน dev ทุกครั้ง
 */
export interface SpeedOption {
  value: number
  label: string
  /**
   * เวลาจริงเดินเร็วกว่าหรือช้ากว่าเวลาในเกมกี่เท่า
   * ฟิสิกส์ยังเดินก้าวละ 1/60 วินาทีเท่าเดิม ผลของรอบจึงเหมือนเดิมเป๊ะไม่ว่าจะตั้งช้าหรือเร็ว
   */
  scale: number
}

export const SPEEDS: SpeedOption[] = [
  { value: 0, label: 'ช้า', scale: 0.6 },
  { value: 1, label: 'ปกติ', scale: 1 },
  { value: 2, label: 'เร็ว', scale: 1.35 }
]
