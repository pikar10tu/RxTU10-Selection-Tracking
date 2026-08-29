// ════════════════════════════════════════════════════════════
//  รูปโปรไฟล์ที่ผู้ใช้อัปเอง — ย่อ 2 ขนาด
// ════════════════════════════════════════════════════════════
//  `customPhoto` (256px) = ตัวเต็ม เก็บใน user doc อ่านตอนเปิดโปรไฟล์รายคน
//  `photoMini`   (48px)  = ตัวจิ๋ว เก็บ "ซ้ำ" ลงแถว roster (ฟิลด์ pm) ด้วย
//
//  ⚠️ ทำไมต้องมีตัวจิ๋ว: `roster/current` เป็น doc เดียวที่ทั้งรุ่นโหลด 1 read
//     ทุกเซสชัน · ตัวเต็ม 256px ≈ 10–25 KB/คน × 83 คน = ชนเพดาน 1 MiB ของ
//     Firestore · ตัวจิ๋วคุมไว้ ≤ MINI_MAX_CHARS ⇒ เต็มรุ่นก็ ~100 KB
//     (ดูคอมเมนต์ที่ utils/roster.js ฟิลด์ p/pm)
// ════════════════════════════════════════════════════════════

export const MINI_SIZE = 48
/** เพดานความยาว data URL ของตัวจิ๋ว — 83 คน × 3000 ≈ 250 KB ยังห่างเพดาน doc มาก */
export const MINI_MAX_CHARS = 3000
/** ไล่ลดคุณภาพจนกว่าจะลอดเพดาน — รูปที่มี noise สูงจะกินที่มากกว่าปกติ */
export const MINI_QUALITIES = [0.6, 0.45, 0.3]

/**
 * data URL → data URL ตัวจิ๋วที่ยาวไม่เกิน MINI_MAX_CHARS · null ถ้าย่อยังไงก็ไม่ลอด
 *
 * `encode(src, size, quality) → Promise<string|null>` แยกออกมาเป็นพารามิเตอร์
 * เพื่อให้ตรรกะไล่คุณภาพเทสได้โดยไม่ต้องมี canvas (ดู photo.test.js)
 */
export async function makePhotoMini(src, encode = encodeViaCanvas) {
  if (!src) return null
  for (const q of MINI_QUALITIES) {
    const out = await encode(src, MINI_SIZE, q)
    if (out && out.length <= MINI_MAX_CHARS) return out
  }
  return null
}

/** ย่อรูปด้วย canvas (เบราว์เซอร์เท่านั้น) — คืน data URL JPEG · null ถ้าโหลดรูปไม่ได้ */
export function encodeViaCanvas(src, max, quality) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onerror = () => resolve(null)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.src = src
  })
}
