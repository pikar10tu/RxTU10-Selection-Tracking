// src/utils/pvpCoins.js
// PvP เศรษฐกิจ — pure: วัดพลังทีมจริงแล้วจ่ายเหรียญตามส่วนต่าง (ไม่ใช่ตามเรต)
// เหตุที่ไม่ใช้เรต: เรตในระบบนี้ได้มาจาก "ขยันบุก" ไม่ใช่ "ทีมแกร่ง"
// ⇒ คนเรตสูงทีมกากจะกลายเป็นเป้าทำเงินชั้นดีที่คนไล่ล่าด้วยปุ่มรีเฟรช
import { combatStats } from '../data/petPower.js'

export const PVP_COIN_BASE    = 150    // เหรียญเมื่อชนะคู่ที่พลังพอกัน
export const PVP_COIN_EXP     = 0.9    // ความชันของรางวัลตามส่วนต่างพลัง
export const PVP_COIN_MIN     = 0.25   // ตัวคูณต่ำสุด (ตีคนอ่อนกว่ามาก)
export const PVP_COIN_MAX     = 2.5    // ตัวคูณสูงสุด (ท้าคนแกร่งกว่ามาก)
export const PVP_CONSOLE_MULT = 0.25   // แพ้ให้คนแกร่งกว่า ได้ปลอบใจกี่ส่วนของค่าชนะ

/** พลังทีม = Σ (atk × maxHp) — ตัวแทนความแกร่งจริง คิดจากเพ็ทไม่ใช่เรต */
export function teamPower(team) {
  return (team || []).reduce((sum, pet) => {
    const c = combatStats(pet)
    return sum + c.atk * c.maxHp
  }, 0)
}

const round10 = (n) => Math.round(n / 10) * 10

/**
 * เหรียญจากผลไฟต์ 1 ครั้ง
 * ชนะ = ฐาน × (พลังเขา/พลังเรา)^0.9 คุมไว้ 0.25–2.5 เท่า
 * แพ้ให้คนแกร่งกว่า = 25% ของค่าชนะ · แพ้ให้คนอ่อนกว่า/พอกัน = 0
 *
 * ⚠️ เหรียญปลอบใจมีไว้ชดเชยที่ battleEngine วันนี้แทบไม่มีพลิก (100% หรือ 0%)
 *    ถ้าไม่มี ท้าคนแกร่งกว่า = ได้ 0 แน่นอน ไม่มีใครท้า ระบบความกล้าตายตั้งแต่วันแรก
 *    🔮 เมื่อระบบ passive (P3) มาแล้วเกิดพลิกได้จริง ให้กลับมาลด/ถอด PVP_CONSOLE_MULT ก่อนอย่างอื่น
 */
export function coinForResult(myPower, oppPower, won) {
  const ratio = oppPower / Math.max(1, myPower)
  const mult = Math.min(PVP_COIN_MAX, Math.max(PVP_COIN_MIN, Math.pow(ratio, PVP_COIN_EXP)))
  const win = round10(PVP_COIN_BASE * mult)
  if (won) return win
  return ratio > 1 ? round10(win * PVP_CONSOLE_MULT) : 0
}
