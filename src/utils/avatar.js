// ════════════════════════════════════════════════════════════
//  Local avatar — initials on a deterministic colour, as an inline
//  data-URI SVG. No network request → never shows a broken-image icon
//  (replaces the old ui-avatars.com fallback, which fails offline / on
//  flaky networks and rendered as "image not loaded").
// ════════════════════════════════════════════════════════════

const COLORS = [
  '#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899',
  '#14b8a6', '#a855f7', '#ef4444', '#0ea5e9', '#84cc16',
]

// Thai combining marks (vowels above/below + tone marks) — drop so an
// initial never starts with a floating mark.
const THAI_COMBINING = /[ัิ-ฺ็-๎]/

function initials(name) {
  const base = [...String(name || '').trim()].filter(
    (c) => /[฀-๿a-zA-Z0-9]/.test(c) && !THAI_COMBINING.test(c)
  )
  if (!base.length) return '?'
  // latin name reads better as 2 letters; Thai as a single character
  const isLatin = /[a-zA-Z]/.test(base[0])
  return base.slice(0, isLatin ? 2 : 1).join('').toUpperCase()
}

function colorFor(name) {
  const s = String(name || '?')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

/** Inline data-URI SVG avatar (initials on colour). */
export function letterAvatar(name, size = 96) {
  const text = initials(name)
  const bg = colorFor(name)
  const fs = (text.length > 1 ? 0.4 : 0.5) * size
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" ` +
    `font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="700" font-size="${fs}">${text}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * <img @error> handler: swap a failed real photo (dead Google/custom URL)
 * for the local letter avatar. Guards against an infinite error loop.
 */
export function fallbackAvatar(e, name, size = 96) {
  const fb = letterAvatar(name, size)
  const el = e?.target
  if (el && el.getAttribute('src') !== fb) el.src = fb
}

/**
 * รูปโปรไฟล์ที่ควรแสดง — **จุดเดียวที่ตัดสินลำดับ** ห้ามเขียน `a || b || c` ซ้ำที่อื่น
 *
 * customPhoto (ตัวเต็ม 256px · มีเฉพาะตอนอ่าน user doc เต็ม เช่น ProfileModal/MeView)
 *   → photoMini (ตัวจิ๋ว 48px · ตัวที่ขี่มากับแถว roster ⇒ จอที่อ่าน roster ใช้ตัวนี้)
 *   → googlePhoto → ตัวอักษรย่อ
 *
 * ⚠️ เดิมแต่ละจอเขียนลำดับเอง แล้วหน้าที่อ่าน roster ไปเช็ก `customPhoto` ซึ่งแถว
 *    roster ไม่เคยมี — เป็นโค้ดตายที่ทำให้บั๊ก "รูปที่อัปเองไม่ขึ้น" ซ่อนตัวได้นาน
 */
export function avatarUrl(u, name, size = 96) {
  return (
    u?.customPhoto || u?.photoMini || u?.googlePhoto ||
    letterAvatar(name ?? u?.nickname, size)
  )
}
