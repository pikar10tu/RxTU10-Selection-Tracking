// idle income — pure: คิดเหรียญสะสม โดยบัฟ ×mult เฉพาะ "ช่วงที่บัฟ active จริง"
// (เดิม useDaily คูณบัฟทั้งก้อนตามสถานะ ณ ตอนกดเก็บ → เก็บจังหวะดีได้ ×1.5 ทั้ง 24ชม.
//  แม้บัฟเพิ่งเปิดชั่วโมงเดียว และกลับกัน. ฟังก์ชันนี้คิดตามเวลาที่บัฟครอบจริง)
export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param baseRatePerDay เรท/วัน ก่อนบัฟ (บ้าน+เพ็ท+หอคอย × โบนัส tag แล้ว)
 * @param lastMs ms เก็บรายได้ครั้งล่าสุด · now ms ปัจจุบัน
 * @param buffFrom/buffUntil ช่วงบัฟ active จริง [from, until] (รองรับสแตคต่อเวลา = until ยาวเกิน 24ชม.)
 * @returns เหรียญสะสม (floor) — หน้าต่างสะสม cap 24ชม.
 */
export function accruedCoins({ baseRatePerDay, lastMs, now, buffFrom = 0, buffUntil = 0, buffMult = 1.5 }) {
  if (!(baseRatePerDay > 0) || !(now > lastMs)) return 0
  const winStart = Math.max(lastMs, now - DAY_MS)   // cap สะสม 24ชม.
  const totalMs = now - winStart
  let buffedMs = 0
  if (buffUntil > buffFrom && buffMult !== 1) {
    // ส่วนที่หน้าต่างสะสม [winStart, now] ทับช่วงบัฟ [buffFrom, buffUntil]
    buffedMs = Math.max(0, Math.min(now, buffUntil) - Math.max(winStart, buffFrom))
  }
  const weightedMs = (totalMs - buffedMs) + buffMult * buffedMs
  return Math.floor(baseRatePerDay * weightedMs / DAY_MS)
}

/**
 * เวลา "เก็บรายได้ล่าสุด" ที่เชื่อถือได้ = ค่าที่ใหม่กว่าระหว่าง doc กับที่จำไว้ในเครื่อง
 *
 * ทำไมต้องมี: onSnapshot ของ Firestore ยิง snapshot ท้องถิ่นทันทีที่เขียน (latency
 * compensation) โดย serverTimestamp() ที่เซิร์ฟเวอร์ยังไม่ยืนยันจะมาเป็น null → ถ้า
 * snapshot นั้นทับ state ลง lastDaily จะหาย = บาร์รายได้เต็มใหม่ทันที กดเก็บซ้ำได้รัวๆ
 * (บั๊กจริง 28 ส.ค.) · ตัวหลักแก้ที่ auth.js (อ่าน snapshot แบบ serverTimestamps:'estimate')
 * ฟังก์ชันนี้เป็นแนวกันที่สอง: เวลาเก็บล่าสุด "เดินหน้าอย่างเดียว" ไม่ย้อนกลับ
 *
 * @param docMs เวลาจาก user doc (ms) — null/ไม่ใช่ตัวเลข = ไม่มี
 * @param localClaimMs เวลาที่กดเก็บสำเร็จในเซสชันนี้ (ms) — 0/null = ยังไม่เคยกด
 * @returns ms ล่าสุด · null ถ้าไม่มีทั้งคู่ (= ยังไม่เคยเก็บ → ผู้เล่นใหม่เริ่มบาร์เต็ม)
 */
export function effectiveLastMs(docMs, localClaimMs) {
  const a = Number.isFinite(docMs) && docMs > 0 ? docMs : null
  const b = Number.isFinite(localClaimMs) && localClaimMs > 0 ? localClaimMs : null
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}
