// ── โหมดลดการเคลื่อนไหว: bypass ทั้งเว็บ (28 ส.ค. 2026 — user สั่ง) ────────────
//
// เดิมแอปเคารพ prefers-reduced-motion ของ OS: JS ตัด FX/จังหวะ + CSS `@media
// (prefers-reduced-motion: reduce)` ตัด animation/transition ทิ้ง ผลคือคนที่เปิด
// โหมดนี้ไว้ (มักไม่รู้ตัวว่าเปิด — iOS/Android เปิดตอนโหมดประหยัดแบตหรือตั้งไว้นานแล้ว)
// เห็นเกมคนละหน้ากับเพื่อน: ไฟต์ไม่มีท่าชน กระดานข่าวไม่สลับ กาชาไม่มีจังหวะลุ้น
// แล้วรายงานเข้ามาว่า "อนิเมชันเสีย" ทั้งที่ระบบตั้งใจตัดให้
//
// ตอนนี้ทุกคนเห็นอนิเมชันชุดเดียวกัน:
//   • ฝั่ง JS อ่านผ่าน prefersReducedMotion() ตัวนี้ตัวเดียว (คืน false ตราบใดที่ธงปิด)
//   • ฝั่ง CSS ลบบล็อก @media ออกหมดแล้วในคอมมิตเดียวกันนี้ (ถ้าจะคืนค่า ดู git show ของคอมมิต
//     "Motion: bypass โหมดลดการเคลื่อนไหวทั้งเว็บ")
//
// ⚠️ ถ้าจะกลับไปเคารพ OS อีกครั้ง: ตั้ง RESPECT_REDUCED_MOTION = true แล้วเอาบล็อก CSS กลับ
export const RESPECT_REDUCED_MOTION = false

/** true = เครื่องขอให้ลดการเคลื่อนไหว · ตอนนี้คืน false เสมอเพราะธงด้านบนปิดอยู่ */
export function prefersReducedMotion() {
  if (!RESPECT_REDUCED_MOTION) return false
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches === true
}
