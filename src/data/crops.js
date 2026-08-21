// ════════════════════════════════════════════════════════════
//  พืชผล (Crops) — farming data
// ════════════════════════════════════════════════════════════
//  plant seed (costs seedCost) → grow (growMinutes, real-time) → harvest →
//  sell for sellPrice. No water/fertilizer — just plant & wait.
//
//  Two axes:
//   • unlockLevel → gates availability by residence.level (one step at a time —
//                   nearly every house upgrade unlocks a fresh crop).
//   • time        → spread per profit-grade: quick(min) / short(hr) /
//                   half-day / multi-day.
//  `tier` is kept as a profit-grade / colour flavour only (NOT the gate).
//  Design: short crops = higher profit/hr but small total (active replanting);
//          long crops  = lower profit/hr but big total (set-and-forget);
//          higher tier = better profit at every time bracket.
//  All numbers are tunable.
// ════════════════════════════════════════════════════════════

export const CROPS = [
  // ── Lv1–2: ธรรมดา (common) ──
  { id: 'lettuce',  name: 'ผักกาด',     emoji: '🥬', tier: 'common',    unlockLevel: 1,  seedCost: 20,    growMinutes: 5,    sellPrice: 45 },
  { id: 'tomato',   name: 'มะเขือเทศ',   emoji: '🍅', tier: 'common',    unlockLevel: 1,  seedCost: 120,   growMinutes: 60,   sellPrice: 320 },
  { id: 'corn',     name: 'ข้าวโพด',    emoji: '🌽', tier: 'common',    unlockLevel: 2,  seedCost: 400,   growMinutes: 360,  sellPrice: 1300 },
  { id: 'potato',   name: 'มันฝรั่ง',    emoji: '🥔', tier: 'common',    unlockLevel: 2,  seedCost: 1200,  growMinutes: 1440, sellPrice: 4200 },
  // ── Lv3–6: แรร์ (rare) ──
  { id: 'strawberry', name: 'สตรอว์เบอร์รี', emoji: '🍓', tier: 'rare',  unlockLevel: 3,  seedCost: 80,    growMinutes: 10,   sellPrice: 160 },
  { id: 'chili',    name: 'พริก',       emoji: '🌶️', tier: 'rare',      unlockLevel: 4,  seedCost: 300,   growMinutes: 120,  sellPrice: 800 },
  { id: 'eggplant', name: 'มะเขือ',     emoji: '🍆', tier: 'rare',      unlockLevel: 5,  seedCost: 900,   growMinutes: 480,  sellPrice: 2900 },
  { id: 'melon',    name: 'แตงโม',      emoji: '🍉', tier: 'rare',      unlockLevel: 6,  seedCost: 2500,  growMinutes: 2160, sellPrice: 9000 },
  // ── Lv7–10: อิพิค (epic) ──
  { id: 'mushroom', name: 'เห็ดวิเศษ',   emoji: '🍄', tier: 'epic',      unlockLevel: 7,  seedCost: 200,   growMinutes: 15,   sellPrice: 380 },
  { id: 'herb',     name: 'สมุนไพร',    emoji: '🌿', tier: 'epic',      unlockLevel: 8,  seedCost: 700,   growMinutes: 180,  sellPrice: 1900 },
  { id: 'ginseng',  name: 'โสม',        emoji: '🪴', tier: 'epic',      unlockLevel: 9,  seedCost: 2000,  growMinutes: 720,  sellPrice: 6800 },
  { id: 'pumpkin',  name: 'ฟักทองยักษ์', emoji: '🎃', tier: 'epic',     unlockLevel: 10, seedCost: 5000,  growMinutes: 2880, sellPrice: 20000 },
  // ── Lv11–12: ตำนาน (legendary) ──
  { id: 'glowflower', name: 'ดอกไม้เรืองแสง', emoji: '🌟', tier: 'legendary', unlockLevel: 11, seedCost: 600, growMinutes: 20, sellPrice: 1100 },
  { id: 'lotus',    name: 'บัวหลวง',    emoji: '🪷', tier: 'legendary', unlockLevel: 11, seedCost: 2000,  growMinutes: 240,  sellPrice: 5600, stages: ['🌱','🍃'] },
  { id: 'sunflower', name: 'ทานตะวันทอง', emoji: '🌻', tier: 'legendary', unlockLevel: 12, seedCost: 6000, growMinutes: 1440, sellPrice: 22000 },
  { id: 'moneytree', name: 'ต้นไม้เงินตรา', emoji: '🌳', tier: 'legendary', unlockLevel: 12, seedCost: 15000, growMinutes: 4320, sellPrice: 70000, stages: ['🌱','🌲'] },
]

const _byId = Object.fromEntries(CROPS.map(c => [c.id, c]))
export const getCrop = (id) => _byId[id] || null

/** Crops a player can plant at a given residence level (unlocked = unlockLevel ≤ level). */
export function cropsForLevel(level) {
  const lv = Number(level) || 1
  return CROPS.filter(c => c.unlockLevel <= lv)
}

/**
 * The next crop(s) waiting to unlock above `level`, or null if all unlocked.
 * Returns `{ level, crops }` for the soonest unlock tier (may be >1 crop).
 */
export function nextUnlock(level) {
  const lv = Number(level) || 1
  const upcoming = CROPS.filter(c => c.unlockLevel > lv)
  if (!upcoming.length) return null
  const at = Math.min(...upcoming.map(c => c.unlockLevel))
  return { level: at, crops: upcoming.filter(c => c.unlockLevel === at) }
}

/** Grow time (ms) for a seed — plain, no speed-ups. */
export const growMs = (seedId) => (getCrop(seedId)?.growMinutes || 0) * 60 * 1000

/** Human-readable grow time: "5 นาที" / "2 ชม." / "1.5 วัน". */
export function growLabel(crop) {
  const m = crop?.growMinutes || 0
  if (m < 60) return `${m} นาที`
  if (m < 1440) { const h = m / 60; return `${Number.isInteger(h) ? h : h.toFixed(1)} ชม.` }
  const d = m / 1440; return `${Number.isInteger(d) ? d : d.toFixed(1)} วัน`
}

// ════════════════════════════════════════════════════════════
//  ระยะการโต — แสดงผลล้วนๆ ไม่กระทบเวลาโต/ผลผลิต/ราคา
//  พืชเปลี่ยนภาพระหว่างรอ: ต้นอ่อน → ต้นโต → ผลจริง
//  พืชที่ระยะกลางแบบร่วมดูแปลก ใส่ `stages: ['a','b']` ทับรายตัวได้ในข้อมูลด้านบน
//  ⚠️ อีโมจิที่ใช้ต้องมีไฟล์ใน public/emoji/fluent/ ไม่งั้น <Emoji> จะ fallback
//     ไปใช้ฟอนต์เครื่อง (หน้าตาไม่ตรงกันแต่ละเครื่อง) — เพิ่มตัวใหม่ต้องรัน
//     `node scripts/fetch-fluent.mjs` (ต้องต่อเน็ต)
// ════════════════════════════════════════════════════════════

/** ระยะกลางที่ใช้ร่วมกันทุกพืช (ต้นอ่อน → ต้นโต) */
export const DEFAULT_STAGES = ['🌱', '🌿']

/** จุดตัดความคืบหน้าที่เปลี่ยนระยะ — ขอบเขตนับเข้าระยะถัดไป */
export const STAGE_CUTS = [0.33, 0.70]

/** อีโมจิที่ควรแสดงตามความคืบหน้า (0..1) · อินพุตพังแค่ไหนก็ไม่ throw */
export function stageEmoji(crop, progress) {
  if (!crop) return ''
  const n = Number(progress)
  const p = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
  if (p >= STAGE_CUTS[1]) return crop.emoji
  const own = Array.isArray(crop.stages) && crop.stages.length >= 2 ? crop.stages : DEFAULT_STAGES
  return p >= STAGE_CUTS[0] ? own[1] : own[0]
}
