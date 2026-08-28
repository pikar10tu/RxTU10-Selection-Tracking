// battleReplayPrefs.js — preset ของ BattleReplay
//   แกน A (fx)    = ความอลังการของภาพ → ตอบคำถาม "แลคมั้ย" (กระทบต้นทุน GPU ล้วน)
//   แกน B (pace)  = จังหวะ → ตอบคำถาม "สนุกมั้ย" (ไม่กระทบต้นทุนเลย)
//   legacyBeats   = สวิตช์กู้ "จังหวะเดิม 4 ชั้น" ไว้เทียบรสนิยม 1 รอบ (ดู §6 ของสเปก)
// เก็บลง localStorage ของเครื่องนั้นเครื่องเดียว — ไม่แตะ config/app กัน user ทดสอบแล้วกระทบนักศึกษาที่กำลังเล่นอยู่
//
// ⚠️ 28 ส.ค. 2026 แกน C (ท่าชน A/B/C/D) ถูกลบ — ตอนนี้มีท่าเดียว (ดู battleMotion.js LUNGE)
//    user สั่งว่าการ์ดทุกใบต้องขยับพอๆ กัน การมีหลายท่าให้เลือกจึงไม่มีความหมายอีกต่อไป

/** flags ทั้ง 5 ตัวต้องมีครบทุก preset — โค้ดที่อ่าน flag คาดหวัง boolean ไม่ใช่ undefined */
export const FX_PRESETS = {
  high: { cardLunge: true,  targetSquash: true,  screenShake: true,  burst: true, ko: true },
  mid:  { cardLunge: true,  targetSquash: false, screenShake: false, burst: true, ko: true },
  low:  { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true },
}

/** ใช้เมื่อ prefersReducedMotion() = true — คงจังหวะไว้ ตัดแต่การเคลื่อนไหว
 *  (28 ส.ค. 2026 bypass ทั้งเว็บแล้ว → ปกติไม่ถูกใช้ เหลือไว้เผื่อเปิดกลับ ดู utils/motionPref.js) */
export const REDUCED_FLAGS = { cardLunge: false, targetSquash: false, screenShake: false, burst: false, ko: false }

export const PACE_PRESETS = { grand: 1.25, normal: 1, tight: 0.8 }

/** ป้ายภาษาไทย — ทั้งพาเนล Admin และป้ายมุมจอในไฟต์ทดสอบต้องใช้ชุดเดียวกัน */
export const FX_LABEL = { high: 'สวยสุด', mid: 'กลาง', low: 'เบา' }
export const PACE_LABEL = { grand: 'อลังการ', normal: 'กลาง', tight: 'กระชับ' }

/** ⚠️ ค่าเริ่มต้นที่ส่งถึงนักศึกษาจริง — legacyBeats: false = ทุกคนได้จังหวะใหม่ */
export const DEFAULT_PREFS = { fx: 'high', pace: 'normal', legacyBeats: false }

const KEY = 'rxtu10.battleReplayPrefs'

function defaultStorage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function readPrefs(storage) {
  const s = storage === undefined ? defaultStorage() : storage
  if (!s) return { ...DEFAULT_PREFS }
  let raw = null
  try { raw = s.getItem(KEY) } catch { return { ...DEFAULT_PREFS } }
  if (!raw) return { ...DEFAULT_PREFS }
  let o = null
  try { o = JSON.parse(raw) } catch { return { ...DEFAULT_PREFS } }
  if (!o || typeof o !== 'object') return { ...DEFAULT_PREFS }
  return {
    fx:    FX_PRESETS[o.fx] ? o.fx : DEFAULT_PREFS.fx,          // ตกกลับทีละฟิลด์ ไม่ทิ้งทั้งก้อน
    pace:  PACE_PRESETS[o.pace] ? o.pace : DEFAULT_PREFS.pace,
    legacyBeats: o.legacyBeats === true,
  }
}

export function writePrefs(p, storage) {
  const next = {
    fx:    FX_PRESETS[p && p.fx] ? p.fx : DEFAULT_PREFS.fx,
    pace:  PACE_PRESETS[p && p.pace] ? p.pace : DEFAULT_PREFS.pace,
    legacyBeats: !!(p && p.legacyBeats),
  }
  const s = storage === undefined ? defaultStorage() : storage
  if (s) { try { s.setItem(KEY, JSON.stringify(next)) } catch { /* โควตาเต็ม/private mode — ใช้ค่าใน memory ต่อไป */ } }
  return next
}

export function fxFlags(name) { return { ...(FX_PRESETS[name] || FX_PRESETS[DEFAULT_PREFS.fx]) } }
export function paceMult(name) { return PACE_PRESETS[name] ?? PACE_PRESETS.normal }
