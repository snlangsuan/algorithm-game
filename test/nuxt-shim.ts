/**
 * Nuxt เติม ref/reactive/computed ให้เองตอนรันในแอป แต่ตอน bundle เทสต์ไม่มีใครเติมให้
 * จึงต้อง inject ชุดนี้เข้าไปแทน (ดู --inject ใน run.mjs)
 */
export { computed, reactive, readonly, ref, watch, watchEffect, shallowRef, toRaw, nextTick } from 'vue'

/** ของ Nuxt ที่โค้ดในโปรเจกต์ใช้ — เทสต์รันนอกเบราว์เซอร์ จึงถือว่าไม่ใช่ฝั่ง client */
export const useState = undefined as never
