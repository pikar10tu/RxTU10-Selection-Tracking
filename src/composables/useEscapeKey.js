import { watch, onUnmounted } from 'vue'

/**
 * ปิด overlay/modal/sheet ด้วยปุ่ม Escape
 *
 * ทำไมต้องผูกที่ `window`: `@keydown.esc` บน element ทำงานเฉพาะตอน element นั้น
 * (หรือลูก) มีโฟกัส — overlay ส่วนใหญ่เปิดมาแล้วโฟกัสยังค้างที่ปุ่มเดิมหลังฉาก
 * กด Escape จึงไม่เกิดอะไรขึ้น (ออดิต 13 ส.ค.: 16 จาก 17 ตัวปิดด้วย Escape ไม่ได้)
 *
 * ผูก listener เฉพาะตอนเปิดจริง แล้วถอดตอนปิด/unmount — ไม่ทิ้ง listener ค้าง
 *
 * @param {import('vue').Ref<boolean>|(() => boolean)} isOpen ตัวบอกว่าเปิดอยู่ไหม
 * @param {() => void} onClose สิ่งที่ทำเมื่อกด Escape
 *
 * @example
 * const props = defineProps({ open: Boolean })
 * const emit = defineEmits(['close'])
 * useEscapeKey(() => props.open, () => emit('close'))
 */
export function useEscapeKey(isOpen, onClose) {
  let bound = false

  function onKey(e) {
    if (e.key === 'Escape') onClose()
  }
  function bind() {
    if (bound) return
    window.addEventListener('keydown', onKey)
    bound = true
  }
  function unbind() {
    if (!bound) return
    window.removeEventListener('keydown', onKey)
    bound = false
  }

  watch(isOpen, (open) => (open ? bind() : unbind()), { immediate: true })
  onUnmounted(unbind)
}
