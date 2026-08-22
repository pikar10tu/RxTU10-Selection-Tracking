// ════════════════════════════════════════════════════════════
//  ออเดอร์ฟาร์ม (Farm Orders) — บอร์ด 5 ช่อง เติมใบใหม่เองตามเวลา
// ════════════════════════════════════════════════════════════
//  ส่งพืชตามที่ขอ → ได้เหรียญมากกว่าเอาไปขายเอง · ปฏิเสธใบที่ไม่ถูกใจได้
//  แต่ช่องจะรอนานกว่า · ไม่มีการรีเซ็ตรายวัน ใบที่ยังไม่ส่งค้างอยู่ได้เรื่อยๆ
//  ตัวเลขทั้งหมดจูนได้ที่นี่ ไม่ต้องแตะตรรกะ
// ════════════════════════════════════════════════════════════
import { getCrop } from './crops.js'

export const ORDER_SLOTS = 5
export const REFILL_MS = 30 * 60 * 1000        // รอหลังส่งสำเร็จ
export const REROLL_MS = 2 * 60 * 60 * 1000    // รอหลังปฏิเสธ (แพงกว่า กันรีโรลรัวจนได้ใบคุ้มสุดเสมอ)

// ── รางวัล: คิดเป็นจำนวนเต็มเปอร์เซ็นต์แล้วหาร 100 ครั้งเดียวตอนท้าย
//    (1.5 + 0.1*2 ในจาวาสคริปต์ = 1.7000000000000002 → ปัดเศษเพี้ยน) ──
export const REWARD_PCT = 150    // % ของราคาขายรวม
export const VARIETY_PCT = 10    // +% ต่อชนิดที่เกินชนิดแรก
export const MAX_KINDS = 3
export const KIND_WEIGHTS = [45, 35, 20]   // น้ำหนักสุ่มจำนวนชนิด 1 / 2 / 3

/** รางวัลของออเดอร์ — โครงเป็น object เผื่อเติมของอย่างอื่นทีหลังโดยไม่ต้องแก้ทั้งเส้นทาง */
export function orderReward(items) {
  const entries = Object.entries(items || {}).filter(([, q]) => Number(q) > 0)
  if (!entries.length) return { coins: 0 }
  let base = 0
  let validKinds = 0
  for (const [id, qty] of entries) {
    const c = getCrop(id)
    if (c) {
      base += c.sellPrice * Number(qty)
      validKinds++
    }
  }
  if (validKinds === 0) return { coins: 0 }
  const pct = REWARD_PCT + VARIETY_PCT * (validKinds - 1)
  return { coins: Math.round(base * pct / 100) }
}

/** ผลผลิตในกล่องพอส่งออเดอร์นี้ไหม */
export function canDeliver(order, inventory) {
  const items = order?.items
  if (!items || !Object.keys(items).length) return false
  const inv = inventory || {}
  for (const [id, qty] of Object.entries(items)) {
    if ((Number(inv[id]) || 0) < Number(qty)) return false
  }
  return true
}

/** ชนิดที่ยังขาด + ขาดกี่ชิ้น (ใช้ระบายสีชิปในบอร์ด) */
export function missingItems(order, inventory) {
  const out = {}
  const inv = inventory || {}
  for (const [id, qty] of Object.entries(order?.items || {})) {
    const short = Number(qty) - (Number(inv[id]) || 0)
    if (short > 0) out[id] = short
  }
  return out
}
