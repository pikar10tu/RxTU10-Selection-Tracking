// src/utils/pvpBoard.js
// PvP กระดาน — pure: seed ของกระดาน + กติกา cooldown ปุ่มรีเฟรช
// กระดานเปลี่ยนเมื่อ: บุกจบ 1 ครั้ง (nonce++) · กดปุ่มรี (nonce++) · ข้ามวัน
// ⚠️ โหลดหน้าใหม่ต้อง "ไม่" เปลี่ยน — ไม่งั้นกด F5 รัวๆ = รีฟรีไม่จำกัด cooldown ไร้ความหมาย
//    (จึงต้องเก็บ nonce ใน user doc ไม่ใช่ใน state ของ component)
import { hashStr } from './seededRng.js'

export const PVP_REFRESH_COOLDOWN_MS = 60 * 60 * 1000   // 1 ชม.

/** seed ของกระดาน ณ วันนี้ของผู้เล่นคนนี้ ที่ nonce นี้ */
export function boardSeed(dayStr, uid, nonce) {
  return hashStr(`${dayStr}|${uid || ''}|${nonce || 0}`)
}

/** เหลืออีกกี่ ms ถึงกดรีได้ (0 = กดได้เลย) */
export function refreshLeftMs(lastAt, now, cooldown = PVP_REFRESH_COOLDOWN_MS) {
  // ยังไม่เคยกดเลย = กดได้ทันที · เขียนเป็นเงื่อนไขตรงๆ ไม่พึ่งว่า now เป็นเลขใหญ่พอ
  if (!lastAt) return 0
  // clamp ที่ 0 กันนาฬิกาเครื่องเดินถอยหลังแล้วล็อกปุ่มยาวเกิน cooldown
  const passed = Math.max(0, now - lastAt)
  return passed >= cooldown ? 0 : cooldown - passed
}

export const canRefresh = (lastAt, now, cooldown = PVP_REFRESH_COOLDOWN_MS) =>
  refreshLeftMs(lastAt, now, cooldown) === 0
