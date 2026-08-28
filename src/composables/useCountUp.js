import { ref, watch, onUnmounted } from 'vue'
import { prefersReducedMotion } from '../utils/motionPref.js'

/**
 * ตัวเลขที่ "วิ่งไล่" ค่าจริง
 *   • วิ่งเฉพาะตอนค่าเพิ่ม — ค่าลด (จ่ายเงินซื้อเมล็ด) เปลี่ยนทันที
 *     ไม่งั้นจะดูเหมือนเงินค่อยๆ ไหลออกซึ่งน่ากังวลโดยไม่จำเป็น
 *   • prefersReducedMotion() → เปลี่ยนทันทีทุกกรณี (ตอนนี้ bypass ทั้งเว็บ ดู utils/motionPref.js)
 */
export function useCountUp(source, { duration = 700 } = {}) {
  const shown = ref(Number(source.value) || 0)
  let raf = 0

  const instant = () => prefersReducedMotion()
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }

  watch(source, (to) => {
    const target = Number(to) || 0
    stop()
    if (instant() || target <= shown.value) { shown.value = target; return }
    const start = shown.value
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)          // ease-out cubic
      shown.value = Math.round(start + (target - start) * eased)
      raf = k < 1 ? requestAnimationFrame(tick) : 0
    }
    raf = requestAnimationFrame(tick)
  })

  onUnmounted(stop)
  return shown
}
