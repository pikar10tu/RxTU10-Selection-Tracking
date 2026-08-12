// ════════════════════════════════════════════════════════════
//  แยก "ผู้ใช้กดปิด popup เอง" ออกจาก "popup ล็อกอินพังจนปิดตัวเอง"
// ════════════════════════════════════════════════════════════
//  Firebase คืน code เดียวกัน (auth/popup-closed-by-user) ทั้งสองกรณี จึงแยก
//  ด้วยเวลา: คนจริงต้องรอหน้า Google โหลด + เลือกบัญชีก่อน เร็วกว่าเกณฑ์นี้ปิดไม่ทัน
//
//  ⚠️ เคสจริงที่ทำให้ต้องมีไฟล์นี้ (13 ส.ค. 2026): API key ใน Google Cloud ถูกจำกัด
//  referrer ไว้แค่โฮสต์ของแอป ไม่ได้ใส่ authDomain → หน้า /__/auth/handler เช็ค
//  โดเมนไม่ผ่าน ขึ้น "The requested action is invalid." → popup ตายทันที → แอปกลืน
//  error เงียบสนิท ล็อกอินพังทั้งเว็บโดยไม่มีสัญญาณอะไรเลย (ดู CLAUDE.md กับดักข้อ 1)

export const POPUP_ABORT_MS = 1500

/** code ที่แปลว่า popup ปิดลงโดยไม่ได้ล็อกอินสำเร็จ (ไม่ว่าด้วยเหตุใด) */
export function isPopupClosedCode(code) {
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

/**
 * true  = ควรเตือนผู้ใช้ — popup ตายเองเร็วผิดปกติ (ระบบล็อกอินมีปัญหา)
 * false = เงียบไว้ — ผู้ใช้กดปิดเอง หรือแยกไม่ออก (กันเตือนหลอก)
 */
export function shouldWarnPopupClosed(code, elapsedMs) {
  if (!isPopupClosedCode(code)) return false
  if (!Number.isFinite(elapsedMs)) return false
  return elapsedMs < POPUP_ABORT_MS
}
