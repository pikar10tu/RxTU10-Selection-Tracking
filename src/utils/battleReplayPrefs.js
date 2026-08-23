// battleReplayPrefs.js — preset ของ BattleReplay 2 แกนที่อิสระต่อกัน
//   แกน A (fx)   = ความอลังการของภาพ → ตอบคำถาม "แลคมั้ย" (กระทบต้นทุน GPU ล้วน)
//   แกน B (pace) = จังหวะ → ตอบคำถาม "สนุกมั้ย" (ไม่กระทบต้นทุนเลย)
// เก็บลง localStorage ของเครื่องนั้นเครื่องเดียว — ไม่แตะ config/app กัน user ทดสอบแล้วกระทบนักศึกษาที่กำลังเล่นอยู่

/** flags ทั้ง 5 ตัวต้องมีครบทุก preset — โค้ดที่อ่าน flag คาดหวัง boolean ไม่ใช่ undefined */
export const FX_PRESETS = {
  high: { cardLunge: true,  targetSquash: true,  screenShake: true,  burst: true, ko: true },
  mid:  { cardLunge: true,  targetSquash: false, screenShake: false, burst: true, ko: true },
  low:  { cardLunge: false, targetSquash: false, screenShake: false, burst: true, ko: true },
}

/** ใช้เมื่อเครื่องตั้ง prefers-reduced-motion — คงจังหวะ 4 ชั้นไว้ ตัดแต่การเคลื่อนไหว */
export const REDUCED_FLAGS = { cardLunge: false, targetSquash: false, screenShake: false, burst: false, ko: false }

export const PACE_PRESETS = { grand: 1.25, normal: 1, tight: 0.8 }

/** ⚠️ ค่าเริ่มต้นที่ส่งถึงนักศึกษาจริง — อัปเดตตรงนี้หลัง user เทสจอจริงผ่านพาเนล Admin แล้ว (§11.4 ของสเปก) */
export const DEFAULT_PREFS = { fx: 'high', pace: 'normal' }

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
    fx:   FX_PRESETS[o.fx] ? o.fx : DEFAULT_PREFS.fx,          // ตกกลับทีละฟิลด์ ไม่ทิ้งทั้งก้อน
    pace: PACE_PRESETS[o.pace] ? o.pace : DEFAULT_PREFS.pace,
  }
}

export function writePrefs(p, storage) {
  const next = {
    fx:   FX_PRESETS[p && p.fx] ? p.fx : DEFAULT_PREFS.fx,
    pace: PACE_PRESETS[p && p.pace] ? p.pace : DEFAULT_PREFS.pace,
  }
  const s = storage === undefined ? defaultStorage() : storage
  if (s) { try { s.setItem(KEY, JSON.stringify(next)) } catch { /* โควตาเต็ม/private mode — ใช้ค่าใน memory ต่อไป */ } }
  return next
}

export function fxFlags(name) { return { ...(FX_PRESETS[name] || FX_PRESETS[DEFAULT_PREFS.fx]) } }
export function paceMult(name) { return PACE_PRESETS[name] ?? PACE_PRESETS.normal }
