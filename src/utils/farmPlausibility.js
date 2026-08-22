// ════════════════════════════════════════════════════════════
//  farmPlausibility — เพดาน "เป็นไปได้ไหม" ของผลผลิตในฟาร์ม
// ════════════════════════════════════════════════════════════
//  ใช้คู่กับ cheatLogs (useGuard) — แอพนี้ client-only ป้องกันจริงไม่ได้
//  ที่ทำได้คือ "บันทึกค่าที่เป็นไปไม่ได้" ไว้ให้แอดมินดู
//
//  ⚠️ กติกาสำคัญ: บันทึกอย่างเดียว ห้ามขวางผู้เล่น — ถ้าเกณฑ์เพี้ยน
//     คนที่โดนคือนักศึกษาที่เล่นปกติ และแก้เองไม่ได้
//  ⚠️ เพดานหลวมโดยตั้งใจ: ไม่หักช่วงที่พืชยังไม่ปลดล็อก ไม่หักช่วงที่ไม่ได้เข้าเกม
//     แถมคูณ PLAUSIBILITY_SLACK เผื่ออีกชั้น → รายงานเฉพาะเคสที่อธิบายไม่ได้จริงๆ
//  ⚠️ ห้ามใช้เกณฑ์ที่อิงเหรียญ — AdminView แก้เหรียญรายคนได้ และของขวัญต้อนรับ
//     แจก 15,000 เหรียญ · ส่วนพืชไม่มีทางได้มาโดยไม่ปลูก
//  หมายเหตุ: ถ้าวันหนึ่งไป "เพิ่ม" growMinutes ของพืช เพดานจะแคบลงย้อนหลัง
//     ให้เผื่อใจว่าจะมีบันทึกโผล่มาสักพัก
// ════════════════════════════════════════════════════════════
import { growMs } from '../data/crops.js'

export const PLAUSIBILITY_SLACK = 2

/** createdAt จาก Firestore มาได้หลายรูป (Timestamp / number / Date / null) → ms หรือ null */
export function createdAtMs(createdAt) {
  if (createdAt == null) return null
  if (typeof createdAt === 'number') return Number.isFinite(createdAt) ? createdAt : null
  if (createdAt instanceof Date) { const t = createdAt.getTime(); return Number.isFinite(t) ? t : null }
  if (typeof createdAt.toMillis === 'function') {
    try { const t = createdAt.toMillis(); return Number.isFinite(t) ? t : null } catch { return null }
  }
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000
  return null
}

/** เพดานจำนวนที่เก็บเกี่ยวได้ตลอดอายุบัญชี · Infinity = ข้อมูลไม่พอ ห้ามรายงาน */
export function maxPossibleHarvest(cropId, { createdMs, plotsUnlocked, now } = {}) {
  const g = growMs(cropId)
  if (!g) return Infinity
  if (!Number.isFinite(createdMs) || !Number.isFinite(now) || now <= createdMs) return Infinity
  const plots = Math.max(1, Math.floor(Number(plotsUnlocked)) || 1)
  return Math.floor((now - createdMs) / g) * plots
}

function overCeiling(map, ctx, key) {
  const out = []
  for (const [cropId, raw] of Object.entries(map || {})) {
    const n = Number(raw) || 0
    if (n <= 0) continue
    const max = maxPossibleHarvest(cropId, ctx)
    if (Number.isFinite(max) && n > max * PLAUSIBILITY_SLACK) out.push({ cropId, [key]: n, max })
  }
  return out
}

/** ของในกล่องที่มากเกินกว่าจะเป็นไปได้ */
export function implausibleStock(inventory, ctx) { return overCeiling(inventory, ctx, 'have') }

/** ของที่กำลังส่งออเดอร์ซึ่งมากเกินกว่าจะเป็นไปได้ */
export function implausibleDelivery(items, ctx) { return overCeiling(items, ctx, 'need') }
