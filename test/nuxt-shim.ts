export { computed, reactive, readonly, ref, watch, watchEffect, shallowRef, toRaw, nextTick } from 'vue'

/** auto-import ของ Nuxt — เทสต์ bundle เอง จึงต้องต่อสายให้เอง */
export { useBlockProgram } from '~/composables/useBlockProgram'

/**
 * วงจรชีวิตของคอมโพเนนต์ — เทสต์เรียก composable ตรง ๆ ไม่ได้อยู่ในคอมโพเนนต์
 * ของจริงใช้ผูก/ถอด event ของหน้าต่าง ซึ่งไม่มีใน node อยู่แล้ว จึงปล่อยว่างไว้
 */
export const onMounted = (_fn: () => void): void => {}
export const onBeforeUnmount = (_fn: () => void): void => {}
export const onScopeDispose = (_fn: () => void): void => {}

export const useState = undefined as never
