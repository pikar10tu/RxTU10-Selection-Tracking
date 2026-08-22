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

// ── ตัวสุ่มแบบมี seed (mulberry32) — ไม่ใช่ crypto ใช้เพื่อให้เทสได้ว่า
//    seed เดิมต้องได้ออเดอร์เดิมเสมอ ──
function rng(seed) {
  let a = (Number(seed) || 0) >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// จำนวนชิ้นผูกกับเวลาโต ไม่ใช่สุ่มลอยๆ — กันออเดอร์อย่าง "ต้นไม้เงินตรา ×5" (กินเวลา 15 วัน)
export const QTY_BRACKETS = [
  { maxMinutes: 15,       min: 3, max: 8 },
  { maxMinutes: 180,      min: 2, max: 5 },
  { maxMinutes: 1440,     min: 1, max: 3 },
  { maxMinutes: Infinity, min: 1, max: 2 },
]

export function qtyBracket(crop) {
  const m = Number(crop?.growMinutes) || 0
  return QTY_BRACKETS.find(b => m <= b.maxMinutes) || QTY_BRACKETS[QTY_BRACKETS.length - 1]
}

/** สร้างออเดอร์ 1 ใบจาก seed · `crops` = พืชที่ปลดล็อกแล้วเท่านั้น · คืน null ถ้าไม่มีพืชให้เลือก */
export function buildOrder(seed, crops, now) {
  const list = (Array.isArray(crops) ? crops : []).filter(Boolean)
  if (!list.length) return null
  const rand = rng(seed)

  // จำนวนชนิด: สุ่มตามน้ำหนัก แล้ว clamp ด้วยจำนวนพืชที่มีจริง
  let roll = rand() * KIND_WEIGHTS.reduce((s, w) => s + w, 0)
  let kinds = 1
  for (let i = 0; i < KIND_WEIGHTS.length; i++) {
    if (roll < KIND_WEIGHTS[i]) { kinds = i + 1; break }
    roll -= KIND_WEIGHTS[i]
  }
  kinds = Math.min(kinds, MAX_KINDS, list.length)

  // เลือกพืชไม่ซ้ำ (หยิบออกจากกองทีละตัว)
  const pool = list.slice()
  const items = {}
  for (let i = 0; i < kinds; i++) {
    const crop = pool.splice(Math.floor(rand() * pool.length), 1)[0]
    const b = qtyBracket(crop)
    items[crop.id] = b.min + Math.floor(rand() * (b.max - b.min + 1))
  }

  return { id: `o${now}x${((Number(seed) || 0) >>> 0).toString(36)}`, items, reward: orderReward(items) }
}

/** ทำให้ array ช่องถูกรูปเสมอ — ช่องที่หายไป/เพี้ยนกลายเป็นช่องพร้อมใช้ทันที (คนเก่าได้บอร์ดเต็มเลย) */
export function normalizeOrders(raw, now) {
  const src = Array.isArray(raw) ? raw : []
  const ready = Number(now) || 0
  const out = []
  for (let i = 0; i < ORDER_SLOTS; i++) {
    const s = src[i]
    if (s && typeof s === 'object' && s.items && typeof s.items === 'object' && Object.keys(s.items).length) {
      out.push({ id: String(s.id || `o${i}`), items: { ...s.items }, reward: { coins: Number(s.reward?.coins) || 0 } })
    } else if (s && typeof s === 'object' && Number.isFinite(Number(s.at))) {
      out.push({ at: Number(s.at) })
    } else {
      out.push({ at: ready })
    }
  }
  return out
}

/** index ของช่องที่ว่างและถึงเวลาเติมใบใหม่แล้ว */
export function dueSlots(orders, now) {
  const list = Array.isArray(orders) ? orders : []
  const t = Number(now) || 0
  const out = []
  for (let i = 0; i < list.length; i++) {
    const s = list[i]
    if (s && !s.items && Number(s.at) <= t) out.push(i)
  }
  return out
}
