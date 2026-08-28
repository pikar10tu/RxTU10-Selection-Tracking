// farmfx.js — เอฟเฟกต์ "ยิงของจากจุด A ไปจุด B" ของหน้าฟาร์ม (JS ล้วน ไม่พึ่ง Vue)
// doctrine:
//   • ชั้นเอฟเฟกต์แปะที่ document.body เท่านั้น — #main-content เป็น position:fixed
//     = สร้าง stacking context ของที่อยู่ข้างในสู้ #bottom-nav ไม่ได้ (CLAUDE.md ข้อ 6)
//   • zIndex ของชั้นนี้ = 250 โดยตั้งใจ: ต้องสูงกว่า #bottom-nav (200, ข้อบังคับจริงตาม
//     CLAUDE.md ข้อ 6) แต่ต่ำกว่าโมดัล/ชีตทุกตัว (BottomSheet 400, .modal-ov 900) — ของที่ลอย
//     แปะ body ทีหลังใน DOM จึงเพนต์ทับได้ ถ้าตั้งสูงเกินจะแล่นผ่านหน้าโมดัลที่เปิดค้างอยู่
//     (เคสจริง: เก็บเกี่ยวแล้วรีบกดปลูกต่อ ของยังลอยไม่ทันจบ SeedPicker ก็เปิดทับแล้ว)
//     ⚠️ อย่าดันขึ้นโดยไม่คิด — ต่ำกว่าโมดัลคือความตั้งใจ ไม่ใช่ค่าที่ลืมปรับ
//   • ขับด้วย WAAPI เปลี่ยนแค่ transform/opacity (แนวคิดเดียวกับ battlefx.js แต่แยกไฟล์
//     ไม่ import และไม่แก้ของ battle — เคสกระตุก iOS ของนั้นเพิ่งปิด)
//   • ของที่ลอยเป็น element ชั่วคราวนอก Vue → Vue ไม่ต้อง re-render ระหว่างอนิเมชัน
//   • prefersReducedMotion() = ไม่สร้างอะไรเลย เรียก onArrive ทันที (ผลลัพธ์ต้องเหมือนกัน)
//     — ตอนนี้ bypass ทั้งเว็บแล้ว ทุกคนเห็นอนิเมชันเดียวกัน (ดู utils/motionPref.js)
import { fluentFile } from './emoji.js'
import { prefersReducedMotion } from './motionPref.js'

const BASE = import.meta.env.BASE_URL
const MAX_PIECES = 6          // กันสั่งลอยทีละเยอะจนมือถือเก่ากระตุก

let layer = null
const live = new Set()        // WAAPI ที่ยังวิ่งอยู่ (ไว้ cancel ตอนออกจากหน้า)

function prefersReduced() {
  return prefersReducedMotion()
}

function ensureLayer() {
  if (layer && layer.isConnected) return layer
  layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '250',
  })
  document.body.appendChild(layer)
  return layer
}

/** สร้างชิ้นที่จะลอย — ใช้รูป Fluent ถ้ามี ไม่งั้น fallback เป็นตัวอักษร */
function makePiece(emoji, size) {
  const file = fluentFile(emoji)
  let el
  if (file) {
    el = document.createElement('img')
    el.src = BASE + file
    el.style.width = `${size}px`
    el.style.height = `${size}px`
  } else {
    el = document.createElement('span')
    el.textContent = emoji
    el.style.fontSize = `${size}px`
    el.style.lineHeight = '1'
  }
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', willChange: 'transform, opacity' })
  return el
}

/**
 * ยิงของจาก from ไป to
 * @param emoji อีโมจิที่จะลอย · from/to = DOMRect · count จำนวนชิ้น (cap ที่ MAX_PIECES)
 * @param onArrive เรียกครั้งเดียวตอนชิ้นสุดท้ายถึงปลายทาง (ถูก cancel = ไม่เรียก)
 */
export function flyTo({ emoji, from, to, count = 1, size = 26, onArrive }) {
  if (!emoji || !from || !to || prefersReduced()) { onArrive?.(); return }
  const host = ensureLayer()
  const n = Math.max(1, Math.min(MAX_PIECES, Math.floor(count) || 1))
  const x0 = from.left + from.width / 2 - size / 2
  const y0 = from.top + from.height / 2 - size / 2
  const x1 = to.left + to.width / 2 - size / 2
  const y1 = to.top + to.height / 2 - size / 2
  let arrived = 0

  for (let i = 0; i < n; i++) {
    const el = makePiece(emoji, size)
    host.appendChild(el)
    const driftX = (Math.random() - 0.5) * 26
    const driftY = -18 - Math.random() * 22
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${x0 + driftX}px, ${y0 + driftY}px) scale(1.15)`, opacity: 1, offset: .28 },
      { transform: `translate(${x1}px, ${y1}px) scale(.55)`, opacity: .9 },
    ], { duration: 620, delay: i * 55, easing: 'cubic-bezier(.34,.85,.4,1)', fill: 'forwards' })
    live.add(anim)
    anim.finished
      .then(() => { if (++arrived === n) onArrive?.() })
      .catch(() => {})                       // ถูก cancel → ไม่เรียก onArrive
      .finally(() => { live.delete(anim); el.remove() })
  }
}

/** ยกเลิกทุกอย่างที่ค้าง + ถอดชั้นออกจาก DOM (เรียกตอนออกจากหน้าฟาร์ม) */
export function cancelFarmFx() {
  for (const a of live) a.cancel()
  live.clear()
  layer?.remove()
  layer = null
}
